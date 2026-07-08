/**
 * Per-user chat threads in Firestore: users/{uid}/chats/{chatId}/messages/{messageId}
 * Client SDK only (no Cloud Functions). Used for persistence + onSnapshot live updates.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { firebaseDb } from '../firebase';

/** Shape aligned with `ChatMessage` in Chat.tsx (kept here to avoid circular imports). */
export interface PersistableChatMessage {
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

const MAX_CONTENT = 24000;

function shortenContent(s: string, max = MAX_CONTENT): string {
  if (!s || s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function sanitizeForFirestore(msg: PersistableChatMessage): Omit<FirestoreChatMessagePayload, 'createdAt'> {
  let content = msg.content ?? '';
  if (content.startsWith('data:image') || content.length > 50000) {
    content = msg.type === 'image' ? shortenContent(content, 2000) : '[image or large payload omitted for storage]';
  }
  const audioUrl =
    msg.audioUrl && !msg.audioUrl.startsWith('blob:') ? msg.audioUrl : undefined;
  const imageUrl =
    msg.imageUrl && !msg.imageUrl.startsWith('blob:')
      ? shortenContent(msg.imageUrl, 2000)
      : msg.imageUrl?.startsWith('blob:')
        ? undefined
        : msg.imageUrl
          ? shortenContent(msg.imageUrl, 2000)
          : undefined;

  return {
    chatId: '',
    senderId: msg.role === 'user' ? '' : 'ai',
    role: msg.role,
    content: shortenContent(content),
    timestamp: msg.timestamp,
    type: msg.type ?? 'text',
    audioUrl,
    audioDuration: msg.audioDuration,
    imageUrl,
    translationMode: msg.translationMode,
  };
}

type FirestoreChatMessagePayload = {
  chatId: string;
  senderId: string;
  role: 'ai' | 'user';
  content: string;
  timestamp: string;
  type?: 'text' | 'voice' | 'image';
  audioUrl?: string;
  audioDuration?: number;
  imageUrl?: string;
  translationMode?: 'ocr' | 'describe' | 'ask';
  createdAt: ReturnType<typeof serverTimestamp>;
};

export function chatDocRef(uid: string, chatId: string) {
  return doc(firebaseDb, 'users', uid, 'chats', chatId);
}

export function messagesCollectionRef(uid: string, chatId: string) {
  return collection(firebaseDb, 'users', uid, 'chats', chatId, 'messages');
}

function messageSortKey(m: PersistableChatMessage): number {
  const n = Number(m.id);
  return Number.isFinite(n) ? n : 0;
}

/** Prefer remote when both exist; keep local-only optimistic rows until server has the same id. */
export function mergeChatMessages(local: PersistableChatMessage[], remote: PersistableChatMessage[]): PersistableChatMessage[] {
  const map = new Map<string, PersistableChatMessage>();
  for (const m of remote) map.set(m.id, m);
  for (const m of local) {
    if (!map.has(m.id)) map.set(m.id, m);
  }
  return [...map.values()].sort((a, b) => messageSortKey(a) - messageSortKey(b));
}

function docToChatMessage(d: { id: string; data: () => Record<string, unknown> }): PersistableChatMessage {
  const data = d.data();
  return {
    id: d.id,
    role: (data.role as PersistableChatMessage['role']) ?? 'user',
    content: (data.content as string) ?? '',
    timestamp: (data.timestamp as string) ?? '',
    type: data.type as PersistableChatMessage['type'] | undefined,
    audioUrl: data.audioUrl as string | undefined,
    audioDuration: data.audioDuration as number | undefined,
    imageUrl: data.imageUrl as string | undefined,
    translationMode: data.translationMode as PersistableChatMessage['translationMode'],
  };
}

export async function createEmptyChat(uid: string): Promise<string> {
  const chatId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  await setDoc(chatDocRef(uid, chatId), {
    userId: uid,
    title: 'New chat',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    savedAt: Date.now(),
  });
  return chatId;
}

export async function upsertChatMessage(uid: string, chatId: string, msg: PersistableChatMessage): Promise<void> {
  const base = sanitizeForFirestore(msg);
  base.chatId = chatId;
  base.senderId = msg.role === 'user' ? uid : 'ai';

  const payload: FirestoreChatMessagePayload = {
    ...base,
    createdAt: serverTimestamp(),
  };

  const mRef = doc(firebaseDb, 'users', uid, 'chats', chatId, 'messages', msg.id);
  await setDoc(mRef, payload, { merge: true });

  await setDoc(
    chatDocRef(uid, chatId),
    {
      userId: uid,
      updatedAt: serverTimestamp(),
      savedAt: Date.now(),
    },
    { merge: true }
  );
}

function deriveTitleFromMessagesForMeta(msgs: Pick<PersistableChatMessage, 'role' | 'content' | 'type'>[]): string {
  const firstUser = msgs.find((m) => m.role === 'user');
  if (!firstUser) return 'New chat';
  if (firstUser.type === 'image') {
    const t = firstUser.content.trim();
    return t ? (t.length > 40 ? `${t.slice(0, 40)}…` : t) : 'Image';
  }
  const text = firstUser.content.trim();
  return text.length > 40 ? `${text.slice(0, 40)}…` : text || 'New chat';
}

/** Update chat thread title from full message list (e.g. after AI reply). */
export async function updateChatThreadMeta(uid: string, chatId: string, messages: PersistableChatMessage[]): Promise<void> {
  if (!messages.length) return;
  const title = deriveTitleFromMessagesForMeta(messages);
  await setDoc(
    chatDocRef(uid, chatId),
    {
      userId: uid,
      title,
      updatedAt: serverTimestamp(),
      savedAt: Date.now(),
    },
    { merge: true }
  );
}

export async function fetchChatMessages(uid: string, chatId: string): Promise<PersistableChatMessage[]> {
  try {
    const q = query(messagesCollectionRef(uid, chatId), orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => docToChatMessage(d));
  } catch (err) {
    console.error('fetchChatMessages ordered query failed, falling back:', err);
    const snap = await getDocs(messagesCollectionRef(uid, chatId));
    return snap.docs
      .map((d) => docToChatMessage(d))
      .sort((a, b) => messageSortKey(a) - messageSortKey(b));
  }
}

export function subscribeChatMessages(
  uid: string,
  chatId: string,
  onMessages: (messages: PersistableChatMessage[]) => void
): Unsubscribe {
  const q = query(messagesCollectionRef(uid, chatId), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const remote = snap.docs.map((d) => docToChatMessage(d));
      onMessages(remote);
    },
    (err) => {
      console.error('subscribeChatMessages', err);
      onMessages([]);
    }
  );
}

export interface ChatListItem {
  id: string;
  title: string;
  savedAt: number;
}

export function subscribeUserChatThreads(uid: string, onList: (items: ChatListItem[]) => void): Unsubscribe {
  const q = query(collection(firebaseDb, 'users', uid, 'chats'), orderBy('updatedAt', 'desc'), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      const items: ChatListItem[] = snap.docs.map((d) => {
        const data = d.data();
        const updatedAt = data.updatedAt as Timestamp | undefined;
        const savedAt = typeof data.savedAt === 'number' ? data.savedAt : updatedAt?.toMillis() ?? Date.now();
        return {
          id: d.id,
          title: (data.title as string) || 'New chat',
          savedAt,
        };
      });
      onList(items);
    },
    (err) => {
      console.error('subscribeUserChatThreads', err);
      onList([]);
    }
  );
}

export async function deleteChatThread(uid: string, chatId: string): Promise<void> {
  const msgsRef = messagesCollectionRef(uid, chatId);
  const snap = await getDocs(msgsRef);
  const chunk = 450;
  for (let i = 0; i < snap.docs.length; i += chunk) {
    const batch = writeBatch(firebaseDb);
    snap.docs.slice(i, i + chunk).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(chatDocRef(uid, chatId));
}

export async function deleteAllChatThreads(uid: string): Promise<void> {
  const threads = await getDocs(collection(firebaseDb, 'users', uid, 'chats'));
  for (const d of threads.docs) {
    await deleteChatThread(uid, d.id);
  }
}

export async function chatThreadExists(uid: string, chatId: string): Promise<boolean> {
  const s = await getDoc(chatDocRef(uid, chatId));
  return s.exists();
}

/**
 * One-time import of legacy localStorage sessions when Firestore has no threads yet.
 */
export async function migrateLocalSessionsToFirestoreIfEmpty(
  uid: string,
  localSessions: { id: string; title: string; messages?: PersistableChatMessage[]; savedAt: number }[]
): Promise<void> {
  const flagKey = `salintayo_chat_fs_migrated_v1:${uid}`;
  try {
    if (localStorage.getItem(flagKey)) return;
  } catch {
    return;
  }
  if (!localSessions.length) return;

  const existing = await getDocs(query(collection(firebaseDb, 'users', uid, 'chats'), limit(1)));
  if (!existing.empty) {
    try {
      localStorage.setItem(flagKey, '1');
    } catch {
      /* ignore */
    }
    return;
  }

  for (const session of localSessions) {
    if (!(session.messages ?? []).length) continue;
    await setDoc(chatDocRef(uid, session.id), {
      userId: uid,
      title: session.title || 'Chat',
      createdAt: Timestamp.fromMillis(session.savedAt),
      updatedAt: Timestamp.fromMillis(session.savedAt),
      savedAt: session.savedAt,
    });

    let batch = writeBatch(firebaseDb);
    let n = 0;
    for (const m of session.messages ?? []) {
      const base = sanitizeForFirestore(m);
      base.chatId = session.id;
      base.senderId = m.role === 'user' ? uid : 'ai';
      const mRef = doc(firebaseDb, 'users', uid, 'chats', session.id, 'messages', m.id);
      batch.set(mRef, {
        ...base,
        createdAt: Timestamp.fromMillis(Number(m.id) || session.savedAt),
      });
      n++;
      if (n >= 400) {
        await batch.commit();
        batch = writeBatch(firebaseDb);
        n = 0;
      }
    }
    if (n > 0) await batch.commit();
  }

  try {
    localStorage.setItem(flagKey, '1');
  } catch {
    /* ignore */
  }
}
