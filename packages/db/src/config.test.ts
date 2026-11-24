import { describe, expect, it } from 'vitest';
import { DatabaseConfigError, loadDatabaseConfig } from './config';

describe('loadDatabaseConfig', () => {
  it.each([
    'postgres://globetrot:globetrot@localhost:5455/globetrot',
    'postgresql://user:p%40ss@db.internal:5432/app?sslmode=require',
    'postgres://127.0.0.1/globetrot',
  ])('accepts %s', (url) => {
    expect(loadDatabaseConfig({ DATABASE_URL: url })).toEqual({ url });
  });

  it.each([
    ['is missing', undefined],
    ['is empty', ''],
    ['uses another scheme', 'mysql://user:secret@localhost/app'],
    ['is a web URL', 'https://localhost/app'],
    ['has no host', 'postgres:///app'],
    ['names no database', 'postgres://user:secret@localhost:5432'],
    ['is not a URL', 'not a url'],
  ])('rejects a value that %s', (_label, value) => {
    expect(() => loadDatabaseConfig({ DATABASE_URL: value })).toThrow(DatabaseConfigError);
  });

  it('never repeats the value, which may contain a password', () => {
    for (const value of [
      'mysql://user:hunter2@localhost/app',
      'postgres://user:hunter2@localhost',
    ]) {
      try {
        loadDatabaseConfig({ DATABASE_URL: value });
        expect.unreachable();
      } catch (error) {
        expect((error as Error).message).not.toContain('hunter2');
        expect((error as Error).message).toMatch(/^DATABASE_URL /);
      }
    }
  });

  it('reads process.env by default', () => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgres://u:p@localhost:5455/globetrot';
    try {
      expect(loadDatabaseConfig().url).toBe('postgres://u:p@localhost:5455/globetrot');
    } finally {
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
