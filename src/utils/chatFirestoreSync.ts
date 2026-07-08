/**
 * Uploads local chat sessions to Firestore so the admin panel can list real learner threads.
 * Docs live in `chatSessions/{sessionId}` with userId = Firebase uid (rules enforce ownership).
 */
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { firebaseAuth, firebaseDb } from '../firebase';

export interface ChatMessageLike {
  id: string;
  role: 'ai' | 'user';
  content: string;
  timestamp: string;
  type?: 'text' | 'voice' | 'image';
}

export interface ChatSessionLike {
  id: string;
  title: string;
  messages: ChatMessageLike[];
  savedAt: number;
}

const LIVE_PREFIX = 'live-';
const MAX_MSGS = 40;
const MAX_CONTENT = 8000;

function shortenContent(s: string, max = MAX_CONTENT): string {
  if (!s || s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function sanitizeMessages(msgs: ChatMessageLike[]): ChatMessageLike[] {
  return msgs.map((m) => {
    let content = m.content ?? '';
    if (content.startsWith('data:image') || content.length > 24000) {
      content = '[image]';
    }
    return {
      id: m.id,
      role: m.role,
      content: shortenContent(content),
      timestamp: m.timestamp,
      type: m.type ?? 'text',
    };
  });
}

function deriveTitle(msgs: ChatMessageLike[]): string {
  const firstUser = msgs.find((m) => m.role === 'user');
  if (!firstUser) return 'New chat';
  if (firstUser.type === 'image') {
    const t = firstUser.content.trim();
    return t ? (t.length > 40 ? `${t.slice(0, 40)}…` : t) : 'Image';
  }
  const text = firstUser.content.trim();
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}

function countsFromMessages(msgs: ChatMessageLike[]) {
  let imagesSent = 0;
  let voiceMessages = 0;
  for (const m of msgs) {
    if (m.type === 'image') imagesSent += 1;
    if (m.type === 'voice') voiceMessages += 1;
  }
  return { imagesSent, voiceMessages };
}

function sessionPayload(
  uid: string,
  userMeta: { email: string | null; displayName: string | null },
  title: string,
  savedAt: number,
  messagesRaw: ChatMessageLike[],
  dialectLabel: string,
  isLiveDraft: boolean
) {
  const messages = sanitizeMessages(messagesRaw).slice(-MAX_MSGS);
  const last = messages[messages.length - 1];
  const lastMessage = last ? shortenContent(last.content, 500) : '';
  const { imagesSent, voiceMessages } = countsFromMessages(messagesRaw);
  return {
    userId: uid,
    userEmail: userMeta.email || '',
    userName: userMeta.displayName || userMeta.email || 'Learner',
    lastMessage,
    lastAt: Timestamp.fromMillis(savedAt),
    messageCount: messagesRaw.length,
    dialectLabel: dialectLabel || '—',
    color: '#1d6ef7',
    imagesSent,
    voiceMessages,
    messages,
    title: title || deriveTitle(messagesRaw),
    source: 'app-sync',
    isLiveDraft,
    updatedAt: Date.now(),
  };
}

/** Remove Firestore copy of a single saved session (when learner deletes from history). */
export async function deleteChatSessionDoc(sessionId: string): Promise<void> {
  const u = firebaseAuth.currentUser;
  if (!u) return;
  await deleteDoc(doc(firebaseDb, 'chatSessions', sessionId));
}

/** Remove all chatSessions documents for this user (clear all history). */
export async function deleteAllUserChatDocs(uid: string): Promise<void> {
  const u = firebaseAuth.currentUser;
  if (!u || u.uid !== uid) return;
  const q = query(collection(firebaseDb, 'chatSessions'), where('userId', '==', uid));
  const snap = await getDocs(q);
  const docs = snap.docs;
  const chunk = 450;
  for (let i = 0; i < docs.length; i += chunk) {
    const batch = writeBatch(firebaseDb);
    docs.slice(i, i + chunk).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

/**
 * Upserts saved sessions + optional live draft so admins see in-progress threads.
 */
export async function syncChatSessionsToCloud(
  uid: string,
  userMeta: { email: string | null; displayName: string | null },
  sessions: ChatSessionLike[],
  liveMessages: ChatMessageLike[] | null,
  dialectLabel: string
): Promise<void> {
  if (!uid || uid === 'guest') return;
  const u = firebaseAuth.currentUser;
  if (!u || u.uid !== uid) return;

  const liveId = `${LIVE_PREFIX}${uid}`;
  const liveRaw = liveMessages?.length ? liveMessages : [];
  const liveSanitized = liveRaw.length ? dedupeMsgs(liveRaw) : [];
  const top = sessions[0];
  const sameAsTop =
    !!top &&
    liveRaw.length > 0 &&
    JSON.stringify(top.messages) === JSON.stringify(liveRaw);

  for (const s of sessions) {
    const payload = sessionPayload(
      uid,
      userMeta,
      s.title,
      s.savedAt,
      s.messages,
      dialectLabel,
      false
    );
    await setDoc(doc(firebaseDb, 'chatSessions', s.id), payload, { merge: true });
  }

  if (liveRaw.length && !sameAsTop) {
    const payload = sessionPayload(
      uid,
      userMeta,
      deriveTitle(liveSanitized),
      Date.now(),
      liveSanitized,
      dialectLabel,
      true
    );
    await setDoc(doc(firebaseDb, 'chatSessions', liveId), payload, { merge: true });
  } else {
    try {
      await deleteDoc(doc(firebaseDb, 'chatSessions', liveId));
    } catch {
      /* ok */
    }
  }
}

function dedupeMsgs(msgs: ChatMessageLike[]): ChatMessageLike[] {
  const seen = new Set<string>();
  const out: ChatMessageLike[] = [];
  for (const m of msgs) {
    const k = `${m.id}|${m.timestamp}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(m);
  }
  return out;
}
