# Connect SalinTayo to Firebase

## 1. Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** (or use an existing project).
3. Follow the steps (name, Google Analytics optional).

## 2. Enable Authentication

1. In the project, open **Build** → **Authentication**.
2. Click **Get started**.
3. Open the **Sign-in method** tab.
4. Enable **Email/Password** (and **Google** if you want “Continue with Google” later).
5. Save.

## 3. Register your app and get config

1. In Project Overview, click the **Web** icon (`</>`) to add a web app.
2. Give it a nickname (e.g. “SalinTayo web”) and optionally enable Firebase Hosting.
3. Copy the `firebaseConfig` object (or the individual values).

## 4. Add config to your app

1. In the project root, copy the example env file:
   ```bash
   copy .env.example .env
   ```
   (On macOS/Linux: `cp .env.example .env`)

2. Open `.env` and set each variable using the values from the Firebase Console:

   | Variable | Where to find it |
   |----------|-------------------|
   | `VITE_FIREBASE_API_KEY` | `config.apiKey` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `config.authDomain` |
   | `VITE_FIREBASE_PROJECT_ID` | `config.projectId` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `config.storageBucket` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | `config.messagingSenderId` |
   | `VITE_FIREBASE_APP_ID` | `config.appId` |

   Example `.env`:
   ```
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abc...
   ```

3. **Do not commit `.env`** — it’s in `.gitignore`. Use `.env.example` only as a template (no real keys).

## 5. Run the app

```bash
npm install
npm run dev
```

- **Login** and **Register** use Firebase Authentication (email/password).
- **Forgot password** sends a reset email via Firebase.
- Auth state is shared via `AuthContext`; use `useAuth()` in any component to read `user` and `loading`.

## Optional: Google sign-in

To enable “Continue with Google” on the login page:

1. In Firebase Console → **Authentication** → **Sign-in method**, enable **Google** and set support email.
2. Install and use `signInWithPopup` (or `signInWithRedirect`) with `GoogleAuthProvider` from `firebase/auth` in `Login.tsx`.
