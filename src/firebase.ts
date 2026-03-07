import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

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

function getFirebase() {
  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
  }
  return { app, auth };
}

export const { app: firebaseApp, auth: firebaseAuth } = getFirebase();
export default getFirebase;
