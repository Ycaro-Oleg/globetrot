import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadWorkerConfig } from './config';
import { startWorker } from './worker';

afterEach(() => {
  vi.useRealTimers();
});

describe('worker scheduler', () => {
  it('runs after the first delay, then on every interval, never two rounds at once', async () => {
    vi.useFakeTimers();
    let calls = 0;
    let finish: () => void = () => {};
    const logs: string[] = [];
    const worker = startWorker({
      firstDelayMs: 1000,
      intervalMs: 5000,
      log: (m) => logs.push(m),
      runOnce: () => {
        calls++;
        return new Promise<void>((resolve) => {
          finish = resolve;
        });
      },
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(calls).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toBe(1); // still running: no overlap
    finish();
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toBe(2);
    finish();
    await worker.stop();
    expect(logs).toEqual(['worker started', 'worker stopped']);
  });

  it('logs a failed round by kind and keeps going', async () => {
    vi.useFakeTimers();
    const logs: string[] = [];
    let calls = 0;
    const worker = startWorker({
      firstDelayMs: 10,
      intervalMs: 10,
      log: (m) => logs.push(m),
      runOnce: async () => {
        calls++;
        throw new TypeError('secret detail');
      },
    });
    await vi.advanceTimersByTimeAsync(25);
    await worker.stop();
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(logs).toContain('worker round failed (TypeError)');
    expect(logs.join(' ')).not.toContain('secret detail');
  });
});

describe('worker settings', () => {
  const DATABASE_URL = 'postgres://u:p@localhost:5432/db';
  it('defaults to hourly rounds and local storage', () => {
    const config = loadWorkerConfig({ DATABASE_URL });
    expect(config.intervalMinutes).toBe(60);
    expect(config.storage.bucket).toBe('globetrot-media');
  });
  it('refuses a bad interval and missing production storage', () => {
    expect(() => loadWorkerConfig({ DATABASE_URL, MAINTENANCE_INTERVAL_MINUTES: '0' })).toThrow(
      /MAINTENANCE_INTERVAL_MINUTES/,
    );
    expect(() => loadWorkerConfig({ DATABASE_URL, NODE_ENV: 'production' })).toThrow(/S3_ENDPOINT/);
  });
});
