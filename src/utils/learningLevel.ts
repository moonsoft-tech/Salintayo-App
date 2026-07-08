/**
 * Learning Level — derived from quiz attempts in Firestore `users/{uid}/quizHistory`
 * (and localStorage fallback per dialect, matching Quiz.tsx).
 *
 * Tier from average quiz score (0–100):
 * - Beginner: 0–50
 * - Intermediate: 51–80
 * - Advanced: 81–100
 */

import { startOfWeekMonday } from './learnStreak';

/** Dialect ids used with `salintayo_quiz_attempts_{id}` (aligned with LanguageModal). */
const QUIZ_DIALECT_CODES = ['fil', 'en', 'ceb', 'hil', 'ilo', 'pag'] as const;

export const QUIZ_PROGRESS_UPDATED_EVENT = 'salintayo_quiz_progress_updated';

const QUIZ_ATTEMPTS_KEY = 'salintayo_quiz_attempts';

export type LearningTier = 'Beginner' | 'Intermediate' | 'Advanced';

export interface QuizAttemptRecord {
  quizId: string;
  dialectId: string;
  score: number;
  timestamp: number;
  questionCount: number;
}

export interface LearningLevelSnapshot {
  proficiencyPercent: number;
  tier: LearningTier;
  /** Line under the title, e.g. weekly comparison */
  weekChangeLabel: string;
  completedQuizCount: number;
  /** Average score across all attempts (0–100), NaN if none */
  averageScore: number;
}

function clamp01to100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function tierFromAverageScore(avg: number): LearningTier {
  if (!Number.isFinite(avg) || avg <= 50) return 'Beginner';
  if (avg <= 80) return 'Intermediate';
  return 'Advanced';
}

function weekRangeContaining(date: Date): { weekStartMs: number; weekEndMs: number } {
  const start = startOfWeekMonday(date);
  const weekStartMs = start.getTime();
  const weekEndMs = weekStartMs + 7 * 24 * 60 * 60 * 1000;
  return { weekStartMs, weekEndMs };
}

function averageScores(attempts: QuizAttemptRecord[]): number {
  if (attempts.length === 0) return NaN;
  const sum = attempts.reduce((a, x) => a + x.score, 0);
  return sum / attempts.length;
}

/**
 * Parse a Firestore quizHistory document into a normalized attempt.
 */
export function parseQuizHistoryDoc(docId: string, data: Record<string, unknown>): QuizAttemptRecord | null {
  const score = typeof data.score === 'number' && Number.isFinite(data.score) ? data.score : NaN;
  if (!Number.isFinite(score)) return null;

  let ts =
    typeof data.timestamp === 'number' && Number.isFinite(data.timestamp)
      ? data.timestamp
      : Date.now();
  if (ts < 1e12) ts *= 1000; // seconds → ms guard

  const quizId = typeof data.quizId === 'string' && data.quizId ? data.quizId : docId;
  const dialectId = typeof data.dialectId === 'string' ? data.dialectId : 'fil';
  const questionCount =
    typeof data.questionCount === 'number' && Number.isFinite(data.questionCount)
      ? Math.max(0, Math.floor(data.questionCount))
      : 0;

  return { quizId, dialectId, score: clamp01to100(score), timestamp: ts, questionCount };
}

/**
 * Load attempts from local storage (all dialect keys), for offline / pre-sync UX.
 */
export function loadLocalQuizAttemptsMerged(): QuizAttemptRecord[] {
  const byId = new Map<string, QuizAttemptRecord>();

  for (const code of QUIZ_DIALECT_CODES) {
    try {
      const raw = localStorage.getItem(`${QUIZ_ATTEMPTS_KEY}_${code}`);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) continue;
      for (const row of parsed) {
        if (!row || typeof row !== 'object') continue;
        const r = row as Record<string, unknown>;
        const quizId = typeof r.quizId === 'string' ? r.quizId : `local-${code}-${r.timestamp}`;
        const score = typeof r.score === 'number' ? clamp01to100(r.score) : NaN;
        if (!Number.isFinite(score)) continue;
        const timestamp =
          typeof r.timestamp === 'number' && Number.isFinite(r.timestamp) ? r.timestamp : 0;
        const questionCount =
          typeof r.questionCount === 'number' && Number.isFinite(r.questionCount)
            ? Math.max(0, Math.floor(r.questionCount))
            : 0;
        byId.set(quizId, {
          quizId,
          dialectId: typeof r.dialectId === 'string' ? r.dialectId : code,
          score,
          timestamp,
          questionCount,
        });
      }
    } catch {
      /* ignore */
    }
  }

  return [...byId.values()].sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Merge Firestore attempts with local; Firestore wins on same quizId.
 */
export function mergeQuizAttempts(
  firestoreAttempts: QuizAttemptRecord[],
  localAttempts: QuizAttemptRecord[]
): QuizAttemptRecord[] {
  const byId = new Map<string, QuizAttemptRecord>();
  for (const a of localAttempts) byId.set(a.quizId, a);
  for (const a of firestoreAttempts) byId.set(a.quizId, a);
  return [...byId.values()].sort((a, b) => b.timestamp - a.timestamp);
}

export function computeLearningLevel(attempts: QuizAttemptRecord[], now: Date = new Date()): LearningLevelSnapshot {
  const completedQuizCount = attempts.length;
  const avg = averageScores(attempts);
  const proficiencyPercent = Number.isFinite(avg) ? clamp01to100(avg) : 0;
  const tier = tierFromAverageScore(Number.isFinite(avg) ? avg : 0);

  if (completedQuizCount === 0) {
    return {
      proficiencyPercent: 0,
      tier: 'Beginner',
      weekChangeLabel: 'Take a quiz to track your level',
      completedQuizCount: 0,
      averageScore: NaN,
    };
  }

  const { weekStartMs: thisWeekStart } = weekRangeContaining(now);
  const lastWeekStart = thisWeekStart - 7 * 24 * 60 * 60 * 1000;
  const lastWeekEnd = thisWeekStart;

  const thisWeek = attempts.filter(a => a.timestamp >= thisWeekStart);
  const lastWeek = attempts.filter(a => a.timestamp >= lastWeekStart && a.timestamp < lastWeekEnd);

  const avgThis = averageScores(thisWeek);
  const avgLast = averageScores(lastWeek);

  let weekChangeLabel: string;

  if (thisWeek.length === 0) {
    weekChangeLabel = 'No quizzes completed this week yet';
  } else if (lastWeek.length === 0) {
    weekChangeLabel = `${Math.round(avgThis)}% avg from ${thisWeek.length} quiz${thisWeek.length === 1 ? '' : 'zes'} this week`;
  } else {
    const diff = Math.round(avgThis) - Math.round(avgLast);
    if (diff === 0) {
      weekChangeLabel = 'Same avg score as last week';
    } else if (diff > 0) {
      weekChangeLabel = `+${diff}% avg vs last week`;
    } else {
      weekChangeLabel = `${diff}% avg vs last week`;
    }
  }

  return {
    proficiencyPercent,
    tier,
    weekChangeLabel,
    completedQuizCount,
    averageScore: avg,
  };
}
