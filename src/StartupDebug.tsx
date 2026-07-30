import React, { useMemo } from 'react';
import { getBootLogs, getLastStep, logStartupError } from './bootLogger';

type StartupDebugProps = {
  error: Error | string;
  component: string;
};

export function StartupDebug({ error, component }: StartupDebugProps) {
  const errorInstance = typeof error === 'string' ? new Error(error) : error;
  const errorId = typeof error === 'string' ? error : `${errorInstance.message}-${errorInstance.stack ?? ''}`;
  const details = useMemo(() => logStartupError(errorInstance, component), [component, errorId]);
  const logs = useMemo(() => getBootLogs(), []);

  return (
    <div style={{ minHeight: '100vh', padding: 24, background: '#111', color: '#f4f4f4', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ marginTop: 0, fontSize: 28 }}>APP FAILED TO START</h1>
      <section style={{ marginTop: 20, padding: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
        <h2 style={{ margin: '0 0 8px 0' }}>Last successful boot step</h2>
        <div>{getLastStep()}</div>
      </section>
      <section style={{ marginTop: 20, padding: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
        <h2 style={{ margin: '0 0 8px 0' }}>Error</h2>
        <div>{details.message}</div>
      </section>
      <section style={{ marginTop: 20, padding: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
        <h2 style={{ margin: '0 0 8px 0' }}>Context</h2>
        <div>{details.context ?? 'unknown'}</div>
      </section>
      <section style={{ marginTop: 20, padding: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
        <h2 style={{ margin: '0 0 8px 0' }}>Location</h2>
        <div>URL: {details.url}</div>
        <div>Platform: {details.platform}</div>
        <div>User agent: {details.userAgent}</div>
        <div>Environment: {details.environment}</div>
      </section>
      <section style={{ marginTop: 20, padding: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 12, overflow: 'auto' }}>
        <h2 style={{ margin: '0 0 8px 0' }}>Boot trace</h2>
        {logs.map((entry) => (
          <div key={`${entry.timestamp}-${entry.step}`} style={{ marginBottom: 4 }}>
            <strong>{entry.timestamp}</strong> <code>{entry.platform}</code> {entry.message}
          </div>
        ))}
      </section>
      <section style={{ marginTop: 20, padding: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
        <h2 style={{ margin: '0 0 8px 0' }}>Stack trace</h2>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{details.stack ?? 'No stack available'}</pre>
      </section>
    </div>
  );
}
