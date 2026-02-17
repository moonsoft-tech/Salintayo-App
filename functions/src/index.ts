import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

/** URL of the Python logic service (Cloud Run, etc.). */
function getLogicUrl(): string {
  const config = functions.config() as { logic?: { service_url?: string } };
  return config.logic?.service_url || process.env.LOGIC_SERVICE_URL || 'http://localhost:8080';
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
  const res = await fetch(`${logicUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * API: chatCompletion — DeepSeek-V3 chat via OpenAI-compatible API.
 * Requires Firebase auth. Messages are passed through to DeepSeek.
 */
export const chatCompletion = functions.https.onRequest(async (req, res) => {
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
