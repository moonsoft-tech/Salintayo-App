import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, type Firestore } from 'firebase/firestore';
import { logBootStep, auditEnvironmentVariables, logStartupError } from './bootLogger';

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
      auth = getAuth(app);
      try {
        db = initializeFirestore(app, { localCache: persistentLocalCache({}) });
      } catch {
        db = getFirestore(app);
      }
    } catch (error) {
      logStartupError(error, 'firebase.ts');
      throw error;
    } finally {
      logBootStep('[BOOT 07] Firebase init finished');
    }
  }
  return { app, auth, db };
}

export default getFirebase;
