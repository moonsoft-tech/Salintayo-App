import React, { useState, useRef, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { IonIcon } from '@ionic/react';
import {
  chatbubbleEllipsesOutline,
  flashOutline,
} from 'ionicons/icons';
import './QuickChatBubble.css';

const STORAGE_KEY    = 'salintayo_quickchat_enabled';
const POS_KEY        = 'salintayo_quickchat_pos';
const BUBBLE_SIZE    = 52;
const MOVE_THRESHOLD = 8;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ── Language options ─────────────────────────────────────────
const LANGUAGES = [
  { code: 'tagalog',     label: 'Tagalog',     flag: '🇵🇭', color: '#0047ab', colorEnd: '#1d6ef7' },
  { code: 'cebuano',    label: 'Cebuano',     flag: '🌴', color: '#0d9488', colorEnd: '#059669' },
  { code: 'ilocano',    label: 'Ilocano',     flag: '🏝️', color: '#7c3aed', colorEnd: '#6d28d9' },
  { code: 'hiligaynon', label: 'Hiligaynon',  flag: '🌸', color: '#db2777', colorEnd: '#be185d' },
  { code: 'bicolano',   label: 'Bicolano',    flag: '🌋', color: '#ea580c', colorEnd: '#c2410c' },
];

const QuickChatBubble: React.FC = () => {
  const history  = useHistory();

  /* ── state ───────────────────────────────────────────────────── */
  const [isEnabled,    setIsEnabled]    = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });
  const [showPicker,   setShowPicker]   = useState(false);
  const [selectedLang, setSelectedLang] = useState<string | null>(null);
  const [isPulsing,    setIsPulsing]    = useState(false);
  const [isDragging,   setIsDragging]   = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const s = localStorage.getItem(POS_KEY);
      if (s) return JSON.parse(s);
    } catch {}
    return { x: window.innerWidth - BUBBLE_SIZE - 16, y: window.innerHeight - 180 };
  });

  /* ── refs ────────────────────────────────────────────────────── */
  const bubbleRef  = useRef<HTMLDivElement>(null);
  const posRef     = useRef(pos);
  const enabledRef = useRef(isEnabled);
  const historyRef = useRef(history);

  useEffect(() => { posRef.current     = pos;       }, [pos]);
  useEffect(() => { enabledRef.current = isEnabled; }, [isEnabled]);
  useEffect(() => { historyRef.current = history;   }, [history]);

  // Stable setter refs so once-attached listeners never go stale
  const setShowPickerRef  = useRef(setShowPicker);
  const setIsPulsingRef   = useRef(setIsPulsing);
  const setIsDraggingRef  = useRef(setIsDragging);
  const setPosRef         = useRef(setPos);
  useEffect(() => { setShowPickerRef.current  = setShowPicker;  });
  useEffect(() => { setIsPulsingRef.current   = setIsPulsing;   });
  useEffect(() => { setIsDraggingRef.current  = setIsDragging;  });
  useEffect(() => { setPosRef.current         = setPos;         });

  const ds            = useRef({ active: false, moved: false, startX: 0, startY: 0, originX: 0, originY: 0 });
  const lpTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = useRef(false); // blocks tap logic firing after a long-press

  /* ── helpers ─────────────────────────────────────────────────── */
  const savePos = (x: number, y: number) => {
    try { localStorage.setItem(POS_KEY, JSON.stringify({ x, y })); } catch {}
  };
  const persistEnabled = (val: boolean) => {
    setIsEnabled(val);
    enabledRef.current = val;
    try { localStorage.setItem(STORAGE_KEY, String(val)); } catch {}
  };

  /* ── language selection ──────────────────────────────────────── */
  const handleLanguageSelect = (langCode: string) => {
    setSelectedLang(langCode);
    setShowPicker(false);
    setTimeout(() => {
      historyRef.current.push(`/chat?lang=${langCode}&quickmode=true`);
      setSelectedLang(null);
    }, 180);
  };

  /* ── drag handler refs (never stale) ─────────────────────────── */
  const onStartRef = useRef((clientX: number, clientY: number) => {
    const { x, y } = posRef.current;
    ds.current = { active: true, moved: false, startX: clientX, startY: clientY, originX: x, originY: y };

    // Long-press → disable
    if (enabledRef.current) {
      lpTimer.current = setTimeout(() => {
        if (!ds.current.moved) {
          longPressedRef.current = true;
          persistEnabled(false);
          setShowPickerRef.current(false);
          // Clear the flag after a short cooldown so normal taps work again
          setTimeout(() => { longPressedRef.current = false; }, 600);
        }
      }, 700);
    }
  });

  const onMoveRef = useRef((clientX: number, clientY: number) => {
    if (!ds.current.active) return;
    const dx = clientX - ds.current.startX;
    const dy = clientY - ds.current.startY;

    if (!ds.current.moved) {
      if (Math.hypot(dx, dy) < MOVE_THRESHOLD) return;
      ds.current.moved = true;
      setIsDraggingRef.current(true);
      if (lpTimer.current) clearTimeout(lpTimer.current);
    }

    const nx = clamp(ds.current.originX + dx, 4, window.innerWidth  - BUBBLE_SIZE - 4);
    const ny = clamp(ds.current.originY + dy, 60, window.innerHeight - BUBBLE_SIZE - 4);
    setPosRef.current({ x: nx, y: ny });
    posRef.current = { x: nx, y: ny };
  });

  const onEndRef = useRef((clientX: number) => {
    if (!ds.current.active) return;
    if (lpTimer.current) clearTimeout(lpTimer.current);
    const wasMoved = ds.current.moved;
    ds.current.active = false;
    setIsDraggingRef.current(false);

    if (!wasMoved) {
      // If this pointer-up is the tail end of a long-press, ignore it
      if (longPressedRef.current) return;

      if (!enabledRef.current) {
        // First tap when disabled → enable then open picker
        persistEnabled(true);
        setShowPickerRef.current(true);
      } else {
        // Already enabled → pulse then open picker
        setIsPulsingRef.current(true);
        setTimeout(() => {
          setIsPulsingRef.current(false);
          setShowPickerRef.current(true);
        }, 200);
      }
    } else {
      // Snap to nearest edge after drag
      const snapX = clientX < window.innerWidth / 2
        ? 4
        : window.innerWidth - BUBBLE_SIZE - 4;
      const snapY = posRef.current.y;
      setPosRef.current({ x: snapX, y: snapY });
      posRef.current = { x: snapX, y: snapY };
      savePos(snapX, snapY);
    }
  });

  /* ── attach native listeners once ───────────────────────────── */
  useEffect(() => {
    const el = bubbleRef.current;
    if (!el) return;

    const tStart = (e: TouchEvent) => { e.stopPropagation(); onStartRef.current(e.touches[0].clientX, e.touches[0].clientY); };
    const tMove  = (e: TouchEvent) => { if (!ds.current.active) return; e.preventDefault(); onMoveRef.current(e.touches[0].clientX, e.touches[0].clientY); };
    const tEnd   = (e: TouchEvent) => onEndRef.current(e.changedTouches[0].clientX);
    const mDown  = (e: MouseEvent) => { e.preventDefault(); onStartRef.current(e.clientX, e.clientY); };
    const mMove  = (e: MouseEvent) => onMoveRef.current(e.clientX, e.clientY);
    const mUp    = (e: MouseEvent) => onEndRef.current(e.clientX);

    el.addEventListener('touchstart', tStart, { passive: false });
    el.addEventListener('touchmove',  tMove,  { passive: false });
    el.addEventListener('touchend',   tEnd);
    el.addEventListener('mousedown',  mDown);
    window.addEventListener('mousemove', mMove);
    window.addEventListener('mouseup',   mUp);

    return () => {
      el.removeEventListener('touchstart', tStart);
      el.removeEventListener('touchmove',  tMove);
      el.removeEventListener('touchend',   tEnd);
      el.removeEventListener('mousedown',  mDown);
      window.removeEventListener('mousemove', mMove);
      window.removeEventListener('mouseup',   mUp);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* ── Floating Bubble ── */}
      <div
        ref={bubbleRef}
        className={[
          'qcb-bubble',
          isEnabled  ? 'qcb-bubble--on'      : 'qcb-bubble--off',
          isPulsing  ? 'qcb-bubble--pulse'    : '',
          isDragging ? 'qcb-bubble--dragging' : '',
        ].filter(Boolean).join(' ')}
        style={{ left: pos.x, top: pos.y }}
        role="button"
        aria-label="Quick Chat"
      >
        <div className="qcb-bubble__inner">
          <IonIcon
            icon={isEnabled ? flashOutline : chatbubbleEllipsesOutline}
            className="qcb-bubble__icon"
          />
          {isEnabled && <span className="qcb-bubble__badge" />}
        </div>
        {isEnabled && <div className="qcb-bubble__ripple" />}
      </div>

      {/* ── Language Picker Overlay ── */}
      {showPicker && (
        <div className="qcb-overlay" onClick={() => setShowPicker(false)}>
          <div className="qcb-picker" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="qcb-picker__header">
              <div className="qcb-picker__header-icon">
                <IonIcon icon={flashOutline} />
              </div>
              <div className="qcb-picker__header-text">
                <h2 className="qcb-picker__title">Quick Chat</h2>
                <p className="qcb-picker__subtitle">Pick a language to begin</p>
              </div>
              <button
                className="qcb-picker__close"
                onClick={() => setShowPicker(false)}
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Language grid */}
            <div className="qcb-picker__grid">
              {LANGUAGES.map((lang, i) => (
                <button
                  key={lang.code}
                  className={`qcb-lang-btn ${selectedLang === lang.code ? 'qcb-lang-btn--selecting' : ''}`}
                  style={{
                    '--lang-color':     lang.color,
                    '--lang-color-end': lang.colorEnd,
                    animationDelay:     `${i * 0.055}s`,
                  } as React.CSSProperties}
                  onClick={() => handleLanguageSelect(lang.code)}
                >
                  <span className="qcb-lang-btn__flag">{lang.flag}</span>
                  <span className="qcb-lang-btn__label">{lang.label}</span>
                  <span className="qcb-lang-btn__arrow">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </span>
                </button>
              ))}
            </div>

            {/* Hint */}
            <p className="qcb-picker__hint">
              💡 Long-press the bubble anytime to disable Quick Chat
            </p>

          </div>
        </div>
      )}
    </>
  );
};

export default QuickChatBubble;