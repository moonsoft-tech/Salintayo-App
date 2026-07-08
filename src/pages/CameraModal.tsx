import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IonIcon } from '@ionic/react';
import {
  closeOutline,
  flashOutline,
  flashOffOutline,
  cameraReverseOutline,
  imagesOutline,
  ellipseOutline,
} from 'ionicons/icons';
import './CameraModal.css';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageData: string) => void;
  onOpenGallery?: () => void;
}

type FacingMode = 'user' | 'environment';

const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  onOpenGallery,
}) => {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [facingMode, setFacingMode]   = useState<FacingMode>('environment');
  const [flashOn, setFlashOn]         = useState(false);
  const [hasMultipleCams, setHasMultipleCams] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false); // shutter flash
  const [isReady, setIsReady]         = useState(false);

  // ── Start / restart stream ─────────────────────────────────────────────────
  const startStream = useCallback(async (facing: FacingMode) => {
    // Stop any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsReady(false);
    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsReady(true);
        };
      }

      // Check if device has multiple cameras
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      setHasMultipleCams(videoDevices.length > 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Camera unavailable';
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        setCameraError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (msg.includes('NotFound') || msg.includes('DevicesNotFound')) {
        setCameraError('No camera found on this device.');
      } else {
        setCameraError('Unable to access camera. Please try again.');
      }
    }
  }, []);

  // ── Open / close lifecycle ─────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      startStream(facingMode);
    } else {
      // Clean up stream when modal closes
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      setIsReady(false);
      setCameraError(null);
      setFlashOn(false);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Flip camera ────────────────────────────────────────────────────────────
  const handleFlip = () => {
    const next: FacingMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startStream(next);
  };

  // ── Capture photo ─────────────────────────────────────────────────────────
  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current || !isReady) return;

    // Shutter flash animation
    setIsCapturing(true);
    setTimeout(() => setIsCapturing(false), 200);

    const video  = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mirror selfie mode
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    onCapture(imageData);
    onClose();
  };

  // ── Gallery picker ────────────────────────────────────────────────────────
  const handleGalleryClick = () => {
    if (onOpenGallery) {
      onOpenGallery();
      onClose();
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      onCapture(reader.result as string);
      onClose();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="cm-root" role="dialog" aria-modal="true" aria-label="Camera">

      {/* Live video preview */}
      <video
        ref={videoRef}
        className={`cm-video${facingMode === 'user' ? ' cm-video--mirror' : ''}`}
        playsInline
        muted
        autoPlay
        aria-hidden="true"
      />

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="cm-canvas" aria-hidden="true" />

      {/* Hidden file input for gallery fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="cm-file-input"
        onChange={handleFileChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Shutter flash overlay */}
      {isCapturing && <div className="cm-shutter-flash" aria-hidden="true" />}

      {/* Error state */}
      {cameraError && (
        <div className="cm-error-overlay" aria-live="assertive">
          <div className="cm-error-box">
            <span className="cm-error-icon" aria-hidden>📷</span>
            <p className="cm-error-text">{cameraError}</p>
            <button type="button" className="cm-error-retry" onClick={() => startStream(facingMode)}>
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Loading shimmer */}
      {!isReady && !cameraError && (
        <div className="cm-loading" aria-label="Loading camera...">
          <div className="cm-loading__spinner" />
          <p className="cm-loading__text">Starting camera…</p>
        </div>
      )}

      {/* ── TOP BAR ── */}
      <div className="cm-top-bar">
        {/* Close */}
        <button type="button" className="cm-icon-btn" onClick={onClose} aria-label="Close camera">
          <IonIcon icon={closeOutline} />
        </button>

        {/* Flash toggle */}
        <button
          type="button"
          className={`cm-icon-btn${flashOn ? ' cm-icon-btn--active' : ''}`}
          onClick={() => setFlashOn(f => !f)}
          aria-label={flashOn ? 'Flash on' : 'Flash off'}
          aria-pressed={flashOn}
        >
          <IonIcon icon={flashOn ? flashOutline : flashOffOutline} />
        </button>
      </div>

      {/* ── VIEWFINDER GUIDE ── */}
      <div className="cm-viewfinder" aria-hidden="true">
        <span className="cm-vf-corner cm-vf-corner--tl" />
        <span className="cm-vf-corner cm-vf-corner--tr" />
        <span className="cm-vf-corner cm-vf-corner--bl" />
        <span className="cm-vf-corner cm-vf-corner--br" />
      </div>

      {/* ── BOTTOM CONTROLS ── */}
      <div className="cm-controls">

        {/* Gallery picker */}
        <button
          type="button"
          className="cm-side-btn"
          onClick={handleGalleryClick}
          aria-label="Open photo gallery"
        >
          <IonIcon icon={imagesOutline} />
          <span className="cm-side-btn__label">Gallery</span>
        </button>

        {/* Shutter */}
        <button
          type="button"
          className={`cm-shutter${!isReady ? ' cm-shutter--disabled' : ''}`}
          onClick={handleCapture}
          disabled={!isReady || !!cameraError}
          aria-label="Take photo"
        >
          <span className="cm-shutter__outer">
            <span className="cm-shutter__inner" />
          </span>
        </button>

        {/* Flip camera */}
        <button
          type="button"
          className={`cm-side-btn${!hasMultipleCams ? ' cm-side-btn--hidden' : ''}`}
          onClick={handleFlip}
          disabled={!hasMultipleCams}
          aria-label="Flip camera"
        >
          <IonIcon icon={cameraReverseOutline} />
          <span className="cm-side-btn__label">Flip</span>
        </button>

      </div>
    </div>
  );
};

export default CameraModal;