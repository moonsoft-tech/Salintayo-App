"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPasswordWithCode = exports.verifyPasswordResetCode = exports.sendPasswordResetCode = exports.markUserRegistered = exports.chatCompletion = exports.validateUserAction = exports.getMe = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const cors = require('cors');
admin.initializeApp();
const corsHandler = cors({ origin: true });
const db = admin.firestore();
const CODE_LENGTH = 6;
const CODE_EXPIRY_MINUTES = 10;
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
    const res = await fetch(`${logicUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
 */
exports.sendPasswordResetCode = functions.https.onRequest((req, res) => {
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
//# sourceMappingURL=index.js.map