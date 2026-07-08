/**
 * Flatten Capacitor plugin / Firebase / unknown errors for on-screen display.
 * Native bridges often omit `message` or nest details.
 */
export function formatAuthErrorForUi(err: unknown): { message: string; code?: string } {
  if (err == null) return { message: 'Unknown error' };

  if (err instanceof Error) {
    const withCode = err as Error & { code?: string };
    const code = typeof withCode.code === 'string' ? withCode.code : undefined;
    return { message: err.message || 'Error', code };
  }

  if (typeof err === 'object') {
    const o = err as Record<string, unknown>;
    const code = typeof o.code === 'string' ? o.code : undefined;

    const nested = o.error;
    const nestedMsg =
      nested && typeof nested === 'object' && nested !== null && 'message' in nested
        ? String((nested as { message?: unknown }).message ?? '')
        : '';

    const msg =
      (typeof o.message === 'string' && o.message.trim() && o.message) ||
      (typeof o.errorMessage === 'string' && o.errorMessage.trim() && o.errorMessage) ||
      (typeof o.localizedDescription === 'string' && o.localizedDescription.trim() && o.localizedDescription) ||
      nestedMsg.trim() ||
      '';

    if (msg) return { message: msg, code };

    try {
      return { message: JSON.stringify(o), code };
    } catch {
      return { message: String(err), code };
    }
  }

  return { message: String(err) };
}
