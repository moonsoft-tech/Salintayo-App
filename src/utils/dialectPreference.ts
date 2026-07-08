/**
 * Dialect defaults follow welcome flow: Tourist (foreign visitor) → English;
 * Local (Filipino) → Filipino. Used when no explicit dialect is stored yet.
 */

export const DIALECT_LANG_STORAGE_KEY = 'salintayo_dialect_lang';
export const QCB_DIALECT_LANG_STORAGE_KEY = 'salintayo_qcb_dialect_lang';
export const EXPERIENCE_STORAGE_KEY = 'salintayo_experience';

/** Tourist / foreign visitor → English. Local Filipino or unset → Filipino. */
export function getDefaultDialectCodeForExperience(): 'en' | 'fil' {
  try {
    if (localStorage.getItem(EXPERIENCE_STORAGE_KEY) === 'tourist') return 'en';
  } catch {
    /* ignore */
  }
  return 'fil';
}

/** Prefer stored dialect; otherwise experience-based default. */
export function getResolvedDialectLangCode(): string {
  try {
    const raw = localStorage.getItem(DIALECT_LANG_STORAGE_KEY)?.trim().toLowerCase();
    if (raw) return raw;
  } catch {
    /* ignore */
  }
  return getDefaultDialectCodeForExperience();
}
