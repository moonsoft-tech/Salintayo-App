import React, { useState, useEffect, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import {
  getRedirectResult,
  setPersistence,
  browserLocalPersistence,
  indexedDBLocalPersistence,
} from 'firebase/auth';
import { IonSpinner } from '@ionic/react';
import { Capacitor } from '@capacitor/core';
import { firebaseAuth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { hasSeenWelcome } from '../utils/welcomeStorage';
import { signInWithGoogleNative } from '../utils/googleAuthNative';
import {
  signInWithGoogleWeb,
  GoogleWebRedirectStarted,
  getGoogleWebErrorMessage,
} from '../utils/googleAuthWeb';
import './Login.css';

const imgLogo = '/logo.png';
const imgGoogleIcon = '/icons/google.svg';

/** True when running inside Capacitor (Android APK / iOS). Uses native Google Sign-In — no OAuth redirect in WebView. */
function isNativeAppShell(): boolean {
  return Capacitor.isNativePlatform();
}

function navigateAfterLogin(uid: string, history: ReturnType<typeof useHistory>) {
  history.replace(hasSeenWelcome(uid) ? '/home' : '/welcome');
}

export default function LoginPage() {
  const history = useHistory();
  const { user } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const ensureRedirectPersistence = useCallback(async () => {
    if (isNativeAppShell()) {
      try {
        await setPersistence(firebaseAuth, indexedDBLocalPersistence);
        return;
      } catch {
        // Continue to browser persistence fallback.
      }
    }

    try {
      await setPersistence(firebaseAuth, browserLocalPersistence);
      return;
    } catch {
      // browser localStorage may be blocked in this Android browser environment
    }

    try {
      await setPersistence(firebaseAuth, indexedDBLocalPersistence);
    } catch {
      // If IndexedDB also fails, continue with default persistence.
    }
  }, []);

  /* ── Web only: consume redirect result after popup was blocked ── */
  useEffect(() => {
    if (isNativeAppShell()) return;

    let cancelled = false;

    (async () => {
      try {
        const result = await getRedirectResult(firebaseAuth);
        if (cancelled) return;
        if (result?.user) {
          navigateAfterLogin(result.user.uid, history);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const code =
          err && typeof err === 'object' && 'code' in err
            ? (err as { code: string }).code
            : '';
        if (code && code !== 'auth/no-auth-event') {
          setError('Google sign-in failed after redirect. Please try again.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Redirect already-authenticated users ── */
  useEffect(() => {
    if (user) {
      navigateAfterLogin(user.uid, history);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    /** Keep spinner until the OAuth redirect navigates away (web popup-blocked path). */
    let keepLoadingForRedirect = false;

    try {
      await ensureRedirectPersistence();

      if (isNativeAppShell()) {
        const u = await signInWithGoogleNative();
        navigateAfterLogin(u.uid, history);
        return;
      }

      try {
        const u = await signInWithGoogleWeb();
        navigateAfterLogin(u.uid, history);
      } catch (err: unknown) {
        if (err instanceof GoogleWebRedirectStarted) {
          setError('Redirecting to Google…');
          keepLoadingForRedirect = true;
          return;
        }
        setError(getGoogleWebErrorMessage(err));
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : getGoogleWebErrorMessage(err);
      setError(message);
    } finally {
      if (!keepLoadingForRedirect) setLoading(false);
    }
  };

  return (
    <div
      className={`login-page${loading ? ' login-page--busy' : ''}`}
      aria-busy={loading}
    >
      <div className="login-page__bg" aria-hidden />
      <div className="login-page__dots" aria-hidden />
      <div className="login-page__accent" aria-hidden />
      <div className="login-page__ring" aria-hidden />

      {loading && (
        <div
          className="login-page__auth-overlay"
          role="status"
          aria-live="polite"
          aria-label="Signing in with Google"
        >
          <IonSpinner name="crescent" className="login-page__auth-spinner" />
          <p className="login-page__auth-label">Signing in with Google…</p>
        </div>
      )}

      <div className="login-page__inner">
        <header className="login-header">
          <div className="login-header__logo">
            <img src={imgLogo} alt="SalinTayo" />
          </div>
          <h1 className="login-header__title">
            Welcome to{' '}
            <span className="login-header__title-brand">SalinTayo!</span>
          </h1>
          <p className="login-header__subtitle">Continue learning and translating with AI.</p>
        </header>

        <div className="login-form">
          <div className="login-divider">
            <span className="login-divider__text">Sign in with</span>
          </div>

          {error && (
            <p className="login-form__error" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            className="login-btn--google"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <img src={imgGoogleIcon} alt="" className="login-btn__google-icon" />
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>

          <p className="login-privacy">
            By continuing, you agree to our <a href="/terms">Terms of Service</a> and{' '}
            <a href="/privacy">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
