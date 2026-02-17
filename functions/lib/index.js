"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatCompletion = exports.validateUserAction = exports.getMe = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
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
 */
exports.chatCompletion = functions.https.onRequest(async (req, res) => {
    var _a, _b, _c, _d;
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
//# sourceMappingURL=index.js.map