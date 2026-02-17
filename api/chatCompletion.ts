import type { VercelRequest, VercelResponse } from '@vercel/node';

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Verify Firebase ID token using the Auth REST API (no firebase-admin needed).
 */
async function verifyFirebaseToken(idToken: string): Promise<{ uid: string } | null> {
  const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );

  if (!res.ok) return null;
  const data = (await res.json()) as { users?: Array<{ localId: string }> };
  const user = data.users?.[0];
  return user ? { uid: user.localId } : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid token' });
    return;
  }

  const token = authHeader.split('Bearer ')[1];
  const decoded = await verifyFirebaseToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
    return;
  }

  const body = req.body as { messages?: DeepSeekMessage[] };
  if (!Array.isArray(body?.messages) || body.messages.length === 0) {
    res.status(400).json({ error: 'Bad request', message: 'messages array required and must not be empty' });
    return;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server misconfigured', message: 'DEEPSEEK_API_KEY not set' });
    return;
  }

  try {
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
      res.status(deepseekRes.status).json({ error: 'DeepSeek API error', message: errText });
      return;
    }

    const data = (await deepseekRes.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (data.error) {
      res.status(500).json({ error: data.error.message || 'DeepSeek error' });
      return;
    }

    const content = data.choices?.[0]?.message?.content ?? '';
    res.json({ content });
  } catch (e) {
    res.status(500).json({
      error: 'Chat failed',
      message: e instanceof Error ? e.message : 'Unknown error',
    });
  }
}
