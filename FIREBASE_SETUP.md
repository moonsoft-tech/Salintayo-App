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
- **Forgot password** uses a 6-digit code sent to the user's email (Gmail). See below for SMTP setup.
- Auth state is shared via `AuthContext`; use `useAuth()` in any component to read `user` and `loading`.

## Password reset (code-based flow)

Forgot password sends a 6-digit code to the user's email instead of a link. Requires:

- **Firestore** enabled in your Firebase project (Build → Firestore Database → Create database).
- **SMTP configuration** (Gmail recommended):

1. **Gmail App Password** (recommended for Gmail):
   - Enable 2-Step Verification on your Google account.
   - Go to [Google Account → Security → App passwords](https://myaccount.google.com/apppasswords).
   - Generate an app password for "Mail" and copy it.

2. **Configure Firebase Functions**:
   ```bash
   firebase functions:config:set smtp.user="your@gmail.com" smtp.pass="xxxx xxxx xxxx xxxx"
   ```

3. **Deploy the functions**:
   ```bash
   cd functions && npm run build && firebase deploy --only functions
   ```

4. Ensure `VITE_FUNCTIONS_URL` is set in `.env` (e.g. `https://us-central1-YOUR_PROJECT.cloudfunctions.net`).

## Optional: Google sign-in

To enable “Continue with Google” on the login page:

1. In Firebase Console → **Authentication** → **Sign-in method**, enable **Google** and set support email.
2. Add your app's URL to **Authorized domains**: Authentication → **Settings** → **Authorized domains**. Include `localhost` for dev and your production domain when you deploy.
3. The app uses `signInWithPopup` and falls back to `signInWithRedirect` if the popup is blocked.
