// Minimal chat history persistence.
//
// Backed by localStorage for now — no backend required to get the feature
// working end to end. If/when this needs to move to Firestore, only the
// internals of this file change; every function signature below can stay
// the same, so Chat.tsx never has to know which storage it's talking to.

export interface ChatHistoryMessage {
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

interface ChatHistoryEntry {
  id: string;
  uid: string;
  title: string;
  messages: ChatHistoryMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatHistorySummary {
  id: string;
  title: string;
  updatedAt: number;
}

const STORAGE_KEY = 'salintayo_chat_history';
const GUEST_UID = 'guest';
const GUEST_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function readAll(): ChatHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(entries: ChatHistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage full/unavailable (e.g. private browsing) — history is a
    // nice-to-have, fail silently rather than breaking the chat itself.
  }
}

function makeTitle(messages: ChatHistoryMessage[]): string {
  const firstUserMsg = messages.find((m) => m.role === 'user');
  if (!firstUserMsg) return 'New conversation';

  if (firstUserMsg.type === 'voice') return 'Voice message';
  if (firstUserMsg.type === 'image') {
    const caption = (firstUserMsg.content || '').trim();
    return caption ? truncate(caption) : 'Image message';
  }

  const text = (firstUserMsg.content || '').trim();
  return text ? truncate(text) : 'New conversation';
}

function truncate(text: string, max = 30): string {
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

export function generateChatId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Create/update a chat doc. No-op on empty message lists (never persist blank chats). */
export function saveChat(uid: string, chatId: string, messages: ChatHistoryMessage[]): void {
  if (!messages.length) return;

  const entries = readAll();
  const now = Date.now();
  const title = makeTitle(messages);
  const existingIndex = entries.findIndex((e) => e.id === chatId && e.uid === uid);

  if (existingIndex >= 0) {
    entries[existingIndex] = { ...entries[existingIndex], messages, title, updatedAt: now };
  } else {
    entries.push({ id: chatId, uid, title, messages, createdAt: now, updatedAt: now });
  }

  writeAll(entries);
}

export function loadChatList(uid: string): ChatHistorySummary[] {
  return readAll()
    .filter((e) => e.uid === uid && e.messages.length > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));
}

export function loadChat(uid: string, chatId: string): ChatHistoryMessage[] | null {
  const entry = readAll().find((e) => e.id === chatId && e.uid === uid);
  return entry ? entry.messages : null;
}

export function deleteChat(uid: string, chatId: string): void {
  writeAll(readAll().filter((e) => !(e.id === chatId && e.uid === uid)));
}

/** Remove guest conversations older than 24h. Call once on app/page load. */
export function cleanupGuestChats(): void {
  const now = Date.now();
  const entries = readAll();
  const filtered = entries.filter((e) => e.uid !== GUEST_UID || now - e.updatedAt < GUEST_TTL_MS);
  if (filtered.length !== entries.length) writeAll(filtered);
}

export function relativeTime(timestamp: number): string {
  const diffMin = Math.floor((Date.now() - timestamp) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
