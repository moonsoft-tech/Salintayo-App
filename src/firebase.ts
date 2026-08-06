import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  type Auth,
} from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, type Firestore } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { logBootStep, auditEnvironmentVariables, logStartupError, renderDebugPage } from './bootLogger';

logBootStep('[BOOT 06] Firebase init started');
auditEnvironmentVariables([
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]);

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'placeholder',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'placeholder.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'placeholder',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'placeholder.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '0',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:0:web:0',
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

export function getFirebase() {
  if (!app) {
    try {
      app = initializeApp(firebaseConfig);

      // `getAuth(app)` eagerly wires up Firebase's default popup/redirect
      // resolver, which injects a hidden iframe pointed at `authDomain`
      // (https://<project>.firebaseapp.com/__/auth/iframe) to track
      // cross-tab auth state and pending redirect results. This happens
      // unconditionally on Auth init, regardless of whether any
      // popup/redirect sign-in method is ever called.
      //
      // Inside a Capacitor WKWebView the app's origin is
      // `capacitor://localhost` — not a real http(s) origin — so that
      // iframe fails to initialize correctly against its parent. Because
      // the failing script lives in that cross-origin iframe, the browser
      // reports it to window.onerror as the generic, stack-less
      // "Script error." (only reproducible with network access, since the
      // iframe has to actually load before it can fail — hence: fine with
      // WiFi off, broken with WiFi on).
      //
      // Native sign-in goes through signInWithGoogleNative() and never
      // uses the popup/redirect flow, so native platforms skip the
      // resolver entirely instead of letting it auto-initialize.
      const isNative = Capacitor.isNativePlatform();
      auth = initializeAuth(app, {
        persistence: isNative ? indexedDBLocalPersistence : browserLocalPersistence,
        ...(isNative ? {} : { popupRedirectResolver: browserPopupRedirectResolver }),
      });

      try {
        db = initializeFirestore(app, { localCache: persistentLocalCache({}) });
      } catch {
        db = getFirestore(app);
      }
    } catch (error) {
      logStartupError(error, 'firebase.ts');
      renderDebugPage(error, 'firebase.ts');
      throw error;
    } finally {
      logBootStep('[BOOT 07] Firebase init finished');
    }
  }
  return { app, auth, db };
}

const { app: firebaseApp, auth: firebaseAuth, db: firebaseDb } = getFirebase();
export { firebaseApp, firebaseAuth, firebaseDb };
export default getFirebase;