import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useHistory } from 'react-router-dom';
import {
  IonContent,
  IonFooter,
  IonIcon,
  IonPage,
} from '@ionic/react';
import {
  bookOutline,
  flagOutline,
  chatbubbleOutline,
  mapOutline,
  documentTextOutline,
  homeOutline,
  personOutline,
  arrowForwardOutline,
  informationCircleOutline,
  sparklesOutline,
  checkmarkCircle,
} from 'ionicons/icons';
import './Learn.css';
import { getResolvedDialectLangCode, getDefaultDialectCodeForExperience } from '../utils/dialectPreference';
import { useIonContentScrollTopOnEnter } from '../utils/useIonContentScrollTopOnEnter';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'assistant';
  suggestions?: LearnSuggestion[];
}

interface LearnSuggestion {
  dialectId: string;
  dialectName: string;
  sectionId: string;
  sectionLabel: string;
  preview: string;
}

// ─── Dialect metadata ──────────────────────────────────────────────────────────
// Fix 6: Removed unused LEARN_SECTIONS — section data lives in DialectDetail.tsx only.

const DIALECT_STATS: Record<string, { speakers: string; region: string; rank: number; difficulty: string }> = {
  filipino:    { speakers: '90M+',  region: 'Nationwide',         rank: 1, difficulty: 'Beginner-friendly' },
  cebuano:     { speakers: '20M+',  region: 'Visayas & Mindanao', rank: 2, difficulty: 'Moderate' },
  hiligaynon:  { speakers: '9.1M',  region: 'Western Visayas',    rank: 3, difficulty: 'Moderate' },
  ilocano:     { speakers: '8M+',   region: 'Northern Luzon',     rank: 4, difficulty: 'Intermediate' },
  pangasinan:  { speakers: '2.4M',  region: 'Central Luzon',      rank: 5, difficulty: 'Intermediate' },
};

// ─── Storage key for active dialect ──────────────────────────────────────────
export const ACTIVE_DIALECT_KEY = 'salintayo_active_dialect';

// ─── OpenRouter API call (DeepSeek) ──────────────────────────────────────────

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const LEARN_CHAT_HISTORY_KEY = 'salintayo_learn_chat_history';
const USER_LEARNING_PROFILE_KEY = 'salintayo_user_learning_profile';

interface UserLearningProfile {
  totalChats: number;
  favoriteDialects: Record<string, number>;
  commonTopics: Record<string, number>;
  learningGoals: string[];
  lastActive: number;
  region: string | null;
  activeDialectId: string | null; // NEW: tracks the globally selected dialect
}

interface ChatSession {
  id: string;
  timestamp: number;
  messages: Message[];
  userRegion: string | null;
}

function getActiveDialect(): { code: string; name: string; native: string } {
  // Fix 5: Always check ACTIVE_DIALECT_KEY first (set by handleLearnClick).
  // This is the single source of truth. Only fall back to dialectPreference
  // util if the user hasn't picked a dialect via the Learn page yet.
  try {
    const stored = localStorage.getItem(ACTIVE_DIALECT_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.code && parsed?.name && parsed?.native) return parsed;
    }
  } catch { /* fall through */ }

  // Fallback: read from profile preference util (first-time users)
  try {
    const saved = getResolvedDialectLangCode().trim().toLowerCase();
    const aliasToCode: Record<string, string> = {
      en: 'en', fil: 'fil', ceb: 'ceb', ilo: 'ilo', hil: 'hil',
      war: 'war', bik: 'bik', pam: 'pam', tsg: 'tsg', pag: 'pag',
      english: 'en', filipino: 'fil', tagalog: 'fil', cebuano: 'ceb',
      ilocano: 'ilo', hiligaynon: 'hil', waray: 'war', bicolano: 'bik',
      kapampangan: 'pam', pangasinan: 'pag', tausug: 'tsg',
    };
    const code = aliasToCode[saved] ?? saved;
    const languages = [
      { code: 'fil', name: 'Filipino',   native: 'Filipino'   },
      { code: 'ceb', name: 'Cebuano',    native: 'Bisaya'     },
      { code: 'hil', name: 'Hiligaynon', native: 'Ilonggo'    },
      { code: 'ilo', name: 'Ilocano',    native: 'Ilokano'    },
      { code: 'pag', name: 'Pangasinan', native: 'Pangasinan' },
      { code: 'en',  name: 'English',    native: 'English'    },
    ];
    const lang = languages.find(l => l.code === code);
    const fb = getDefaultDialectCodeForExperience();
    const fbLang = languages.find(l => l.code === fb);
    return {
      code:   lang?.code   ?? fb,
      name:   lang?.name   ?? fbLang?.name   ?? 'Filipino',
      native: lang?.native ?? fbLang?.native ?? 'Filipino',
    };
  } catch {
    const fb = getDefaultDialectCodeForExperience();
    return fb === 'en'
      ? { code: 'en', name: 'English', native: 'English' }
      : { code: 'fil', name: 'Filipino', native: 'Filipino' };
  }
}

// Map dialect card id → lang code used by getActiveDialect
const DIALECT_ID_TO_CODE: Record<string, string> = {
  filipino:   'fil',
  cebuano:    'ceb',
  hiligaynon: 'hil',
  ilocano:    'ilo',
  pangasinan: 'pag',
};

function getRegionFromDialect(dialectCode: string): string {
  const regionMap: Record<string, string> = {
    fil: 'Nationwide', ceb: 'Visayas & Mindanao',
    hil: 'Western Visayas', ilo: 'Northern Luzon',
    pag: 'Central Luzon', en: 'Philippines',
  };
  return regionMap[dialectCode] ?? 'Philippines';
}

function getDialectStatsKey(dialectCode: string): string {
  const keyMap: Record<string, string> = {
    fil: 'filipino', ceb: 'cebuano', hil: 'hiligaynon',
    ilo: 'ilocano', pag: 'pangasinan',
  };
  return keyMap[dialectCode] ?? 'filipino';
}

function normalizeAssistantText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getStoredChatHistory(): ChatSession[] {
  try {
    const raw = localStorage.getItem(LEARN_CHAT_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveChatSession(session: ChatSession) {
  try {
    const history = getStoredChatHistory();
    const updated = [session, ...history.slice(0, 9)];
    localStorage.setItem(LEARN_CHAT_HISTORY_KEY, JSON.stringify(updated));
  } catch (e) { console.warn('Failed to save chat session:', e); }
}

function getUserLearningProfile(): UserLearningProfile {
  try {
    const raw = localStorage.getItem(USER_LEARNING_PROFILE_KEY);
    return raw ? JSON.parse(raw) : {
      totalChats: 0, favoriteDialects: {}, commonTopics: {},
      learningGoals: [], lastActive: Date.now(), region: null, activeDialectId: null,
    };
  } catch {
    return {
      totalChats: 0, favoriteDialects: {}, commonTopics: {},
      learningGoals: [], lastActive: Date.now(), region: null, activeDialectId: null,
    };
  }
}

function updateUserProfile(messages: Message[], userRegion: string | null) {
  try {
    const profile = getUserLearningProfile();
    const allText = messages.map(m => m.text.toLowerCase()).join(' ');
    const dialects = ['filipino', 'cebuano', 'hiligaynon', 'ilocano', 'pangasinan'];
    dialects.forEach(dialect => {
      const count = (allText.match(new RegExp(dialect, 'g')) || []).length;
      if (count > 0) profile.favoriteDialects[dialect] = (profile.favoriteDialects[dialect] || 0) + count;
    });
    const topics = ['pronunciation', 'grammar', 'history', 'phrases', 'numbers', 'origins', 'culture'];
    topics.forEach(topic => {
      const count = (allText.match(new RegExp(topic, 'g')) || []).length;
      if (count > 0) profile.commonTopics[topic] = (profile.commonTopics[topic] || 0) + count;
    });
    const userMessages = messages.filter(m => m.sender === 'user').map(m => m.text);
    const goalKeywords = ['learn', 'study', 'practice', 'improve', 'master', 'beginner', 'intermediate'];
    userMessages.forEach(msg => {
      goalKeywords.forEach(keyword => {
        if (msg.toLowerCase().includes(keyword) && !profile.learningGoals.includes(keyword))
          profile.learningGoals.push(keyword);
      });
    });
    profile.totalChats += 1;
    profile.lastActive = Date.now();
    profile.region = userRegion;
    localStorage.setItem(USER_LEARNING_PROFILE_KEY, JSON.stringify(profile));
  } catch (e) { console.warn('Failed to update user profile:', e); }
}

function generatePredictiveInsights(activeDialectName?: string): {
  predictedInterests: string[];
  recommendedDialects: string[];
  proactiveSuggestions: string[];
} {
  // Fix 4: Generate actually useful proactive chips based on real user data.
  // Previously only one suggestion showed (7-day absence). Now we surface
  // topic-based chips from the user's interaction history.
  const profile = getUserLearningProfile();
  const predictedInterests: string[] = [];
  const recommendedDialects: string[] = [];
  const proactiveSuggestions: string[] = [];

  const dialect = activeDialectName ?? 'this dialect';

  // Topic-based chips — shown if user has interacted with that topic before
  const topicChips: Record<string, string> = {
    pronunciation: `Practice ${dialect} pronunciation`,
    grammar:       `Review ${dialect} grammar rules`,
    phrases:       `Learn more ${dialect} phrases`,
    numbers:       `Practice ${dialect} numbers`,
    history:       `Explore ${dialect} history`,
    culture:       `Discover ${dialect} culture`,
  };

  const sortedTopics = Object.entries(profile.commonTopics)
    .sort(([, a], [, b]) => b - a)
    .map(([topic]) => topic);

  // Add top 2 topic chips if user has history
  sortedTopics.slice(0, 2).forEach(topic => {
    if (topicChips[topic]) proactiveSuggestions.push(topicChips[topic]);
  });

  // Always show at least 2 default chips if not enough history
  const defaults = [
    `Teach me a ${dialect} phrase`,
    `How do I say hello in ${dialect}?`,
    `What's unique about ${dialect}?`,
  ];
  defaults.forEach(chip => {
    if (proactiveSuggestions.length < 2) proactiveSuggestions.push(chip);
  });

  // Return-user suggestion
  const daysSinceLastActive = (Date.now() - profile.lastActive) / (1000 * 60 * 60 * 24);
  if (daysSinceLastActive > 7)
    proactiveSuggestions.unshift("Welcome back! Ready to continue learning?");

  const sortedDialects = Object.entries(profile.favoriteDialects)
    .sort(([, a], [, b]) => b - a)
    .map(([dialect]) => dialect);
  if (sortedDialects.length > 0) recommendedDialects.push(...sortedDialects.slice(0, 2));

  return { predictedInterests, recommendedDialects, proactiveSuggestions };
}

async function callDialectAssistantAI(
  conversationHistory: { role: 'user' | 'assistant'; content: string }[],
  userLocation: string | null,
  activeDialectOverride?: { name: string; native: string; code: string },
): Promise<{ text: string; suggestions: LearnSuggestion[] }> {
  if (!OPENROUTER_API_KEY)
    throw new Error('OpenRouter API key not configured.');

  const activeDialect = activeDialectOverride ?? getActiveDialect();

  const outputLanguageInstruction = (() => {
    // Hard requirement: if the user chose a Filipino language/dialect, the assistant must reply in it.
    switch (activeDialect.code) {
      case 'fil': return 'Filipino (Tagalog)';
      case 'ceb': return 'Cebuano (Bisaya)';
      case 'hil': return 'Hiligaynon (Ilonggo)';
      case 'ilo': return 'Ilocano (Ilokano)';
      case 'pag': return 'Pangasinan';
      case 'en': return 'English';
      default: return activeDialect.name;
    }
  })();

  const systemPrompt = `You are a Philippine dialect learning assistant embedded ONLY in the SalinTayo Learn page.
Your job: help users learn the dialect they chose: ${activeDialect.name} (${activeDialect.native}).

OUTPUT LANGUAGE (STRICT):
- Write your replies in ${outputLanguageInstruction}.
- Do NOT reply in English unless ${outputLanguageInstruction} is English, OR the user explicitly asks for an English translation.
- If the user asks for a translation, keep it short and include it AFTER the dialect response.

ACTIVE DIALECT RECOMMENDATION:
- The user has selected ${activeDialect.name} (${activeDialect.native}) as their learning focus.
- All learning recommendations should be based on this active dialect choice.
- If they ask about OTHER dialects, politely remind them they chose ${activeDialect.name} and suggest exploring it first.
- Provide content and suggestions specifically for ${activeDialect.name}.

DIALECT INFORMATION FOR CONTEXT:
- Filipino/Tagalog: 90M+ speakers, nationwide, national language, easiest for beginners
- Cebuano/Bisaya: 20M+ speakers, Visayas & Mindanao, 2nd most spoken PH language
- Hiligaynon/Ilonggo: 9.1M speakers, Western Visayas (Iloilo, Bacolod)
- Ilocano: 8M+ speakers, Northern Luzon, 2,000+ year literary tradition
- Pangasinan: 2.4M speakers, Central Luzon, one of oldest PH languages

IMPORTANT RESTRICTIONS:
- You ONLY know about Philippine dialects and learning them
- You do NOT know about ANY other topics
- If asked about anything outside dialect learning, say "I can only help with dialect learning decisions on this page."

BE DIRECT AND CONCISE:
1. Keep ALL responses under 50 words
2. Focus ONLY on helping them learn ${activeDialect.name}
3. If they ask about learning HOW to do something, provide a suggestion link
4. Be helpful but brief
5. No long explanations

RESPONSE RULES:
1. At the END of your response, if you mention a specific learning topic (pronunciation, grammar, history, phrases, numbers), include a JSON block:
   [SUGGESTIONS]:[{"dialectId":"${activeDialect.name.toLowerCase()}","dialectName":"${activeDialect.name}","sectionId":"pronunciation-guide","sectionLabel":"Pronunciation Guide","preview":"Short one-line teaser"}]
2. Only include suggestions when the user asks about HOW to learn, pronunciation, origins, grammar, history, or phrases.
3. [SUGGESTIONS] must be valid JSON array or omit it entirely.
4. Keep responses under 50 words. Be direct and actionable.
5. If topic is outside dialect learning, respond with: "I can only help with dialect learning decisions on this Learn page."
6. IMPORTANT: Always put [SUGGESTIONS] at the very end of your response, after all other text.`;

  const messages = [{ role: 'system', content: systemPrompt }, ...conversationHistory];

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
    },
    body: JSON.stringify({
      model: 'deepseek/deepseek-chat',
      messages,
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content ?? '';
  const suggMatch = rawText.match(/\[SUGGESTIONS\]:(\[[\s\S]*?\])/);
  let suggestions: LearnSuggestion[] = [];
  let cleanText = rawText;
  if (suggMatch) {
    try { suggestions = JSON.parse(suggMatch[1]) as LearnSuggestion[]; }
    catch (e) { console.warn('Failed to parse suggestions JSON:', e); }
    cleanText = rawText.replace(/\[SUGGESTIONS\]:[\s\S]*$/, '').trim();
  }
  return { text: normalizeAssistantText(cleanText), suggestions };
}

// ─── Component ─────────────────────────────────────────────────────────────────

const LearnPage: React.FC = () => {
  const location = useLocation();
  const history = useHistory();
  const isLearn = location.pathname === '/learn';
  const learnContentRef = useIonContentScrollTopOnEnter();

  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [apiHistory, setApiHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [userRegion, setUserRegion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [proactiveSuggestions, setProactiveSuggestions] = useState<string[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatHistoryRef = useRef<Message[]>([]);
  const apiHistoryRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);

  // NEW: track which dialect card is actively selected
  const [selectedDialectId, setSelectedDialectId] = useState<string | null>(null);
  // NEW: track current assistant dialect context (updates when Learn is clicked)
  const [assistantDialect, setAssistantDialect] = useState<{ code: string; name: string; native: string } | null>(null);

  const dialects = [
    { id: 'filipino',   name: 'Filipino',   description: 'Filipino – National Capital Region', icon: flagOutline,        gradient: 'linear-gradient(135deg, #dc2626, #fbbf24)' },
    { id: 'cebuano',    name: 'Cebuano',    description: 'Bisaya – Visayas / Mindanao',        icon: chatbubbleOutline,  gradient: 'linear-gradient(135deg, #0d9488, #10b981)' },
    { id: 'hiligaynon', name: 'Hiligaynon', description: 'Ilonggo – Western Visayas',          icon: mapOutline,         gradient: 'linear-gradient(135deg, #db2777, #f472b6)' },
    { id: 'ilocano',    name: 'Ilocano',    description: 'Ilokano – Northern Luzon',           icon: flagOutline,        gradient: 'linear-gradient(135deg, #0047ab, #06b6d4)' },
    { id: 'pangasinan', name: 'Pangasinan', description: 'Pangasinan – Central Luzon',         icon: chatbubbleOutline,  gradient: 'linear-gradient(135deg, #ea580c, #fbbf24)' },
  ];

  // Load saved active dialect on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_DIALECT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSelectedDialectId(parsed.id);
        setAssistantDialect({ code: parsed.code, name: parsed.name, native: parsed.native });
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const { proactiveSuggestions: newSuggestions } = generatePredictiveInsights(assistantDialect?.name ?? getActiveDialect().name);
    setProactiveSuggestions(newSuggestions.slice(0, 3));
  }, [chatHistory]);

  // ── On mount: restore last session OR show welcome (never both). Uses
  // getActiveDialect() so salintayo_active_dialect from storage is respected
  // without re-running when assistantDialect state hydrates.
  useEffect(() => {
    const activeDialect = getActiveDialect();
    const region = getRegionFromDialect(activeDialect.code);
    setUserRegion(region);

    const savedHistory = getStoredChatHistory();
    if (savedHistory.length > 0) {
      const lastSession = savedHistory[0];
      setChatHistory(lastSession.messages);
      setApiHistory(lastSession.messages.map(m => ({ role: m.sender, content: m.text })));
      setUserRegion(lastSession.userRegion);
      return;
    }

    const profile = getUserLearningProfile();
    const statsKey = getDialectStatsKey(activeDialect.code);
    const speakers = DIALECT_STATS[statsKey]?.speakers || 'many speakers';
    const welcomeText = profile.totalChats > 0
      ? `Welcome back to learning ${activeDialect.name}! Ready to dive deeper? Ask me anything about it!`
      : `Let's learn ${activeDialect.name} (${speakers} speakers)! Ask me about pronunciation, grammar, phrases, and more.`;
    const welcome: Message = { id: 0, text: welcomeText, sender: 'assistant' };
    setChatHistory([welcome]);
    setApiHistory([{ role: 'assistant' as const, content: welcome.text }]);
  }, []);

  useEffect(() => {
    chatHistoryRef.current = chatHistory;
  }, [chatHistory]);

  useEffect(() => {
    apiHistoryRef.current = apiHistory;
  }, [apiHistory]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  // ── handleLearnClick: the main function ──────────────────────────────────────
  const handleLearnClick = (dialectId: string, dialectName: string) => {
    const dialect = dialects.find(d => d.id === dialectId);
    if (!dialect) return;

    const code = DIALECT_ID_TO_CODE[dialectId] ?? 'fil';
    const nativeMap: Record<string, string> = {
      filipino: 'Filipino', cebuano: 'Bisaya', hiligaynon: 'Ilonggo',
      ilocano: 'Ilokano', pangasinan: 'Pangasinan',
    };
    const native = nativeMap[dialectId] ?? dialectName;

    // 1. Save globally to localStorage so Chat & Quiz pages can read it
    localStorage.setItem(
      ACTIVE_DIALECT_KEY,
      JSON.stringify({ id: dialectId, code, name: dialectName, native }),
    );

    // 2. Update profile with new active dialect
    const profile = getUserLearningProfile();
    profile.activeDialectId = dialectId;
    localStorage.setItem(USER_LEARNING_PROFILE_KEY, JSON.stringify(profile));

    // 3. Update the "Currently Learning" badge on cards
    setSelectedDialectId(dialectId);

    // 4. Switch the Dialect Assistant to the new dialect context
    setAssistantDialect({ code, name: dialectName, native });

    // 5. Navigate to the dialect detail page
    history.push(`/learn/${dialectId}`);
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;
    const userText = inputValue.trim();
    const userMsg: Message = { id: Date.now(), text: userText, sender: 'user' };
    const baseChat = [...chatHistoryRef.current, userMsg];
    setChatHistory(baseChat);
    chatHistoryRef.current = baseChat;
    setInputValue('');
    setIsLoading(true);

    const newApiHistory: { role: 'user' | 'assistant'; content: string }[] = [
      ...apiHistoryRef.current,
      { role: 'user' as const, content: userText },
    ];

    try {
      const { text, suggestions } = await callDialectAssistantAI(
        newApiHistory,
        userRegion,
        assistantDialect ?? undefined,
      );
      const assistantMsg: Message = {
        id: Date.now() + 1, text, sender: 'assistant',
        suggestions: suggestions.length > 0 ? suggestions : undefined,
      };
      const updatedChatHistory = [...baseChat, assistantMsg];
      setChatHistory(updatedChatHistory);
      chatHistoryRef.current = updatedChatHistory;
      const nextApi = [...newApiHistory, { role: 'assistant' as const, content: text }];
      setApiHistory(nextApi);
      apiHistoryRef.current = nextApi;
      const session: ChatSession = {
        id: `session_${Date.now()}`, timestamp: Date.now(),
        messages: updatedChatHistory, userRegion,
      };
      saveChatSession(session);
      updateUserProfile(updatedChatHistory, userRegion);
    } catch {
      const errMsg: Message = {
        id: Date.now() + 1,
        text: 'Oops, I had trouble connecting. Please try again!',
        sender: 'assistant',
      };
      const updatedChatHistory = [...baseChat, errMsg];
      setChatHistory(updatedChatHistory);
      chatHistoryRef.current = updatedChatHistory;
      const nextApi = [...newApiHistory, { role: 'assistant' as const, content: errMsg.text }];
      setApiHistory(nextApi);
      apiHistoryRef.current = nextApi;
      const session: ChatSession = {
        id: `session_${Date.now()}`, timestamp: Date.now(),
        messages: updatedChatHistory, userRegion,
      };
      saveChatSession(session);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProactiveSuggestion = async (suggestion: string) => {
    // Fix 2: Don't rely on setInputValue + sendMessage() — state update is async
    // so sendMessage() would read the old empty inputValue.
    // Instead, send the suggestion text directly without touching inputValue.
    if (isLoading) return;

    const userMsg: Message = { id: Date.now(), text: suggestion, sender: 'user' };
    const baseChat = [...chatHistoryRef.current, userMsg];
    setChatHistory(baseChat);
    chatHistoryRef.current = baseChat;
    setIsLoading(true);

    const newApiHistory: { role: 'user' | 'assistant'; content: string }[] = [
      ...apiHistoryRef.current,
      { role: 'user' as const, content: suggestion },
    ];

    try {
      const { text, suggestions } = await callDialectAssistantAI(
        newApiHistory,
        userRegion,
        assistantDialect ?? undefined,
      );
      const assistantMsg: Message = {
        id: Date.now() + 1, text, sender: 'assistant',
        suggestions: suggestions.length > 0 ? suggestions : undefined,
      };
      const updated = [...baseChat, assistantMsg];
      setChatHistory(updated);
      chatHistoryRef.current = updated;
      const nextApi = [...newApiHistory, { role: 'assistant' as const, content: text }];
      setApiHistory(nextApi);
      apiHistoryRef.current = nextApi;
    } catch {
      const errMsg: Message = {
        id: Date.now() + 1,
        text: 'Oops, I had trouble connecting. Please try again!',
        sender: 'assistant',
      };
      const updated = [...baseChat, errMsg];
      setChatHistory(updated);
      chatHistoryRef.current = updated;
      const nextApi = [...newApiHistory, { role: 'assistant' as const, content: errMsg.text }];
      setApiHistory(nextApi);
      apiHistoryRef.current = nextApi;
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') sendMessage();
  };

  const handleSuggestionClick = (sug: LearnSuggestion) => {
    // Normalize: AI may return lang code (ceb) or full name (cebuano). Always resolve to route id.
    const codeToId: Record<string, string> = {
      fil: 'filipino', ceb: 'cebuano', hil: 'hiligaynon',
      ilo: 'ilocano', pag: 'pangasinan',
    };
    const resolvedId = codeToId[sug.dialectId] ?? sug.dialectId.toLowerCase();

    const anchor = document.getElementById(`section-${resolvedId}-${sug.sectionId}`);
    if (anchor) {
      anchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
      anchor.classList.add('dialect-section--highlight');
      setTimeout(() => anchor.classList.remove('dialect-section--highlight'), 2000);
    } else {
      history.push(`/learn/${resolvedId}#${sug.sectionId}`);
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen className="learn-content" ref={learnContentRef}>
        <div className="learn-page">
          <header className="learn-header">
            <div className="hero-banner"></div>
            <svg className="hero-wave" viewBox="0 0 430 40" preserveAspectRatio="none">
              <path d="M0,20 C80,40 180,0 280,20 C350,35 400,10 430,18 L430,40 L0,40 Z" fill="#ffffff"/>
            </svg>
            <h1 className="learn-header__title">Choose a dialect to begin</h1>
            <p className="learn-header__subtitle">Philippine languages</p>
          </header>

          <div className="learn-main">
            {/* ── Dialect cards ── */}
            <section className="learn-dialects">
              {dialects.map((dialect) => {
                const stats = DIALECT_STATS[dialect.id];
                const isActive = selectedDialectId === dialect.id;
                return (
                  <article
                    key={dialect.id}
                    className={`learn-dialect-card${isActive ? ' learn-dialect-card--active' : ''}`}
                    style={{ '--dialect-gradient': dialect.gradient } as React.CSSProperties}
                  >
                    {/* Currently Learning badge */}
                    {isActive && (
                      <div className="learn-dialect-card__active-badge">
                        <IonIcon icon={checkmarkCircle} />
                        Currently Learning
                      </div>
                    )}
                    <div className="learn-dialect-card__icon">
                      <IonIcon icon={dialect.icon} />
                    </div>
                    <div className="learn-dialect-card__content">
                      <h2 className="learn-dialect-card__title">{dialect.name}</h2>
                      <p className="learn-dialect-card__description">{dialect.description}</p>
                      {stats && (
                        <p className="learn-dialect-card__stats">
                          {stats.speakers} speakers · {stats.difficulty}
                        </p>
                      )}
                    </div>
                    <button
                      className={`learn-dialect-card__button${isActive ? ' learn-dialect-card__button--active' : ''}`}
                      onClick={() => handleLearnClick(dialect.id, dialect.name)}
                    >
                      {isActive ? 'Continue' : 'Learn'}
                    </button>
                  </article>
                );
              })}
            </section>

            {/* ── AI Assistant ── */}
            <section className="learn-assistant">
              <h3 className="learn-assistant__title">
                <IonIcon icon={sparklesOutline} className="learn-assistant__title-icon" />
                Dialect Assistant
                {assistantDialect && (
                  <span className="learn-assistant__dialect-tag">{assistantDialect.name}</span>
                )}
              </h3>

              <div className="learn-assistant__chat">
                <div className="learn-assistant__history">
                  {chatHistory.map((msg) => (
                    <div key={msg.id}>
                      <div className={`learn-assistant__message learn-assistant__message--${msg.sender}`}>
                        {msg.text}
                      </div>
                      {msg.sender === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && (
                        <div className="learn-assistant__suggestions">
                          <p className="learn-assistant__suggestions-label">
                            <IonIcon icon={informationCircleOutline} />
                            Jump to a lesson:
                          </p>
                          {msg.suggestions.map((sug, i) => (
                            <button
                              key={i}
                              className="learn-assistant__suggestion-chip"
                              onClick={() => handleSuggestionClick(sug)}
                            >
                              <span className="learn-assistant__suggestion-text">
                                <strong>{sug.dialectName}</strong> › {sug.sectionLabel}
                                <span className="learn-assistant__suggestion-preview">{sug.preview}</span>
                              </span>
                              <IonIcon icon={arrowForwardOutline} className="learn-assistant__suggestion-arrow" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {isLoading && (
                    <div className="learn-assistant__message learn-assistant__message--assistant learn-assistant__message--loading">
                      <span className="learn-assistant__dot" />
                      <span className="learn-assistant__dot" />
                      <span className="learn-assistant__dot" />
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {proactiveSuggestions.length > 0 && chatHistory.length > 1 && (
                  <div className="learn-assistant__proactive">
                    <div className="learn-assistant__proactive-header">
                      <IonIcon icon={sparklesOutline} />
                      <span>Based on your interests:</span>
                    </div>
                    <div className="learn-assistant__proactive-suggestions">
                      {proactiveSuggestions.map((suggestion, i) => (
                        <button
                          key={i}
                          className="learn-assistant__proactive-chip"
                          onClick={() => handleProactiveSuggestion(suggestion)}
                          disabled={isLoading}
                        >
                          {suggestion}
                          <IonIcon icon={arrowForwardOutline} className="learn-assistant__proactive-arrow" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="learn-assistant__input-area">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me what to learn..."
                    className="learn-assistant__input"
                    disabled={isLoading}
                  />
                  <button
                    onClick={sendMessage}
                    className="learn-assistant__send"
                    disabled={isLoading || !inputValue.trim()}
                  >
                    Send
                  </button>
                </div>
              </div>
            </section>
          </div>

          <div className="learn-spacer" aria-hidden />
        </div>
      </IonContent>

      <IonFooter className="learn-footer ion-no-border">
        <nav className="learn-nav" aria-label="Main">
          <Link to="/learn" className={`learn-nav__item ${isLearn ? 'learn-nav__item--active' : ''}`}>
            <IonIcon icon={bookOutline} className="learn-nav__icon" />
            <span className="learn-nav__label">Learn</span>
          </Link>
          <Link to="/quiz" className="learn-nav__item">
            <IonIcon icon={documentTextOutline} className="learn-nav__icon" />
            <span className="learn-nav__label">Quiz</span>
          </Link>
          <Link to="/home" className="learn-nav__item">
            <IonIcon icon={homeOutline} className="learn-nav__icon" />
            <span className="learn-nav__label">Home</span>
          </Link>
          <Link to="/chat" className="learn-nav__item">
            <IonIcon icon={chatbubbleOutline} className="learn-nav__icon" />
            <span className="learn-nav__label">Chat</span>
          </Link>
          <Link to="/profile" className="learn-nav__item">
            <IonIcon icon={personOutline} className="learn-nav__icon" />
            <span className="learn-nav__label">Profile</span>
          </Link>
        </nav>
      </IonFooter>
    </IonPage>
  );
};

export default LearnPage;