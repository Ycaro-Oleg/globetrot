import { describe, expect, it } from 'vitest';
import {
  assertLocalDatabase,
  assertSafeDatabaseName,
  databaseNameOf,
  isLocalHost,
  quoteIdentifier,
  withDatabase,
} from './admin';

describe('local-only guard', () => {
  it.each(['localhost', 'LOCALHOST', '127.0.0.1', '[::1]'])('treats %s as local', (host) => {
    expect(isLocalHost(host)).toBe(true);
  });

  it.each(['db.example.com', '10.0.0.5', 'postgres', 'localhost.evil.com', ''])(
    'does not treat %j as local',
    (host) => {
      expect(isLocalHost(host)).toBe(false);
    },
  );

  it('accepts local URLs, including IPv6, and refuses the rest', () => {
    expect(() => assertLocalDatabase('postgres://u:p@localhost:5455/app')).not.toThrow();
    expect(() => assertLocalDatabase('postgres://u:p@127.0.0.1/app')).not.toThrow();
    expect(() => assertLocalDatabase('postgres://u:p@[::1]:5432/app')).not.toThrow();
    expect(() => assertLocalDatabase('postgres://u:p@db.example.com/app')).toThrow(
      /local database/,
    );
  });
});

describe('database names and URLs', () => {
  it('reads the database name from a URL', () => {
    expect(databaseNameOf('postgres://u:p@localhost:5455/globetrot?sslmode=disable')).toBe(
      'globetrot',
    );
  });

  it('swaps the database and keeps credentials, host and port', () => {
    const next = new URL(withDatabase('postgres://user:pass@localhost:5455/globetrot', 'postgres'));
    expect([next.username, next.password, next.hostname, next.port, next.pathname]).toEqual([
      'user',
      'pass',
      'localhost',
      '5455',
      '/postgres',
    ]);
  });

  it.each(['globetrot', 'globetrot_test_0123456789abcdef', 'a1'])('accepts the name %s', (name) => {
    expect(() => assertSafeDatabaseName(name)).not.toThrow();
    expect(quoteIdentifier(name)).toBe(`"${name}"`);
  });

  it.each([
    '',
    'Globetrot',
    '1db',
    'a-b',
    'x"; DROP DATABASE postgres; --',
    'a'.repeat(64),
    'with space',
  ])('rejects the unsafe name %j (so it can never reach DDL)', (name) => {
    expect(() => assertSafeDatabaseName(name)).toThrow(/Unsafe database name/);
    expect(() => quoteIdentifier(name)).toThrow();
  });
});
