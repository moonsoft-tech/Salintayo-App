/**
 * Learning streak helpers — shared by Home (display) and future Learn flows.
 * Login streak persistence: `loginStreakFirestore.syncLoginStreakOnAuth` writes
 * `streakCount`, `lastLoginDate`, and `loginActivityDates` on `users/{uid}`.
 * Learn can also append days via localStorage until the cloud path is wired.
 */

export const LEARN_ACTIVITY_DATES_KEY = 'salintayo_learn_activity_dates';

export const LEARN_STREAK_CHANGED_EVENT = 'salintayo_learn_streak_changed';

// Login streak keys/events used by Home/Profile/AuthContext (compat API)
export const LOGIN_ACTIVITY_DATES_KEY = 'salintayo_login_activity_dates';
export const LOGIN_STREAK_CHANGED_EVENT = 'salintayo_login_streak_changed';

/** Local calendar day as YYYY-MM-DD */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Philippine/local app day key helper expected by login-streak consumers. */
export function phDateKey(d: Date = new Date()): string {
  return localDateKey(d);
}

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export type StreakDayState = 'completed' | 'today' | 'upcoming';

export interface StreakWeekCell {
  label: string;
  state: StreakDayState;
}

/** Monday-start week containing `date` */
export function startOfWeekMonday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const jsDay = d.getDay();
  const offset = jsDay === 0 ? -6 : 1 - jsDay;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function readLocalActivityDates(): string[] {
  try {
    const raw = localStorage.getItem(LEARN_ACTIVITY_DATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x));
  } catch {
    return [];
  }
}

/** Login activity date reader (compat API). */
export function readLocalLoginDates(): string[] {
  try {
    const raw = localStorage.getItem(LOGIN_ACTIVITY_DATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x));
  } catch {
    return [];
  }
}

export function mergeActivityDateStrings(...lists: (string[] | undefined)[]): string[] {
  const s = new Set<string>();
  for (const list of lists) {
    if (!list) continue;
    for (const x of list) {
      if (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)) s.add(x);
    }
  }
  return [...s].sort();
}

/** Consecutive calendar days with activity, counting backward from today or yesterday */
export function computeCurrentStreakFromDates(activity: Set<string>, now = new Date()): number {
  let count = 0;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!activity.has(localDateKey(d))) {
    d.setDate(d.getDate() - 1);
  }
  while (activity.has(localDateKey(d))) {
    count += 1;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

/** Login streak calculator (compat API). */
export function computeCurrentLoginStreakFromDates(activity: Set<string>, now = new Date()): number {
  return computeCurrentStreakFromDates(activity, now);
}

export function buildStreakWeekRow(activity: Set<string>, now = new Date()): StreakWeekCell[] {
  const todayKey = localDateKey(now);
  const monday = startOfWeekMonday(now);
  const row: StreakWeekCell[] = [];

  for (let i = 0; i < 7; i++) {
    const cell = new Date(monday);
    cell.setDate(monday.getDate() + i);
    const key = localDateKey(cell);
    const label = WEEK_LABELS[i];

    if (key === todayKey) {
      row.push({ label, state: activity.has(key) ? 'completed' : 'today' });
    } else if (key > todayKey) {
      row.push({ label, state: 'upcoming' });
    } else {
      row.push({ label, state: activity.has(key) ? 'completed' : 'upcoming' });
    }
  }

  return row;
}

/** Login weekly row builder (compat API). */
export function buildLoginStreakWeekRow(activity: Set<string>, now = new Date()): StreakWeekCell[] {
  return buildStreakWeekRow(activity, now);
}

/**
 * Record learning activity for a calendar day (defaults to today). Call from Learn when a session completes.
 * Does not write Firestore — sync that when your backend is ready.
 */
export function recordLocalLearnActivity(date: Date = new Date()): void {
  const key = localDateKey(date);
  try {
    const merged = mergeActivityDateStrings(readLocalActivityDates(), [key]);
    localStorage.setItem(LEARN_ACTIVITY_DATES_KEY, JSON.stringify(merged));
    window.dispatchEvent(new Event(LEARN_STREAK_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

/** Record login activity for today (compat API for auth/login streak). */
export function recordLocalLoginActivity(date: Date = new Date()): void {
  const key = phDateKey(date);
  try {
    const merged = mergeActivityDateStrings(readLocalLoginDates(), [key]);
    localStorage.setItem(LOGIN_ACTIVITY_DATES_KEY, JSON.stringify(merged));
    window.dispatchEvent(new Event(LOGIN_STREAK_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}
