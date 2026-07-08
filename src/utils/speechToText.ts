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
  stop: () => Promise<void>;
};

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
  onChunk: (chunk: SpeechToTextChunk) => void;
  onError?: (message: string) => void;
  /** If true, web recognition re-starts automatically while still recording. */
  restartOnEnd?: boolean;
}): Promise<SpeechToTextSession> {
  const language = params.language ?? 'en-US';

  if (Capacitor.isNativePlatform()) {
    const available = await SpeechRecognition.available().catch(() => ({ available: false }));
    if (!available.available) {
      params.onError?.('Speech-to-Text is not available on this device.');
      return { stop: async () => undefined };
    }

    const perm = await SpeechRecognition.checkPermissions().catch(() => ({ speechRecognition: 'prompt' as const }));
    if (perm.speechRecognition !== 'granted') {
      const requested = await SpeechRecognition.requestPermissions().catch(() => ({ speechRecognition: 'denied' as const }));
      if (requested.speechRecognition !== 'granted') {
        params.onError?.('Microphone/Speech permission denied.');
        return { stop: async () => undefined };
      }
    }

    const partial = await SpeechRecognition.addListener('partialResults', (data: { matches?: string[] }) => {
      const text = (data.matches?.[0] ?? '').trim();
      if (!text) return;
      params.onChunk({ text, isFinal: false });
    });

    const listening = await SpeechRecognition.addListener('listeningState', (data: { status: 'started' | 'stopped' }) => {
      if (data.status === 'stopped') {
        // Promote the latest partial to final on stop (Android often only gives partials).
        // We cannot reliably emit true finals without a dedicated final-result event.
      }
    });

    await SpeechRecognition.start({
      language,
      popup: false,
      partialResults: true,
      maxResults: 3,
    });

    return {
      stop: async () => {
        await partial.remove().catch(() => undefined);
        await listening.remove().catch(() => undefined);
        await SpeechRecognition.stop().catch(() => undefined);
      },
    };
  }

  const support = speechToTextIsSupported();
  if (!support.supported) {
    params.onError?.(support.reason || 'Speech-to-Text is not supported.');
    return { stop: async () => undefined };
  }

  const win = window as BrowserSpeechRecognitionWindow;
  const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
  if (!Ctor) return { stop: async () => undefined };

  const recognition = new Ctor();
  recognition.lang = language;
  recognition.continuous = true;
  recognition.interimResults = true;

  let stopping = false;

  recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const chunk = event.results[i][0]?.transcript ?? '';
      if (event.results[i].isFinal) {
        const text = chunk.trim();
        if (text) params.onChunk({ text, isFinal: true });
      } else {
        interim += chunk;
      }
    }
    const t = interim.trim();
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
    return { stop: async () => undefined };
  }

  return {
    stop: async () => {
      stopping = true;
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    },
  };
}

