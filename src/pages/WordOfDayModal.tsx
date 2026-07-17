import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { IonIcon } from '@ionic/react';
import {
  closeOutline,
  volumeHighOutline,
  micOutline,
  stopOutline,
  refreshOutline,
  checkmarkCircle,
  alertCircleOutline,
} from 'ionicons/icons';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firebaseAuth, firebaseDb } from '../firebase';
import { speakText, cancelSpeech } from '../utils/tts';
import { transcribeWhisper, chatWithDeepSeek, type DeepSeekMessage } from '../utils/api';
import { startSpeechToText, type SpeechToTextSession } from '../utils/speechToText';
import './WordOfDayModal.css';

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */
interface WordEntry {
  word: string;
  meaning: string;
  exampleSentence?: string;
}

interface WordOfDayHistoryDoc {
  dialect: string;
  word: string;
  score: number;
  timestamp: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  dialectId: string;
  dialectName: string;
  accentColor?: string;
  /** Called with the score (0-100) once the user finishes today's word. */
  onComplete?: (score: number) => void;
}

type Stage = 'loading' | 'ready' | 'recording' | 'processing' | 'result' | 'error' | 'already-done';

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

/** Returns today's date key, e.g. "2026-07-09". Local device date is fine here. */
function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

const WOD_CACHE_KEY_PREFIX = 'salintayo_wod_ai_cache';

/** Reads today's already-generated word for this dialect from localStorage, if any. */
function loadCachedWord(dialectId: string, dateKey: string): WordEntry | null {
  try {
    const raw = localStorage.getItem(`${WOD_CACHE_KEY_PREFIX}_${dialectId}_${dateKey}`);
    return raw ? (JSON.parse(raw) as WordEntry) : null;
  } catch {
    return null;
  }
}

function cacheWord(dialectId: string, dateKey: string, entry: WordEntry): void {
  try {
    localStorage.setItem(`${WOD_CACHE_KEY_PREFIX}_${dialectId}_${dateKey}`, JSON.stringify(entry));
  } catch { /* ignore */ }
}

/** Asks the AI for a fresh, beginner-friendly Word of the Day for this dialect. */
async function generateWordOfDayViaAI(dialectId: string, dialectName: string): Promise<WordEntry> {
  const systemPrompt = `You are a Philippine dialect tutor generating a "Word of the Day" for a pronunciation-practice feature.
Generate ONE common, useful, beginner-friendly word or short phrase in the ${dialectName} dialect (dialect code: ${dialectId}).
Avoid obscure, offensive, or overly complex words — pick something a beginner would realistically use in everyday conversation.
Return ONLY valid JSON, no markdown fences, no extra text, in this exact shape:
{ "word": "...", "meaning": "short English meaning", "exampleSentence": "a simple example sentence using the word" }`;

  const userPrompt = `Give me today's Word of the Day for ${dialectName}. Pick something different from the obvious, commonly-repeated examples, and make sure it's appropriate for a beginner learner.`;

  const messages: DeepSeekMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const rawText = await chatWithDeepSeek(messages);
  const cleaned = rawText.replace(/```json|```/gi, '').trim();
  const parsed = JSON.parse(cleaned) as { word?: string; meaning?: string; exampleSentence?: string };
  if (!parsed?.word) throw new Error('AI did not return a valid word.');

  return {
    word: String(parsed.word),
    meaning: String(parsed.meaning ?? ''),
    exampleSentence: parsed.exampleSentence ? String(parsed.exampleSentence) : undefined,
  };
}

/** Returns today's word for this dialect — from cache if already generated today, otherwise fresh from the AI. */
async function getOrGenerateWordOfDay(dialectId: string, dialectName: string): Promise<WordEntry> {
  const dateKey = todayKey();
  const cached = loadCachedWord(dialectId, dateKey);
  if (cached) return cached;
  const generated = await generateWordOfDayViaAI(dialectId, dialectName);
  cacheWord(dialectId, dateKey, generated);
  return generated;
}

/** Normalizes text for comparison: lowercase, strip punctuation/diacritics/extra spaces. */
function normalizeForCompare(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Classic Levenshtein edit distance. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = new Array(n + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

/** Rough similarity score 0-100 between the spoken transcript and the target word. */
function scorePronunciation(target: string, transcript: string): number {
  const t = normalizeForCompare(target);
  const s = normalizeForCompare(transcript);
  if (!s) return 0;
  if (s.includes(t) || t.includes(s)) return 100;
  const dist = levenshtein(t, s);
  const maxLen = Math.max(t.length, s.length) || 1;
  const raw = (1 - dist / maxLen) * 100;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function feedbackForScore(score: number): string {
  if (score >= 85) return 'Excellent! That sounded very close. 🎉';
  if (score >= 60) return 'Good try — pretty close! Keep practicing.';
  if (score >= 30) return 'Getting there. Listen again and try once more.';
  return "Didn't quite catch that — give it another shot.";
}

function pickSupportedAudioMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

/** Prefer en-US (most reliable on Android). Fallbacks cover Filipino packs when available. */
function speechLangForDialect(dialectId: string): { primary: string; fallbacks: string[] } {
  const id = (dialectId || '').trim().toLowerCase();
  if (id === 'en' || id === 'english') {
    return { primary: 'en-US', fallbacks: [] };
  }
  // Use English recognizer first — many phones lack fil-PH offline pack.
  return { primary: 'en-US', fallbacks: ['fil-PH', 'tl-PH'] };
}

/** Collapse exact doubled phrases / immediate word repeats from Android STT. */
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

/* ═══════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════ */
const WordOfDayModal: React.FC<Props> = ({
  isOpen,
  onClose,
  dialectId,
  dialectName,
  accentColor = '#0047ab',
  onComplete,
}) => {
  const [stage, setStage] = useState<Stage>('loading');
  const [wordEntry, setWordEntry] = useState<WordEntry | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [score, setScore] = useState<number | null>(null);
  const [transcript, setTranscript] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speechSessionRef = useRef<SpeechToTextSession | null>(null);
  const latestTranscriptRef = useRef('');
  const usingNativeSttRef = useRef(false);
  const stopInFlightRef = useRef(false);

  /* ── Load today's word (and check if already completed) whenever the modal opens ── */
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const load = async () => {
      setStage('loading');
      setErrorMsg('');
      setScore(null);
      setTranscript('');

      try {
        const user = firebaseAuth.currentUser;
        const dateKey = todayKey();

        // 1) Check if the user already completed today's word for this dialect.
        if (user) {
          const historySnap = await getDoc(
            doc(firebaseDb, 'users', user.uid, 'wordOfDayHistory', dateKey)
          );
          if (historySnap.exists()) {
            const data = historySnap.data() as WordOfDayHistoryDoc;
            if (data.dialect === dialectId) {
              if (cancelled) return;
              setWordEntry({ word: data.word, meaning: '' });
              setScore(data.score);
              setStage('already-done');
              return;
            }
          }
        }

        // 2) Get (or generate) today's word for this dialect via AI.
        const picked = await getOrGenerateWordOfDay(dialectId, dialectName);
        if (cancelled) return;
        setWordEntry(picked);
        setStage('ready');
      } catch (e: unknown) {
        if (cancelled) return;
        setErrorMsg(e instanceof Error ? e.message : 'Failed to load Word of the Day.');
        setStage('error');
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [isOpen, dialectId, dialectName]);

  /* ── Cleanup on close ── */
  useEffect(() => {
    if (!isOpen) {
      cancelSpeech();
      stopMediaTracks();
      void speechSessionRef.current?.stop().catch(() => undefined);
      speechSessionRef.current = null;
      latestTranscriptRef.current = '';
      usingNativeSttRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingSeconds(0);
      setIsSpeaking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const stopMediaTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const handlePlayReference = useCallback(() => {
    if (!wordEntry) return;
    setIsSpeaking(true);
    speakText(wordEntry.word, {
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }, [wordEntry]);

  const scoreAndFinish = async (heardRaw: string) => {
    if (!wordEntry) {
      setErrorMsg('Word of the Day is not ready yet. Please close and try again.');
      setStage('error');
      return;
    }
    const heardText = normalizeRepeatedSpeech(heardRaw);
    if (!heardText) {
      setErrorMsg('Could not detect speech from your recording. Please try again.');
      setStage('error');
      return;
    }
    setTranscript(heardText);
    const finalScore = scorePronunciation(wordEntry.word, heardText);
    setScore(finalScore);
    setStage('result');
    // Don't block the result UI on Firestore latency.
    void saveAttempt(finalScore);
    onComplete?.(finalScore);
  };

  const handleStartRecording = async () => {
    setErrorMsg('');
    setLiveTranscript('');
    latestTranscriptRef.current = '';
    usingNativeSttRef.current = false;
    stopInFlightRef.current = false;

    try {
      // Android/iOS: use on-device STT (Whisper Cloud Function is not deployed).
      // Do not start MediaRecorder at the same time — it steals the mic from SpeechRecognition.
      if (Capacitor.isNativePlatform()) {
        usingNativeSttRef.current = true;
        const langs = speechLangForDialect(dialectId);
        const session = await startSpeechToText({
          language: langs.primary,
          languageFallbacks: langs.fallbacks,
          restartOnEnd: false,
          onChunk: (chunk) => {
            const text = normalizeRepeatedSpeech(chunk.text);
            if (!text) return;
            latestTranscriptRef.current = text;
            setLiveTranscript(text);
          },
          onError: (message) => {
            setErrorMsg(message);
          },
        });
        speechSessionRef.current = session;
        setStage('recording');
        setRecordingSeconds(0);
        timerRef.current = setInterval(() => {
          setRecordingSeconds((s) => s + 1);
        }, 1000);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickSupportedAudioMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stopMediaTracks();
        void handleRecordingComplete();
      };

      recorder.start(250);
      setStage('recording');
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setErrorMsg('Could not access the microphone. Please check your permissions.');
      setStage('error');
    }
  };

  const handleStopRecording = () => {
    if (stopInFlightRef.current) return;
    stopInFlightRef.current = true;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setStage('processing');

    if (usingNativeSttRef.current) {
      const session = speechSessionRef.current;
      speechSessionRef.current = null;
      const heardNow = latestTranscriptRef.current || liveTranscript;

      void (async () => {
        try {
          const stoppedText = await session?.stop();
          const heard = normalizeRepeatedSpeech(stoppedText || heardNow);
          await scoreAndFinish(heard);
        } catch {
          setErrorMsg('Something went wrong while checking your pronunciation. Please try again.');
          setStage('error');
        } finally {
          stopInFlightRef.current = false;
        }
      })();
      return;
    }

    mediaRecorderRef.current?.stop();
    stopInFlightRef.current = false;
  };

  const handleRecordingComplete = async () => {
    if (!wordEntry) return;
    try {
      const recorderMime = mediaRecorderRef.current?.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: recorderMime });
      if (blob.size === 0) {
        setErrorMsg('No voice detected. Please speak clearly and try again.');
        setStage('error');
        return;
      }
      const result = await Promise.race([
        transcribeWhisper(blob),
        new Promise<{ text: string }>((_, reject) =>
          window.setTimeout(() => reject(new Error('Speech check timed out. Please try again.')), 15000)
        ),
      ]);
      await scoreAndFinish(result?.text || '');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setErrorMsg(
        msg
          ? `Could not check pronunciation: ${msg}`
          : 'Something went wrong while checking your pronunciation. Please try again.'
      );
      setStage('error');
    }
  };

  const saveAttempt = async (finalScore: number) => {
    const user = firebaseAuth.currentUser;
    if (!user || !wordEntry) return;
    try {
      await setDoc(
        doc(firebaseDb, 'users', user.uid, 'wordOfDayHistory', todayKey()),
        {
          dialect: dialectId,
          word: wordEntry.word,
          score: finalScore,
          timestamp: Date.now(),
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('Failed to save Word of the Day attempt:', e);
    }
  };

  const handleRetry = () => {
    setStage('ready');
    setScore(null);
    setTranscript('');
    setLiveTranscript('');
    setErrorMsg('');
  };

  const handleRetakeToday = async () => {
    setStage('loading');
    setScore(null);
    setTranscript('');
    try {
      const picked = await getOrGenerateWordOfDay(dialectId, dialectName);
      setWordEntry(picked);
      setStage('ready');
    } catch {
      setErrorMsg('Could not reload the word. Please try again.');
      setStage('error');
    }
  };

  const handleClose = () => {
    cancelSpeech();
    stopMediaTracks();
    void speechSessionRef.current?.stop().catch(() => undefined);
    speechSessionRef.current = null;
    stopInFlightRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="wod-overlay" onClick={handleClose} role="dialog" aria-modal="true" aria-label="Word of the Day">
      <div className="wod-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="wod-header" style={{ background: accentColor }}>
          <span className="wod-header__title">📖 Word of the Day</span>
          <span className="wod-header__dialect">{dialectName}</span>
          <button className="wod-close-btn" onClick={handleClose} aria-label="Close">
            <IonIcon icon={closeOutline} />
          </button>
        </div>

        <div className="wod-body">
          {stage === 'loading' && (
            <div className="wod-state">
              <div className="wod-spinner" style={{ borderTopColor: accentColor }} />
              <p>Loading today's word…</p>
            </div>
          )}

          {stage === 'error' && (
            <div className="wod-state">
              <IonIcon icon={alertCircleOutline} className="wod-state__icon wod-state__icon--error" />
              <p>{errorMsg}</p>
            </div>
          )}

          {stage === 'already-done' && wordEntry && (
            <div className="wod-state">
              <IonIcon icon={checkmarkCircle} className="wod-state__icon wod-state__icon--success" />
              <h3 className="wod-word">{wordEntry.word}</h3>
              <p>You already practiced today's word.</p>
              <div className="wod-score" style={{ color: accentColor }}>{score}%</div>
              <p className="wod-feedback">{feedbackForScore(score ?? 0)}</p>
              <button className="wod-retake-btn" style={{ color: accentColor, borderColor: accentColor }} onClick={handleRetakeToday}>
                <IonIcon icon={refreshOutline} />
                Retake today's word
              </button>
              <p className="wod-hint">Or come back tomorrow for a new word.</p>
            </div>
          )}

          {(stage === 'ready' || stage === 'recording' || stage === 'processing') && wordEntry && (
            <div className="wod-practice">
              <h3 className="wod-word">{wordEntry.word}</h3>
              {wordEntry.meaning && <p className="wod-meaning">{wordEntry.meaning}</p>}
              {wordEntry.exampleSentence && (
                <p className="wod-example">"{wordEntry.exampleSentence}"</p>
              )}

              <button
                className="wod-speaker-btn"
                style={{ borderColor: accentColor, color: accentColor }}
                onClick={handlePlayReference}
                disabled={isSpeaking}
              >
                <IonIcon icon={volumeHighOutline} />
                {isSpeaking ? 'Playing…' : 'Hear pronunciation'}
              </button>

              <div className="wod-divider" />

              {stage === 'ready' && (
                <button
                  className="wod-mic-btn"
                  style={{ background: accentColor }}
                  onClick={handleStartRecording}
                  aria-label="Start recording"
                >
                  <IonIcon icon={micOutline} />
                </button>
              )}

              {stage === 'recording' && (
                <div className="wod-recording">
                  <button
                    className="wod-mic-btn wod-mic-btn--active"
                    onClick={handleStopRecording}
                    aria-label="Stop recording"
                  >
                    <IonIcon icon={stopOutline} />
                  </button>
                  <span className="wod-recording__timer">{recordingSeconds}s</span>
                  <p className="wod-hint" aria-live="polite">
                    {liveTranscript
                      ? `Heard: “${liveTranscript}”`
                      : 'Speak the word now, then tap stop.'}
                  </p>
                </div>
              )}

              {stage === 'processing' && (
                <div className="wod-state">
                  <div className="wod-spinner" style={{ borderTopColor: accentColor }} />
                  <p>Checking your pronunciation…</p>
                </div>
              )}

              {stage === 'ready' && <p className="wod-hint">Tap the mic and say the word aloud.</p>}
            </div>
          )}

          {stage === 'result' && wordEntry && score !== null && (
            <div className="wod-state">
              <h3 className="wod-word">{wordEntry.word}</h3>
              {transcript && <p className="wod-hint">We heard: "{transcript}"</p>}
              <div className="wod-score" style={{ color: accentColor }}>{score}%</div>
              <p className="wod-feedback">{feedbackForScore(score)}</p>
              <div className="wod-result-actions">
                <button className="wod-retry-btn" onClick={handleRetry}>
                  <IonIcon icon={refreshOutline} />
                  Try again
                </button>
                <button
                  className="wod-done-btn"
                  style={{ background: accentColor }}
                  onClick={handleClose}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WordOfDayModal;