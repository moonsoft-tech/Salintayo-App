import { firebaseAuth } from '../firebase';

/**
 * Base URL for Firebase Cloud Functions.
 * Set VITE_FUNCTIONS_URL in .env (e.g. https://us-central1-YOUR_PROJECT.cloudfunctions.net)
 * For local emulator: http://127.0.0.1:5001/YOUR_PROJECT/us-central1
 */
const FUNCTIONS_BASE = import.meta.env.VITE_FUNCTIONS_URL || '';

/**
 * Call a public Cloud Function (no auth required).
 */
async function callPublicApi<T = unknown>(
  functionName: string,
  options: Omit<RequestInit, 'body'> & { body?: unknown } = {}
): Promise<T> {
  if (!FUNCTIONS_BASE) {
    throw new Error('VITE_FUNCTIONS_URL is not set. Add it to .env');
  }
  const url = `${FUNCTIONS_BASE}/${functionName}`;
  const { body, ...rest } = options;
  const resolvedBody = body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body);
  const res = await fetch(url, {
    ...rest,
    method: rest.method || 'POST',
    headers: { 'Content-Type': 'application/json', ...(rest.headers as Record<string, string>) },
    body: resolvedBody,
  });
  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Request failed');
  }
  return data as T;
}

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

  if (!FUNCTIONS_BASE) {
    throw new Error('VITE_FUNCTIONS_URL is not set. Add it to .env for the Chat API.');
  }

  const url = `${FUNCTIONS_BASE}/${functionName}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'Failed to fetch' || msg.includes('Load failed') || msg.includes('NetworkError')) {
      throw new Error(
        'Cannot reach the server (network or CORS). Make sure you ran "firebase deploy --only functions" and that chatCompletion is deployed.'
      );
    }
    throw e;
  }

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

/** Chat message format (OpenAI/OpenRouter compatible). */
export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Mark the current user as registered (app sign-up). Called after successful registration. */
export async function markUserRegistered(): Promise<void> {
  await callProtectedApi('markUserRegistered', { method: 'POST', body: JSON.stringify({}) });
}

/** Request a 6-digit password reset code to be sent to the given email. */
export async function sendPasswordResetCode(email: string): Promise<void> {
  await callPublicApi('sendPasswordResetCode', { method: 'POST', body: { email } });
}

/** Verify the password reset code. Throws if invalid or expired. */
export async function verifyPasswordResetCode(email: string, code: string): Promise<void> {
  await callPublicApi('verifyPasswordResetCode', { method: 'POST', body: { email, code } });
}

/** Reset password using the verified code. */
export async function resetPasswordWithCode(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  await callPublicApi('resetPasswordWithCode', {
    method: 'POST',
    body: { email, code, newPassword },
  });
}

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = 'deepseek/deepseek-chat';

/**
 * Chat with DeepSeek via OpenRouter (client-side). No Firebase Blaze or Cloud Functions needed.
 * Get an API key at https://openrouter.ai/keys and optionally restrict it by origin.
 * Returns the assistant's reply content.
 */
export async function chatWithDeepSeek(messages: DeepSeekMessage[]): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error(
      'VITE_OPENROUTER_API_KEY is not set. Add it to .env (get a key at https://openrouter.ai/keys).'
    );
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages,
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    const msg = err?.error?.message ?? err?.message ?? res.statusText;
    throw new Error(msg || 'OpenRouter request failed');
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (data.error) {
    throw new Error(data.error.message || 'OpenRouter error');
  }
  return data.choices?.[0]?.message?.content ?? '';
}
