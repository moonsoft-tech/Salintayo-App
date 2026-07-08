/**
 * TTS wrapper.
 *
 * - Prefers Camb AI TTS (network) when `VITE_CAMB_API_KEY` is configured.
 * - Falls back to native Capacitor TTS on device, then browser SpeechSynthesis on web.
 *
 * We keep the same exported API (`speakText`, `cancelSpeech`) so callers don't change.
 */
import { Capacitor } from '@capacitor/core';
import { QueueStrategy, TextToSpeech } from '@capacitor-community/text-to-speech';
import { getResolvedDialectLangCode, QCB_DIALECT_LANG_STORAGE_KEY, DIALECT_LANG_STORAGE_KEY } from './dialectPreference';

type DialectCode = string;

const CAMB_API_KEY = (import.meta.env.VITE_CAMB_API_KEY as string | undefined) ?? '';
const CAMB_TTS_VOICE_ID = Number(import.meta.env.VITE_CAMB_TTS_VOICE_ID ?? '') || 170787;
const CAMB_TTS_URL = 'https://client.camb.ai/apis/tts-stream';

const LANG_LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  fil: 'fil-PH',
  ceb: 'ceb-PH',
  ilo: 'ilo-PH',
  hil: 'hil-PH',
  war: 'war-PH',
  bik: 'bik-PH',
  pam: 'pam-PH',
  pag: 'pag-PH',
  tsg: 'tsg-PH',
};

function getDialectCodeForTts(): DialectCode {
  try {
    const code =
      localStorage.getItem(QCB_DIALECT_LANG_STORAGE_KEY) ??
      localStorage.getItem(DIALECT_LANG_STORAGE_KEY) ??
      getResolvedDialectLangCode();
    return (code || '').trim().toLowerCase() || 'en';
  } catch {
    return 'en';
  }
}

export function getTtsLocale(): string {
  // Legacy name: returned value is used as a "locale" for non-Camb fallbacks.
  const code = getDialectCodeForTts();
  return LANG_LOCALE_MAP[code] ?? 'en-US';
}

interface DialectRule {
  pattern: string;
  replacement: string;
}

const DIALECT_RULES: Record<string, DialectRule[]> = {
  // Avoid aggressive phoneme "hacks" (e.g. r→l) — they often reduce fluency/accuracy.
  // Keep rules minimal and only where we know it improves Camb pronunciation for that dialect.
  fil: [],
  ceb: [],
  ilo: [],
  hil: [
    { pattern: '\\bnakaon ka na\\b', replacement: 'na-kaon ka na' },
    { pattern: '\\bnakaon ka\\b', replacement: 'na-kaon ka' },
    { pattern: '\\bnakaon\\b', replacement: 'na-kaon' },
    { pattern: '\\bkaon\\b', replacement: 'ka-on' },
    { pattern: '\\bpa ka\\b', replacement: 'pa ka' },
    { pattern: '\\bna ka na\\b', replacement: 'naka na' },
    { pattern: '\\bnakayon\\b', replacement: 'nakaon' },
    { pattern: '\\bpatay\\b', replacement: 'pati' },
  ],
  pag: [],
  en: [],
};

function getDialectRules(code: string): DialectRule[] {
  const normalized = (code || '').trim().toLowerCase();
  return DIALECT_RULES[normalized] ?? DIALECT_RULES['fil'];
}

function applyDialectTransform(text: string, rules: DialectRule[]): string {
  return rules.reduce((current, rule) => {
    try {
      return current.replace(new RegExp(rule.pattern, 'gi'), rule.replacement);
    } catch {
      return current;
    }
  }, text);
}

let cambAbort: AbortController | null = null;
let cambAudioEl: HTMLAudioElement | null = null;
let cambAudioUrl: string | null = null;

const DIALECT_LABEL: Record<string, string> = {
  en: 'English',
  fil: 'Filipino/Tagalog',
  ceb: 'Cebuano',
  ilo: 'Ilocano',
  hil: 'Hiligaynon',
  war: 'Waray',
  bik: 'Bicolano',
  pam: 'Kapampangan',
  pag: 'Pangasinan',
  tsg: 'Tausug',
};

function pickVoiceForLocale(locale: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const normalizedLocale = locale.toLowerCase();
  const localeBase = normalizedLocale.split('-')[0];
  const qualityHints = VOICE_QUALITY_HINTS[locale] ?? [];

  const scored = voices
    .map((voice) => {
      const voiceLang = voice.lang?.toLowerCase() ?? '';
      const voiceName = voice.name?.toLowerCase() ?? '';
      let score = 0;

      if (voiceLang === normalizedLocale) score += 120;
      if (voiceLang.startsWith(`${localeBase}-`)) score += 80;
      if (voiceLang === 'fil-ph') score += 70;
      if (voiceLang === 'en-ph') score += 60;
      if (voiceLang.startsWith('fil')) score += 50;
      if (voiceLang.startsWith('en')) score += 20;
      if (voice.localService) score += 10;
      if (voice.default) score += 5;

      for (const hint of qualityHints) {
        if (voiceName.includes(hint)) {
          score += 30;
          break;
        }
      }

      return { voice, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.score > 0 ? scored[0].voice : null;
}

const WEB_LOCALE_FALLBACKS: Record<string, string[]> = {
  'ceb-PH': ['fil-PH', 'en-PH', 'en-US'],
  'ilo-PH': ['fil-PH', 'en-PH', 'en-US'],
  'hil-PH': ['fil-PH', 'en-PH', 'en-US'],
  'war-PH': ['fil-PH', 'en-PH', 'en-US'],
  'bik-PH': ['fil-PH', 'en-PH', 'en-US'],
  'pam-PH': ['fil-PH', 'en-PH', 'en-US'],
  'pag-PH': ['fil-PH', 'en-PH', 'en-US'],
  'tsg-PH': ['fil-PH', 'en-PH', 'en-US'],
};

/**
 * Heuristic hints for fluent/common high-quality voices across platforms.
 * We prefer exact locale first, then quality Philippine-friendly voices.
 */
const VOICE_QUALITY_HINTS: Record<string, string[]> = {
  'fil-PH': ['filipino', 'tagalog', 'rosa', 'angeli', 'maria', 'google'],
  'ceb-PH': ['filipino', 'tagalog', 'rosa', 'angeli', 'maria', 'google'],
  'ilo-PH': ['filipino', 'tagalog', 'rosa', 'angeli', 'maria', 'google'],
  'hil-PH': ['filipino', 'tagalog', 'rosa', 'angeli', 'maria', 'google'],
  'war-PH': ['filipino', 'tagalog', 'rosa', 'angeli', 'maria', 'google'],
  'bik-PH': ['filipino', 'tagalog', 'rosa', 'angeli', 'maria', 'google'],
  'pam-PH': ['filipino', 'tagalog', 'rosa', 'angeli', 'maria', 'google'],
  'pag-PH': ['filipino', 'tagalog', 'rosa', 'angeli', 'maria', 'google'],
  'tsg-PH': ['filipino', 'tagalog', 'rosa', 'angeli', 'maria', 'google'],
  'en-PH': ['philippines', 'english', 'google'],
  'en-US': ['english', 'google'],
};

async function resolveNativeLocale(locale: string): Promise<string> {
  try {
    const { supported } = await TextToSpeech.isLanguageSupported({ lang: locale });
    if (supported) return locale;
  } catch {
    // Fall back to safe defaults below.
  }

  const fallbacks = WEB_LOCALE_FALLBACKS[locale] ?? ['en-US'];
  for (const fallback of fallbacks) {
    try {
      const { supported } = await TextToSpeech.isLanguageSupported({ lang: fallback });
      if (supported) return fallback;
    } catch {
      // Continue trying next fallback.
    }
  }
  return 'en-US';
}

async function speakNativeText(text: string, locale: string): Promise<void> {
  const lang = await resolveNativeLocale(locale);
  await TextToSpeech.stop().catch(() => undefined);
  await TextToSpeech.speak({
    text,
    lang,
    rate: 0.92,
    pitch: 1,
    volume: 1,
    queueStrategy: QueueStrategy.Flush,
  });
}

export interface SpeakTextOptions {
  onEnd?: () => void;
  onError?: () => void;
}

/** Speaks plain text; cancels any in-flight utterance first. */
export function speakText(text: string, options?: SpeakTextOptions): void {
  const trimmed = text.trim();
  if (!trimmed) {
    options?.onEnd?.();
    return;
  }

  // Prefer Camb if configured (works in web and native WebView).
  if (CAMB_API_KEY) {
    cancelSpeech();
    const code = getDialectCodeForTts();
    const rules = getDialectRules(code);
    const transformedText = applyDialectTransform(trimmed, rules);
    const voiceId = CAMB_TTS_VOICE_ID;
    const language = (import.meta.env.VITE_CAMB_TTS_LANGUAGE as string | undefined) ?? 'en-us';
    const dialectLabel = DIALECT_LABEL[code] ?? code.toUpperCase();

    cambAbort = new AbortController();
    const signal = cambAbort.signal;

    void (async () => {
      try {
        const requestBody = {
          text: transformedText,
          voice_id: voiceId,
          language,
          // Use the instruct model so we can steer accent + pronunciation.
          speech_model: 'mars-instruct',
          user_instructions: `Speak naturally and fluently with a Philippine accent suitable for ${dialectLabel}. Pronounce Filipino-language words correctly. Keep an educational, friendly tutor voice. Avoid robotic pacing.`,
          output_configuration: { format: 'wav' },
          enhance_named_entities_pronunciation: true,
          voice_settings: {
            enhance_reference_audio_quality: false,
            maintain_source_accent: false,
            speaking_rate: 0.95,
            apply_ref_loudness_norm: false,
          },
          inference_options: {
            temperature: 0.55,
            inference_steps: 60,
            speaker_similarity: 0.7,
            stability: 0.75,
            acoustic_quality_boost: false,
          },
        };

        const response = await fetch(CAMB_TTS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': CAMB_API_KEY,
          },
          body: JSON.stringify(requestBody),
          signal,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          throw new Error(`Camb TTS HTTP ${response.status}: ${errorText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        if (!arrayBuffer) throw new Error('Unexpected Camb TTS response');

        const audioBlob = new Blob([arrayBuffer], { type: 'audio/wav' });
        cambAudioUrl = URL.createObjectURL(audioBlob);
        cambAudioEl = new Audio(cambAudioUrl);

        cambAudioEl.onended = () => {
          if (cambAudioUrl) URL.revokeObjectURL(cambAudioUrl);
          cambAudioUrl = null;
          cambAudioEl = null;
          cambAbort = null;
          options?.onEnd?.();
        };
        cambAudioEl.onerror = () => {
          if (cambAudioUrl) URL.revokeObjectURL(cambAudioUrl);
          cambAudioUrl = null;
          cambAudioEl = null;
          cambAbort = null;
          options?.onError?.();
        };

        await cambAudioEl.play();
      } catch (err) {
        if (signal.aborted) return;
        console.error('Camb TTS error:', err);
        cambAbort = null;
        cambAudioEl = null;
        if (cambAudioUrl) URL.revokeObjectURL(cambAudioUrl);
        cambAudioUrl = null;
        // Camb failed — fall back to native/web TTS so the user still gets audio.
        try {
          const locale = getTtsLocale();
          if (Capacitor.isNativePlatform()) {
            await speakNativeText(trimmed, locale);
            options?.onEnd?.();
            return;
          }
          if (typeof window === 'undefined' || !window.speechSynthesis) {
            options?.onEnd?.();
            return;
          }
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(trimmed);
          utter.lang = locale;
          utter.rate = 0.92;
          utter.pitch = 1;
          utter.onend = () => options?.onEnd?.();
          utter.onerror = () => options?.onError?.();
          window.speechSynthesis.speak(utter);
        } catch {
          options?.onError?.();
        }
      }
    })();
    return;
  }

  const locale = getTtsLocale();
  if (Capacitor.isNativePlatform()) {
    void speakNativeText(trimmed, locale)
      .then(() => options?.onEnd?.())
      .catch(() => options?.onError?.());
    return;
  }

  if (typeof window === 'undefined' || !window.speechSynthesis) {
    options?.onEnd?.();
    return;
  }

  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(trimmed);
  utter.lang = locale;
  utter.rate = 0.92;
  utter.pitch = 1;

  const webFallbackLocales = [locale, ...(WEB_LOCALE_FALLBACKS[locale] ?? ['en-US'])];
  const match = webFallbackLocales.map((l) => pickVoiceForLocale(l)).find(Boolean) ?? null;
  if (match) utter.voice = match;
  utter.onend = () => options?.onEnd?.();
  utter.onerror = () => options?.onError?.();
  window.speechSynthesis.speak(utter);
}

export function cancelSpeech(): void {
  try {
    cambAbort?.abort();
  } catch {
    /* ignore */
  }
  cambAbort = null;
  if (cambAudioEl) {
    try {
      cambAudioEl.pause();
    } catch {
      /* ignore */
    }
    cambAudioEl = null;
  }
  if (cambAudioUrl) {
    try {
      URL.revokeObjectURL(cambAudioUrl);
    } catch {
      /* ignore */
    }
    cambAudioUrl = null;
  }

  if (Capacitor.isNativePlatform()) {
    void TextToSpeech.stop().catch(() => undefined);
    return;
  }
  window.speechSynthesis?.cancel();
}
