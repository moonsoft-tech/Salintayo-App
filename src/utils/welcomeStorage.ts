const STORAGE_KEY = 'salintayo_hasSeenWelcome';
const STORAGE_KEY_PREFIX = 'salintayo_welcome_';

export function hasSeenWelcome(userId?: string): boolean {
  try {
    if (userId) {
      return localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`) === 'true';
    }
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setHasSeenWelcome(userId?: string): void {
  try {
    if (userId) {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, 'true');
    } else {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
  } catch {
    // Ignore storage errors (e.g. private mode)
  }
}
