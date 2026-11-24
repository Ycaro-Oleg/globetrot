import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DEFAULT_AFTER_LOGIN, hasForbiddenCharacter, safeNext, withNext } from './safe-next';

describe('safeNext', () => {
  it.each([
    ['/app', '/app'],
    ['/app/trips/42', '/app/trips/42'],
    ['/app?tab=budget', '/app?tab=budget'],
    ['/app#board', '/app#board'],
    ['/settings', '/settings'],
    ['/', '/'],
  ])('keeps the path %s', (value, expected) => {
    expect(safeNext(value)).toBe(expected);
  });

  it.each([
    ['https://evil.example', 'an absolute URL'],
    ['http://evil.example/app', 'an absolute http URL'],
    ['//evil.example', 'a protocol-relative URL'],
    ['//evil.example/app', 'a protocol-relative URL with a path'],
    ['///evil.example', 'three slashes'],
    ['/\\evil.example', 'a backslash after the slash'],
    ['\\\\evil.example', 'two backslashes'],
    ['/\t/evil.example', 'a tab that the browser drops'],
    ['/\n/evil.example', 'a newline that the browser drops'],
    ['/\r/evil.example', 'a carriage return'],
    ['/\u0000/evil.example', 'a NUL'],
    ['javascript:alert(1)', 'a javascript: URL'],
    ['data:text/html,hi', 'a data: URL'],
    ['evil.example', 'a bare host'],
    ['app', 'a relative path without a slash'],
    ['', 'an empty value'],
    ['  /app', 'leading whitespace'],
    ['/app\u007f', 'a DEL character'],
    ['/' + 'a'.repeat(3000), 'a very long value'],
  ])('falls back for %j (%s)', (value) => {
    expect(safeNext(value)).toBe(DEFAULT_AFTER_LOGIN);
  });

  it('falls back for values that are not a single string', () => {
    expect(safeNext(undefined)).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeNext(null)).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeNext(['/app', '/settings'])).toBe(DEFAULT_AFTER_LOGIN);
  });

  it('uses the fallback it is given', () => {
    expect(safeNext('https://evil.example', '/settings')).toBe('/settings');
  });

  it('percent-encoded slashes stay inside the path, on this site', () => {
    expect(safeNext('/%2F%2Fevil.example')).toBe('/%2F%2Fevil.example');
    expect(safeNext('/%5Cevil.example')).toBe('/%5Cevil.example');
  });

  it('whatever it returns is a path on this site, for any input at all', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 80 }), (value) => {
        const result = safeNext(value);
        expect(result.startsWith('/')).toBe(true);
        expect(result.startsWith('//')).toBe(false);
        expect(hasForbiddenCharacter(result)).toBe(false);
        expect(new URL(result, 'https://globetrot.invalid').origin).toBe(
          'https://globetrot.invalid',
        );
      }),
      { numRuns: 500 },
    );
  });

  it('whatever it returns for a hostile-looking prefix is the fallback', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('//', '/\\', 'https://', 'http://', 'javascript:', 'data:', '/\t/', '/\n/'),
        fc.string({ maxLength: 30 }),
        (prefix, rest) => {
          expect(safeNext(`${prefix}${rest}`)).toBe(DEFAULT_AFTER_LOGIN);
        },
      ),
    );
  });
});

describe('withNext', () => {
  it('keeps a destination other than the default, encoded', () => {
    expect(withNext('/signup', '/app/trips?example=japan')).toBe(
      '/signup?next=%2Fapp%2Ftrips%3Fexample%3Djapan',
    );
    expect(withNext('/login', DEFAULT_AFTER_LOGIN)).toBe('/login');
  });
});
