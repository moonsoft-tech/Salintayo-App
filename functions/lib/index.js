"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transcribeWhisper = exports.resetPasswordWithCode = exports.verifyPasswordResetCode = exports.sendPasswordResetCode = exports.markUserRegistered = exports.chatCompletion = exports.validateUserAction = exports.getMe = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const cors = require('cors');
admin.initializeApp();
const corsHandler = cors({ origin: true });
const db = admin.firestore();
const CODE_LENGTH = 6;
const CODE_EXPIRY_MINUTES = 10;
function getClientIp(req) {
    var _a;
    const xfwd = (req.headers['x-forwarded-for'] || '').toString();
    const first = (_a = xfwd.split(',')[0]) === null || _a === void 0 ? void 0 : _a.trim();
    return first || req.ip || 'unknown';
}
const whisperRateLimits = new Map();
function checkRateLimit(key) {
    var _a, _b;
    const now = Date.now();
    const buckets = (_a = whisperRateLimits.get(key)) !== null && _a !== void 0 ? _a : [
        { windowMs: 60000, max: 10, hits: [] }, // 10/min
        { windowMs: 3600000, max: 60, hits: [] }, // 60/hour
    ];
    for (const b of buckets) {
        b.hits = b.hits.filter((t) => now - t < b.windowMs);
        if (b.hits.length >= b.max) {
            const oldest = (_b = b.hits[0]) !== null && _b !== void 0 ? _b : now;
            const retryAfterMs = Math.max(0, b.windowMs - (now - oldest));
            whisperRateLimits.set(key, buckets);
            return { ok: false, retryAfterSec: Math.ceil(retryAfterMs / 1000) };
        }
    }
    for (const b of buckets)
        b.hits.push(now);
    whisperRateLimits.set(key, buckets);
    return { ok: true };
}
async function verifyAppCheckIfPresent(req) {
    var _a, _b;
    const token = (req.header('X-Firebase-AppCheck') ||
        req.header('X-Firebase-Appcheck') ||
        req.header('x-firebase-appcheck') ||
        '').toString().trim();
    if (!token)
        return { ok: true }; // optional; rate limit still applies
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const appCheck = (_b = (_a = admin).appCheck) === null || _b === void 0 ? void 0 : _b.call(_a);
        if (!(appCheck === null || appCheck === void 0 ? void 0 : appCheck.verifyToken))
            return { ok: true };
        await appCheck.verifyToken(token);
        return { ok: true };
    }
    catch (_c) {
        return { ok: false, message: 'Invalid App Check token' };
    }
}
function getSmtpConfig() {
    var _a, _b;
    const config = functions.config();
    const user = ((_a = config.smtp) === null || _a === void 0 ? void 0 : _a.user) || process.env.SMTP_USER;
    const pass = ((_b = config.smtp) === null || _b === void 0 ? void 0 : _b.pass) || process.env.SMTP_PASS;
    if (!user || !pass) {
        throw new Error('SMTP not configured. Run: firebase functions:config:set smtp.user="your@gmail.com" smtp.pass="app-password"');
    }
    return { user, pass };
}
function generateCode() {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
        code += Math.floor(Math.random() * 10).toString();
    }
    return code;
}
/** URL of the Python logic service (Cloud Run, etc.). */
function getLogicUrl() {
    var _a;
    const config = functions.config();
    return ((_a = config.logic) === null || _a === void 0 ? void 0 : _a.service_url) || process.env.LOGIC_SERVICE_URL || 'http://localhost:8080';
}
function getLogicApiKey() {
    var _a;
    const config = functions.config();
    const key = ((_a = config.logic) === null || _a === void 0 ? void 0 : _a.api_key) || process.env.LOGIC_API_KEY;
    return key || null;
}
/**
 * Helper to verify Firebase ID token from Authorization header.
 */
async function verifyAuth(request) {
    const authHeader = request.headers.authorization;
    if (!(authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Bearer ')))
        return null;
    const token = authHeader.split('Bearer ')[1];
    try {
        return await admin.auth().verifyIdToken(token);
    }
    catch (_a) {
        return null;
    }
}
/** Call Python logic service and return its JSON response. */
async function callLogic(path, body) {
    const logicUrl = getLogicUrl();
    const logicApiKey = getLogicApiKey();
    const headers = { 'Content-Type': 'application/json' };
    if (logicApiKey)
        headers['x-logic-key'] = logicApiKey;
    const res = await fetch(`${logicUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `Logic service error: ${res.status}`);
    }
    return res.json();
}
/**
 * API: getMe — Firebase handles auth; Python handles logic.
 */
exports.getMe = functions.https.onRequest(async (req, res) => {
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
        const result = await callLogic('/logic/getMe', { uid: decoded.uid, email: decoded.email, email_verified: decoded.email_verified });
        res.json(result);
    }
    catch (e) {
        functions.logger.error('Logic call failed', e);
        res.status(502).json({ error: 'Logic service unavailable' });
    }
});
/**
 * API: validateUserAction — Firebase handles auth; Python handles logic.
 */
exports.validateUserAction = functions.https.onRequest(async (req, res) => {
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
    if (!(body === null || body === void 0 ? void 0 : body.action)) {
        res.status(400).json({ error: 'Bad request', message: 'Missing action' });
        return;
    }
    try {
        const result = await callLogic('/logic/validateUserAction', {
            user: { uid: decoded.uid, email: decoded.email, email_verified: decoded.email_verified },
            body: { action: body.action },
        });
        res.json(result);
    }
    catch (e) {
        functions.logger.error('Logic call failed', e);
        res.status(502).json({ error: 'Logic service unavailable' });
    }
});
/** DeepSeek API key from Firebase config. Set via: firebase functions:config:set deepseek.api_key="sk-xxx" */
function getDeepSeekApiKey() {
    var _a;
    const config = functions.config();
    const key = ((_a = config.deepseek) === null || _a === void 0 ? void 0 : _a.api_key) || process.env.DEEPSEEK_API_KEY;
    if (!key) {
        throw new Error('DEEPSEEK_API_KEY not configured. Run: firebase functions:config:set deepseek.api_key="sk-xxx"');
    }
    return key;
}
/** OpenAI API key for Whisper transcription. */
function getOpenAIApiKey() {
    var _a;
    const config = functions.config();
    const key = ((_a = config.openai) === null || _a === void 0 ? void 0 : _a.api_key) || process.env.OPENAI_API_KEY;
    if (!key) {
        throw new Error('OPENAI_API_KEY not configured. Run: firebase functions:config:set openai.api_key="sk-xxx"');
    }
    return key;
}
/**
 * API: chatCompletion — DeepSeek-V3 chat via OpenAI-compatible API.
 * Requires Firebase auth. Messages are passed through to DeepSeek.
 * Uses cors middleware so preflight (OPTIONS) from browser gets correct headers.
 */
exports.chatCompletion = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        var _a, _b, _c, _d;
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
        if (!Array.isArray(body === null || body === void 0 ? void 0 : body.messages) || body.messages.length === 0) {
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
            const data = (await deepseekRes.json());
            if (data.error) {
                res.status(500).json({ error: data.error.message || 'DeepSeek error' });
                return;
            }
            const content = (_d = (_c = (_b = (_a = data.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) !== null && _d !== void 0 ? _d : '';
            res.json({ content });
        }
        catch (e) {
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
exports.markUserRegistered = functions.https.onRequest((req, res) => {
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
        }
        catch (e) {
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
exports.sendPasswordResetCode = functions.https.onRequest(async (req, res) => {
    var _a, _b;
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
    const email = (((_a = req.body) === null || _a === void 0 ? void 0 : _a.email) || '').toString().trim().toLowerCase();
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
        if (((_b = userRecord.customClaims) === null || _b === void 0 ? void 0 : _b.registered) !== true) {
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
    }
    catch (e) {
        functions.logger.error('sendPasswordResetCode failed', e);
        res.status(500).json({ error: 'Failed to send code. Please try again.' });
    }
});
/**
 * verifyPasswordResetCode — Verify the code is valid. Returns success for use before redirecting to NewPassword.
 */
exports.verifyPasswordResetCode = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        var _a, _b;
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
        const email = (((_a = req.body) === null || _a === void 0 ? void 0 : _a.email) || '').toString().trim().toLowerCase();
        const code = (((_b = req.body) === null || _b === void 0 ? void 0 : _b.code) || '').toString().trim();
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
            const data = doc.data();
            if (data.code !== code) {
                res.status(400).json({ error: 'Invalid or expired code.' });
                return;
            }
            if (new Date() > data.expiresAt.toDate()) {
                await doc.ref.delete();
                res.status(400).json({ error: 'Code has expired. Please request a new one.' });
                return;
            }
            res.json({ success: true });
        }
        catch (e) {
            functions.logger.error('verifyPasswordResetCode failed', e);
            res.status(500).json({ error: 'Verification failed.' });
        }
    });
});
/**
 * resetPasswordWithCode — Verify code and update user password.
 */
exports.resetPasswordWithCode = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        var _a, _b, _c;
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
        const email = (((_a = req.body) === null || _a === void 0 ? void 0 : _a.email) || '').toString().trim().toLowerCase();
        const code = (((_b = req.body) === null || _b === void 0 ? void 0 : _b.code) || '').toString().trim();
        const newPassword = (((_c = req.body) === null || _c === void 0 ? void 0 : _c.newPassword) || '').toString();
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
            const data = doc.data();
            if (data.code !== code) {
                res.status(400).json({ error: 'Invalid or expired code.' });
                return;
            }
            if (new Date() > data.expiresAt.toDate()) {
                await doc.ref.delete();
                res.status(400).json({ error: 'Code has expired. Please request a new one.' });
                return;
            }
            const userRecord = await admin.auth().getUserByEmail(email);
            await admin.auth().updateUser(userRecord.uid, { password: newPassword });
            await doc.ref.delete();
            res.json({ success: true, message: 'Password updated. You can now sign in.' });
        }
        catch (e) {
            functions.logger.error('resetPasswordWithCode failed', e);
            res.status(500).json({ error: 'Failed to reset password. Please try again.' });
        }
    });
});
/**
 * transcribeWhisper — Transcribes recorded audio using OpenAI Whisper.
 */
exports.transcribeWhisper = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        var _a;
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
        const body = req.body;
        if (!(body === null || body === void 0 ? void 0 : body.audio_base64)) {
            res.status(400).json({ error: 'Bad request', message: 'audio_base64 is required' });
            return;
        }
        try {
            const openaiKey = getOpenAIApiKey();
            const mimeType = (body.mime_type || 'audio/webm').toLowerCase();
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
            if (b64.length > 12000000) {
                res.status(413).json({ error: 'Payload too large', message: 'Audio is too large. Please record a shorter clip.' });
                return;
            }
            const audioBytes = Buffer.from(body.audio_base64, 'base64');
            if (audioBytes.length > 9000000) {
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
                    msg = ((_a = parsed === null || parsed === void 0 ? void 0 : parsed.error) === null || _a === void 0 ? void 0 : _a.message) || (parsed === null || parsed === void 0 ? void 0 : parsed.message) || msg;
                }
                catch (_b) {
                    // ignore parse errors, keep raw message
                }
                throw new Error(msg);
            }
            const data = (await openaiRes.json());
            res.json({ text: data.text || '' });
        }
        catch (e) {
            functions.logger.error('transcribeWhisper failed', e);
            res.status(502).json({
                error: 'Whisper service unavailable',
                message: e instanceof Error ? e.message : 'Unknown error',
            });
        }
    });
});
//# sourceMappingURL=index.js.map