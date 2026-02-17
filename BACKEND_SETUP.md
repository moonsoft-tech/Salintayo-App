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
