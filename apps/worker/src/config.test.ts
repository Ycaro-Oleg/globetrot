import { describe, expect, it } from 'vitest';
import { loadWorkerConfig } from './config';

const DATABASE_URL = 'postgres://globetrot:globetrot@localhost:5455/globetrot';
const production = {
  NODE_ENV: 'production',
  DATABASE_URL,
  BETTER_AUTH_URL: 'https://app.example.test',
  SMTP_HOST: 'smtp.example.test',
  EMAIL_FROM: 'Globetrot <hello@example.test>',
  S3_ENDPOINT: 'https://s3.example.test',
  S3_BUCKET: 'globetrot-photos',
  S3_ACCESS_KEY_ID: 'production-key',
  S3_SECRET_ACCESS_KEY: 'production-secret',
};

describe('worker settings', () => {
  it('work locally with only the database: hourly, Mailpit, the local web origin', () => {
    const config = loadWorkerConfig({ DATABASE_URL });
    expect(config.intervalMinutes).toBe(60);
    expect(config.appUrl).toBe('http://localhost:3000');
    expect(config.email).toMatchObject({ host: 'localhost', port: 1025 });
  });

  it('need a mail server and an https origin in production', () => {
    expect(loadWorkerConfig(production).email.host).toBe('smtp.example.test');
    expect(() => loadWorkerConfig({ ...production, SMTP_HOST: '' })).toThrow(/SMTP_HOST/);
    expect(() => loadWorkerConfig({ ...production, BETTER_AUTH_URL: 'http://x.test' })).toThrow(
      /https/,
    );
  });

  it('refuse a bad interval', () => {
    expect(() => loadWorkerConfig({ DATABASE_URL, MAINTENANCE_INTERVAL_MINUTES: '0' })).toThrow();
  });
});
