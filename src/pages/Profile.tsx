import React, { useState, useEffect, useCallback } from 'react';
import { Link, useHistory, useLocation } from 'react-router-dom';
import { IonContent,
  IonFooter, IonIcon, IonPage, useIonViewDidEnter } from '@ionic/react';
import { useIonContentScrollTopOnEnter } from '../utils/useIonContentScrollTopOnEnter';
import {
  personCircleOutline,
  personOutline,
  createOutline,
  bookOutline,
  documentTextOutline,
  homeOutline,
  chatbubbleOutline,
  statsChartOutline,
  globeOutline,
  settingsOutline,
  notificationsOutline,
  helpCircleOutline,
  logOutOutline,
  checkmarkCircle,
} from 'ionicons/icons';
import './Profile.css';
import './LanguageModal.css';

import NotifModal from './NotifModal';
import EditProfileModal from './EditProfileModal';
import LanguageModal, { Language, LANGUAGES } from './LanguageModal';
import { getDefaultDialectCodeForExperience, getResolvedDialectLangCode } from '../utils/dialectPreference';
import HelpModal from './HelpModal';
import LogoutModal from './LogoutModal';

// Firebase
import { signOut } from 'firebase/auth';
import { firebaseAuth, firebaseDb } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import {
  computeCurrentLoginStreakFromDates,
  mergeActivityDateStrings,
  readLocalLoginDates,
} from '../utils/learnStreak';

/** Overall learning progress % → short tier label (matches Learn path: Newbie → Expert). */
function learningTierFromProgress(p: number): string {
  if (p <= 0) return 'Getting started';
  if (p < 34) return 'Newbie';
  if (p < 67) return 'Intermediate';
  return 'Expert';
}

/** Calculate total quiz attempts across all dialects */
function getTotalQuizAttempts(): number {
  const QUIZ_ATTEMPTS_KEY = 'salintayo_quiz_attempts';
  const dialects = ['fil', 'ceb', 'ilo', 'hil', 'pag', 'war', 'bik', 'pam', 'tsg'];
  let total = 0;
  
  try {
    for (const dialect of dialects) {
      const raw = localStorage.getItem(`${QUIZ_ATTEMPTS_KEY}_${dialect}`);
      if (raw) {
        const attempts = JSON.parse(raw);
        if (Array.isArray(attempts)) {
          total += attempts.length;
        }
      }
    }
  } catch (e) {
    console.warn('Error calculating quiz attempts:', e);
  }
  
  return total;
}

const ProfilePage: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const isProfile = location.pathname === '/profile';
  const profileContentRef = useIonContentScrollTopOnEnter();

  const { user } = useAuth();

  useEffect(() => {
    return () => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    };
  }, []);

  useIonViewDidEnter(() => {
    const firstFocusable = document.querySelector<HTMLElement>('.identity-name');
    if (firstFocusable) {
      firstFocusable.focus();
    }
  });

  const [showNotifModal, setShowNotifModal]           = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal]     = useState(false);
  const [showHelpModal, setShowHelpModal]             = useState(false);
  const [showLogoutModal, setShowLogoutModal]         = useState(false);

  // Quick Chat Bubble toggle
  const QCB_KEY = 'salintayo_quickchat_enabled';
  const [qcbEnabled, setQcbEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem(QCB_KEY) === 'true'; } catch { return false; }
  });
  const toggleQcb = () => {
    const next = !qcbEnabled;
    setQcbEnabled(next);
    try {
      localStorage.setItem(QCB_KEY, String(next));
      window.dispatchEvent(new Event('salintayo_qcb_changed'));
    } catch {}
  };

  // Active / bubble dialect — default follows Tourist (English) vs Local (Filipino) from welcome
  const LANG_KEY = 'salintayo_dialect_lang';
  const QCB_LANG_KEY = 'salintayo_qcb_dialect_lang';
  const languageFromResolved = (): Language =>
    LANGUAGES.find((l) => l.code === getResolvedDialectLangCode()) ?? LANGUAGES.find((l) => l.code === 'fil')!;
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      return LANGUAGES.find(l => l.code === saved) ?? languageFromResolved();
    } catch {
      return languageFromResolved();
    }
  });

  const persistLanguage = (lang: Language) => {
    setSelectedLanguage(lang);
    setQcbLanguage(lang);
    try {
      localStorage.setItem(LANG_KEY, lang.code);
      localStorage.setItem(QCB_LANG_KEY, lang.code);
      window.dispatchEvent(new Event('salintayo_lang_changed'));
      window.dispatchEvent(new Event('salintayo_qcb_lang_changed'));
    } catch {}
  };

  const [qcbLanguage, setQcbLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(QCB_LANG_KEY);
      return LANGUAGES.find(l => l.code === saved) ?? languageFromResolved();
    } catch {
      return languageFromResolved();
    }
  });
  const [showQcbLanguageModal, setShowQcbLanguageModal] = useState(false);

  const persistQcbLanguage = (lang: Language) => {
    setQcbLanguage(lang);
    setSelectedLanguage(lang);
    try {
      localStorage.setItem(QCB_LANG_KEY, lang.code);
      localStorage.setItem(LANG_KEY, lang.code);
      window.dispatchEvent(new Event('salintayo_lang_changed'));
      window.dispatchEvent(new Event('salintayo_qcb_lang_changed'));
    } catch {}
  };

  // Profile data
  const [displayName, setDisplayName] = useState('Juan Dela Cruz');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [photoSrc, setPhotoSrc]       = useState<string | null>(null);

  const EXPERIENCE_KEY = 'salintayo_experience';
  const [experience, setExperience] = useState<'tourist' | 'local' | null>(() => {
    try {
      const v = localStorage.getItem('salintayo_experience');
      return v === 'tourist' || v === 'local' ? v : null;
    } catch { return null; }
  });
  
  // Stats
  const [streak, setStreak] = useState(0);
  const [lessons, setLessons] = useState(0);
  const [progress, setProgress] = useState(0);

  const loadProfile = async () => {
    if (!user) return;

    setDisplayName(user.displayName ?? 'Juan Dela Cruz');
    setEmail(user.email ?? '');
    setPhotoSrc(user.photoURL ?? null);

    try {
      const snap = await getDoc(doc(firebaseDb, 'users', user.uid));
      const data = snap.exists() ? snap.data() : null;

      const rawDates = data?.loginActivityDates;
      const fireDates = Array.isArray(rawDates)
        ? rawDates.filter((x): x is string => typeof x === 'string')
        : undefined;
      const mergedActivity = mergeActivityDateStrings(readLocalLoginDates(), fireDates);
      const streakFromDb =
        typeof data?.streakCount === 'number' && Number.isFinite(data.streakCount)
          ? Math.floor(data.streakCount)
          : typeof data?.loginStreak === 'number' && Number.isFinite(data.loginStreak)
            ? Math.floor(data.loginStreak)
            : null;
      setStreak(
        streakFromDb !== null ? streakFromDb : computeCurrentLoginStreakFromDates(new Set(mergedActivity))
      );

      setLessons(getTotalQuizAttempts());
      setProgress(
        typeof data?.progress === 'number' && Number.isFinite(data.progress)
          ? Math.min(100, Math.max(0, data.progress))
          : 0
      );

      if (data) {
        if (data.displayName) setDisplayName(data.displayName);
        if (data.email) setEmail(data.email);
        if (data.phone) setPhone(data.phone);
        if (data.bio) setBio(data.bio);
        if (data.photoBase64) setPhotoSrc(data.photoBase64);
        if (data.languageCode) {
          const saved = LANGUAGES.find(l => l.code === data.languageCode);
          if (saved) {
            let localDialect: string | null = null;
            try {
              localDialect = localStorage.getItem(LANG_KEY);
            } catch {}
            const localValid = localDialect && LANGUAGES.some(l => l.code === localDialect);
            if (!localValid) persistLanguage(saved);
          }
        }
      }
    } catch (e) {
      console.error('Firestore load error:', e);
    }
  };

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user?.uid]);

  useEffect(() => {
    const syncDialect = () => {
      try {
        const savedLang = localStorage.getItem(LANG_KEY);
        const savedQcb = localStorage.getItem(QCB_LANG_KEY);
        const lang = LANGUAGES.find((l) => l.code === savedLang);
        const qcbLang = LANGUAGES.find((l) => l.code === savedQcb);
        if (lang) setSelectedLanguage(lang);
        if (qcbLang) setQcbLanguage(qcbLang);
      } catch {}
    };

    window.addEventListener('salintayo_lang_changed', syncDialect);
    window.addEventListener('salintayo_qcb_lang_changed', syncDialect);
    return () => {
      window.removeEventListener('salintayo_lang_changed', syncDialect);
      window.removeEventListener('salintayo_qcb_lang_changed', syncDialect);
    };
  }, []);

  useIonViewDidEnter(() => {
    try {
      const savedLang = localStorage.getItem(LANG_KEY);
      const savedQcb = localStorage.getItem(QCB_LANG_KEY);
      const lang = LANGUAGES.find(l => l.code === savedLang);
      const qcbLang = LANGUAGES.find(l => l.code === savedQcb);
      if (lang) setSelectedLanguage(lang);
      if (qcbLang) setQcbLanguage(qcbLang);
    } catch {}
  });

  const handleProfileSave = useCallback((data: {
    displayName: string;
    email: string;
    phone: string;
    bio: string;
    photoBase64?: string;
  }) => {
    setDisplayName(data.displayName);
    setEmail(data.email);
    setPhone(data.phone);
    setBio(data.bio);
    if (data.photoBase64) setPhotoSrc(data.photoBase64);
  }, []);

  return (
    <IonPage>
      <IonContent fullscreen className="profile-content" ref={profileContentRef}>
        <div className="page">

          {/* ═══ HERO BANNER ═══ */}
          <div className="hero">
            <div className="hero-banner"></div>
            
            <svg className="hero-wave" viewBox="0 0 1200 40" preserveAspectRatio="none">
              <path d="M0,20 C240,40 540,0 840,20 C1050,35 1200,10 1200,18 L1200,40 L0,40 Z" fill="#f4f6fb"/>
            </svg>

            <button 
              className="hero-edit-btn" 
              title="Edit banner"
              onClick={() => setShowEditProfileModal(true)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>

            <div className="avatar-wrap">
              <div className="avatar-ring">
                {photoSrc ? (
                  <img
                    className="avatar-img"
                    src={photoSrc}
                    alt="User profile photo"
                  />
                ) : (
                  <div className="avatar-fallback">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                    </svg>
                  </div>
                )}
              </div>
              <button 
                className="avatar-edit-badge" 
                title="Change photo"
                onClick={() => setShowEditProfileModal(true)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
              </button>
            </div>
          </div>

          {/* ═══ IDENTITY ═══ */}
          <div className="identity">
            <h1 className="identity-name">
              {displayName}
              <span className="verified-badge" title="Verified learner">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </span>
            </h1>
            <p className="identity-sub">
              {email} {phone ? `· ${phone}` : ''}
            </p>
            {experience && (
              <p className="identity-sub" style={{ marginTop: 4 }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '2px 10px',
                  borderRadius: 20,
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  background: experience === 'tourist' ? 'rgba(254,242,242,1)' : 'rgba(239,246,255,1)',
                  color: experience === 'tourist' ? '#b91c1c' : '#1d4ed8',
                  border: experience === 'tourist' ? '1px solid rgba(185,28,28,0.18)' : '1px solid rgba(29,78,216,0.18)',
                }}>
                  {experience === 'tourist' ? '🧳' : '🏠'}
                  {experience === 'tourist' ? 'Tourist' : 'Local'}
                </span>
              </p>
            )}
            <div>
              <span className="level-pill">
                <span
                  className="level-dot"
                  style={{ background: selectedLanguage.gradient, width: 10, height: 10, borderRadius: '50%', display: 'inline-block' }}
                />
                Learning {selectedLanguage.name} · {learningTierFromProgress(progress)}
              </span>
            </div>
          </div>

          {/* ═══ QUICK STATS ═══ */}
          <div className="stats-row">
            <div className="stat-item">
              <div className="stat-value streak">{streak} 🔥</div>
              <div className="stat-label">Day Streak</div>
            </div>
            <div className="stat-item">
              <div className="stat-value lessons">{lessons}</div>
              <div className="stat-label">Quiz Taken</div>
            </div>
          </div>

          {/* ═══ PROGRESS CARD ═══ */}
          <div className="card">
            <div className="card-head">
              <span className="card-icon blue">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/>
                  <line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              </span>
              <span className="card-title">Progress Overview</span>
            </div>
            <div className="card-body">
              <div className="progress-labels">
                <span>Newbie</span>
                <span>Expert</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" id="prog-fill" style={{ width: `${progress}%` }}></div>
              </div>
              <div className="progress-current">
                {progress <= 0
                  ? 'Start on Learn to track progress from Newbie to Expert.'
                  : `${learningTierFromProgress(progress)} — ${progress}% toward Expert`}
              </div>
            </div>
          </div>

          {/* ═══ BIO CARD ═══ */}
          {bio && (
            <div className="card">
              <div className="card-head">
                <span className="card-icon teal">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </span>
                <span className="card-title">About Me</span>
              </div>
              <div className="card-body">
                <p className="bio-text">{bio}</p>
              </div>
            </div>
          )}

          {/* ═══ ACTIVE DIALECT ═══ */}
          <div className="card">
            <div className="card-head">
              <span className="card-icon yellow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
              </span>
              <span className="card-title">Active Dialect</span>
            </div>
            <div className="card-body">
              <button
                onClick={() => setShowLanguageModal(true)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 16px',
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, rgba(0,71,171,0.06) 0%, rgba(13,148,136,0.06) 100%)',
                  border: '1.5px solid rgba(0,71,171,0.14)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'transform 0.15s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.18s ease, background 0.18s ease',
                  WebkitTapHighlightColor: 'transparent',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget;
                  el.style.background = 'linear-gradient(135deg, rgba(0,71,171,0.10) 0%, rgba(13,148,136,0.10) 100%)';
                  el.style.boxShadow = '0 4px 16px rgba(0,71,171,0.10)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget;
                  el.style.background = 'linear-gradient(135deg, rgba(0,71,171,0.06) 0%, rgba(13,148,136,0.06) 100%)';
                  el.style.boxShadow = 'none';
                  el.style.transform = 'scale(1)';
                }}
                onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; }}
                onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.97)'; }}
                onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                {/* Gradient avatar */}
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: selectedLanguage.gradient,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  color: '#fff',
                  fontFamily: 'Poppins, sans-serif',
                  letterSpacing: '-0.01em',
                  transition: 'transform 0.18s cubic-bezier(0.34,1.4,0.64,1)',
                }}>
                  {selectedLanguage.name.charAt(0)}
                </div>

                {/* Name + meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: 700,
                    fontSize: '1rem',
                    color: '#1a2340',
                    letterSpacing: '-0.01em',
                    marginBottom: 3,
                  }}>
                    {selectedLanguage.name}
                    {selectedLanguage.code === getDefaultDialectCodeForExperience() && (
                      <span style={{
                        marginLeft: 7,
                        padding: '1px 8px',
                        borderRadius: 20,
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        background: 'rgba(0,71,171,0.10)',
                        color: '#0047ab',
                        verticalAlign: 'middle',
                        letterSpacing: '0.03em',
                        fontFamily: 'Poppins, sans-serif',
                      }}>Default</span>
                    )}
                  </div>
                  <div style={{
                    fontFamily: 'Poppins, sans-serif',
                    fontSize: '0.72rem',
                    fontWeight: 500,
                    color: '#6b7a99',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '4px 8px',
                  }}>
                    <span>{selectedLanguage.native}</span>
                    <span style={{ color: '#c9d1e3' }}>·</span>
                    <span>{selectedLanguage.region}</span>
                  </div>
                </div>

                {/* Chevron */}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, color: '#b0bcd4', flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          </div>

          {/* ═══ ACCOUNT SETTINGS ═══ */}
          <div className="card">
            <div className="card-head">
              <span className="card-icon grey">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </span>
              <span className="card-title">Account Settings</span>
            </div>
            <ul className="settings-list">
              <li>
                <button className="settings-item" onClick={() => setShowEditProfileModal(true)}>
                  <div className="settings-item-left">
                    <span className="settings-item-icon blue">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                    </span>
                    <span className="settings-item-label">Edit Profile</span>
                  </div>
                  <span className="settings-chevron">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </span>
                </button>
              </li>

              <li>
                <button className="settings-item" onClick={() => setShowNotifModal(true)}>
                  <div className="settings-item-left">
                    <span className="settings-item-icon teal">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
                        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
                        <line x1="6" y1="1" x2="6" y2="4"/>
                        <line x1="10" y1="1" x2="10" y2="4"/>
                        <line x1="14" y1="1" x2="14" y2="4"/>
                      </svg>
                    </span>
                    <span className="settings-item-label">Notification Preferences</span>
                  </div>
                  <span className="settings-chevron">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </span>
                </button>
              </li>

              <li>
                <button className="settings-item" onClick={() => setShowHelpModal(true)}>
                  <div className="settings-item-left">
                    <span className="settings-item-icon orange">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                    </span>
                    <span className="settings-item-label">Help Center</span>
                  </div>
                  <span className="settings-chevron">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </span>
                </button>
              </li>

              <li>
                <div className="settings-item settings-item--toggle">
                  <div className="settings-item-left">
                    <span className={`settings-item-icon ${qcbEnabled ? 'blue' : 'grey'}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                      </svg>
                    </span>
                    <div className="settings-item-label-group">
                      <span className="settings-item-label">Quick Chat Bubble</span>
                      <span className="settings-item-sublabel">
                        {qcbEnabled ? 'Floating emergency button is visible' : 'Floating emergency button is hidden'}
                      </span>
                    </div>
                  </div>
                  <button
                    className={`qcb-toggle ${qcbEnabled ? 'qcb-toggle--on' : ''}`}
                    onClick={toggleQcb}
                    aria-label={qcbEnabled ? 'Disable Quick Chat Bubble' : 'Enable Quick Chat Bubble'}
                    aria-pressed={qcbEnabled}
                  >
                    <span className="qcb-toggle__thumb" />
                  </button>
                </div>
              </li>

              {qcbEnabled && (
                <li>
                  <button className="settings-item" onClick={() => setShowQcbLanguageModal(true)}>
                    <div className="settings-item-left">
                      <span className="settings-item-icon blue">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                          <line x1="8" y1="10" x2="16" y2="10"/>
                          <line x1="8" y1="14" x2="13" y2="14"/>
                        </svg>
                      </span>
                      <div className="settings-item-label-group">
                        <span className="settings-item-label">Bubble Translation Dialect</span>
                        <span className="settings-item-sublabel">
                          <span
                            className="qcb-dialect-dot"
                            style={{ background: qcbLanguage.gradient }}
                          />
                          {qcbLanguage.name}
                          {qcbLanguage.code === 'fil' && (
                            <span className="qcb-dialect-note"> · translations hidden</span>
                          )}
                        </span>
                      </div>
                    </div>
                    <span className="settings-chevron">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </span>
                  </button>
                </li>
              )}

              <li>
                <button className="settings-item" onClick={() => setShowLogoutModal(true)}>
                  <div className="settings-item-left">
                    <span className="settings-item-icon red">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                    </span>
                    <span className="settings-item-label danger">Logout</span>
                  </div>
                  <span className="settings-chevron">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </span>
                </button>
              </li>
            </ul>
          </div>

        </div>

        {/* Modals */}
        <NotifModal
          isOpen={showNotifModal}
          onClose={() => setShowNotifModal(false)}
        />
        <EditProfileModal
          isOpen={showEditProfileModal}
          onClose={() => setShowEditProfileModal(false)}
          onSave={handleProfileSave}
        />
        <LanguageModal
          isOpen={showLanguageModal}
          onClose={() => setShowLanguageModal(false)}
          onSave={(lang) => persistLanguage(lang)}
          currentLanguageCode={selectedLanguage.code}
        />
        <LanguageModal
          isOpen={showQcbLanguageModal}
          onClose={() => setShowQcbLanguageModal(false)}
          onSave={(lang) => persistQcbLanguage(lang)}
          currentLanguageCode={qcbLanguage.code}
        />
        <HelpModal
          isOpen={showHelpModal}
          onClose={() => setShowHelpModal(false)}
        />
        <LogoutModal
          isOpen={showLogoutModal}
          onClose={() => setShowLogoutModal(false)}
          onConfirm={async () => {
            await signOut(firebaseAuth);
            setShowLogoutModal(false);
            history.replace('/login');
          }}
        />

      </IonContent>

      <IonFooter className="profile-footer ion-no-border">
          <nav className="profile-nav" aria-label="Main">
            <Link to="/learn" className="profile-nav__item">
              <IonIcon icon={bookOutline} className="profile-nav__icon" />
              <span className="profile-nav__label">Learn</span>
            </Link>
            <Link to="/quiz" className="profile-nav__item">
              <IonIcon icon={documentTextOutline} className="profile-nav__icon" />
              <span className="profile-nav__label">Quiz</span>
            </Link>
            <Link to="/home" className="profile-nav__item">
              <IonIcon icon={homeOutline} className="profile-nav__icon" />
              <span className="profile-nav__label">Home</span>
            </Link>
            <Link to="/chat" className={`profile-nav__item ${location.pathname === '/chat' ? 'profile-nav__item--active' : ''}`}>
              <IonIcon icon={chatbubbleOutline} className="profile-nav__icon" />
              <span className="profile-nav__label">Chat</span>
            </Link>
            <Link to="/profile" className={`profile-nav__item ${isProfile ? 'profile-nav__item--active' : ''}`}>
              <IonIcon icon={personOutline} className="profile-nav__icon" />
              <span className="profile-nav__label">Profile</span>
            </Link>
          </nav>
        </IonFooter>
    </IonPage>
  );
};

export default ProfilePage;
