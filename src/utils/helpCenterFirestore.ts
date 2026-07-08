import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { firebaseDb } from '../firebase';

export const BUG_REPORTS_COLLECTION = 'bugReports';
export const APP_FEEDBACK_COLLECTION = 'appFeedback';

export type BugReportPayload = {
  userId: string;
  userEmail: string;
  userName: string;
  bugType: string;
  description: string;
  platform: string;
};

export async function submitBugReport(payload: BugReportPayload): Promise<void> {
  await addDoc(collection(firebaseDb, BUG_REPORTS_COLLECTION), {
    userId: payload.userId,
    userEmail: payload.userEmail,
    userName: payload.userName,
    bugType: payload.bugType,
    description: payload.description.slice(0, 8000),
    platform: payload.platform,
    createdAt: Timestamp.now(),
  });
}

export type FeedbackPayload = {
  userId: string;
  userEmail: string;
  userName: string;
  rating: number;
  comment: string;
  platform: string;
};

export async function submitAppFeedback(payload: FeedbackPayload): Promise<void> {
  const stars = Math.min(5, Math.max(1, Math.round(Number(payload.rating))));

  await addDoc(collection(firebaseDb, APP_FEEDBACK_COLLECTION), {
    userId: payload.userId,
    userEmail: payload.userEmail,
    userName: payload.userName,
    rating: stars,
    comment: payload.comment.slice(0, 8000),
    platform: payload.platform,
    createdAt: Timestamp.now(),
  });
}
