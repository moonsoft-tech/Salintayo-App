/**
 * Validates email format. Rejects invalid patterns like user@gmail.co (2-char TLD).
 * Requires: local@domain.tld where tld is at least 3 characters (e.g. .com, .org).
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{3,}$/.test(email.trim());
}
