import { firebaseApp, firebaseAuth } from '../firebase';
import { getOpenRouterFetchHeaders } from './openRouterClient';

/**
 * Base URL for Firebase Cloud Functions.
 * Set VITE_FUNCTIONS_URL in .env (e.g. https://us-central1-YOUR_PROJECT.cloudfunctions.net)
 * For local emulator: http://127.0.0.1:5001/YOUR_PROJECT/us-central1
 */
const FUNCTIONS_REGION = (import.meta.env.VITE_FUNCTIONS_REGION || 'us-central1').trim();

function resolveFunctionsBaseUrl(): string {
  const explicit = (import.meta.env.VITE_FUNCTIONS_URL || '').trim().replace(/\/+$/, '');
  if (explicit) return explicit;

  const projectId = (firebaseApp.options.projectId || '').trim();
  if (!projectId || projectId === 'placeholder') return '';

  return `https://${FUNCTIONS_REGION}-${projectId}.cloudfunctions.net`;
}

const FUNCTIONS_BASE = resolveFunctionsBaseUrl();

/**
 * Call a public Cloud Function (no auth required).
 */
function formatFunctionsHttpError(status: number, data: Record<string, unknown>): string {
  const detail = (data.message || data.error || data.detail || '').toString().trim();
  if (status === 404 || /page not found/i.test(detail)) {
    return (
      'Voice transcription service is not deployed yet. ' +
      'Deploy Firebase function "transcribeWhisper" (Blaze plan + OPENAI_API_KEY), ' +
      'or use on-device Speech-to-Text.'
    );
  }
  return detail || `Request failed (${status})`;
}

async function callPublicApi<T = unknown>(
  functionName: string,
  options: Omit<RequestInit, 'body'> & { body?: unknown } = {}
): Promise<T> {
  if (!FUNCTIONS_BASE) {
    throw new Error('Cloud Functions URL is not configured. Set VITE_FUNCTIONS_URL or Firebase projectId env values.');
  }
  const url = `${FUNCTIONS_BASE}/${functionName}`;
  const { body, ...rest } = options;
  const resolvedBody = body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body);
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      method: rest.method || 'POST',
      headers: { 'Content-Type': 'application/json', ...(rest.headers as Record<string, string>) },
      body: resolvedBody,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'Failed to fetch' || msg.includes('Load failed') || msg.includes('NetworkError')) {
      throw new Error(
        'Cannot reach Cloud Functions (network or CORS). Deploy "transcribeWhisper", check VITE_FUNCTIONS_URL, or use on-device Speech-to-Text.'
      );
    }
    throw e;
  }
  const data = (await res.json().catch(() => ({ error: res.statusText }))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(formatFunctionsHttpError(res.status, data));
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
    throw new Error(
      'Cloud Functions URL is not configured. Set VITE_FUNCTIONS_URL or Firebase projectId env values for Chat API.'
    );
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
        'Cannot reach Cloud Functions (network or CORS). Set VITE_FUNCTIONS_URL, deploy functions (e.g. transcribeWhisper/chatCompletion), or use the emulator URL.'
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
    headers: getOpenRouterFetchHeaders(OPENROUTER_API_KEY),
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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read audio blob'));
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unexpected FileReader result'));
        return;
      }
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

/** Strip codec params so backends accept "audio/webm;codecs=opus" as "audio/webm". */
function normalizeAudioMime(mimeType: string | undefined): string {
  const raw = (mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
  return raw || 'audio/webm';
}

const LOGIC_URL = (import.meta.env.VITE_LOGIC_URL || '').trim().replace(/\/+$/, '');
const LOGIC_API_KEY = import.meta.env.VITE_LOGIC_API_KEY || '';

/** Transcription via your self-hosted logic service (Python Whisper). */
async function transcribeWhisperDirectLogic(
  audioBlob: Blob,
  whisperModel?: string
): Promise<{ text: string }> {
  if (!LOGIC_URL) {
    throw new Error('VITE_LOGIC_URL is not set. Point it to your hosted logic service (e.g. https://your-logic-host).');
  }

  const audioBase64 = await blobToBase64(audioBlob);
  const res = await fetch(`${LOGIC_URL}/logic/transcribeWhisper`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(LOGIC_API_KEY ? { 'x-logic-key': LOGIC_API_KEY } : {}),
    },
    body: JSON.stringify({
      audio_base64: audioBase64,
      mime_type: normalizeAudioMime(audioBlob.type),
      whisper_model: whisperModel,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.detail || data?.error || data?.message || `Logic request failed: ${res.status}`);
  }

  return data as { text: string };
}

/**
 * Whisper via Cloud Functions.
 * Server endpoint is public (rate-limited); do not require Firebase Auth.
 */
async function transcribeWhisperViaFunctions(audioBlob: Blob, whisperModel?: string): Promise<{ text: string }> {
  if (!audioBlob.size) {
    throw new Error('No audio to transcribe.');
  }
  const audioBase64 = await blobToBase64(audioBlob);
  return callPublicApi<{ text: string }>('transcribeWhisper', {
    method: 'POST',
    body: {
      audio_base64: audioBase64,
      mime_type: normalizeAudioMime(audioBlob.type),
      whisper_model: whisperModel,
    },
  });
}

/** Transcription via self-hosted logic service (preferred) with Cloud Functions fallback. */
export async function transcribeWhisper(
  audioBlob: Blob,
  whisperModel?: string
): Promise<{ text: string }> {
  if (LOGIC_URL) {
    return transcribeWhisperDirectLogic(audioBlob, whisperModel);
  }
  return transcribeWhisperViaFunctions(audioBlob, whisperModel);
}
