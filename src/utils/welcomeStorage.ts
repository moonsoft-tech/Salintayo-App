/** Pre–per-user builds stored one flag for the whole browser; never use it for routing. */
const LEGACY_GLOBAL_KEY = 'salintayo_hasSeenWelcome';
const STORAGE_KEY_PREFIX = 'salintayo_welcome_';

/**
 * Whether this Firebase account finished onboarding (cultural intro).
 * Requires uid — if missing, returns false so we never skip welcome due to another user's legacy flag.
 */
export function hasSeenWelcome(userId: string | undefined): boolean {
  try {
    if (!userId) return false;
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`) === 'true';
  } catch {
    return false;
  }
}

export function setHasSeenWelcome(userId: string | undefined): void {
  try {
    if (!userId) return;
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, 'true');
  } catch {
    // Ignore storage errors (e.g. private mode)
  }
}

/** Drop legacy global key so it cannot affect new accounts on shared devices. */
export function clearLegacyWelcomeGlobalKey(): void {
  try {
    localStorage.removeItem(LEGACY_GLOBAL_KEY);
  } catch {
    /* ignore */
  }
}

/* ─── Onboarding step order enforcement ─────────────────────────── */

const STEP_KEY_PREFIX = 'salintayo_welcome_step_';

export type OnboardingStep = 'welcome' | 'welcome2' | 'cultural-intro';

/** Order matters: index = position in the required flow. */
const STEP_ORDER: OnboardingStep[] = ['welcome', 'welcome2', 'cultural-intro'];

export const STEP_PATH: Record<OnboardingStep, string> = {
  welcome: '/welcome',
  welcome2: '/welcome-2',
  'cultural-intro': '/cultural-intro',
};

function getFurthestCompletedIdx(userId: string | undefined): number {
  try {
    if (!userId) return -1;
    const stored = localStorage.getItem(`${STEP_KEY_PREFIX}${userId}`) as OnboardingStep | null;
    return stored ? STEP_ORDER.indexOf(stored) : -1;
  } catch {
    return -1;
  }
}

/** Call when a user finishes a step (e.g. taps "Continue") — advances the marker if this step is further than before. */
export function markOnboardingStepComplete(userId: string | undefined, step: OnboardingStep): void {
  try {
    if (!userId) return;
    const currentIdx = getFurthestCompletedIdx(userId);
    const newIdx = STEP_ORDER.indexOf(step);
    if (newIdx > currentIdx) {
      localStorage.setItem(`${STEP_KEY_PREFIX}${userId}`, step);
    }
  } catch {
    /* ignore */
  }
}

/** True if the user is allowed to view this step right now (current step, or one step ahead of what they've completed). */
export function canAccessStep(userId: string | undefined, step: OnboardingStep): boolean {
  const targetIdx = STEP_ORDER.indexOf(step);
  return targetIdx <= getFurthestCompletedIdx(userId) + 1;
}

/** Where to send a user who tries to jump ahead — the correct next step for them right now. */
export function getCurrentAllowedStepPath(userId: string | undefined): string {
  const nextIdx = Math.min(getFurthestCompletedIdx(userId) + 1, STEP_ORDER.length - 1);
  return STEP_PATH[STEP_ORDER[nextIdx]];
}
