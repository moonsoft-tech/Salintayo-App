export type BootEntry = {
  step: string;
  timestamp: string;
  platform: string;
  message: string;
};

export type StartupErrorDetails = {
  message: string;
  stack?: string;
  file?: string;
  line?: number;
  column?: number;
  context?: string;
  platform: string;
  url: string;
  userAgent: string;
  environment: string;
  lastStep: string;
};

const logs: BootEntry[] = [];
let startupError: StartupErrorDetails | null = null;

function getPlatform(): string {
  if (typeof window === 'undefined') return 'unknown';
  const nav = window.navigator as any;
  if (nav?.standalone) return 'ios-webapp';
  if ('Capacitor' in window) {
    const capacitor = (window as any).Capacitor;
    return capacitor.getPlatform?.() ?? capacitor.platform ?? 'native';
  }
  return 'web';
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function appendLog(message: string): void {
  const entry: BootEntry = {
    step: message,
    timestamp: formatTimestamp(),
    platform: getPlatform(),
    message,
  };
  logs.push(entry);
  console.debug('[BOOT]', entry.step, entry);
}

function buildErrorDetails(error: any, context?: string): StartupErrorDetails {
  const platform = getPlatform();
  const url = typeof window !== 'undefined' ? window.location.href : 'unknown';
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
  const environment = typeof import.meta !== 'undefined' ? (import.meta.env.MODE ?? 'unknown') : 'unknown';

  const details: StartupErrorDetails = {
    message: error?.message ?? String(error ?? 'Unknown error'),
    stack: error?.stack ?? undefined,
    file: error?.fileName ?? undefined,
    line: error?.lineNumber ?? undefined,
    column: error?.columnNumber ?? undefined,
    context,
    platform,
    url,
    userAgent,
    environment,
    lastStep: getLastStep(),
  };

  if (typeof error === 'object' && error !== null) {
    if (!details.file && typeof error.source === 'string') details.file = error.source;
    if (!details.line && typeof error.lineno === 'number') details.line = error.lineno;
    if (!details.column && typeof error.colno === 'number') details.column = error.colno;
  }

  return details;
}

export function getBootLogs(): BootEntry[] {
  return [...logs];
}

export function getLastStep(): string {
  return logs.length ? logs[logs.length - 1].step : 'none';
}

export function logBootStep(message: string): void {
  appendLog(message);
}

export function logStartupError(error: any, context?: string): StartupErrorDetails {
  const details = buildErrorDetails(error, context);
  startupError = details;
  appendLog(`[BOOT ERROR] ${details.message}`);
  console.error('[BOOT ERROR]', details);
  return details;
}

export function getStartupError(): StartupErrorDetails | null {
  return startupError;
}

export function auditEnvironmentVariables(keys: string[]): string[] {
  const missing: string[] = [];
  keys.forEach((key) => {
    const value = (import.meta.env as Record<string, unknown>)[key];
    const present = value !== undefined && value !== null && value !== '';
    appendLog(`[ENV] ${key}=${present ? 'present' : 'missing'}`);
    if (!present) {
      appendLog(`MISSING ENV: ${key}`);
      missing.push(key);
    }
  });
  return missing;
}

export async function verifyCriticalAssets(paths: string[]): Promise<void> {
  for (const path of paths) {
    try {
      const url = new URL(path, typeof window !== 'undefined' ? window.location.origin : '');
      const response = await fetch(url.href, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Asset returned ${response.status} for ${path}`);
      }
      appendLog(`[ASSET] Verified ${path}`);
    } catch (error) {
      throw new Error(`Critical asset failed to load: ${path} | ${String(error)}`);
    }
  }
}

function renderHtml(details: StartupErrorDetails): string {
  const paddedStack = details.stack ? details.stack.replace(/\n/g, '<br/>') : 'No stack available';
  const logsHtml = getBootLogs()
    .map((entry) => `<div style="margin-bottom:4px;"><strong>${entry.timestamp}</strong> <code>${entry.platform}</code> ${entry.message}</div>`)
    .join('');

  return `
    <style>
      body { margin: 0; background: #111; color: #f4f4f4; font-family: system-ui, sans-serif; }
      .boot-debug { min-height: 100vh; padding: 24px; box-sizing: border-box; }
      .boot-debug h1 { margin-top: 0; font-size: 28px; }
      .boot-debug h2 { font-size: 18px; margin-bottom: 8px; }
      .boot-debug .section { margin-top: 20px; }
      .boot-debug .details { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 16px; border-radius: 12px; }
      .boot-debug pre { white-space: pre-wrap; word-break: break-word; margin: 0; }
      .boot-debug .logs { max-height: 240px; overflow: auto; }
    </style>
    <div class="boot-debug">
      <h1>APP FAILED TO START</h1>
      <div class="section details">
        <h2>Last successful boot step</h2>
        <div>${details.lastStep}</div>
      </div>
      <div class="section details">
        <h2>Error</h2>
        <div>${details.message}</div>
      </div>
      <div class="section details">
        <h2>Stack trace</h2>
        <pre>${paddedStack}</pre>
      </div>
      <div class="section details">
        <h2>Context</h2>
        <div>${details.context ?? 'unknown'}</div>
      </div>
      <div class="section details">
        <h2>Location</h2>
        <div>URL: ${details.url}</div>
        <div>Platform: ${details.platform}</div>
        <div>User agent: ${details.userAgent}</div>
        <div>Environment: ${details.environment}</div>
      </div>
      <div class="section details logs">
        <h2>Boot trace</h2>
        ${logsHtml}
      </div>
    </div>
  `;
}

export function renderDebugPage(error: any, context?: string): void {
  const details = error && typeof error === 'object' && 'message' in error ? buildErrorDetails(error, context) : buildErrorDetails({ message: String(error) }, context);
  const html = renderHtml(details);
  if (typeof document !== 'undefined') {
    document.documentElement.innerHTML = html;
    document.documentElement.style.background = '#111';
  }
}

export function installGlobalHandlers(): void {
  if (typeof window === 'undefined') return;

  window.onerror = (message, source, lineno, colno, error) => {
    const details = logStartupError(error ?? { message: String(message), source, lineNumber: lineno, columnNumber: colno }, 'window.onerror');
    renderDebugPage(details, 'window.onerror');
    return true;
  };

  window.onunhandledrejection = (event) => {
    const reason = (event && (event as PromiseRejectionEvent).reason) ?? 'Unhandled rejection';
    const details = logStartupError(reason, 'window.onunhandledrejection');
    renderDebugPage(details, 'window.onunhandledrejection');
    return true;
  };

  window.addEventListener('error', (event) => {
    if (event?.error) {
      const details = logStartupError(event.error, 'window.addEventListener(error)');
      renderDebugPage(details, 'window.addEventListener(error)');
      event.preventDefault();
    }
  });
}
