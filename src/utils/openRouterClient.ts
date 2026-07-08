import { Capacitor } from '@capacitor/core';

/**
 * OpenRouter expects HTTP-Referer to be a real site URL when keys are origin-restricted.
 * Capacitor WebViews often report https://localhost or capacitor://localhost, which breaks that.
 */
export function getOpenRouterHttpReferer(): string {
  const refererOverride = (import.meta.env.VITE_OPENROUTER_HTTP_REFERER ?? '').trim();
  if (refererOverride) return refererOverride;

  const publicAppUrl = (import.meta.env.VITE_APP_PUBLIC_URL ?? '').trim();
  if (Capacitor.isNativePlatform() && publicAppUrl) {
    return publicAppUrl.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    return window.location.origin;
  }

  return publicAppUrl.replace(/\/+$/, '') || 'https://localhost';
}

export function getOpenRouterFetchHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': getOpenRouterHttpReferer(),
  };
}
