import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { IonContent,
  IonFooter, IonIcon, IonPage, useIonViewDidEnter, useIonViewWillEnter } from '@ionic/react';
import {
  bookOutline,
  documentTextOutline,
  homeOutline,
  chatbubbleOutline,
  personOutline,
  personCircleOutline,
  attachOutline,
  micOutline,
  send,
  settingsOutline,
  chatbubbleEllipsesOutline,
  playOutline,
  pauseOutline,
  volumeHighOutline,
  imageOutline,
  trashOutline,
  close,
  add,
  cameraOutline,
  imagesOutline,
  checkmark,
  chevronBack,
  chevronForward,
  volumeMediumOutline,
} from 'ionicons/icons';
import AttachmentModal from './AttachmentModal';
import VoiceRecordModal from './VoiceRecordModal';
import CameraModal from './CameraModal';
import { LANGUAGES } from './LanguageModal';
import { useAuth } from '../contexts/AuthContext';
import {
  createEmptyChat,
  chatThreadExists,
  deleteAllChatThreads,
  deleteChatThread,
  fetchChatMessages,
  mergeChatMessages,
  migrateLocalSessionsToFirestoreIfEmpty,
  subscribeChatMessages,
  subscribeUserChatThreads,
  updateChatThreadMeta,
  upsertChatMessage,
} from '../utils/userChatFirestore';
import './Chat.css';
import { speakText, cancelSpeech } from '../utils/tts';
import { getResolvedDialectLangCode, getDefaultDialectCodeForExperience } from '../utils/dialectPreference';
import { getOpenRouterHttpReferer } from '../utils/openRouterClient';
import { callProtectedApi, transcribeWhisper } from '../utils/api';

// Type definitions for Emergency Mode (from EmergencyDialectBubble)
interface Dialect {
  name: string;
  nativeName: string;
  flag: string;
}

interface EmergencyPhrase {
  label: string;
  text: string;
}

// OpenRouter API configuration
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_VISION_MODEL = import.meta.env.VITE_OPENROUTER_VISION_MODEL || 'google/gemma-3-27b-it';
const ENABLE_FUNCTIONS_CHAT_FALLBACK = (import.meta.env.VITE_ENABLE_FUNCTIONS_CHAT_FALLBACK || '').trim().toLowerCase() === 'true';

// Quick Chat language definitions (matching QuickChatBubble)
const QUICK_CHAT_LANGUAGES: { [key: string]: { label: string; flag: string } } = {
  tagalog: { label: 'Tagalog', flag: '🇵🇭' },
  cebuano: { label: 'Cebuano', flag: '🌴' },
  ilocano: { label: 'Ilocano', flag: '🏝️' },
  hiligaynon: { label: 'Hiligaynon', flag: '🌸' },
  bicolano: { label: 'Bicolano', flag: '🌋' },
};

// System prompt for the AI
const SYSTEM_PROMPT = `You are SalinTayo AI, a Filipino language tutor and translator. 
Your role is to help users learn Filipino/Tagalog by:
- Translating English to Filipino and vice versa
- Explaining Filipino words, phrases, and grammar
- Providing example sentences
- Being friendly, patient, and encouraging

Always respond in a helpful and educational manner. If asked about images, analyze them and provide translations of any text you see.`;

function getActiveDialect(): { code: string; name: string; native: string } {
  // Always default to the Profile "Active Dialect".
  try {
    const saved = getResolvedDialectLangCode().trim().toLowerCase();
    const aliasToCode: Record<string, string> = {
      // Profile codes (newer)
      en: 'en',
      fil: 'fil',
      ceb: 'ceb',
      ilo: 'ilo',
      hil: 'hil',
      war: 'war',
      bik: 'bik',
      pam: 'pam',
      tsg: 'tsg',

      // Older / alias values (if stored differently)
      english: 'en',
      filipino: 'fil',
      tagalog: 'fil',
      cebuano: 'ceb',
      ilocano: 'ilo',
      hiligaynon: 'hil',
      waray: 'war',
      bicolano: 'bik',
      kapampangan: 'pam',
      tausug: 'tsg',
    };

    const code = aliasToCode[saved] ?? saved;
    const lang = LANGUAGES.find((l) => l.code === code) ?? LANGUAGES.find((l) => l.name.toLowerCase() === saved) ?? LANGUAGES.find((l) => l.native.toLowerCase() === saved);
    const fb = getDefaultDialectCodeForExperience();
    const fbLang = LANGUAGES.find((l) => l.code === fb);
    return {
      code: lang?.code ?? fb,
      name: lang?.name ?? fbLang?.name ?? 'Filipino',
      native: lang?.native ?? fbLang?.native ?? 'Filipino',
    };
  } catch {
    const fb = getDefaultDialectCodeForExperience();
    const fbLang = LANGUAGES.find((l) => l.code === fb);
    return { code: fb, name: fbLang?.name ?? 'Filipino', native: fbLang?.native ?? 'Filipino' };
  }
}

// When the user asks to translate, we want a short response: ONLY the translation text.
function getStrictTranslationSystemPrompt(target: { code: string; name: string; native: string }): string {
  return `You are SalinTayo AI.
Translate the user's message into: ${target.name} (${target.native}).
Target code: ${target.code}.

The user may type in English or in another language. Detect the source language automatically.

Rules (follow strictly):
1. Your entire reply MUST start with a single line: RESULT=
2. On the same line after RESULT=, or on following lines only for line breaks within the translation, output the COMPLETE translation. Long texts must be fully translated — do not summarize or truncate.
3. Do NOT add any other lines before or after the translation block: no introductions, no "Here is", no comparisons, no labels like "Tagalog:", no bullet points, no follow-up questions, no "Would you like".
4. If the user asks for "one word" or a "word", put only that single word on the RESULT= line (no extra punctuation or quotes).
5. Output MUST be in ${target.native}. Never output English unless the target is English.
6. If the input is already in the target language/dialect, repeat it unchanged after RESULT=.
`;
}

function getVoiceTranslationTarget(): { code: string; name: string; native: string } {
  const active = getActiveDialect();
  // If the active dialect is English, use Filipino for voice translation output by default.
  if (active.code === 'en') {
    return { code: 'fil', name: 'Filipino', native: 'Filipino' };
  }
  return active;
}

function isTranslationRequest(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    /\btranslate\b/.test(t) ||
    /\btranslation\b/.test(t) ||
    /\bmeaning\b/.test(t) ||
    /\bwhat does\b/.test(t) ||
    /\bhow do you say\b/.test(t) ||
    /\bhow to say\b/.test(t)
  );
}

function getWordCount(text: string): number {
  const cleaned = text
    .trim()
    .replace(/[“”"']/g, ' ')
    .replace(/\s+/g, ' ');
  if (!cleaned) return 0;
  return cleaned.split(' ').filter(Boolean).length;
}

/** User is asking for teaching / meta help — keep conversational tutor mode. */
function looksLikeTutoringCommand(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const lower = t.toLowerCase();
  if (
    /^\s*(explain|describe|write me|write a|tell me (a )?story|create|list|compare|contrast|define|give (me )?examples?|what is the difference|how do i learn|teach me|tutor me)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  if (/\b(teach me|tutor me|grammar lesson)\b/.test(lower)) return true;
  return false;
}

function isAutoTranslationCandidate(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (looksLikeTutoringCommand(t)) return false;

  const lower = t.toLowerCase();
  if (/\b(explain|grammar|examples?|example|teach|tutor|lessons?|definition|define)\b/.test(lower)) return false;
  if (/\b(why|how|when|where)\b/.test(lower) && /\b(say|translate|meaning|does|mean)\b/.test(lower)) return false;

  // Short, single-line inputs (original behavior).
  if (/[\r\n]/.test(t) || t.length > 120) return false;

  const wc = getWordCount(t);
  return wc >= 1 && wc <= 15;
}

/** Long passages or pasted blocks: translate only, not tutor chat (unless it looks like a lesson request). */
function isLongPlainTranslationPaste(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (looksLikeTutoringCommand(t)) return false;

  const lower = t.toLowerCase();
  if (/\b(explain|grammar|examples?|example|teach|tutor|lessons?|definition|define)\b/.test(lower)) return false;
  if (/\b(why|how|when|where)\b/.test(lower) && /\b(say|translate|meaning|does|mean)\b/.test(lower)) return false;

  const wc = getWordCount(t);
  if (t.length > 120 || wc > 15) return true;
  // Multiline paste: treat as content to translate only if substantial (avoid 2-line homework prompts).
  if (/[\r\n]/.test(t) && t.length >= 150) return true;
  return false;
}

function translationMaxOutputTokens(inputText: string, forceSingleWord: boolean): number {
  if (forceSingleWord) return 48;
  const wc = getWordCount(inputText);
  const estimated = Math.ceil(wc * 2.8) + 96;
  return Math.min(4096, Math.max(220, estimated));
}

function extractTranslationOnly(raw: string, forceSingleWord: boolean): string {
  // Keep the extraction intentionally simple so we don't accidentally remove the real translation.
  let s = (raw || '').trim();
  if (!s) return s;

  // Remove common labels like "Translation: ..."
  s = s.replace(/^\s*(translation|answer)\s*[:\-]\s*/i, '').trim();

  // Strip fenced code blocks if the model returns them.
  s = s.replace(/^```[\w-]*\s*/g, '').replace(/```$/g, '').trim();

  // Prefer structured marker extraction (full translation may span multiple lines).
  const markerBlock = s.match(/\bRESULT\s*[:=]\s*([\s\S]+?)(?:\n{2,}(?:Would you like|Here's|Note:|Alternatively)[\s\S]*|$)/i);
  let markerTail = markerBlock?.[1];
  if (markerTail !== undefined) {
    let out = markerTail.replace(/\n{2,}(?:Would you like|Here's|Note:|Alternatively)[\s\S]*$/i, '').trim();
    out = out.replace(/^["'`]+|["'`]+$/g, '').trim();
    if (forceSingleWord) {
      out = out.split(/[,;\/|]|[\s]+/)[0]?.trim() || out;
      out = out.replace(/[.,;:!?]+$/g, '').trim();
      out = out.slice(0, 25).trim();
    }
    return out;
  }

  const lines = s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const stripLeadingPunctuation = (line: string) =>
    line.replace(/^[-*•]\s*/, '').replace(/^\d+[\.\)]\s*/, '').replace(/^["'`]+|["'`]+$/g, '').trim();

  const stripCommonFiller = (line: string) => {
    // Example: "Sure, the translation is: kumusta"
    let out = line;
    out = out.replace(/^\s*(sure|of course|here'?s|here is|the translation is|translation is)\s*[:\-]?\s*/i, '').trim();
    // If there's still a label-like "X: Y", take the part after the colon.
    if (out.includes(':')) {
      const parts = out.split(':');
      if (parts.length >= 2) out = parts.slice(1).join(':').trim();
    }
    return out;
  };

  let first = '';
  for (const line of lines) {
    const candidate = stripLeadingPunctuation(stripCommonFiller(line));
    // Skip likely labels that would be "English: ...", "Tagalog: ..." etc.
    if (/^(english|filipino|tagalog|cebuano|ilocano|hiligaynon|waray|bicolano|kapampangan|tausug)\s*[:\-]/i.test(line)) {
      continue;
    }
    if (candidate) {
      first = candidate;
      break;
    }
  }
  if (!first) first = stripLeadingPunctuation(s);

  if (forceSingleWord) {
    // If the model returns "word, phrase" take the first part.
    first = first.split(/[,;\/|]|[-–—:]/)[0]?.trim() || first;
    // Keep only the first token and remove trailing punctuation.
    first = first.split(/\s+/)[0]?.trim() || first;
    first = first.replace(/[.,;:!?]+$/g, '').trim();
    // Hard-cap length for single tokens (avoid "word - ...")
    first = first.split(/\s+/)[0]?.trim() || first;
  } else if (first.length <= 400) {
    // Short informal replies: avoid taking multiple sentences of filler.
    const sentenceCut = first.split(/[.!?]+/)[0]?.trim();
    if (sentenceCut && sentenceCut.length < first.length * 0.85) first = sentenceCut;
    if (first.length > 60) first = `${first.slice(0, 60).trim()}`;
  }
  // Long informal output: return stripped first substantial line/block without a harsh cap.

  return first.trim();
}

function formatTranslationReply(params: {
  originalText: string;
  target: { code: string; name: string; native: string };
  translation: string;
}): string {
  const { originalText, target, translation } = params;
  const safeOriginal = (originalText || '').trim().replace(/\s+/g, ' ').replace(/"/g, '\\"');
  const safeTranslation = (translation || '').trim();
  const langLabel = (target?.name || target?.native || 'Filipino').trim();

  if (!safeTranslation) {
    return `Sorry, I couldn't translate "${safeOriginal}". Please try again.`;
  }

  const punctuated = /[.!?]$/.test(safeTranslation) ? safeTranslation : `${safeTranslation}.`;
  return `"${safeOriginal}" on ${langLabel} is ${punctuated}`;
}

function getTtsSpeakTextFromAiMessageContent(content: string): string {
  const raw = (content || '').trim();
  if (!raw) return '';

  // If the AI message is in our translation wrapper format, speak only the translated word/phrase.
  // Example: "Good morning" on Cebuano is Maayong buntag.
  const m = raw.match(/^"[^"]+"\s+on\s+.+?\s+is\s+(.+?)\s*$/i);
  if (m?.[1]) {
    const translation = m[1].trim().replace(/^["'`]+|["'`]+$/g, '').trim();
    return translation.replace(/[.!?]+$/g, '').trim() || raw;
  }

  return raw;
}

// Function to call OpenRouter API
async function askOpenRouter(
  messages: { role: 'user' | 'assistant'; content: string }[],
  customSystemPrompt?: string,
  options?: { maxTokens?: number; temperature?: number; reasoningEnabled?: boolean }
): Promise<string> {
  const systemPrompt = customSystemPrompt || SYSTEM_PROMPT;
  const combinedMessages = [{ role: 'system' as const, content: systemPrompt }, ...messages];
  const hasValidOpenRouterKey =
    Boolean(OPENROUTER_API_KEY) && OPENROUTER_API_KEY !== 'your_openrouter_api_key_here';

  const askViaFirebaseFunction = async (): Promise<string> => {
    const data = await callProtectedApi<{ content?: string }>('chatCompletion', {
      method: 'POST',
      body: JSON.stringify({ messages: combinedMessages }),
    });
    return (data?.content || '').trim() || 'Sorry, I could not generate a response.';
  };

  if (!hasValidOpenRouterKey) {
    if (!ENABLE_FUNCTIONS_CHAT_FALLBACK) {
      throw new Error(
        'OpenRouter API key is missing. Set VITE_OPENROUTER_API_KEY for direct chat, or enable VITE_ENABLE_FUNCTIONS_CHAT_FALLBACK=true to use Firebase Functions.'
      );
    }
    return askViaFirebaseFunction();
  }

  try {
    console.log(
      'OpenRouter API Key loaded:',
      OPENROUTER_API_KEY ? `${OPENROUTER_API_KEY.substring(0, 10)}...` : 'NOT LOADED'
    );
    console.log('Request URL:', OPENROUTER_API_URL);

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': getOpenRouterHttpReferer(),
        'X-Title': 'SalinTayo AI',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat',
        messages: combinedMessages,
        max_tokens: options?.maxTokens ?? 1000,
        temperature: options?.temperature ?? 0.7,
        reasoning: { enabled: options?.reasoningEnabled ?? true },
      }),
    });

    console.log('OpenRouter Response Status:', response.status);
    console.log('OpenRouter Response OK:', response.ok);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenRouter Error Response:', errorData);
      throw new Error(
        errorData.error?.message || `API request failed: ${response.status} - ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json();
    console.log('OpenRouter Response Data:', JSON.stringify(data, null, 2));

    const message = data.choices?.[0]?.message;
    const content = message?.content || message?.reasoning_details || 'Sorry, I could not generate a response.';
    return content;
  } catch (directError) {
    if (!ENABLE_FUNCTIONS_CHAT_FALLBACK) {
      throw directError instanceof Error ? directError : new Error('Direct OpenRouter request failed.');
    }
    console.warn('OpenRouter direct request failed, falling back to Firebase chatCompletion.', directError);
    return askViaFirebaseFunction();
  }
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image for OCR'));
    img.src = dataUrl;
  });
}

async function buildProcessedOcrCanvas(imageBase64: string): Promise<HTMLCanvasElement> {
  const img = await loadImageFromDataUrl(imageBase64);
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(img.width * scale));
  canvas.height = Math.max(1, Math.floor(img.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Increase OCR readability: grayscale + hard threshold.
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    const bw = gray > 170 ? 255 : 0;
    data[i] = bw;
    data[i + 1] = bw;
    data[i + 2] = bw;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

async function detectTextWithTextDetector(source: CanvasImageSource): Promise<string> {
  const DetectorCtor = (window as Window & {
    TextDetector?: new () => { detect: (input: CanvasImageSource) => Promise<Array<{ rawValue?: string }>> };
  }).TextDetector;
  if (!DetectorCtor) return '';
  const detector = new DetectorCtor();
  const blocks = await detector.detect(source);
  return blocks
    .map((block) => (block.rawValue ?? '').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

async function extractTextWithVisionModel(imageBase64: string): Promise<string> {
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'your_openrouter_api_key_here') {
    throw new Error('OpenRouter API key not configured. Please add VITE_OPENROUTER_API_KEY to your .env file.');
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': getOpenRouterHttpReferer(),
      'X-Title': 'SalinTayo AI',
    },
    body: JSON.stringify({
      model: OPENROUTER_VISION_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Extract all visible text from images accurately. Return plain text only. Keep line breaks. If there is no readable text, return exactly: [No readable text found].',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Read the text in this image exactly.' },
            { type: 'image_url', image_url: { url: imageBase64 } },
          ],
        },
      ],
      max_tokens: 800,
      temperature: 0,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || `Vision OCR failed: ${response.status}`);
  }

  const text = (data?.choices?.[0]?.message?.content || '').trim();
  return text || '[No readable text found]';
}

// OCR helper for image attachments (keeps DeepSeek text chat untouched).
async function extractTextFromImage(imageBase64: string): Promise<string> {
  const ocrErrors: string[] = [];

  try {
    const image = await loadImageFromDataUrl(imageBase64);
    const nativeRaw = await detectTextWithTextDetector(image);
    const processedCanvas = await buildProcessedOcrCanvas(imageBase64);
    const nativeProcessed = await detectTextWithTextDetector(processedCanvas);
    const nativeBest = nativeProcessed.length > nativeRaw.length ? nativeProcessed : nativeRaw;
    if (nativeBest.trim()) return nativeBest.trim();
  } catch (error) {
    ocrErrors.push(error instanceof Error ? error.message : 'Native OCR failed');
  }

  try {
    const processedCanvas = await buildProcessedOcrCanvas(imageBase64);
    const processedImageBase64 = processedCanvas.toDataURL('image/png');
    const [visionRaw, visionProcessed] = await Promise.all([
      extractTextWithVisionModel(imageBase64),
      extractTextWithVisionModel(processedImageBase64),
    ]);
    const visionBest = visionProcessed.length > visionRaw.length ? visionProcessed : visionRaw;
    if (visionBest.trim()) return visionBest.trim();
  } catch (error) {
    ocrErrors.push(error instanceof Error ? error.message : 'Vision OCR failed');
  }

  if (ocrErrors.length > 0) return `[OCR error: ${ocrErrors[0]}]`;
  return '[No readable text found]';
}

function hasReadableOcrText(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === '[no readable text found]') return false;
  if (normalized.startsWith('[ocr error:')) return false;
  return true;
}

export interface ChatMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
  timestamp: string;
  type?: 'text' | 'voice' | 'image';
  audioUrl?: string;
  audioDuration?: number;
  imageUrl?: string;
  translationMode?: 'ocr' | 'describe' | 'ask';
}

interface ChatSession {
  id: string;
  title: string;
  /** Populated for guest/local history; signed-in threads load messages from Firestore via `currentChatId`. */
  messages?: ChatMessage[];
  savedAt: number;
}

/** localStorage key for the active guest thread (persists across app restarts on mobile). */
function sessionMessagesStorageKey(uid: string): string {
  return `salintayo_chat_current_session:${uid}`;
}

/** localStorage: last opened Firestore chat id (signed-in users). */
function activeChatIdStorageKey(uid: string): string {
  return `salintayo_chat_active_chat_id:${uid}`;
}

function guestCurrentSessionIdKey(uid: string): string {
  return `salintayo_chat_active_guest_session:${uid}`;
}

function getGuestCurrentSessionId(uid: string): string | null {
  try {
    return localStorage.getItem(guestCurrentSessionIdKey(uid));
  } catch {
    return null;
  }
}

function setGuestCurrentSessionId(uid: string, id: string) {
  try {
    localStorage.setItem(guestCurrentSessionIdKey(uid), id);
  } catch {
    /* ignore */
  }
}

function clearGuestCurrentSessionId(uid: string) {
  try {
    localStorage.removeItem(guestCurrentSessionIdKey(uid));
  } catch {
    /* ignore */
  }
}

/** One-time migration from sessionStorage (cleared on Android app kill). */
function migrateChatStorageFromSession(uid: string) {
  for (const keyFn of [sessionMessagesStorageKey, activeChatIdStorageKey]) {
    try {
      const key = keyFn(uid);
      const legacy = sessionStorage.getItem(key);
      if (legacy && !localStorage.getItem(key)) {
        localStorage.setItem(key, legacy);
      }
      if (legacy) sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

/** After a full reload, blob: audio URLs are invalid; drop them so playback UI does not reference dead resources. */
function sanitizeMessagesAfterReload(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => {
    if (m.audioUrl?.startsWith('blob:')) {
      const { audioUrl: _drop, ...rest } = m;
      return rest as ChatMessage;
    }
    return m;
  });
}

function loadSessionMessages(uid: string): ChatMessage[] {
  migrateChatStorageFromSession(uid);
  try {
    const raw = localStorage.getItem(sessionMessagesStorageKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return sanitizeMessagesAfterReload(parsed as ChatMessage[]);
  } catch {
    return [];
  }
}

function deriveChatTitle(msgs: ChatMessage[]): string {
  const firstUser = msgs.find((m) => m.role === 'user');
  if (!firstUser) return 'New chat';
  if (firstUser.type === 'image') {
    const t = firstUser.content.trim();
    return t ? (t.length > 40 ? `${t.slice(0, 40)}…` : t) : 'Image';
  }
  const text = firstUser.content.trim();
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}

function loadGuestSessionMessages(uid: string, sessionId: string): ChatMessage[] {
  try {
    const sessions = JSON.parse(localStorage.getItem(`salintayo_chat_sessions:${uid}`) || '[]') as ChatSession[];
    const match = sessions.find((s) => s.id === sessionId);
    return match?.messages?.length ? sanitizeMessagesAfterReload(match.messages) : [];
  } catch {
    return [];
  }
}

interface PendingImage {
  id: string;
  data: string;
  caption: string;
  selected: boolean;
}

interface LocationState {
  emergencyDialect?: Dialect;
  emergencyPhrases?: EmergencyPhrase[];
}

const formatTime = () =>
  new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

function isUserCancelledError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /cancel/i.test(msg) || /dismiss/i.test(msg);
}

async function readImageRefAsDataUrl(webPath: string): Promise<string> {
  if (webPath.startsWith('data:')) return webPath;
  const response = await fetch(webPath);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read selected image.'));
    reader.readAsDataURL(blob);
  });
}

const ChatPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation<LocationState>();
  const isChat = location.pathname === '/chat';
  const storageUid = user?.uid ?? 'guest';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const currentChatIdRef = useRef<string | null>(null);
  const chatInitPromiseRef = useRef<Promise<string | null> | null>(null);
  const chatInitUidRef = useRef<string | null>(null);
  useEffect(() => {
    currentChatIdRef.current = currentChatId;
  }, [currentChatId]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [speakingTtsMessageId, setSpeakingTtsMessageId] = useState<string | null>(null);
  
  // Image attachment state - Messenger/DeepSeek style
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [isImageTrayOpen, setIsImageTrayOpen] = useState(false);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [selectMode, setSelectMode] = useState(false);
  
  // ── Emergency mode state ──────────────────────────────────────────────
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [emergencyDialect, setEmergencyDialect] = useState<Dialect | null>(null);
  const [emergencyPhrases, setEmergencyPhrases] = useState<EmergencyPhrase[]>([]);
  
  // ── Quick Chat mode state ─────────────────────────────────────────────
  const [isQuickChatMode, setIsQuickChatMode] = useState(false);
  const [quickChatLanguage, setQuickChatLanguage] = useState<string | null>(null);

  // ── Auto-mic mode — activated when arriving from a QuickChat phrase ───
  // When true: mic opens automatically, AI replies are spoken aloud,
  // and the mic re-opens after each AI turn for a hands-free conversation.
  const [isAutoMicMode, setIsAutoMicMode] = useState(false);

  // ── History drawer + saved sessions (localStorage, per user or guest) ──
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const sessionsKey = (uid: string) => `salintayo_chat_sessions:${uid}`;

  const loadSessionsForUser = (uid: string): ChatSession[] => {
    try {
      const raw = localStorage.getItem(sessionsKey(uid));
      return raw ? (JSON.parse(raw) as ChatSession[]) : [];
    } catch {
      return [];
    }
  };

  const persistSessionsForUser = (uid: string, sessions: ChatSession[]) => {
    try {
      localStorage.setItem(sessionsKey(uid), JSON.stringify(sessions));
    } catch {
      /* ignore quota */
    }
  };

  const [savedSessions, setSavedSessions] = useState<ChatSession[]>(() =>
    user?.uid ? [] : loadSessionsForUser(storageUid)
  );

  const ensureCurrentChatId = useCallback(async (): Promise<string | null> => {
    const uid = user?.uid;
    if (!uid) return null;
    if (currentChatIdRef.current) return currentChatIdRef.current;
    if (chatInitPromiseRef.current && chatInitUidRef.current === uid) {
      const id = await chatInitPromiseRef.current;
      if (id) setCurrentChatId(id);
      return id;
    }
    migrateChatStorageFromSession(uid);
    let preferred: string | null = null;
    try {
      preferred = localStorage.getItem(activeChatIdStorageKey(uid));
    } catch {
      preferred = null;
    }
    if (preferred) {
      const exists = await chatThreadExists(uid, preferred);
      if (exists) {
        setCurrentChatId(preferred);
        return preferred;
      }
    }
    const newId = await createEmptyChat(uid);
    setCurrentChatId(newId);
    try {
      localStorage.setItem(activeChatIdStorageKey(uid), newId);
    } catch {
      /* ignore */
    }
    return newId;
  }, [user?.uid]);

  const persistCloudMessage = useCallback(
    (msg: ChatMessage) => {
      const uid = user?.uid;
      if (!uid) return;
      void (async () => {
        try {
          const cid = await ensureCurrentChatId();
          if (!cid) return;
          await upsertChatMessage(uid, cid, msg);
        } catch (err) {
          console.error('Chat save failed:', err);
        }
      })();
    },
    [user?.uid, ensureCurrentChatId]
  );

  // Guest: session list from localStorage. Signed-in: live thread list from Firestore.
  useEffect(() => {
    if (user?.uid) {
      const unsub = subscribeUserChatThreads(user.uid, (items) => {
        setSavedSessions(
          items.map((i) => ({
            id: i.id,
            title: i.title,
            savedAt: i.savedAt,
            messages: [],
          }))
        );
      });
      return unsub;
    }
    setSavedSessions(loadSessionsForUser(storageUid));
    return undefined;
  }, [user?.uid, storageUid]);

  // Guest: restore / follow storageUid; signed-in messages come from Firestore subscription.
  const isFirstStorageUidEffect = useRef(true);
  useEffect(() => {
    if (user?.uid) return;
    if (isFirstStorageUidEffect.current) {
      isFirstStorageUidEffect.current = false;
      setMessages(loadSessionMessages(storageUid));
      return;
    }
    setMessages(loadSessionMessages(storageUid));
  }, [storageUid, user?.uid]);

  // Signed-in: resolve Firestore thread id + optional one-time migration from legacy localStorage.
  useEffect(() => {
    if (!user?.uid) {
      chatInitPromiseRef.current = null;
      chatInitUidRef.current = null;
      setCurrentChatId(null);
      return;
    }
    setMessages([]);
    let cancelled = false;
    const uid = user.uid;
    chatInitUidRef.current = uid;
    chatInitPromiseRef.current = (async () => {
      try {
        await migrateLocalSessionsToFirestoreIfEmpty(uid, loadSessionsForUser(uid));
      } catch (e) {
        console.error('Chat migration failed:', e);
      }
      if (cancelled) return null;
      migrateChatStorageFromSession(uid);
      let preferred: string | null = null;
      try {
        preferred = localStorage.getItem(activeChatIdStorageKey(uid));
      } catch {
        preferred = null;
      }
      if (preferred) {
        const exists = await chatThreadExists(uid, preferred);
        if (cancelled) return null;
        if (exists) return preferred;
      }
      try {
        const newId = await createEmptyChat(uid);
        if (cancelled) return null;
        try {
          localStorage.setItem(activeChatIdStorageKey(uid), newId);
        } catch {
          /* ignore */
        }
        return newId;
      } catch (e) {
        console.error('Could not start chat thread:', e);
        return null;
      }
    })();
    void chatInitPromiseRef.current.then((id) => {
      if (!cancelled && id) setCurrentChatId(id);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  // Signed-in: live messages for the active chatId (merge keeps optimistic rows until server echoes).
  const prevSubChatIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user?.uid || !currentChatId) return;
    if (prevSubChatIdRef.current !== currentChatId) {
      setMessages([]);
      prevSubChatIdRef.current = currentChatId;
    }
    const uid = user.uid;
    const cid = currentChatId;
    const unsub = subscribeChatMessages(uid, cid, (remote) => {
      setMessages((prev) => mergeChatMessages(prev, remote));
    });
    return unsub;
  }, [user?.uid, currentChatId]);

  // Signed-in: keep thread title/sidebar in sync with the latest transcript.
  useEffect(() => {
    if (!user?.uid || !currentChatId || messages.length === 0) return;
    const uid = user.uid;
    const cid = currentChatId;
    const t = window.setTimeout(() => {
      void updateChatThreadMeta(uid, cid, messages);
    }, 450);
    return () => window.clearTimeout(t);
  }, [messages, user?.uid, currentChatId]);

  // Guest: persist current thread + session list to localStorage (survives app restarts on mobile).
  useEffect(() => {
    if (user?.uid) return;
    try {
      localStorage.setItem(sessionMessagesStorageKey(storageUid), JSON.stringify(messages));
    } catch {
      /* ignore quota */
    }
    if (messages.length === 0) return;

    const timer = window.setTimeout(() => {
      let sessionId = getGuestCurrentSessionId(storageUid);
      if (!sessionId) {
        sessionId = `s-${Date.now()}`;
        setGuestCurrentSessionId(storageUid, sessionId);
      }
      const entry: ChatSession = {
        id: sessionId,
        title: deriveChatTitle(messages),
        messages,
        savedAt: Date.now(),
      };
      const sessions = loadSessionsForUser(storageUid);
      const idx = sessions.findIndex((s) => s.id === sessionId);
      const updated =
        idx >= 0 ? sessions.map((s, i) => (i === idx ? entry : s)) : [entry, ...sessions];
      persistSessionsForUser(storageUid, updated.slice(0, 50));
      setSavedSessions(updated.slice(0, 50));
    }, 600);
    return () => window.clearTimeout(timer);
  }, [messages, storageUid, user?.uid]);

  const deleteSession = (sessionId: string) => {
    if (user?.uid) {
      void (async () => {
        try {
          await deleteChatThread(user.uid, sessionId);
        } catch (e) {
          console.error('deleteChatThread', e);
        }
        if (currentChatIdRef.current === sessionId) {
          try {
            const newId = await createEmptyChat(user.uid);
            setCurrentChatId(newId);
            try {
              localStorage.setItem(activeChatIdStorageKey(user.uid), newId);
            } catch {
              /* ignore */
            }
          } catch (e) {
            console.error(e);
          }
        }
      })();
      return;
    }
    const updated = savedSessions.filter((s) => s.id !== sessionId);
    persistSessionsForUser(storageUid, updated);
    setSavedSessions(updated);
  };

  const deleteAllSessions = () => {
    if (user?.uid) {
      void (async () => {
        try {
          await deleteAllChatThreads(user.uid);
        } catch (e) {
          console.error('deleteAllChatThreads', e);
        }
        try {
          const newId = await createEmptyChat(user.uid);
          prevSubChatIdRef.current = null;
          setCurrentChatId(newId);
          try {
            localStorage.setItem(activeChatIdStorageKey(user.uid), newId);
          } catch {
            /* ignore */
          }
        } catch (e) {
          console.error(e);
        }
        setMessages([]);
        setShowClearConfirm(false);
      })();
      return;
    }
    persistSessionsForUser(storageUid, []);
    setSavedSessions([]);
    try {
      localStorage.removeItem(sessionMessagesStorageKey(storageUid));
    } catch {
      /* ignore */
    }
    clearGuestCurrentSessionId(storageUid);
    setMessages([]);
    setShowClearConfirm(false);
  };

  const groupSessions = (sessions: ChatSession[]) => {
    const now = Date.now();
    const DAY = 86_400_000;
    const groups: { group: string; sessions: ChatSession[] }[] = [
      { group: 'Today', sessions: [] },
      { group: '7 Days', sessions: [] },
      { group: '30 Days', sessions: [] },
      { group: 'Older', sessions: [] },
    ];
    sessions.forEach((s) => {
      const age = now - s.savedAt;
      if (age < DAY) groups[0].sessions.push(s);
      else if (age < 7 * DAY) groups[1].sessions.push(s);
      else if (age < 30 * DAY) groups[2].sessions.push(s);
      else groups[3].sessions.push(s);
    });
    return groups.filter((g) => g.sessions.length > 0);
  };

  const chatHistory = groupSessions(
    user?.uid
      ? savedSessions.filter((s) => s.title !== 'New chat' || s.id === currentChatId)
      : savedSessions
  );

  const finalizeGuestSession = useCallback(
    (msgs: ChatMessage[], sessionId: string | null) => {
      if (!msgs.length) return null;
      const sid = sessionId ?? `s-${Date.now()}`;
      const entry: ChatSession = {
        id: sid,
        title: deriveChatTitle(msgs),
        messages: msgs,
        savedAt: Date.now(),
      };
      const sessions = loadSessionsForUser(storageUid);
      const idx = sessions.findIndex((s) => s.id === sid);
      const updated =
        idx >= 0 ? sessions.map((s, i) => (i === idx ? entry : s)) : [entry, ...sessions];
      persistSessionsForUser(storageUid, updated.slice(0, 50));
      setSavedSessions(updated.slice(0, 50));
      return sid;
    },
    [storageUid]
  );

  const openHistorySession = useCallback(
    (session: ChatSession) => {
      setIsHistoryOpen(false);
      if (user?.uid) {
        prevSubChatIdRef.current = null;
        setMessages([]);
        setCurrentChatId(session.id);
        try {
          localStorage.setItem(activeChatIdStorageKey(user.uid), session.id);
        } catch {
          /* ignore */
        }
        void fetchChatMessages(user.uid, session.id)
          .then((msgs) => {
            if (currentChatIdRef.current !== session.id) return;
            let loaded = sanitizeMessagesAfterReload(msgs as ChatMessage[]);
            if (!loaded.length) {
              loaded = loadGuestSessionMessages(user.uid, session.id);
            }
            setMessages(loaded);
          })
          .catch((err) => console.error('Failed to load chat history:', err));
        return;
      }

      const stored = loadGuestSessionMessages(storageUid, session.id);
      const msgs =
        stored.length > 0
          ? stored
          : sanitizeMessagesAfterReload(session.messages ?? []);
      setGuestCurrentSessionId(storageUid, session.id);
      setMessages(msgs);
      try {
        localStorage.setItem(sessionMessagesStorageKey(storageUid), JSON.stringify(msgs));
      } catch {
        /* ignore */
      }
    },
    [user?.uid, storageUid]
  );

  // Guest: refresh session list from disk when opening history (ensures messages are available).
  useEffect(() => {
    if (isHistoryOpen && !user?.uid) {
      setSavedSessions(loadSessionsForUser(storageUid));
    }
  }, [isHistoryOpen, user?.uid, storageUid]);

  const startNewChat = () => {
    if (user?.uid) {
      void (async () => {
        try {
          const newId = await createEmptyChat(user.uid);
          prevSubChatIdRef.current = null;
          setCurrentChatId(newId);
          try {
            localStorage.setItem(activeChatIdStorageKey(user.uid), newId);
          } catch {
            /* ignore */
          }
        } catch (e) {
          console.error('startNewChat', e);
        }
        setMessages([]);
        setPendingImages([]);
        setIsImageTrayOpen(false);
        setIsFullscreenPreview(false);
        setSelectMode(false);
        setInputValue('');
        setIsHistoryOpen(false);
        setShowClearConfirm(false);
      })();
      return;
    }
    finalizeGuestSession(messages, getGuestCurrentSessionId(storageUid));
    try {
      localStorage.removeItem(sessionMessagesStorageKey(storageUid));
      clearGuestCurrentSessionId(storageUid);
    } catch {
      /* ignore */
    }
    setMessages([]);
    setPendingImages([]);
    setIsImageTrayOpen(false);
    setIsFullscreenPreview(false);
    setSelectMode(false);
    setInputValue('');
    setIsHistoryOpen(false);
    setShowClearConfirm(false);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContentRef = useRef<HTMLIonContentElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const filePickerRef = useRef<HTMLInputElement>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  // ── Handle emergency dialect injection on mount ──
  const lastEmergencyInjectionKeyRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    // Ionic/React Router can keep pages mounted on mobile; re-run when navigation key changes.
    if (lastEmergencyInjectionKeyRef.current === location.key) return;
    lastEmergencyInjectionKeyRef.current = location.key;

    const { emergencyDialect: dial, emergencyPhrases: phrases } = location.state ?? {};
    if (!dial || !phrases || phrases.length === 0) return;

    setEmergencyDialect(dial);
    setEmergencyPhrases(phrases);
    setIsEmergencyMode(true);

    // Clear history state so a refresh doesn't re-inject emergency mode repeatedly.
    window.history.replaceState({}, document.title);
  }, [location.key, location.state]);

  // ── Handle Quick Chat mode and automic mode from query parameters ────────
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const lang      = searchParams.get('lang');
    const quickmode = searchParams.get('quickmode');
    const automic   = searchParams.get('automic');

    // automic=true → arrived from a QuickChat phrase speaker button
    if (automic === 'true') {
      setIsAutoMicMode(true);
    }

    if (lang && quickmode === 'true' && QUICK_CHAT_LANGUAGES[lang]) {
      setQuickChatLanguage(lang);
      setIsQuickChatMode(true);
      try {
        localStorage.setItem('salintayo_quickchat_lang', lang);
      } catch {}
    } else {
      try {
        const savedLang = localStorage.getItem('salintayo_quickchat_lang');
        if (savedLang && QUICK_CHAT_LANGUAGES[savedLang]) {
          setQuickChatLanguage(savedLang);
          setIsQuickChatMode(true);
        }
      } catch {}
    }
  }, [location.search]);

  // ── Auto-open voice mic when arriving in automic mode ─────────────────
  useEffect(() => {
    if (!isAutoMicMode) return;
    // Small delay so IonPage finishes its enter animation before the modal opens
    const timer = setTimeout(() => setIsVoiceModalOpen(true), 700);
    return () => clearTimeout(timer);
  }, [isAutoMicMode]);

  // ── Auto-speak AI replies and re-open mic in automic mode ─────────────
  useEffect(() => {
    if (!isAutoMicMode || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== 'ai') return;

    // Speak via shared TTS wrapper (now prefers Camb, with fallbacks).
    const textToSpeak = getTtsSpeakTextFromAiMessageContent(lastMsg.content);
    if (!textToSpeak.trim()) {
      const t = setTimeout(() => setIsVoiceModalOpen(true), 800);
      return () => clearTimeout(t);
    }

    // Fallback in case onEnd doesn't fire (network / audio issues).
    const fallback = setTimeout(() => {
      cancelSpeech();
      setIsVoiceModalOpen(true);
    }, 12_000);

    speakText(textToSpeak, {
      onEnd: () => {
        clearTimeout(fallback);
        setTimeout(() => setIsVoiceModalOpen(true), 600);
      },
      onError: () => {
        clearTimeout(fallback);
        setTimeout(() => setIsVoiceModalOpen(true), 600);
      },
    });

    return () => {
      clearTimeout(fallback);
      cancelSpeech();
    };
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Generate language-specific system prompt ───────────────────────────
  const getLanguageSystemPrompt = (langCode: string | null): string => {
    if (!langCode || !QUICK_CHAT_LANGUAGES[langCode]) {
      return SYSTEM_PROMPT;
    }
    const lang = QUICK_CHAT_LANGUAGES[langCode];
    return `You are SalinTayo AI, a Filipino language tutor and translator specializing in ${lang.label}.
Your role is to help users learn ${lang.label} by:
- Translating English to ${lang.label} and vice versa
- Explaining ${lang.label} words, phrases, and grammar
- Providing example sentences in ${lang.label}
- Being friendly, patient, and encouraging

Always respond primarily in ${lang.label} when the user communicates in English. If asked about images, analyze them and provide translations in ${lang.label}.`;
  };

  // ── Handle quick phrase click ─────────────────────────────────────────
  const handleQuickPhraseClick = (phrase: EmergencyPhrase) => {
    setInputValue(phrase.text);
    inputRef.current?.focus();
  };

  // ── Dismiss emergency mode ───────────────────────────────────────────
  const handleDismissEmergency = () => {
    setIsEmergencyMode(false);
    setEmergencyDialect(null);
    setEmergencyPhrases([]);
  };

  // ── Dismiss Quick Chat mode ─────────────────────────────────────────────
  const handleDismissQuickChat = () => {
    setIsQuickChatMode(false);
    setQuickChatLanguage(null);
    try {
      localStorage.removeItem('salintayo_quickchat_lang');
    } catch {}
  };

  // ── Exit Quick Chat mode fully (disables bubble too) ────────────────────
  const handleExitQuickChat = () => {
    setIsQuickChatMode(false);
    setQuickChatLanguage(null);
    try {
      localStorage.removeItem('salintayo_quickchat_lang');
      localStorage.setItem('salintayo_quickchat_enabled', 'false');
    } catch {}
  };

  useEffect(() => {
    return () => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    };
  }, []);

  useIonViewWillEnter(() => {
    requestAnimationFrame(() => {
      void chatContentRef.current?.scrollToBottom(0);
    });
  });

  useIonViewDidEnter(() => {
    const firstFocusable = document.querySelector<HTMLElement>('.chat-input__field');
    if (firstFocusable) {
      firstFocusable.focus();
    }
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    return () => {
      Object.values(audioRefs.current).forEach(audio => {
        audio.pause();
        audio.src = '';
      });
    };
  }, []);

  // Ensure SpeechSynthesis voices load (Chrome loads them asynchronously).
  const [, setTtsVoicesEpoch] = useState(0);
  useEffect(() => {
    const onVoices = () => setTtsVoicesEpoch((n) => n + 1);
    window.speechSynthesis?.addEventListener('voiceschanged', onVoices);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', onVoices);
  }, []);

  useEffect(() => {
    return () => {
      cancelSpeech();
    };
  }, []);

  const handleSpeakAiMessage = useCallback((msg: ChatMessage) => {
    if (msg.role !== 'ai' || !msg.content.trim()) return;
    if (!('speechSynthesis' in window)) return;

    if (speakingTtsMessageId === msg.id) {
      cancelSpeech();
      setSpeakingTtsMessageId(null);
      return;
    }

    setSpeakingTtsMessageId(msg.id);
    speakText(getTtsSpeakTextFromAiMessageContent(msg.content), {
      onEnd: () => setSpeakingTtsMessageId((id) => (id === msg.id ? null : id)),
      onError: () => setSpeakingTtsMessageId((id) => (id === msg.id ? null : id)),
    });
  }, [speakingTtsMessageId]);

  const sendTextToAI = async (
    textRaw: string,
    options?: { skipUserMessage?: boolean; forceTranslation?: boolean }
  ) => {
    const text = textRaw.trim();
    if (!text || isLoading) return;

    if (!options?.skipUserMessage) {
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: text,
        timestamp: formatTime(),
      };
      setMessages((prev) => [...prev, userMessage]);
      if (user?.uid) persistCloudMessage(userMessage);
      setInputValue('');
    }

    setIsLoading(true);
    try {
      const translationMode =
        Boolean(options?.forceTranslation) ||
        isTranslationRequest(text) ||
        isAutoTranslationCandidate(text) ||
        isLongPlainTranslationPaste(text);
      const wordCount = getWordCount(text);
      const forceSingleWord =
        /\b(one word|single word)\b/i.test(text) ||
        (/\bword\b/i.test(text) && !/\bsentence\b/i.test(text)) ||
        wordCount === 1;

      const activeDialect = getActiveDialect();
      const systemPrompt = translationMode
        ? getStrictTranslationSystemPrompt(activeDialect)
        : getLanguageSystemPrompt(quickChatLanguage);

      // Translation mode doesn't need full conversation context.
      // Sending only the current input makes the model faster and more deterministic.
      const messagesForModel = translationMode
        ? ([{ role: 'user' as const, content: text }] as { role: 'user' | 'assistant'; content: string }[])
        : (messages.slice(-10).map((msg) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })) as { role: 'user' | 'assistant'; content: string }[]).concat([
            { role: 'user', content: text },
          ]);

      const reply = await askOpenRouter(messagesForModel, systemPrompt, {
        maxTokens: translationMode ? translationMaxOutputTokens(text, forceSingleWord) : 1000,
        temperature: translationMode ? 0.1 : 0.7,
        reasoningEnabled: !translationMode,
      });

      const content = translationMode
        ? formatTranslationReply({
            originalText: text,
            target: activeDialect,
            translation: extractTranslationOnly(reply, forceSingleWord),
          })
        : reply;

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: content || 'Sorry, I could not generate a response. Please try again.',
        timestamp: formatTime(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      if (user?.uid) persistCloudMessage(aiMessage);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Failed to get response';
      const fallbackMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: `Sorry, something went wrong: ${errMsg}. Please check your API key configuration.`,
        timestamp: formatTime(),
      };
      setMessages((prev) => [...prev, fallbackMessage]);
      if (user?.uid) persistCloudMessage(fallbackMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    await sendTextToAI(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAttachmentClick = () => {
    setIsAttachmentModalOpen(true);
  };

  const addPendingImage = useCallback((data: string) => {
    const newImage: PendingImage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      data,
      caption: '',
      selected: false,
    };
    setPendingImages((prev) => [...prev, newImage]);
    setIsImageTrayOpen(true);
  }, []);

  const showImagePickerError = useCallback((error: unknown) => {
    if (isUserCancelledError(error)) return;
    const message = error instanceof Error ? error.message : 'Unable to access image source.';
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'ai',
      content: `⚠️ ${message}`,
      timestamp: formatTime(),
    };
    setMessages((prev) => [...prev, userMessage]);
    if (user?.uid) persistCloudMessage(userMessage);
  }, [persistCloudMessage, user?.uid]);

  const pickNativeGallery = useCallback(async () => {
    try {
      // Let the attachment sheet finish closing before launching the system picker.
      await new Promise((resolve) => setTimeout(resolve, 150));
      const result = await Camera.pickImages({ quality: 90 });
      if (!result.photos.length) return;

      for (const photo of result.photos) {
        const dataUrl = await readImageRefAsDataUrl(photo.webPath);
        addPendingImage(dataUrl);
      }
    } catch (error) {
      showImagePickerError(error);
    }
  }, [addPendingImage, showImagePickerError]);

  const pickNativeCamera = useCallback(async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 150));
      const perms = await Camera.requestPermissions({ permissions: ['camera'] });
      if (perms.camera !== 'granted' && perms.camera !== 'limited') {
        throw new Error('Camera permission is required to take photos.');
      }
      const photo = await Camera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.DataUrl,
        quality: 90,
      });
      if (!photo.dataUrl) {
        throw new Error('No image data returned by device.');
      }
      addPendingImage(photo.dataUrl);
    } catch (error) {
      showImagePickerError(error);
    }
  }, [addPendingImage, showImagePickerError]);

  const openGalleryPicker = useCallback(() => {
    if (Capacitor.isNativePlatform()) {
      void pickNativeGallery();
      return;
    }
    filePickerRef.current?.click();
  }, [pickNativeGallery]);

  const handleVoiceClick = () => {
    setIsVoiceModalOpen(true);
  };

  const handleAttachmentSelect = (type: 'camera' | 'gallery' | 'document' | 'voice' | 'location') => {
    if (type === 'camera') {
      setIsAttachmentModalOpen(false);
      if (Capacitor.isNativePlatform()) {
        void pickNativeCamera();
        return;
      }
      setIsCameraModalOpen(true);
      return;
    }
    if (type === 'gallery') {
      setIsAttachmentModalOpen(false);
      openGalleryPicker();
      return;
    }
    const featureMessages: Record<string, string> = {
      document: '📄 Document attachment coming soon!',
      voice: '🎤 Voice recording coming soon!',
      location: '📍 Location sharing coming soon!',
    };
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: featureMessages[type],
      timestamp: formatTime(),
    };
    setMessages((prev) => [...prev, userMessage]);
    if (user?.uid) persistCloudMessage(userMessage);
    setIsAttachmentModalOpen(false);
  };

  const handleCameraCapture = (imageData: string) => {
    const newImage: PendingImage = {
      id: Date.now().toString(),
      data: imageData,
      caption: '',
      selected: false,
    };
    setPendingImages(prev => [...prev, newImage]);
    setIsImageTrayOpen(true);
    setIsCameraModalOpen(false);
  };

  const handleFilePickerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const newImage: PendingImage = {
          id: Date.now().toString() + i + Math.random().toString(),
          data: base64,
          caption: '',
          selected: false,
        };
        setPendingImages(prev => [...prev, newImage]);
      };
      reader.readAsDataURL(file);
    }
    setIsImageTrayOpen(true);
    e.target.value = '';
  };

  const handleRemoveImage = (id: string) => {
    setPendingImages(prev => prev.filter(img => img.id !== id));
    if (pendingImages.length <= 1) {
      setIsImageTrayOpen(false);
      setIsFullscreenPreview(false);
    } else if (previewIndex >= pendingImages.length - 1) {
      setPreviewIndex(Math.max(0, pendingImages.length - 2));
    }
  };

  const handleToggleSelect = (id: string) => {
    setPendingImages(prev => prev.map(img => 
      img.id === id ? { ...img, selected: !img.selected } : img
    ));
  };

  const handleSelectAll = () => {
    const allSelected = pendingImages.every(img => img.selected);
    setPendingImages(prev => prev.map(img => ({ ...img, selected: !allSelected })));
  };

  const handleDeleteSelected = () => {
    setPendingImages(prev => prev.filter(img => !img.selected));
    setSelectMode(false);
    if (pendingImages.filter(img => !img.selected).length === 0) {
      setIsImageTrayOpen(false);
      setIsFullscreenPreview(false);
    }
  };

  const handleUpdateCaption = (id: string, caption: string) => {
    setPendingImages(prev => prev.map(img => 
      img.id === id ? { ...img, caption } : img
    ));
  };

  const handleOpenFullscreen = (index: number) => {
    setPreviewIndex(index);
    setIsFullscreenPreview(true);
  };

  const handleCloseFullscreen = () => {
    setIsFullscreenPreview(false);
  };

  const handlePrevImage = () => {
    setPreviewIndex(prev => Math.max(0, prev - 1));
  };

  const handleNextImage = () => {
    setPreviewIndex(prev => Math.min(pendingImages.length - 1, prev + 1));
  };

  const handleAddMoreFromPreview = () => {
    openGalleryPicker();
  };

  const handleSendImages = async () => {
    if (pendingImages.length === 0) return;
    
    const imagesToSend = [...pendingImages];
    const caption = inputValue.trim();
    
    imagesToSend.forEach((img, index) => {
      const userMessage: ChatMessage = {
        id: (Date.now() + index).toString(),
        role: 'user',
        content: caption,
        timestamp: formatTime(),
        type: 'image',
        imageUrl: img.data,
        translationMode: 'ocr',
      };
      setMessages(prev => [...prev, userMessage]);
      if (user?.uid) persistCloudMessage(userMessage);
    });
    
    setPendingImages([]);
    setIsImageTrayOpen(false);
    setIsFullscreenPreview(false);
    setSelectMode(false);
    setInputValue('');
    setIsLoading(true);
    try {
      const ocrResults = await Promise.all(
        imagesToSend.map(async (img, index) => {
          try {
            const text = await extractTextFromImage(img.data);
            return { index, text };
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : 'OCR failed';
            return { index, text: `[OCR error: ${errMsg}]` };
          }
        })
      );

      const readableResults = ocrResults.filter((result) => hasReadableOcrText(result.text));
      if (readableResults.length === 0) {
        const ocrErrorResults = ocrResults.filter((result) => result.text.trim().toLowerCase().startsWith('[ocr error:'));
        if (ocrErrorResults.length > 0) {
          const firstError = ocrErrorResults[0].text.replace(/^\[ocr error:\s*/i, '').replace(/\]$/, '').trim();
          const ocrFailureMessage: ChatMessage = {
            id: (Date.now() + 1000).toString(),
            role: 'ai',
            content: `⚠️ Image text scan failed. OCR engine error: ${firstError || 'unknown error'}.`,
            timestamp: formatTime(),
          };
          setMessages((prev) => [...prev, ocrFailureMessage]);
          if (user?.uid) persistCloudMessage(ocrFailureMessage);
          return;
        }

        const noTextMessage: ChatMessage = {
          id: (Date.now() + 1000).toString(),
          role: 'ai',
          content: '⚠️ No text on image detected. Please upload a clearer image that contains readable text.',
          timestamp: formatTime(),
        };
        setMessages((prev) => [...prev, noTextMessage]);
        if (user?.uid) persistCloudMessage(noTextMessage);
        return;
      }

      const extractedText = readableResults
        .map((result) => result.text)
        .join('\n\n');

      const targetDialect = getActiveDialect();
      const ocrTranslationPrompt = `You are SalinTayo AI.
Translate the OCR text into ${targetDialect.name} (${targetDialect.native}).
Rules:
1. Output exactly ONE line.
2. Format: RESULT=<translation>
3. Do NOT include explanations, labels, or extra text.`;

      const translatedText = await askOpenRouter(
        [{ role: 'user', content: extractedText }],
        ocrTranslationPrompt,
        { maxTokens: 1000, temperature: 0.2, reasoningEnabled: false }
      );
      const translationOnly = extractTranslationOnly(translatedText, false);

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1000).toString(),
        role: 'ai',
        content: translationOnly || '[Translation unavailable]',
        timestamp: formatTime(),
      };
      setMessages(prev => [...prev, aiMessage]);
      if (user?.uid) persistCloudMessage(aiMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTrayClose = () => {
    setIsImageTrayOpen(false);
    setIsFullscreenPreview(false);
    setSelectMode(false);
    setPendingImages([]);
  };

  const handleVoiceSend = async (
    audioBlob: Blob,
    caption: string,
    transcript: string,
    durationSec: number
  ) => {
    if (isLoading) return;

    const audioUrl = URL.createObjectURL(audioBlob);
    const messageId = Date.now().toString();
    const trimmedTranscript = transcript.trim();
    const voiceBubbleText = caption.trim();

    const voiceUserMessage: ChatMessage = {
      id: messageId,
      role: 'user',
      content: voiceBubbleText,
      timestamp: formatTime(),
      type: 'voice',
      audioUrl,
      audioDuration: durationSec,
    };
    setMessages((prev) => [...prev, voiceUserMessage]);
    if (user?.uid) persistCloudMessage(voiceUserMessage);

    try {
      setIsLoading(true);

      // Prefer device STT transcript. If empty, fall back to Whisper transcription.
      let sourceText = trimmedTranscript;
      if (!sourceText) {
        const t = await transcribeWhisper(audioBlob).catch(() => ({ text: '' }));
        sourceText = (t.text || '').trim();
      }

      if (!sourceText) {
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: 'I couldn’t detect speech from that recording. Please try again and speak a bit louder/closer to the mic.',
          timestamp: formatTime(),
        };
        setMessages((prev) => [...prev, aiMessage]);
        if (user?.uid) persistCloudMessage(aiMessage);
        return;
      }

      const voiceTarget = getVoiceTranslationTarget();
      const voicePrompt = getStrictTranslationSystemPrompt(voiceTarget);
      const translated = await askOpenRouter(
        [{ role: 'user', content: sourceText }],
        voicePrompt,
        { maxTokens: translationMaxOutputTokens(sourceText, false), temperature: 0.1, reasoningEnabled: false }
      );
      const translationOnly = extractTranslationOnly(translated, false) || '[Translation unavailable]';

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: translationOnly,
        timestamp: formatTime(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      if (user?.uid) persistCloudMessage(aiMessage);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Failed to process voice message';
      const failedVoice: ChatMessage = {
        ...voiceUserMessage,
        content: `🎤 Voice send failed: ${errMsg}`,
      };
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, content: `🎤 Voice send failed: ${errMsg}` } : m
        )
      );
      if (user?.uid) persistCloudMessage(failedVoice);

      const aiErrorMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: 'ai',
        content: `Sorry, I couldn't process the voice request: ${errMsg}`,
        timestamp: formatTime(),
      };
      setMessages((prev) => [...prev, aiErrorMessage]);
      if (user?.uid) persistCloudMessage(aiErrorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleVoicePlayback = (messageId: string, audioUrl: string) => {
    if (playingVoiceId === messageId) {
      audioRefs.current[messageId]?.pause();
      setPlayingVoiceId(null);
    } else {
      if (audioRefs.current[messageId]) {
        audioRefs.current[messageId].play();
      } else {
        const audio = new Audio(audioUrl);
        audioRefs.current[messageId] = audio;
        audio.onended = () => setPlayingVoiceId(null);
        audio.play();
      }
      setPlayingVoiceId(messageId);
    }
  };

  const renderMessageContent = (msg: ChatMessage) => {
    if (msg.type === 'voice') {
      if (msg.content.includes('Voice send failed')) {
        return <p className="chat-message__text chat-message__text--voice-error">{msg.content}</p>;
      }
      return (
        <div className="chat-voice-message">
          <button
            type="button"
            className="chat-voice-play-btn"
            onClick={() => msg.audioUrl && toggleVoicePlayback(msg.id, msg.audioUrl)}
            aria-label={playingVoiceId === msg.id ? 'Pause voice' : 'Play voice'}
          >
            <IonIcon icon={playingVoiceId === msg.id ? pauseOutline : playOutline} />
          </button>
          <div className="chat-voice-meta">
            <span className="chat-voice-label">Voice</span>
            <span className="chat-voice-duration">
              {formatDuration(typeof msg.audioDuration === 'number' ? msg.audioDuration : 0)}
            </span>
          </div>
          <div className="chat-voice-waveform" aria-hidden>
            {[...Array(12)].map((_, i) => (
              <div key={i} className="chat-voice-waveform-bar" style={{ animationDelay: `${i * 0.05}s` }} />
            ))}
          </div>
          {msg.content.trim() ? (
            <p className="chat-voice-caption">{msg.content}</p>
          ) : null}
        </div>
      );
    }
    
    if (msg.type === 'image') {
      return (
        <div className="chat-image-message">
          {msg.imageUrl && (
            <div className="chat-image-thumbnail">
              <img src={msg.imageUrl} alt="User upload" />
            </div>
          )}
          {msg.content.trim() && (
            <p className="chat-image-caption">{msg.content}</p>
          )}
        </div>
      );
    }
    
    return <p className="chat-message__text">{msg.content}</p>;
  };

  const selectedCount = pendingImages.filter(img => img.selected).length;

  return (
    <IonPage>
      <IonContent fullscreen className="chat-content" ref={chatContentRef}>
        <div className="chat-page">
          <header className="chat-header-sticky">
            <div className="hero-banner"></div>

            <svg className="hero-wave" viewBox="0 0 430 40" preserveAspectRatio="none">
              <path d="M0,20 C80,40 180,0 280,20 C350,35 400,10 430,18 L430,40 L0,40 Z" fill="#ffffff"/>
            </svg>
            <div className="chat-header">
              <button
                type="button"
                className="chat-header__hamburger"
                onClick={() => setIsHistoryOpen(true)}
                aria-label="Open chat history"
              >
                <span /><span /><span />
              </button>
              <button
                type="button"
                className="chat-header__new-chat-btn"
                onClick={startNewChat}
                aria-label="New chat"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              </button>
            </div>
            <hr className="chat-header__divider" />

            {/* Emergency Mode Banner */}
            {isEmergencyMode && emergencyDialect && (
              <div className="chat-emergency-banner" role="alert" aria-live="assertive">
                <div className="chat-emergency-banner__left">
                  <span className="chat-emergency-banner__icon">🚨</span>
                  <div>
                    <span className="chat-emergency-banner__title">EMERGENCY MODE</span>
                    <span className="chat-emergency-banner__dialect">
                      {emergencyDialect.flag} {emergencyDialect.name} · {emergencyDialect.nativeName}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="chat-emergency-banner__dismiss"
                  onClick={handleDismissEmergency}
                  aria-label="Dismiss emergency mode"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Automic Mode Banner — shown when arrived from QuickChat phrase */}
            {isAutoMicMode && !isEmergencyMode && (
              <div className="chat-automic-banner" role="status" aria-live="polite">
                <span className="chat-automic-banner__icon">🎙️</span>
                <span className="chat-automic-banner__text">
                  Hands-free mode — mic opens automatically after each reply
                </span>
                <button
                  type="button"
                  className="chat-automic-banner__dismiss"
                  onClick={() => {
                    setIsAutoMicMode(false);
                    cancelSpeech();
                    setSpeakingTtsMessageId(null);
                  }}
                  aria-label="Exit hands-free mode"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Quick Chat Mode Banner */}
            {isQuickChatMode && quickChatLanguage && QUICK_CHAT_LANGUAGES[quickChatLanguage] && !isEmergencyMode && (
              <div className="chat-quickchat-banner-wrap">
                <div className="chat-quickchat-banner" role="status" aria-live="polite">
                  <div className="chat-quickchat-banner__left">
                    <span className="chat-quickchat-banner__icon">⚡</span>
                    <div>
                      <span className="chat-quickchat-banner__title">Quick Chat Mode</span>
                      <span className="chat-quickchat-banner__language">
                        {QUICK_CHAT_LANGUAGES[quickChatLanguage].flag} {QUICK_CHAT_LANGUAGES[quickChatLanguage].label}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="chat-quickchat-banner__dismiss"
                    onClick={handleDismissQuickChat}
                    aria-label="Hide banner"
                    title="Hide banner"
                  >
                    ✕
                  </button>
                </div>
                <button
                  type="button"
                  className="chat-quickchat-exit-btn"
                  onClick={handleExitQuickChat}
                  aria-label="Exit Quick Chat mode"
                >
                  ✕ Exit Quick Chat Mode
                </button>
              </div>
            )}

            {/* Emergency Quick Phrases */}
            {isEmergencyMode && emergencyPhrases.length > 0 && (
              <div className="chat-emergency-phrases" role="group" aria-label="Emergency phrases">
                <p className="chat-emergency-phrases__label">Quick Phrases:</p>
                <div className="chat-emergency-phrases__list">
                  {emergencyPhrases.map((phrase, i) => (
                    <button
                      key={i}
                      type="button"
                      className="chat-emergency-phrase-btn"
                      onClick={() => handleQuickPhraseClick(phrase)}
                      title={phrase.text}
                    >
                      <span className="chat-emergency-phrase-btn__label">{phrase.label}</span>
                      <span className="chat-emergency-phrase-btn__text">{phrase.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </header>

          {isHistoryOpen && (
            <div
              className="chat-history-overlay"
              onClick={() => {
                setIsHistoryOpen(false);
                setShowClearConfirm(false);
              }}
              aria-hidden="true"
            />
          )}
          <aside
            className={`chat-history-drawer ${isHistoryOpen ? 'chat-history-drawer--open' : ''}`}
            aria-label="Chat history"
            aria-hidden={!isHistoryOpen}
          >
            <div className="chat-history-drawer__header">
              <div className="chat-history-drawer__brand">
                <IonIcon icon={chatbubbleEllipsesOutline} className="chat-history-drawer__logo" aria-hidden />
                <span className="chat-history-drawer__brand-name">SalinTayo</span>
              </div>
              <button
                type="button"
                className="chat-history-drawer__collapse"
                onClick={() => {
                  setIsHistoryOpen(false);
                  setShowClearConfirm(false);
                }}
                aria-label="Close history"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                </svg>
              </button>
            </div>

            <button type="button" className="chat-history-drawer__new-btn" onClick={startNewChat}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              New chat
            </button>

            <div className="chat-history-drawer__scroll">
              {chatHistory.length === 0 ? (
                <p className="chat-history-drawer__empty">
                  No previous chats yet.
                  <br />
                  Start a conversation and it will appear here.
                </p>
              ) : (
                <>
                  {chatHistory.map((group) => (
                    <div key={group.group} className="chat-history-drawer__group">
                      <p className="chat-history-drawer__group-label">{group.group}</p>
                      <ul className="chat-history-drawer__list">
                        {group.sessions.map((session) => (
                          <li key={session.id} className="chat-history-drawer__list-item">
                            <button
                              type="button"
                              className="chat-history-drawer__item"
                              onClick={() => openHistorySession(session)}
                            >
                              {session.title}
                            </button>
                            <button
                              type="button"
                              className="chat-history-drawer__delete-btn"
                              aria-label="Delete chat"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSession(session.id);
                              }}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6M14 11v6" />
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                              </svg>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </>
              )}
            </div>

            {savedSessions.length > 0 && (
              <div className="chat-history-drawer__footer-actions">
                {showClearConfirm ? (
                  <div className="chat-history-drawer__confirm">
                    <p className="chat-history-drawer__confirm-text">Delete all chat history?</p>
                    <div className="chat-history-drawer__confirm-btns">
                      <button
                        type="button"
                        className="chat-history-drawer__confirm-cancel"
                        onClick={() => setShowClearConfirm(false)}
                      >
                        Cancel
                      </button>
                      <button type="button" className="chat-history-drawer__confirm-delete" onClick={deleteAllSessions}>
                        Delete all
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="chat-history-drawer__clear-all" onClick={() => setShowClearConfirm(true)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                    Clear all history
                  </button>
                )}
              </div>
            )}

            <div className="chat-history-drawer__profile">
              <div className="chat-history-drawer__profile-avatar">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="" className="chat-history-drawer__profile-img" />
                ) : (
                  <IonIcon icon={personCircleOutline} aria-hidden />
                )}
              </div>
              <span className="chat-history-drawer__profile-name">{user?.displayName?.trim() || 'My Account'}</span>
              <button type="button" className="chat-history-drawer__profile-more" aria-label="More options">
                ···
              </button>
            </div>
          </aside>

          <section className="chat-messages" aria-label="Chat conversation">
            {messages.length === 0 && !isEmergencyMode && (
              <div className="chat-empty-state">
                {isQuickChatMode && quickChatLanguage && QUICK_CHAT_LANGUAGES[quickChatLanguage] ? (
                  <>
                    <p>⚡ Quick Chat Mode: {QUICK_CHAT_LANGUAGES[quickChatLanguage].flag} {QUICK_CHAT_LANGUAGES[quickChatLanguage].label}</p>
                    <p>Start chatting and I&apos;ll respond in {QUICK_CHAT_LANGUAGES[quickChatLanguage].label}!</p>
                  </>
                ) : (
                  <>
                    <p>Kumusta! I&apos;m your Filipino AI tutor.</p>
                    <p>Type a message or attach an image to translate.</p>
                  </>
                )}
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-message chat-message--${msg.role} ${msg.type === 'image' ? 'chat-message--image' : ''} ${msg.type === 'voice' ? 'chat-message--voice' : ''}`}
                data-role={msg.role}
              >
                <div className="chat-message__avatar">
                  {msg.role === 'ai' ? (
                    <IonIcon icon={chatbubbleEllipsesOutline} aria-hidden />
                  ) : user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt="Your profile"
                      className="chat-message__avatar-image"
                    />
                  ) : msg.type === 'voice' ? (
                    <IonIcon icon={volumeHighOutline} aria-hidden />
                  ) : msg.type === 'image' ? (
                    <IonIcon icon={imageOutline} aria-hidden />
                  ) : (
                    <IonIcon icon={personCircleOutline} aria-hidden />
                  )}
                </div>
                <div className="chat-message__bubble-wrap">
                  <div className="chat-message__bubble">
                    {msg.role === 'ai' && (
                      <div className="chat-message__ai-actions">
                        <button
                          type="button"
                          className={`chat-message__speak ${speakingTtsMessageId === msg.id ? 'chat-message__speak--active' : ''}`}
                          aria-label={speakingTtsMessageId === msg.id ? 'Stop speaking' : 'Speak message'}
                          onClick={() => handleSpeakAiMessage(msg)}
                        >
                          <IonIcon icon={volumeMediumOutline} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="chat-message__settings"
                          aria-label="Message options"
                        >
                          <IonIcon icon={settingsOutline} aria-hidden />
                        </button>
                      </div>
                    )}
                    {renderMessageContent(msg)}
                  </div>
                  <span className="chat-message__time">{msg.timestamp}</span>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="chat-message chat-message--ai chat-message--loading" data-role="ai">
                <div className="chat-message__avatar">
                  <IonIcon icon={chatbubbleEllipsesOutline} aria-hidden />
                </div>
                <div className="chat-message__bubble-wrap">
                  <div className="chat-message__bubble">
                    <p className="chat-message__text chat-message__typing">Thinking...</p>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} aria-hidden />
          </section>

          {/* Hidden file input */}
          <input
            ref={filePickerRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFilePickerChange}
          />

          {/* Inline Image Preview — attached above input bar */}
          {isImageTrayOpen && pendingImages.length > 0 && (
            <div className="chat-inline-preview">
              <div className="chat-inline-preview__strip">
                {pendingImages.map((img, index) => (
                  <div key={img.id} className="chat-inline-preview__thumb">
                    <img src={img.data} alt={`Preview ${index + 1}`} />
                    <button
                      type="button"
                      className="chat-inline-preview__remove"
                      onClick={() => handleRemoveImage(img.id)}
                      aria-label="Remove image"
                    >
                      <IonIcon icon={close} aria-hidden />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="chat-inline-preview__add"
                  onClick={openGalleryPicker}
                  aria-label="Add more images"
                >
                  <IonIcon icon={add} aria-hidden />
                </button>
              </div>
            </div>
          )}

          {/* Input Bar */}
          <div className={`chat-input-wrap ${isImageTrayOpen ? 'chat-input-wrap--with-preview' : ''}`}>
            <button
              type="button"
              className="chat-input__attach"
              onClick={handleAttachmentClick}
              aria-label="Attach file"
            >
              <IonIcon icon={attachOutline} aria-hidden />
            </button>
            <input
              ref={inputRef}
              type="text"
              className="chat-input__field"
              placeholder={isImageTrayOpen ? 'Add a caption or question...' : 'Type your message...'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  isImageTrayOpen ? handleSendImages() : handleSend();
                }
              }}
              aria-label="Message input"
            />
            <button
              type="button"
              className="chat-input__mic"
              onClick={
                isImageTrayOpen
                  ? openGalleryPicker
                  : handleVoiceClick
              }
              aria-label={
                isImageTrayOpen
                  ? 'Add more images'
                  : 'Voice input'
              }
            >
              <IonIcon icon={isImageTrayOpen ? imagesOutline : micOutline} aria-hidden />
            </button>
            {isImageTrayOpen ? (
              <button
                type="button"
                className="chat-input__send chat-input__send--image"
                onClick={handleSendImages}
                disabled={isLoading || pendingImages.length === 0}
                aria-label="Send images"
              >
                <IonIcon icon={send} aria-hidden />
                {pendingImages.length > 1 && <span className="chat-input__send-badge">{pendingImages.length}</span>}
              </button>
            ) : (
              <button
                type="button"
                className="chat-input__send"
                onClick={handleSend}
                disabled={isLoading || !inputValue.trim()}
                aria-label="Send message"
              >
                <IonIcon icon={send} aria-hidden />
              </button>
            )}
          </div>
        </div>

      </IonContent>

      <IonFooter className="chat-footer ion-no-border">
        <nav className="chat-nav" aria-label="Main">
          <Link to="/learn" className="chat-nav__item">
            <IonIcon icon={bookOutline} className="chat-nav__icon" />
            <span className="chat-nav__label">Learn</span>
          </Link>
          <Link to="/quiz" className="chat-nav__item">
            <IonIcon icon={documentTextOutline} className="chat-nav__icon" />
            <span className="chat-nav__label">Quiz</span>
          </Link>
          <Link to="/home" className="chat-nav__item">
            <IonIcon icon={homeOutline} className="chat-nav__icon" />
            <span className="chat-nav__label">Home</span>
          </Link>
          <Link to="/chat" className={`chat-nav__item ${isChat ? 'chat-nav__item--active' : ''}`}>
            <IonIcon icon={chatbubbleOutline} className="chat-nav__icon" />
            <span className="chat-nav__label">Chat</span>
          </Link>
          <Link to="/profile" className="chat-nav__item">
            <IonIcon icon={personOutline} className="chat-nav__icon" />
            <span className="chat-nav__label">Profile</span>
          </Link>
        </nav>
      </IonFooter>

      <AttachmentModal
        isOpen={isAttachmentModalOpen}
        onClose={() => setIsAttachmentModalOpen(false)}
        onAttachmentSelect={handleAttachmentSelect}
      />

      <VoiceRecordModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onSendVoice={handleVoiceSend}
      />

      <CameraModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={handleCameraCapture}
        onOpenGallery={openGalleryPicker}
      />
    </IonPage>
  );
};

export default ChatPage;