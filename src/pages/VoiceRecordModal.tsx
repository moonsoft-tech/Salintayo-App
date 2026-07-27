import React, { useState, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { IonIcon } from '@ionic/react';
import {
  micOutline,
  closeOutline,
  checkmarkOutline,
  playOutline,
  pauseOutline,
  trashOutline,
  volumeHighOutline,
} from 'ionicons/icons';
import { startSpeechToText, type SpeechToTextSession } from '../utils/speechToText';
import './VoiceRecordModal.css';

interface VoiceRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendVoice: (audioBlob: Blob, caption: string, transcript: string, durationSec: number) => void;
}

type VoiceState = 'idle' | 'recording' | 'preview';

const MEDIA_RECORDER_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
];

function pickMediaRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }
  return MEDIA_RECORDER_MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
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

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript?: string }> & { isFinal?: boolean }>;
}

interface BrowserSpeechRecognitionWindow extends Window {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
}

const VoiceRecordModal: React.FC<VoiceRecordModalProps> = ({
  isOpen,
  onClose,
  onSendVoice,
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [caption, setCaption] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingError, setRecordingError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioUrlRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const finalTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  const isStoppingRecognitionRef = useRef(false);
  const discardNextRecordingRef = useRef(false);
  const speechSessionRef = useRef<SpeechToTextSession | null>(null);
  const stopInFlightRef = useRef(false);
  const usingNativeSttRef = useRef(false);

  const webSpeechSupported = (): boolean => {
    const win = window as BrowserSpeechRecognitionWindow;
    return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
  };

  const webSpeechReadyMessage = (): string | null => {
    const isLocalhost =
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1' ||
      location.hostname === '[::1]';
    const secureOk = (window as Window & { isSecureContext?: boolean }).isSecureContext || isLocalhost;
    if (!secureOk) return 'Speech-to-Text requires HTTPS. Please use the Firebase-hosted (HTTPS) version.';
    if (!webSpeechSupported()) return 'Speech-to-Text is not supported in this browser.';
    return null;
  };

  const clearPreviewAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (previewAudioUrlRef.current) {
      URL.revokeObjectURL(previewAudioUrlRef.current);
      previewAudioUrlRef.current = null;
    }
    setIsPlaying(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      void speechSessionRef.current?.stop().catch(() => undefined);
      speechSessionRef.current = null;
      if (recognitionRef.current) {
        isStoppingRecognitionRef.current = true;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      clearPreviewAudio();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      clearPreviewAudio();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      void speechSessionRef.current?.stop().catch(() => undefined);
      speechSessionRef.current = null;
      setAudioBlob(null);
      setRecordingTime(0);
      setCaption('');
      setRecordingError('');
      setIsListening(false);
      setLiveTranscript('');
      finalTranscriptRef.current = '';
      interimTranscriptRef.current = '';
      chunksRef.current = [];
      stopInFlightRef.current = false;
      usingNativeSttRef.current = false;
      setVoiceState('idle');
    }
  }, [isOpen]);

  const getCombinedTranscript = () =>
    normalizeRepeatedSpeech(
      liveTranscript || `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.trim()
    );

  const startWebSpeechRecognition = () => {
    const notReady = webSpeechReadyMessage();
    if (notReady) {
      setRecordingError(notReady);
      return;
    }

    const win = window as BrowserSpeechRecognitionWindow;
    const SpeechRecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    isStoppingRecognitionRef.current = false;
    setIsListening(true);
    setLiveTranscript('');

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0]?.transcript ?? '';
        if (event.results[i].isFinal) {
          finalTranscriptRef.current = `${finalTranscriptRef.current} ${chunk}`.trim();
        } else {
          interim += chunk;
        }
      }
      interimTranscriptRef.current = interim.trim();
      const combined = normalizeRepeatedSpeech(
        `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.trim()
      );
      setLiveTranscript(combined);
    };

    recognition.onerror = (event: Event) => {
      const maybeAny = event as unknown as { error?: string };
      const code = (maybeAny?.error ?? '').toString();
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setRecordingError('Microphone permission denied for Speech-to-Text.');
      } else if (code === 'audio-capture') {
        setRecordingError('No microphone found or microphone is busy.');
      } else if (code === 'network') {
        setRecordingError('Speech-to-Text network error. Please try again.');
      } else if (code && code !== 'no-speech') {
        setRecordingError(`Speech-to-Text error: ${code}`);
      }
    };

    recognition.onend = () => {
      if (!isStoppingRecognitionRef.current && voiceState === 'recording') {
        try {
          recognition.start();
        } catch {
          // ignore
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setRecordingError('Could not start Speech-to-Text.');
    }
  };

  const stopWebSpeechRecognition = () => {
    isStoppingRecognitionRef.current = true;
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      setRecordingError('');
      clearPreviewAudio();
      setAudioBlob(null);
      setCaption('');
      setLiveTranscript('');
      finalTranscriptRef.current = '';
      interimTranscriptRef.current = '';
      discardNextRecordingRef.current = false;
      stopInFlightRef.current = false;
      usingNativeSttRef.current = false;

      // Android/iOS: use shared on-device STT (no MediaRecorder mic conflict).
      if (Capacitor.isNativePlatform()) {
        usingNativeSttRef.current = true;
        setVoiceState('recording');
        setRecordingTime(0);
        setIsListening(false);

        // Wait until STT is actually running before starting the timer.
        const session = await startSpeechToText({
          language: 'en-US',
          languageFallbacks: ['fil-PH'],
          // Android ends after silence — keep listening for Chat phrases.
          restartOnEnd: true,
          onChunk: (chunk) => {
            const text = normalizeRepeatedSpeech(chunk.text);
            if (!text) return;
            interimTranscriptRef.current = text;
            finalTranscriptRef.current = text;
            setLiveTranscript(text);
            setIsListening(true);
          },
          onError: (message) => {
            setRecordingError(message);
            setIsListening(false);
          },
        });
        if (discardNextRecordingRef.current) {
          await session.stop().catch(() => undefined);
          return;
        }
        speechSessionRef.current = session;
        setIsListening(true);

        timerRef.current = setInterval(() => {
          setRecordingTime((prev) => {
            if (prev >= 60) {
              window.setTimeout(() => stopRecording(), 0);
              return prev;
            }
            return prev + 1;
          });
        }, 1000);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (typeof MediaRecorder === 'undefined') {
        throw new Error('Audio recording is not supported on this device.');
      }
      const pickedMimeType = pickMediaRecorderMimeType();
      const mediaRecorder = pickedMimeType
        ? new MediaRecorder(stream, { mimeType: pickedMimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        if (!discardNextRecordingRef.current) {
          const blobType = mediaRecorder.mimeType || pickedMimeType || 'audio/webm';
          const blob = new Blob(chunksRef.current, { type: blobType });
          setAudioBlob(blob);
          setVoiceState('preview');
        }
        stream.getTracks().forEach((track) => track.stop());
        discardNextRecordingRef.current = false;
      };

      mediaRecorder.start();
      setVoiceState('recording');
      setRecordingTime(0);
      startWebSpeechRecognition();

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 60) {
            window.setTimeout(() => stopRecording(), 0);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to start recording. Check microphone permission.';
      setRecordingError(message);
      setVoiceState('idle');
    }
  };

  const stopRecording = () => {
    if (stopInFlightRef.current) return;
    stopInFlightRef.current = true;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (usingNativeSttRef.current) {
      const session = speechSessionRef.current;
      speechSessionRef.current = null;
      // Prefer refs — React state can be stale inside this handler.
      const snapshot =
        interimTranscriptRef.current || finalTranscriptRef.current || liveTranscript;

      void (async () => {
        try {
          const stoppedText = await session?.stop();
          const text = normalizeRepeatedSpeech(
            stoppedText || session?.getTranscript() || snapshot
          );
          if (!discardNextRecordingRef.current) {
            setLiveTranscript(text);
            finalTranscriptRef.current = text;
            interimTranscriptRef.current = '';
            setVoiceState('preview');
          }
        } catch {
          if (!discardNextRecordingRef.current) {
            const fallback = normalizeRepeatedSpeech(snapshot);
            setLiveTranscript(fallback);
            finalTranscriptRef.current = fallback;
            setVoiceState('preview');
          }
        } finally {
          setIsListening(false);
          stopInFlightRef.current = false;
        }
      })();
      return;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    stopWebSpeechRecognition();
    stopInFlightRef.current = false;
  };

  const cancelRecording = () => {
    discardNextRecordingRef.current = true;
    stopRecording();
    clearPreviewAudio();
    void speechSessionRef.current?.stop().catch(() => undefined);
    speechSessionRef.current = null;
    setAudioBlob(null);
    setRecordingTime(0);
    setCaption('');
    setRecordingError('');
    setIsListening(false);
    setLiveTranscript('');
    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    setVoiceState('idle');
    onClose();
  };

  const deleteRecording = () => {
    clearPreviewAudio();
    setAudioBlob(null);
    setRecordingTime(0);
    setCaption('');
    setRecordingError('');
    setIsListening(false);
    setLiveTranscript('');
    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    setVoiceState('idle');
  };

  const playPreview = () => {
    if (!audioBlob || audioBlob.size === 0) return;

    if (!audioRef.current) {
      if (previewAudioUrlRef.current) {
        URL.revokeObjectURL(previewAudioUrlRef.current);
      }
      previewAudioUrlRef.current = URL.createObjectURL(audioBlob);
      audioRef.current = new Audio(previewAudioUrlRef.current);
      audioRef.current.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.currentTime = 0;
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const sendVoice = () => {
    const transcript = getCombinedTranscript();
    const hasAudio = Boolean(audioBlob && audioBlob.size > 0);
    if (!hasAudio && !transcript) {
      setRecordingError('No speech detected. Please try again and speak clearly.');
      return;
    }
    onSendVoice(audioBlob ?? new Blob([], { type: 'audio/wav' }), caption, transcript, recordingTime);
    deleteRecording();
    onClose();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="voice-backdrop" onClick={cancelRecording} />
      <div className="voice-sheet" role="dialog" aria-modal="true">
        {voiceState === 'idle' && (
          <>
            <div className="voice-handle" />
            <div className="voice-header">
              <h2 className="voice-title">Voice Recording</h2>
              <button className="voice-close-btn" onClick={cancelRecording} aria-label="Close">
                <IonIcon icon={closeOutline} />
              </button>
            </div>
            <div className="voice-body voice-body--idle">
              {recordingError ? <p className="voice-hint">{recordingError}</p> : null}
              <div className="voice-mic-container">
                <button
                  className="voice-mic-btn"
                  onClick={() => void startRecording()}
                  aria-label="Start recording"
                >
                  <IonIcon icon={micOutline} className="voice-mic-icon" />
                </button>
                <p className="voice-hint">Tap to start recording</p>
              </div>
            </div>
          </>
        )}

        {voiceState === 'recording' && (
          <>
            <div className="voice-handle" />
            <div className="voice-header">
              <h2 className="voice-title">Recording...</h2>
            </div>
            <div className="voice-body voice-body--recording">
              <div className="voice-recording-indicator">
                <span className="voice-recording-dot">●</span>
                <span className="voice-recording-text">RECORDING</span>
              </div>
              <p className="voice-hint" aria-live="polite">
                {liveTranscript
                  ? liveTranscript
                  : isListening
                    ? 'Listening… speak now'
                    : 'Starting Speech-to-Text…'}
              </p>
              {recordingError ? <p className="voice-hint">{recordingError}</p> : null}
              <div className="voice-timer">
                <span className="voice-timer-value">{formatTime(recordingTime)}</span>
              </div>
              <div className="voice-waveform">
                <div className="voice-waveform-bar"></div>
                <div className="voice-waveform-bar"></div>
                <div className="voice-waveform-bar"></div>
                <div className="voice-waveform-bar"></div>
                <div className="voice-waveform-bar"></div>
                <div className="voice-waveform-bar"></div>
                <div className="voice-waveform-bar"></div>
                <div className="voice-waveform-bar"></div>
              </div>
              <div className="voice-actions">
                <button className="voice-action-btn voice-action-btn--cancel" onClick={cancelRecording}>
                  <IonIcon icon={closeOutline} />
                  <span>Cancel</span>
                </button>
                <button className="voice-action-btn voice-action-btn--stop" onClick={stopRecording}>
                  <IonIcon icon={checkmarkOutline} />
                  <span>Done</span>
                </button>
              </div>
            </div>
          </>
        )}

        {voiceState === 'preview' && (
          <>
            <div className="voice-handle" />
            <div className="voice-header">
              <h2 className="voice-title">Voice Message Ready</h2>
              <button className="voice-close-btn" onClick={cancelRecording} aria-label="Close">
                <IonIcon icon={closeOutline} />
              </button>
            </div>
            <div className="voice-body voice-body--preview">
              <div className="voice-preview-card">
                <div className="voice-preview-icon">
                  <IonIcon icon={volumeHighOutline} />
                </div>
                <div className="voice-preview-info">
                  <span className="voice-preview-label">
                    {audioBlob && audioBlob.size > 0 ? 'Voice Message' : 'Speech Capture'}
                  </span>
                  <span className="voice-preview-duration">{formatTime(recordingTime)}</span>
                </div>
                {audioBlob && audioBlob.size > 0 ? (
                  <button className="voice-play-btn" onClick={playPreview}>
                    <IonIcon icon={isPlaying ? pauseOutline : playOutline} />
                  </button>
                ) : null}
              </div>
              {getCombinedTranscript() ? (
                <p className="voice-hint" aria-label="Detected speech">
                  {getCombinedTranscript()}
                </p>
              ) : (
                <p className="voice-hint">No speech detected yet. Delete and try again if needed.</p>
              )}
              {recordingError ? <p className="voice-hint">{recordingError}</p> : null}
              <div className="voice-caption-field">
                <label className="voice-caption-label">Add caption (optional):</label>
                <input
                  type="text"
                  className="voice-caption-input"
                  placeholder="What is this phrase in..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
              </div>
              <div className="voice-actions">
                <button className="voice-action-btn voice-action-btn--delete" onClick={deleteRecording}>
                  <IonIcon icon={trashOutline} />
                  <span>Delete</span>
                </button>
                <button className="voice-action-btn voice-action-btn--send" onClick={sendVoice}>
                  <IonIcon icon={checkmarkOutline} />
                  <span>Send</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default VoiceRecordModal;
