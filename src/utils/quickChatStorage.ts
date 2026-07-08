/**
 * Quick Chat "enabled" and bubble position are stored per Firebase uid so a new
 * account on the same device does not inherit the previous learner's settings.
 */

const ENABLED_PREFIX = 'salintayo_quickchat_enabled_';
const POS_PREFIX = 'salintayo_quickchat_pos_';

/** Old global key from builds before per-uid storage; not read anymore. */
const LEGACY_QUICKCHAT_ENABLED_KEY = 'salintayo_quickchat_enabled';

function quickChatEnabledStorageKey(uid: string): string {
  return `${ENABLED_PREFIX}${uid}`;
}

export function readQuickChatEnabled(uid: string): boolean {
  try {
    return localStorage.getItem(quickChatEnabledStorageKey(uid)) === 'true';
  } catch {
    return false;
  }
}

export function writeQuickChatEnabled(uid: string, enabled: boolean): void {
  try {
    localStorage.setItem(quickChatEnabledStorageKey(uid), String(enabled));
    window.dispatchEvent(new Event('salintayo_qcb_changed'));
  } catch {}
}

export function readQuickChatPos(uid: string): { x: number; y: number } | null {
  try {
    const s = localStorage.getItem(`${POS_PREFIX}${uid}`);
    if (!s) return null;
    const p = JSON.parse(s) as unknown;
    if (
      p &&
      typeof p === 'object' &&
      'x' in p &&
      'y' in p &&
      typeof (p as { x: unknown }).x === 'number' &&
      typeof (p as { y: unknown }).y === 'number'
    ) {
      return { x: (p as { x: number }).x, y: (p as { y: number }).y };
    }
  } catch {}
  return null;
}

export function writeQuickChatPos(uid: string, pos: { x: number; y: number }): void {
  try {
    localStorage.setItem(`${POS_PREFIX}${uid}`, JSON.stringify(pos));
  } catch {}
}

/** Drop obsolete global toggle so old values never affect new logic. */
export function clearLegacyQuickChatEnabledKey(): void {
  try {
    localStorage.removeItem(LEGACY_QUICKCHAT_ENABLED_KEY);
  } catch {}
}

export function isQuickChatEnabledStorageKey(key: string | null): boolean {
  return key !== null && key.startsWith(ENABLED_PREFIX);
}
