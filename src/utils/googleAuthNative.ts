import { SocialLogin } from '@capgo/capacitor-social-login';
import { GoogleAuthProvider, signInWithCredential, type User } from 'firebase/auth';
import { firebaseAuth } from '../firebase';

const webClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined;

let socialLoginReady = false;

function isUserCancelledGoogleSignIn(err: unknown): boolean {
  const msg =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message?: unknown }).message)
      : String(err);
  // Android: ApiException 125 = SIGN_IN_CANCELLED; common plugin strings
  if (/cancel|dismiss|denied|aborted|125|sign_in_cancelled|user_cancel/i.test(msg)) {
    return true;
  }
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
  return code === 'CANCELED' || code === 'cancelled';
}

function rethrowIfAndroidOAuthMisconfigured(err: unknown): never {
  const msg =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message?: unknown }).message)
      : String(err);
  if (/DEVELOPER_ERROR|apiexception.*10\b|code:\s*10\b/i.test(msg)) {
    throw new Error(
      'Google Sign-In failed: Android OAuth setup (SHA-1 fingerprint + Android app in Firebase, matching package id io.ionic.starter). See BACKEND_SETUP.md — Android APK & Google Sign-In.',
    );
  }
  throw err;
}

/**
 * Google Sign-In for Capacitor (Android/iOS). Uses the native Google account picker
 * and exchanges the ID token with Firebase — avoids signInWithRedirect, which breaks
 * in WebViews (sessionStorage / partitioned storage).
 */
export async function signInWithGoogleNative(): Promise<User> {
  if (!webClientId?.trim()) {
    throw new Error(
      'Set VITE_GOOGLE_WEB_CLIENT_ID in .env to your OAuth 2.0 Web client ID (Google Cloud Console → APIs & Services → Credentials, or Firebase Console → Project settings → General → your Web app).',
    );
  }

  if (!socialLoginReady) {
    await SocialLogin.initialize({
      google: {
        webClientId: webClientId.trim(),
        mode: 'online',
      },
    });
    socialLoginReady = true;
  }

  try {
    const res = await SocialLogin.login({
      provider: 'google',
      options: {},
    });

    if (res.provider !== 'google') {
      throw new Error('Unexpected login provider');
    }

    const googleResult = res.result;
    if (googleResult.responseType !== 'online') {
      throw new Error('Google offline mode is not supported for Firebase sign-in');
    }

    const idToken = googleResult.idToken;
    if (!idToken) {
      throw new Error('Google did not return an ID token');
    }

    const credential = GoogleAuthProvider.credential(idToken);
    const { user } = await signInWithCredential(firebaseAuth, credential);
    return user;
  } catch (err) {
    if (isUserCancelledGoogleSignIn(err)) {
      throw new Error('Sign-in was cancelled.');
    }
    const code =
      err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
    if (code === 'auth/invalid-credential') {
      throw new Error(
        'Firebase rejected the Google sign-in (invalid credential). Check VITE_GOOGLE_WEB_CLIENT_ID matches the Web OAuth client in the same Firebase project, and re-download google-services.json after adding your SHA-1 in Firebase.',
      );
    }
    if (code === 'auth/operation-not-allowed') {
      throw new Error(
        'Google sign-in is disabled in Firebase. Enable it in Firebase Console → Authentication → Sign-in method → Google.',
      );
    }
    rethrowIfAndroidOAuthMisconfigured(err);
  }
}
