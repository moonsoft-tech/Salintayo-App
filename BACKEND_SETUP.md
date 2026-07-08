# SalinTayo Backend Setup

Server-side architecture: **Firebase Cloud Functions** (API, auth, CORS) + **Python FastAPI** (business logic).

## Architecture

| Layer | Technology | Role |
|-------|------------|------|
| API | Firebase Cloud Functions (Node.js) | Auth verification, CORS, routing, HTTP handling |
| Logic | Python FastAPI | Business logic (validation, rules, computations) |

Flow: Frontend → Cloud Functions (verify token) → Python Logic Service → response back to client.

---

## 1. Python Logic Service

### Local Development

```bash
cd logic
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
```

### Deploy to Cloud Run

```bash
# From project root
gcloud run deploy salintayo-logic \
  --source logic \
  --region us-central1 \
  --allow-unauthenticated
```

Note the service URL (e.g. `https://salintayo-logic-xxx-uc.a.run.app`).

---

## 2. Firebase Cloud Functions

### Install Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

### Link Project

```bash
firebase use --add
```

### Set Python Logic URL

```bash
firebase functions:config:set logic.service_url="https://salintayo-logic-xxx-uc.a.run.app"
```

For local emulator, set `LOGIC_SERVICE_URL=http://localhost:8080` in the environment or use `firebase functions:config:get` to verify.

### Install & Deploy Functions

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

---

## 3. Frontend Environment

Add to `.env`:

```
VITE_FUNCTIONS_URL=https://us-central1-YOUR_PROJECT.cloudfunctions.net
```

For local emulator:

```
VITE_FUNCTIONS_URL=http://127.0.0.1:5001/YOUR_PROJECT/us-central1
```

---

## 4. Local Emulator (Optional)

Terminal 1 — Python logic:

```bash
cd logic && uvicorn main:app --reload --port 8080
```

Terminal 2 — Firebase functions:

```bash
cd functions
set LOGIC_SERVICE_URL=http://host.docker.internal:8080
npm run serve
```

(On macOS/Linux use `export LOGIC_SERVICE_URL=...` and for Docker networking use `host.docker.internal` or your machine’s IP.)

---

## DeepSeek API (Chat)

The Chat page uses DeepSeek-V3 via OpenAI-compatible API. Set the API key:

```bash
firebase functions:config:set deepseek.api_key="sk-YOUR_DEEPSEEK_API_KEY"
```

Get your API key at [platform.deepseek.com](https://platform.deepseek.com/). Redeploy functions after setting the config.

## Endpoints

| Function | Method | Auth | Description |
|----------|--------|------|-------------|
| `getMe` | GET | Required | Returns verified user info (logic in Python) |
| `validateUserAction` | POST | Required | Server-side validation (logic in Python) |
| `chatCompletion` | POST | Required | DeepSeek-V3 chat (body: `{ messages: [...] }`) |

---

## Android APK & Google Sign-In

The Ionic app uses **Firebase Auth (web SDK)** in the WebView and **`@capgo/capacitor-social-login`** on device for Google. The native layer must receive the same **OAuth 2.0 Web client ID** (`VITE_GOOGLE_WEB_CLIENT_ID` in `.env`) that Firebase uses for web, and your Firebase project must trust this Android build.

### 1. Register the Android app in Firebase

1. Firebase Console → Project settings → Your apps → **Add app** → Android.  
2. **Android package name:** `io.ionic.starter` (must match `applicationId` in `android/app/build.gradle` and `appId` in `capacitor.config.ts`).  
3. Download **`google-services.json`** and place it at **`android/app/google-services.json`** (optional for JS-only Firebase Auth, but recommended; enables the Google services Gradle plugin when present).

### 2. Add SHA-1 (and SHA-256) fingerprints

Without this, Google Sign-In often fails with **ApiException 10 / DEVELOPER_ERROR**.

**Debug keystore** (local installs / debug APK):

```bash
# Windows (adjust path to your debug keystore if different)
keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
```

**Release keystore** (Play Store / release APK): use your release `.jks` / `.keystore` and its passwords.

Copy the **SHA-1** (and **SHA-256**) into Firebase Console → Project settings → Your Android app → **Add fingerprint**.  
After saving, download a fresh **`google-services.json`** if you use it.

Firebase/GCP will create or update an **Android OAuth 2.0 client** for that package + SHA; the **`VITE_GOOGLE_WEB_CLIENT_ID`** must remain the **Web client** ID used by `GoogleAuthProvider` / the Social Login plugin’s `webClientId` (not the Android client ID string).

### 3. Build env vars baked into the APK

Run **`npm run build`** (or `npm run build && npx cap sync android`) with a populated **`.env`** so Vite embeds:

- `VITE_FIREBASE_*` — Firebase config  
- `VITE_GOOGLE_WEB_CLIENT_ID` — Web client ID (required on device)  
- `VITE_APP_PUBLIC_URL` or `VITE_OPENROUTER_HTTP_REFERER` — if OpenRouter keys are restricted by HTTP Referer (Capacitor uses `https://localhost` in the WebView)

### 4. Capacitor sync & Android Studio

```bash
npm run build
npx cap sync android
```

Open **`android/`** in Android Studio. **JDK 17+** is required for current Android Gradle Plugin. Build **Run** or **Build → Build Bundle(s) / APK(s)**.

### 5. Build the APK without Android Studio (lighter PC)

You only need **JDK 17+** and the **Android SDK** you already use for `adb` (no full IDE required).

1. Install a JDK 17 build (e.g. [Eclipse Temurin 17](https://adoptium.net/) Windows x64 MSI).
2. In **PowerShell** for that session, point Gradle at JDK 17 (adjust the path if yours differs):

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.13.11-hotspot"
```

3. From the **project root**:

```powershell
npm run build
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```

4. Install on a USB-connected phone:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r ".\app\build\outputs\apk\debug\app-debug.apk"
```

**Important:** If you change any `.env` values or web code, you must run **`npm run build`**, **`npx cap sync android`**, and **`assembleDebug`** again. Installing an **old** `app-debug.apk` will **not** pick up new JS from `cap sync` until you rebuild the APK.

### 6. Troubleshooting Google Sign-In

- After adding **SHA-1**, open the downloaded **`google-services.json`**. Under `oauth_client` you should normally see an entry with **`client_type": 1`** and **`android_info`** (package + certificate hash). If you only see **`client_type": 3`**, try removing and re-adding the fingerprint in Firebase, then download again; or in **Google Cloud Console → APIs & Services → Credentials**, confirm an **Android** OAuth client exists for **`io.ionic.starter`** with your SHA-1.
- On the device, the login screen should show a **specific error** after a failed attempt (plugin or Firebase message). Use that text to narrow the issue.

### 7. Google Cloud Console — OAuth consent screen & client IDs

Use one Google Cloud project (linked to Firebase) so web and Android share the same OAuth brand and Firebase Auth.

1. **OAuth consent screen** (Google Cloud Console → **APIs & Services** → **OAuth consent screen**):
   - Choose **External** (or **Internal** if Workspace-only).
   - Fill **App name**, **User support email**, **Developer contact**.
   - Add **Scopes** needed for Sign-In (Firebase usually uses `openid`, `email`, `profile` via Google Sign-In).
   - While testing, add **Test users** if the app is not yet verified for production.

2. **Credentials** (same console → **Credentials**):
   - **Web client**: Used by the browser app and by `@capgo/capacitor-social-login` as `webClientId` (`VITE_GOOGLE_WEB_CLIENT_ID`). This is typically the “Web client” shown in Firebase → Project settings → Your web app, or an OAuth 2.0 Client ID of type **Web application**.
   - **Android client**: Created automatically when you register the Android app in Firebase and add **SHA-1** fingerprints. You do **not** paste the Android client ID into the app for this flow; the native SDK uses the package name + SHA + **Web client ID** server-side pattern with Firebase.
   - Keep **Authorised JavaScript origins** and **Authorised redirect URIs** correct for your **web** deployment (Firebase Hosting domain, `localhost` for dev).

3. **Firebase Authentication** → **Sign-in method** → **Google**: enable and ensure the **Web SDK configuration** matches your project (support email, etc.).

---

## Using in Your App

```ts
import { fetchMe, callProtectedApi } from './utils/api';

// Fetch server-verified user info
const userInfo = await fetchMe();

// Call other protected endpoints
const result = await callProtectedApi('validateUserAction', {
  method: 'POST',
  body: JSON.stringify({ action: 'submit_quiz' }),
});
```
