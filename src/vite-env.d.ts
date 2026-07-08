/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FUNCTIONS_URL?: string;
  /** OAuth 2.0 Web client ID — required for native Google Sign-In (@capgo/capacitor-social-login + Firebase). */
  readonly VITE_GOOGLE_WEB_CLIENT_ID?: string;
  /** Public site URL for OpenRouter HTTP-Referer on native (when window origin is localhost). */
  readonly VITE_APP_PUBLIC_URL?: string;
  /** Optional override for OpenRouter HTTP-Referer on all platforms. */
  readonly VITE_OPENROUTER_HTTP_REFERER?: string;
  readonly VITE_OPENROUTER_API_KEY?: string;
  readonly VITE_OPENROUTER_VISION_MODEL?: string;
  readonly VITE_LOGIC_URL?: string;
  readonly VITE_LOGIC_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
