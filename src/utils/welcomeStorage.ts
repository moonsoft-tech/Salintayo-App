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
