import React, { useState, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
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
import './VoiceRecordModal.css';

interface VoiceRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendVoice: (audioBlob: Blob, caption: string, transcript: string, durationSec: number) => void;
}

type VoiceState = 'idle' | 'recording' | 'preview';

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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioUrlRef = useRef<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const finalTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  const isStoppingRecognitionRef = useRef(false);
  const discardNextRecordingRef = useRef(false);
  const nativePartialListenerRef = useRef<{ remove: () => Promise<void> } | null>(null);
  const nativeListeningListenerRef = useRef<{ remove: () => Promise<void> } | null>(null);

  const webSpeechSupported = (): boolean => {
    const win = window as BrowserSpeechRecognitionWindow;
    return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
  };

  const webSpeechReadyMessage = (): string | null => {
    // Web Speech API requires a secure context, except for localhost.
    const isLocalhost =
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1' ||
      location.hostname === '[::1]';
    const secureOk = (window as Window & { isSecureContext?: boolean }).isSecureContext || isLocalhost;
    if (!secureOk) return 'Speech-to-Text requires HTTPS. Please use the Firebase-hosted (HTTPS) version.';
    if (!webSpeechSupported()) return 'Speech-to-Text is not supported in this browser.';
    return null;
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) {
        isStoppingRecognitionRef.current = true;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      if (nativePartialListenerRef.current) {
        void nativePartialListenerRef.current.remove().catch(() => undefined);
        nativePartialListenerRef.current = null;
      }
      if (nativeListeningListenerRef.current) {
        void nativeListeningListenerRef.current.remove().catch(() => undefined);
        nativeListeningListenerRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (previewAudioUrlRef.current) {
        URL.revokeObjectURL(previewAudioUrlRef.current);
        previewAudioUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Ensure stale preview state is not kept after the sheet closes.
    if (!isOpen) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (previewAudioUrlRef.current) {
        URL.revokeObjectURL(previewAudioUrlRef.current);
        previewAudioUrlRef.current = null;
      }
      setIsPlaying(false);
      setAudioBlob(null);
      setRecordingTime(0);
      setCaption('');
      setRecordingError('');
      setIsListening(false);
      finalTranscriptRef.current = '';
      interimTranscriptRef.current = '';
      chunksRef.current = [];
      setVoiceState('idle');
    }
  }, [isOpen]);

  const startSpeechRecognition = () => {
    setIsListening(false);
    // Defensive: stop any prior session first to avoid overlap.
    stopSpeechRecognition();

    if (Capacitor.isNativePlatform()) {
      void (async () => {
        try {
          const available = await SpeechRecognition.available();
          if (!available.available) {
            setRecordingError('Speech-to-Text is not available on this device.');
            return;
          }

          const perm = await SpeechRecognition.checkPermissions();
          if (perm.speechRecognition !== 'granted') {
            const requested = await SpeechRecognition.requestPermissions();
            if (requested.speechRecognition !== 'granted') {
              setRecordingError('Microphone/Speech permission denied.');
              return;
            }
          }

          finalTranscriptRef.current = '';
          interimTranscriptRef.current = '';
          isStoppingRecognitionRef.current = false;

          nativePartialListenerRef.current = await SpeechRecognition.addListener('partialResults', (data) => {
            const latest = data.matches?.[0]?.trim() ?? '';
            if (!latest) return;
            interimTranscriptRef.current = latest;
          });

          nativeListeningListenerRef.current = await SpeechRecognition.addListener('listeningState', (data) => {
            setIsListening(data.status === 'started');
          });

          await SpeechRecognition.start({
            language: 'en-US',
            popup: false,
            partialResults: true,
            maxResults: 3,
          });
        } catch {
          // Keep recording audio even if native speech recognition fails.
        }
      })();
      return;
    }

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
    };

    recognition.onerror = (event: Event) => {
      // Keep recording audio even if browser speech recognition fails, but surface a helpful hint.
      const maybeAny = event as unknown as { error?: string; message?: string };
      const code = (maybeAny?.error ?? '').toString();
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setRecordingError('Microphone permission denied for Speech-to-Text.');
      } else if (code === 'audio-capture') {
        setRecordingError('No microphone found or microphone is busy.');
      } else if (code === 'network') {
        setRecordingError('Speech-to-Text network error. Please try again.');
      } else if (code === 'no-speech') {
        // Common transient; do not hard-fail.
      } else if (code) {
        setRecordingError(`Speech-to-Text error: ${code}`);
      }
    };

    recognition.onend = () => {
      if (!isStoppingRecognitionRef.current && voiceState === 'recording') {
        try {
          recognition.start();
        } catch {
          // Ignore repeated start errors.
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
    }
  };

  const stopSpeechRecognition = () => {
    isStoppingRecognitionRef.current = true;
    setIsListening(false);
    if (nativePartialListenerRef.current) {
      void nativePartialListenerRef.current.remove().catch(() => undefined);
      nativePartialListenerRef.current = null;
    }
    if (nativeListeningListenerRef.current) {
      void nativeListeningListenerRef.current.remove().catch(() => undefined);
      nativeListeningListenerRef.current = null;
    }
    if (Capacitor.isNativePlatform()) {
      void SpeechRecognition.stop().catch(() => undefined);
      return;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      setRecordingError('');
      // New recording should always start from a clean preview state.
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (previewAudioUrlRef.current) {
        URL.revokeObjectURL(previewAudioUrlRef.current);
        previewAudioUrlRef.current = null;
      }
      setIsPlaying(false);
      setAudioBlob(null);
      setCaption('');
      finalTranscriptRef.current = '';
      interimTranscriptRef.current = '';
      discardNextRecordingRef.current = false;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (typeof MediaRecorder === 'undefined') {
        throw new Error('Audio recording is not supported on this device.');
      }
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (!discardNextRecordingRef.current) {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          setAudioBlob(blob);
          setVoiceState('preview');
        }
        stream.getTracks().forEach(track => track.stop());
        discardNextRecordingRef.current = false;
      };

      mediaRecorder.start();
      setVoiceState('recording');
      setRecordingTime(0);
      startSpeechRecognition();

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 60) {
            stopRecording();
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
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    stopSpeechRecognition();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const cancelRecording = () => {
    discardNextRecordingRef.current = true;
    stopRecording();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (previewAudioUrlRef.current) {
      URL.revokeObjectURL(previewAudioUrlRef.current);
      previewAudioUrlRef.current = null;
    }
    setIsPlaying(false);
    setAudioBlob(null);
    setRecordingTime(0);
    setCaption('');
    setRecordingError('');
    setIsListening(false);
    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    setVoiceState('idle');
    onClose();
  };

  const deleteRecording = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (previewAudioUrlRef.current) {
      URL.revokeObjectURL(previewAudioUrlRef.current);
      previewAudioUrlRef.current = null;
    }
    setIsPlaying(false);
    setAudioBlob(null);
    setRecordingTime(0);
    setCaption('');
    setRecordingError('');
    setIsListening(false);
    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    setVoiceState('idle');
  };

  const playPreview = () => {
    if (!audioBlob) return;

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
    if (audioBlob) {
      const transcript =
        `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.replace(/\s+/g, ' ').trim();
      onSendVoice(audioBlob, caption, transcript, recordingTime);
      deleteRecording();
      onClose();
    }
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
                  onClick={startRecording}
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
                {isListening ? 'Listening…' : 'Starting Speech-to-Text…'}
              </p>
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
                  <span className="voice-preview-label">Voice Message</span>
                  <span className="voice-preview-duration">{formatTime(recordingTime)}</span>
                </div>
                <button className="voice-play-btn" onClick={playPreview}>
                  <IonIcon icon={isPlaying ? pauseOutline : playOutline} />
                </button>
              </div>
              {(`${finalTranscriptRef.current} ${interimTranscriptRef.current}`.replace(/\s+/g, ' ').trim()) ? (
                <p className="voice-hint" aria-label="Detected speech">
                  {(`${finalTranscriptRef.current} ${interimTranscriptRef.current}`.replace(/\s+/g, ' ').trim())}
                </p>
              ) : null}
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
