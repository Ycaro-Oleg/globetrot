import { afterEach, describe, expect, it, vi } from 'vitest';
import { isStaleVersionError, reloadOnceForNewVersion } from './stale-version';

describe('isStaleVersionError', () => {
  it('recognises the error a tab from an older build gets', () => {
    const error = new Error(
      'Server Action "402f19" was not found on the server. \nRead more: https://nextjs.org/docs/messages/failed-to-find-server-action',
    );
    error.name = 'UnrecognizedActionError';
    expect(isStaleVersionError(error)).toBe(true);
    expect(isStaleVersionError(new Error('Failed to find Server Action "abc"'))).toBe(true);
  });

  it('leaves every other error alone', () => {
    expect(isStaleVersionError(new Error('fetch failed'))).toBe(false);
    expect(isStaleVersionError(null)).toBe(false);
    expect(isStaleVersionError('Server Action')).toBe(false);
  });
});

describe('reloadOnceForNewVersion', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reloads once, then not again within 30 seconds', () => {
    const store = new Map<string, string>();
    const reload = vi.fn();
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
      },
      location: { reload },
    });
    expect(reloadOnceForNewVersion(1_000_000)).toBe(true);
    expect(reloadOnceForNewVersion(1_010_000)).toBe(false);
    expect(reloadOnceForNewVersion(1_040_001)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('does not reload without storage, so it can never loop', () => {
    const reload = vi.fn();
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: () => {
          throw new Error('denied');
        },
      },
      location: { reload },
    });
    expect(reloadOnceForNewVersion()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
