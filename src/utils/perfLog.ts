/**
 * Lightweight performance timing helper for capstone metrics.
 * Wrap any async operation to log its duration to the console, and
 * optionally accumulate samples in memory so you can print an
 * average/min/max after running a feature a few times.
 */
const samples: Record<string, number[]> = {};

export async function timeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const ms = performance.now() - start;
    samples[label] = samples[label] ?? [];
    samples[label].push(ms);
    console.log(`[PERF] ${label}: ${ms.toFixed(1)}ms`);
  }
}

/** Call this in the console (or a temporary debug button) after running a feature a few times. */
export function printPerfSummary(label?: string) {
  const labels = label ? [label] : Object.keys(samples);
  for (const l of labels) {
    const arr = samples[l] ?? [];
    if (!arr.length) continue;
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    console.log(
      `[PERF SUMMARY] ${l} — avg: ${avg.toFixed(1)}ms, min: ${min.toFixed(1)}ms, max: ${max.toFixed(1)}ms, n=${arr.length}`
    );
  }
}