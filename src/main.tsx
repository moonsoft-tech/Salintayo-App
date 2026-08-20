import { printPerfSummary } from './utils/perfLog';
(window as any).printPerfSummary = printPerfSummary;
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { getFirebase } from './firebase';
import { installGlobalHandlers, logBootStep, auditEnvironmentVariables, verifyCriticalAssets, renderDebugPage } from './bootLogger';
import { installAudioUnlock } from './utils/audioUnlock';

logBootStep('[BOOT 01] main.tsx loaded');
installGlobalHandlers();
auditEnvironmentVariables([
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]);

const bootstrap = async () => {
  try {
    logBootStep('[BOOT 01.5] Initializing Firebase');
    installAudioUnlock();
    getFirebase();
    verifyCriticalAssets(['/manifest.json', '/logo.png']).catch((e) => {
      logBootStep(`[BOOT] verifyCriticalAssets failed non-fatally: ${String(e)}`);
    });
    logBootStep('[BOOT 02] React createRoot');
    const container = document.getElementById('root');
    if (!container) throw new Error('Root element #root not found');
    const root = createRoot(container);
    logBootStep('[BOOT 03] Rendering <App />');
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ErrorBoundary>
      </React.StrictMode>
    );
  } catch (error) {
    renderDebugPage(error, 'main.tsx');
  }
};

void bootstrap();