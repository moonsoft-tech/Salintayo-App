/**
 * Persists daily login streak on `users/{uid}` using Firestore transactions (no Cloud Functions).
 *
 * Fields:
 * - `streakCount` (number) — canonical consecutive-day count
 * - `lastLoginDate` — calendar day key `YYYY-MM-DD` in the user’s local timezone (same as `phDateKey()`)
 * - `loginActivityDates` — sorted unique day keys for the weekly UI
 * - `loginStreak` — mirror of `streakCount` for older readers
 */

import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';
import { firebaseDb } from '../firebase';
import {
  computeCurrentLoginStreakFromDates,
  mergeActivityDateStrings,
  phDateKey,
  readLocalLoginDates,
} from './learnStreak';

/** Fired on `window` after `syncLoginStreakOnAuth` completes (detail: LoginStreakSyncEventDetail). */
export const LOGIN_STREAK_SYNCED_EVENT = 'salintayo_login_streak_synced';

export type LoginStreakSyncEventDetail = {
  streakCount: number;
  shouldShowCelebration: boolean;
};

export interface LoginStreakSyncResult {
  streakCount: number;
  lastLoginDate: string;
  loginActivityDates: string[];
  /** First auth this calendar day (server `lastLoginDate` was not today before sync). */
  shouldShowCelebration: boolean;
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseLocalDayKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** True if `earlierKey` is exactly the calendar day before `laterKey` (local date keys). */
export function isPreviousCalendarDay(earlierKey: string, laterKey: string): boolean {
  const d = parseLocalDayKey(earlierKey);
  if (!d) return false;
  d.setDate(d.getDate() + 1);
  return phDateKey(d) === laterKey;
}

function dayKeyFromFirestoreValue(v: unknown): string | null {
  if (typeof v === 'string' && DATE_KEY_RE.test(v)) return v;
  if (v && typeof v === 'object' && 'toDate' in v && typeof (v as Timestamp).toDate === 'function') {
    try {
      return phDateKey((v as Timestamp).toDate());
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeDateStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string' && DATE_KEY_RE.test(x));
}

/**
 * Prefer explicit `lastLoginDate`; otherwise infer from the latest `loginActivityDates` entry ≤ today.
 */
function inferLastLoginDayKey(data: Record<string, unknown>, todayKey: string): string | null {
  const explicit = dayKeyFromFirestoreValue(data.lastLoginDate);
  if (explicit) return explicit;

  const dates = normalizeDateStringArray(data.loginActivityDates);
  if (!dates.length) return null;
  const sorted = [...dates].sort();
  const notFuture = sorted.filter(d => d <= todayKey);
  return notFuture.length ? notFuture[notFuture.length - 1] : sorted[sorted.length - 1];
}

function resolvePrevStreakCount(data: Record<string, unknown>, mergedActivityKeys: string[]): number {
  const raw = data.streakCount ?? data.loginStreak;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 1) {
    return Math.floor(raw);
  }
  const fromDates = computeCurrentLoginStreakFromDates(new Set(mergedActivityKeys));
  return fromDates >= 1 ? fromDates : 1;
}

/**
 * Core rules (local calendar day keys):
 * - No `lastLoginDate` and no inferred day → keep stored streak (≥1) so legacy profiles are not wiped; new users resolve to 1
 * - Last login is today → unchanged
 * - Last login is yesterday → increment
 * - Otherwise → 1
 */
export function computeNextStreakCount(params: {
  todayKey: string;
  lastLoginDayKey: string | null;
  prevStreakCount: number;
}): number {
  const { todayKey, lastLoginDayKey, prevStreakCount } = params;
  const prev = Math.max(1, Math.floor(prevStreakCount) || 1);

  if (!lastLoginDayKey) return prev;
  if (lastLoginDayKey === todayKey) return prev;
  if (isPreviousCalendarDay(lastLoginDayKey, todayKey)) return prev + 1;
  return 1;
}

/**
 * Reads current profile, applies streak rules, writes atomically. Safe under concurrent tabs (retries).
 */
export async function syncLoginStreakOnAuth(uid: string): Promise<LoginStreakSyncResult> {
  const todayKey = phDateKey();
  const localDates = readLocalLoginDates();

  return runTransaction(firebaseDb, async transaction => {
    const ref = doc(firebaseDb, 'users', uid);
    const snap = await transaction.get(ref);
    const data = (snap.exists() ? snap.data() : {}) as Record<string, unknown>;

    const lastBefore = inferLastLoginDayKey(data, todayKey);
    const fireDates = normalizeDateStringArray(data.loginActivityDates);
    const merged = mergeActivityDateStrings(fireDates, localDates);
    const prevStreak = resolvePrevStreakCount(data, merged);

    const nextStreak = computeNextStreakCount({
      todayKey,
      lastLoginDayKey: lastBefore,
      prevStreakCount: prevStreak,
    });

    const loginActivityDates = mergeActivityDateStrings(merged, [todayKey]);

    transaction.set(
      ref,
      {
        streakCount: nextStreak,
        loginStreak: nextStreak,
        lastLoginDate: todayKey,
        loginActivityDates,
        lastActive: serverTimestamp(),
      },
      { merge: true }
    );

    const shouldShowCelebration = lastBefore !== todayKey;

    return {
      streakCount: nextStreak,
      lastLoginDate: todayKey,
      loginActivityDates,
      shouldShowCelebration,
    };
  });
}

export function dispatchLoginStreakSynced(detail: LoginStreakSyncEventDetail): void {
  try {
    window.dispatchEvent(new CustomEvent(LOGIN_STREAK_SYNCED_EVENT, { detail }));
  } catch {
    /* ignore */
  }
}
