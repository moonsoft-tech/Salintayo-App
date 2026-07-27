import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';
const cors = require('cors');

admin.initializeApp();

const corsHandler = cors({ origin: true });
const db = admin.firestore();

const CODE_LENGTH = 6;
const CODE_EXPIRY_MINUTES = 10;

function getClientIp(req: functions.https.Request): string {
  const xfwd = (req.headers['x-forwarded-for'] || '').toString();
  const first = xfwd.split(',')[0]?.trim();
  return first || req.ip || 'unknown';
}

type RateLimitBucket = { windowMs: number; max: number; hits: number[] };
const whisperRateLimits = new Map<string, RateLimitBucket[]>();
function checkRateLimit(key: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const buckets = whisperRateLimits.get(key) ?? [
    { windowMs: 60_000, max: 10, hits: [] }, // 10/min
    { windowMs: 3_600_000, max: 60, hits: [] }, // 60/hour
  ];
  for (const b of buckets) {
    b.hits = b.hits.filter((t) => now - t < b.windowMs);
    if (b.hits.length >= b.max) {
      const oldest = b.hits[0] ?? now;
      const retryAfterMs = Math.max(0, b.windowMs - (now - oldest));
      whisperRateLimits.set(key, buckets);
      return { ok: false, retryAfterSec: Math.ceil(retryAfterMs / 1000) };
    }
  }
  for (const b of buckets) b.hits.push(now);
  whisperRateLimits.set(key, buckets);
  return { ok: true };
}

async function verifyAppCheckIfPresent(
  req: functions.https.Request
): Promise<{ ok: true } | { ok: false; message: string }> {
  const token =
    (req.header('X-Firebase-AppCheck') ||
      req.header('X-Firebase-Appcheck') ||
      req.header('x-firebase-appcheck') ||
      '').toString().trim();
  if (!token) return { ok: true }; // optional; rate limit still applies
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const appCheck = (admin as any).appCheck?.();
    if (!appCheck?.verifyToken) return { ok: true };
    await appCheck.verifyToken(token);
    return { ok: true };
  } catch {
    return { ok: false, message: 'Invalid App Check token' };
  }
}

function getSmtpConfig(): { user: string; pass: string } {
  const config = functions.config() as { smtp?: { user?: string; pass?: string } };
  const user = config.smtp?.user || process.env.SMTP_USER;
  const pass = config.smtp?.pass || process.env.SMTP_PASS;
  if (!user || !pass) {
    throw new Error(
      'SMTP not configured. Run: firebase functions:config:set smtp.user="your@gmail.com" smtp.pass="app-password"'
    );
  }
  return { user, pass };
}

function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

/** URL of the Python logic service (Cloud Run, etc.). */
function getLogicUrl(): string {
  const config = functions.config() as { logic?: { service_url?: string } };
  return config.logic?.service_url || process.env.LOGIC_SERVICE_URL || 'http://localhost:8080';
}

function getLogicApiKey(): string | null {
  const config = functions.config() as { logic?: { api_key?: string } };
  const key = config.logic?.api_key || process.env.LOGIC_API_KEY;
  return key || null;
}

/**
 * Helper to verify Firebase ID token from Authorization header.
 */
async function verifyAuth(request: functions.https.Request): Promise<admin.auth.DecodedIdToken | null> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split('Bearer ')[1];
  try {
    return await admin.auth().verifyIdToken(token);
  } catch {
    return null;
  }
}

/** Call Python logic service and return its JSON response. */
async function callLogic<T>(path: string, body: unknown): Promise<T> {
  const logicUrl = getLogicUrl();
  const logicApiKey = getLogicApiKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (logicApiKey) headers['x-logic-key'] = logicApiKey;
  const res = await fetch(`${logicUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Logic service error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/**
 * API: getMe — Firebase handles auth; Python handles logic.
 */
export const getMe = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Authorization');
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const decoded = await verifyAuth(req);
  if (!decoded) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing token' });
    return;
  }

  try {
    const result = await callLogic<{ uid: string; email?: string; email_verified?: boolean }>(
      '/logic/getMe',
      { uid: decoded.uid, email: decoded.email, email_verified: decoded.email_verified }
    );
    res.json(result);
  } catch (e) {
    functions.logger.error('Logic call failed', e);
    res.status(502).json({ error: 'Logic service unavailable' });
  }
});

/**
 * API: validateUserAction — Firebase handles auth; Python handles logic.
 */
export const validateUserAction = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const decoded = await verifyAuth(req);
  if (!decoded) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing token' });
    return;
  }

  const body = req.body;
  if (!body?.action) {
    res.status(400).json({ error: 'Bad request', message: 'Missing action' });
    return;
  }

  try {
    const result = await callLogic<{ success: boolean; uid: string; action: string; message: string }>(
      '/logic/validateUserAction',
      {
        user: { uid: decoded.uid, email: decoded.email, email_verified: decoded.email_verified },
        body: { action: body.action },
      }
    );
    res.json(result);
  } catch (e) {
    functions.logger.error('Logic call failed', e);
    res.status(502).json({ error: 'Logic service unavailable' });
  }
});

/** DeepSeek API key from Firebase config. Set via: firebase functions:config:set deepseek.api_key="sk-xxx" */
function getDeepSeekApiKey(): string {
  const config = functions.config() as { deepseek?: { api_key?: string } };
  const key = config.deepseek?.api_key || process.env.DEEPSEEK_API_KEY;
  if (!key) {
    throw new Error('DEEPSEEK_API_KEY not configured. Run: firebase functions:config:set deepseek.api_key="sk-xxx"');
  }
  return key;
}

/** OpenAI API key for Whisper transcription. */
function getOpenAIApiKey(): string {
  const config = functions.config() as { openai?: { api_key?: string } };
  const key = config.openai?.api_key || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OPENAI_API_KEY not configured. Run: firebase functions:config:set openai.api_key="sk-xxx"');
  }
  return key;
}

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * API: chatCompletion — DeepSeek-V3 chat via OpenAI-compatible API.
 * Requires Firebase auth. Messages are passed through to DeepSeek.
 * Uses cors middleware so preflight (OPTIONS) from browser gets correct headers.
 */
export const chatCompletion = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const decoded = await verifyAuth(req);
    if (!decoded) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing token' });
      return;
    }

    const body = req.body as { messages?: DeepSeekMessage[] };
    if (!Array.isArray(body?.messages) || body.messages.length === 0) {
      res.status(400).json({ error: 'Bad request', message: 'messages array required and must not be empty' });
      return;
    }

    try {
      const apiKey = getDeepSeekApiKey();
      const deepseekRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: body.messages,
          max_tokens: 2048,
          temperature: 0.7,
        }),
      });

      if (!deepseekRes.ok) {
        const errText = await deepseekRes.text();
        functions.logger.error('DeepSeek API error', { status: deepseekRes.status, body: errText });
        res.status(deepseekRes.status).json({ error: 'DeepSeek API error', message: errText });
        return;
      }

      const data = (await deepseekRes.json()) as {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
        error?: { message?: string };
      };

      if (data.error) {
        res.status(500).json({ error: data.error.message || 'DeepSeek error' });
        return;
      }

      const content = data.choices?.[0]?.message?.content ?? '';
      res.json({ content });
    } catch (e) {
      functions.logger.error('chatCompletion failed', e);
      res.status(500).json({ error: 'Chat failed', message: e instanceof Error ? e.message : 'Unknown error' });
    }
  });
});

// ========== Registration marker ==========

/**
 * markUserRegistered — Called after app registration. Sets custom claim so password reset
 * only works for users who signed up through the app, not manually created accounts.
 */
export const markUserRegistered = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.status(204).send('');
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const decoded = await verifyAuth(req);
    if (!decoded) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      await admin.auth().setCustomUserClaims(decoded.uid, { registered: true });
      res.json({ success: true });
    } catch (e) {
      functions.logger.error('markUserRegistered failed', e);
      res.status(500).json({ error: 'Failed to mark user as registered.' });
    }
  });
});

// ========== Password Reset (code-based flow) ==========

/**
 * sendPasswordResetCode — Generate 6-digit code, store in Firestore, send to email.
 * Only sends if the email belongs to a user who registered through the app (not manually created).
 * Always returns same success message (don't reveal if email exists or is registered).
 *
 * CORS: explicitly handle OPTIONS + set headers so browser preflight succeeds.
 */
export const sendPasswordResetCode = functions.https.onRequest(async (req, res) => {
  // Allow localhost during development; you can tighten this to a specific origin if needed.
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const email = (req.body?.email || '').toString().trim().toLowerCase();
  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  try {
    const userRecord = await admin.auth().getUserByEmail(email).catch(() => null);
    if (!userRecord) {
      res.json({ success: true, message: 'If an account exists, a code was sent to your email.' });
      return;
    }

    // Only send code for users who registered through the app (not manually created in console)
    if (userRecord.customClaims?.registered !== true) {
      res.json({ success: true, message: 'If an account exists, a code was sent to your email.' });
      return;
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);
    const docId = email.replace(/\./g, '_');
    await db.collection('passwordResetCodes').doc(docId).set({ email, code, expiresAt });

    const { user, pass } = getSmtpConfig();
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: user,
      to: email,
      subject: 'SalinTayo – Password Reset Code',
      text: `Your password reset code is: ${code}\n\nThis code expires in ${CODE_EXPIRY_MINUTES} minutes.`,
      html: `<p>Your password reset code is: <strong>${code}</strong></p><p>This code expires in ${CODE_EXPIRY_MINUTES} minutes.</p>`,
    });

    res.json({ success: true, message: 'If an account exists, a code was sent to your email.' });
  } catch (e) {
    functions.logger.error('sendPasswordResetCode failed', e);
    res.status(500).json({ error: 'Failed to send code. Please try again.' });
  }
});

/**
 * verifyPasswordResetCode — Verify the code is valid. Returns success for use before redirecting to NewPassword.
 */
export const verifyPasswordResetCode = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.status(204).send('');
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const email = (req.body?.email || '').toString().trim().toLowerCase();
    const code = (req.body?.code || '').toString().trim();
    if (!email || !code) {
      res.status(400).json({ error: 'Email and code are required' });
      return;
    }
    try {
      const docId = email.replace(/\./g, '_');
      const doc = await db.collection('passwordResetCodes').doc(docId).get();
      if (!doc.exists) {
        res.status(400).json({ error: 'Invalid or expired code.' });
        return;
      }
      const data = doc.data()!;
      if (data.code !== code) {
        res.status(400).json({ error: 'Invalid or expired code.' });
        return;
      }
      if (new Date() > (data.expiresAt as admin.firestore.Timestamp).toDate()) {
        await doc.ref.delete();
        res.status(400).json({ error: 'Code has expired. Please request a new one.' });
        return;
      }
      res.json({ success: true });
    } catch (e) {
      functions.logger.error('verifyPasswordResetCode failed', e);
      res.status(500).json({ error: 'Verification failed.' });
    }
  });
});

/**
 * resetPasswordWithCode — Verify code and update user password.
 */
export const resetPasswordWithCode = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.status(204).send('');
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const email = (req.body?.email || '').toString().trim().toLowerCase();
    const code = (req.body?.code || '').toString().trim();
    const newPassword = (req.body?.newPassword || '').toString();
    if (!email || !code || !newPassword) {
      res.status(400).json({ error: 'Email, code, and new password are required' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }
    try {
      const docId = email.replace(/\./g, '_');
      const doc = await db.collection('passwordResetCodes').doc(docId).get();
      if (!doc.exists) {
        res.status(400).json({ error: 'Invalid or expired code.' });
        return;
      }
      const data = doc.data()!;
      if (data.code !== code) {
        res.status(400).json({ error: 'Invalid or expired code.' });
        return;
      }
      if (new Date() > (data.expiresAt as admin.firestore.Timestamp).toDate()) {
        await doc.ref.delete();
        res.status(400).json({ error: 'Code has expired. Please request a new one.' });
        return;
      }
      const userRecord = await admin.auth().getUserByEmail(email);
      await admin.auth().updateUser(userRecord.uid, { password: newPassword });
      await doc.ref.delete();
      res.json({ success: true, message: 'Password updated. You can now sign in.' });
    } catch (e) {
      functions.logger.error('resetPasswordWithCode failed', e);
      res.status(500).json({ error: 'Failed to reset password. Please try again.' });
    }
  });
});

/**
 * transcribeWhisper — Transcribes recorded audio using OpenAI Whisper.
 */
export const transcribeWhisper = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Firebase-AppCheck');
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // Public endpoint: protect against abuse (rate limit + optional App Check).
    const ip = getClientIp(req);
    const limited = checkRateLimit(`ip:${ip}`);
    if (!limited.ok) {
      res.set('Retry-After', String(limited.retryAfterSec));
      res.status(429).json({ error: 'Too Many Requests', message: 'Rate limit exceeded. Please try again later.' });
      return;
    }

    const appCheck = await verifyAppCheckIfPresent(req);
    if (!appCheck.ok) {
      res.status(401).json({ error: 'Unauthorized', message: appCheck.message });
      return;
    }

    const body = req.body as {
      audio_base64?: string;
      mime_type?: string;
      whisper_model?: string;
    };

    if (!body?.audio_base64) {
      res.status(400).json({ error: 'Bad request', message: 'audio_base64 is required' });
      return;
    }

    try {
      const openaiKey = getOpenAIApiKey();
      const mimeType = (body.mime_type || 'audio/webm').toLowerCase().split(';')[0].trim();
      const allowed = new Set([
        'audio/webm',
        'audio/wav',
        'audio/mpeg',
        'audio/mp3',
        'audio/mp4',
        'audio/aac',
        'audio/ogg',
        'audio/x-m4a',
      ]);
      if (!allowed.has(mimeType)) {
        res.status(400).json({ error: 'Bad request', message: `Unsupported mime_type: ${mimeType}` });
        return;
      }
      // base64 size guard (~9MB decoded max)
      const b64 = body.audio_base64;
      if (b64.length > 12_000_000) {
        res.status(413).json({ error: 'Payload too large', message: 'Audio is too large. Please record a shorter clip.' });
        return;
      }
      const audioBytes = Buffer.from(body.audio_base64, 'base64');
      if (audioBytes.length > 9_000_000) {
        res.status(413).json({ error: 'Payload too large', message: 'Audio is too large. Please record a shorter clip.' });
        return;
      }

      // OpenAI expects multipart form upload.
      const audioFile = new Blob([audioBytes], { type: mimeType });
      const form = new FormData();
      form.append('file', audioFile, `voice.${mimeType.split('/')[1] || 'webm'}`);
      form.append('model', 'whisper-1');

      const openaiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
        },
        body: form,
      });

      if (!openaiRes.ok) {
        const raw = await openaiRes.text().catch(() => '');
        let msg = raw || `OpenAI error: ${openaiRes.status}`;
        try {
          const parsed = JSON.parse(raw);
          msg = parsed?.error?.message || parsed?.message || msg;
        } catch {
          // ignore parse errors, keep raw message
        }
        throw new Error(msg);
      }

      const data = (await openaiRes.json()) as { text?: string };
      res.json({ text: data.text || '' });
    } catch (e) {
      functions.logger.error('transcribeWhisper failed', e);
      res.status(502).json({
        error: 'Whisper service unavailable',
        message: e instanceof Error ? e.message : 'Unknown error',
      });
    }
  });
});
