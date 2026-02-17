# Vercel Setup for SalinTayo Chat

## 1. Environment Variables

Add these in **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**:

| Variable | Value | Notes |
|----------|-------|-------|
| `DEEPSEEK_API_KEY` | `sk-xxxxx` | Your DeepSeek API key from https://platform.deepseek.com/ |
| `FIREBASE_API_KEY` | Your Firebase Web API key | Same as `VITE_FIREBASE_API_KEY` in your `.env` (for token verification) |

> **Tip:** Use `VITE_FIREBASE_API_KEY` if you prefer—the API route checks both.

## 2. Redeploy

After adding the env vars, go to **Deployments** → click the **⋯** on the latest → **Redeploy** (so the new variables take effect).

## 3. Local Dev

When running `npm run dev` locally, the chat needs to reach your deployed Vercel API. Add to `.env`:

```env
VITE_FUNCTIONS_URL=https://your-app.vercel.app
```

This makes the chat call `https://your-app.vercel.app/api/chatCompletion`. When the app is deployed on Vercel, leave `VITE_FUNCTIONS_URL` unset so it uses the same-origin `/api/chatCompletion`.

## 4. API Route

The chat API lives at `/api/chatCompletion` and:

- Accepts `POST` with `{ messages: [...] }`
- Requires `Authorization: Bearer <Firebase_ID_token>`
- Proxies to DeepSeek and returns `{ content: "..." }`
