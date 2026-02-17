import { firebaseAuth } from '../firebase';

/**
 * Base URL for API (Firebase Cloud Functions or Vercel).
 * - Firebase: https://us-central1-YOUR_PROJECT.cloudfunctions.net
 * - Vercel: leave empty to use same-origin /api/chatCompletion
 */
const FUNCTIONS_BASE = import.meta.env.VITE_FUNCTIONS_URL || '';

/**
 * Get the current user's ID token for authenticated requests.
 * Returns null if not logged in.
 */
export async function getIdToken(): Promise<string | null> {
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

/**
 * Call a protected Cloud Function with auth.
 * Automatically adds Authorization: Bearer <token>.
 * Throws on auth failure or non-2xx response.
 */
export async function callProtectedApi<T = unknown>(
  functionName: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getIdToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const url = FUNCTIONS_BASE ? `${FUNCTIONS_BASE}/${functionName}` : `/${functionName}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.message || err.error || 'Request failed');
  }

  return res.json();
}

/**
 * Example: fetch current user info from server (verified server-side).
 */
export async function fetchMe() {
  return callProtectedApi<{ uid: string; email?: string; email_verified?: boolean }>('getMe', {
    method: 'GET',
  });
}

/** DeepSeek message format (OpenAI-compatible). */
export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Chat with DeepSeek-V3. Sends messages to Cloud Function which proxies to DeepSeek API.
 * Returns the assistant's reply content.
 */
export async function chatWithDeepSeek(messages: DeepSeekMessage[]): Promise<string> {
  // Vercel: /api/chatCompletion (same origin). Firebase: FUNCTIONS_BASE/chatCompletion
  const chatPath = FUNCTIONS_BASE ? 'chatCompletion' : 'api/chatCompletion';
  const result = await callProtectedApi<{ content: string }>(chatPath, {
    method: 'POST',
    body: JSON.stringify({ messages }),
  });
  return result.content ?? '';
}
