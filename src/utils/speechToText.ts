import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

export type SpeechToTextChunk = {
  text: string;
  isFinal: boolean;
};

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript?: string }> & { isFinal?: boolean }>;
};

type BrowserSpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
};

export type SpeechToTextSession = {
  /** Stops recognition and returns the best transcript captured. Never hangs forever. */
  stop: () => Promise<string>;
  getTranscript: () => string;
};

/** Serialize native STT sessions so stop/start never overlap and brick the mic. */
let nativeQueue: Promise<unknown> = Promise.resolve();

function enqueueNative<T>(fn: () => Promise<T>): Promise<T> {
  const run = nativeQueue.then(fn, fn);
  nativeQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(undefined), ms);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        window.clearTimeout(timer);
        resolve(undefined);
      });
  });
}

function normalizeRepeatedSpeech(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const words = cleaned.split(' ');
  if (words.length >= 2 && words.length % 2 === 0) {
    const mid = words.length / 2;
    const first = words.slice(0, mid).join(' ');
    const second = words.slice(mid).join(' ');
    if (first.toLowerCase() === second.toLowerCase()) return first;
  }
  return cleaned.replace(/\b(\w+)(?:\s+\1)+\b/gi, '$1');
}

async function forceStopNative(timeoutMs = 900): Promise<void> {
  await withTimeout(SpeechRecognition.stop().then(() => undefined), timeoutMs);
  // Let Android SpeechRecognizer fully release the mic before the next start.
  await new Promise((r) => window.setTimeout(r, 250));
}

export function speechToTextIsSupported(): { supported: boolean; reason?: string } {
  if (Capacitor.isNativePlatform()) return { supported: true };

  const isLocalhost =
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.hostname === '[::1]';
  const secureOk = (window as Window & { isSecureContext?: boolean }).isSecureContext || isLocalhost;
  if (!secureOk) return { supported: false, reason: 'Speech-to-Text requires HTTPS.' };

  const win = window as BrowserSpeechRecognitionWindow;
  const ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
  if (!ctor) return { supported: false, reason: 'Speech-to-Text is not supported in this browser.' };

  return { supported: true };
}

export async function startSpeechToText(params: {
  language?: string;
  /** Extra language fallbacks after `language` (native only). */
  languageFallbacks?: string[];
  onChunk: (chunk: SpeechToTextChunk) => void;
  onError?: (message: string) => void;
  /** If true, web recognition re-starts automatically while still recording. */
  restartOnEnd?: boolean;
}): Promise<SpeechToTextSession> {
  const primaryLanguage = params.language ?? 'en-US';

  if (Capacitor.isNativePlatform()) {
    return enqueueNative(async () => {
      let latest = '';
      let committed = '';
      let partialHandle: { remove: () => Promise<void> } | null = null;
      let listeningHandle: { remove: () => Promise<void> } | null = null;
      let started = false;
      let stopping = false;
      let activeLanguage = primaryLanguage;
      let startOpts = {
        language: primaryLanguage,
        popup: false as const,
        partialResults: true,
        maxResults: 5,
      };

      const emit = (raw: string, isFinal: boolean) => {
        const text = normalizeRepeatedSpeech(raw);
        if (!text) return;
        // Append new utterance after a restart so Chat can capture multi-phrase input.
        latest = committed ? normalizeRepeatedSpeech(`${committed} ${text}`) : text;
        if (isFinal) committed = latest;
        params.onChunk({ text: latest, isFinal });
      };

      const startNativeRecognition = async (language: string) => {
        activeLanguage = language;
        startOpts = {
          language,
          popup: false,
          partialResults: true,
          maxResults: 5,
        };
        await SpeechRecognition.start(startOpts);
      };

      try {
        // Always idle the engine first — a hung previous stop bricks later sessions.
        await forceStopNative();

        const available = await SpeechRecognition.available().catch(() => ({ available: false }));
        if (!available.available) {
          params.onError?.('Speech-to-Text is not available on this device.');
          return {
            getTranscript: () => '',
            stop: async () => '',
          };
        }

        const perm = await SpeechRecognition.checkPermissions().catch(() => ({
          speechRecognition: 'prompt' as const,
        }));
        if (perm.speechRecognition !== 'granted') {
          const requested = await SpeechRecognition.requestPermissions().catch(() => ({
            speechRecognition: 'denied' as const,
          }));
          if (requested.speechRecognition !== 'granted') {
            params.onError?.('Microphone/Speech permission denied.');
            return {
              getTranscript: () => '',
              stop: async () => '',
            };
          }
        }

        partialHandle = await SpeechRecognition.addListener(
          'partialResults',
          (data: { matches?: string[] }) => {
            const text = (data.matches?.[0] ?? '').trim();
            if (text) emit(text, false);
          }
        );

        listeningHandle = await SpeechRecognition.addListener(
          'listeningState',
          (data: { status: 'started' | 'stopped' }) => {
            if (data.status !== 'stopped' || stopping || !params.restartOnEnd) return;
            // Android ends listening after silence / one utterance. Restart for Chat.
            if (latest) committed = latest;
            window.setTimeout(() => {
              if (stopping) return;
              void startNativeRecognition(activeLanguage).catch(() => undefined);
            }, 250);
          }
        );

        const languages = Array.from(
          new Set(
            [primaryLanguage, ...(params.languageFallbacks ?? []), 'en-US', 'fil-PH'].filter(Boolean)
          )
        );

        let lastError: unknown;
        for (const language of languages) {
          try {
            await startNativeRecognition(language);
            started = true;
            lastError = undefined;
            break;
          } catch (err) {
            lastError = err;
            await forceStopNative(500);
          }
        }

        if (!started) {
          params.onError?.(
            lastError instanceof Error
              ? lastError.message
              : 'Could not start Speech-to-Text on this device.'
          );
          await partialHandle.remove().catch(() => undefined);
          await listeningHandle.remove().catch(() => undefined);
          return {
            getTranscript: () => '',
            stop: async () => '',
          };
        }
      } catch (err) {
        params.onError?.(
          err instanceof Error ? err.message : 'Could not start Speech-to-Text on this device.'
        );
        if (partialHandle) await partialHandle.remove().catch(() => undefined);
        if (listeningHandle) await listeningHandle.remove().catch(() => undefined);
        return {
          getTranscript: () => latest,
          stop: async () => latest,
        };
      }

      return {
        getTranscript: () => latest,
        stop: async () => {
          stopping = true;
          return enqueueNative(async () => {
            // Keep listeners briefly so the final hypothesis can still arrive.
            await forceStopNative(1000);
            await new Promise((r) => window.setTimeout(r, 300));
            if (partialHandle) await partialHandle.remove().catch(() => undefined);
            if (listeningHandle) await listeningHandle.remove().catch(() => undefined);
            partialHandle = null;
            listeningHandle = null;
            return latest;
          });
        },
      };
    });
  }

  const support = speechToTextIsSupported();
  if (!support.supported) {
    params.onError?.(support.reason || 'Speech-to-Text is not supported.');
    return {
      getTranscript: () => '',
      stop: async () => '',
    };
  }

  const win = window as BrowserSpeechRecognitionWindow;
  const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
  if (!Ctor) {
    return {
      getTranscript: () => '',
      stop: async () => '',
    };
  }

  const recognition = new Ctor();
  recognition.lang = primaryLanguage;
  recognition.continuous = true;
  recognition.interimResults = true;

  let stopping = false;
  let finalText = '';
  let interimText = '';

  const combined = () => normalizeRepeatedSpeech(`${finalText} ${interimText}`.trim());

  recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const chunk = event.results[i][0]?.transcript ?? '';
      if (event.results[i].isFinal) {
        const text = chunk.trim();
        if (text) {
          finalText = `${finalText} ${text}`.trim();
          params.onChunk({ text: normalizeRepeatedSpeech(finalText), isFinal: true });
        }
      } else {
        interim += chunk;
      }
    }
    interimText = interim.trim();
    const t = combined();
    if (t) params.onChunk({ text: t, isFinal: false });
  };

  recognition.onerror = (event: Event) => {
    const maybeAny = event as unknown as { error?: string };
    const code = (maybeAny?.error ?? '').toString();
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      params.onError?.('Microphone permission denied for Speech-to-Text.');
    } else if (code === 'audio-capture') {
      params.onError?.('No microphone found or microphone is busy.');
    } else if (code === 'network') {
      params.onError?.('Speech-to-Text network error. Please try again.');
    } else if (code && code !== 'no-speech') {
      params.onError?.(`Speech-to-Text error: ${code}`);
    }
  };

  recognition.onend = () => {
    if (!stopping && params.restartOnEnd) {
      try {
        recognition.start();
      } catch {
        // ignore
      }
    }
  };

  try {
    recognition.start();
  } catch {
    params.onError?.('Could not start Speech-to-Text.');
    return {
      getTranscript: () => '',
      stop: async () => '',
    };
  }

  return {
    getTranscript: () => combined(),
    stop: async () => {
      stopping = true;
      try {
        recognition.stop();
      } catch {
        // ignore
      }
      await new Promise((r) => window.setTimeout(r, 200));
      return combined();
    },
  };
}
