import {
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { firebaseAuth } from '../firebase';

/** Thrown when the browser blocked the popup and a full-page redirect was started. */
export class GoogleWebRedirectStarted extends Error {
  constructor() {
    super('Google sign-in redirect started');
    this.name = 'GoogleWebRedirectStarted';
  }
}

/**
 * Google Sign-In for web browsers: Firebase popup, with redirect fallback when popups are blocked.
 * Does not use Custom Tabs or external browser flows on mobile WebViews — use native sign-in on Capacitor instead.
 */
export async function signInWithGoogleWeb(): Promise<User> {
  const provider = new GoogleAuthProvider();
  try {
    const { user } = await signInWithPopup(firebaseAuth, provider);
    return user;
  } catch (err: unknown) {
    const code =
      err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : '';

    if (code === 'auth/popup-blocked') {
      await signInWithRedirect(firebaseAuth, provider);
      throw new GoogleWebRedirectStarted();
    }
    throw err;
  }
}

export function getGoogleWebErrorMessage(err: unknown): string {
  const code =
    err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : '';

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Sign-in was cancelled.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'This domain is not authorised for Google sign-in. Add it in Firebase Console → Authentication → Settings → Authorised domains.';
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return 'An account already exists with the same email but a different sign-in method.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.';
  }
  return 'Google sign-in failed. Please try again.';
}
