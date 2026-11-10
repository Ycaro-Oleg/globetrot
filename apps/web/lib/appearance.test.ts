import { describe, expect, it } from 'vitest';
import { chooseAppearance, THEME_SCRIPT } from './appearance';

describe('chooseAppearance', () => {
  it('falls back to the system theme and full motion', () => {
    expect(chooseAppearance({}, null)).toEqual({ theme: 'system', motion: 'full' });
  });

  it('uses the cookies for an anonymous visitor', () => {
    expect(chooseAppearance({ theme: 'red-eye', motion: 'reduced' }, null)).toEqual({
      theme: 'red-eye',
      motion: 'reduced',
    });
  });

  it('lets the stored choice of a signed-in person win over the cookies', () => {
    expect(
      chooseAppearance({ theme: 'red-eye', motion: 'reduced' }, { theme: 'day', motion: 'full' }),
    ).toEqual({ theme: 'day', motion: 'full' });
  });

  it('ignores unknown values, from the cookie or from the store', () => {
    expect(chooseAppearance({ theme: 'night', motion: 'none' }, null)).toEqual({
      theme: 'system',
      motion: 'full',
    });
    expect(chooseAppearance({ theme: 'red-eye' }, { theme: 'purple', motion: 'x' })).toEqual({
      theme: 'red-eye',
      motion: 'full',
    });
  });
});

describe('the head script', () => {
  // Run it against a fake document and a fake media query: it must follow the system only for `system`.
  function run(choice: string, dark: boolean) {
    const attributes: Record<string, string> = { 'data-theme-choice': choice, 'data-theme': 'day' };
    const listeners: (() => void)[] = [];
    const query = {
      matches: dark,
      addEventListener: (_: string, listener: () => void) => listeners.push(listener),
    };
    const documentElement = {
      getAttribute: (name: string) => attributes[name] ?? null,
      setAttribute: (name: string, value: string) => void (attributes[name] = value),
    };
    new Function('document', 'matchMedia', THEME_SCRIPT)({ documentElement }, () => query);
    return { attributes, query, listeners };
  }

  it('picks red-eye for a dark system and day for a light one', () => {
    expect(run('system', true).attributes['data-theme']).toBe('red-eye');
    expect(run('system', false).attributes['data-theme']).toBe('day');
  });

  it('follows the system when it changes', () => {
    const { attributes, query, listeners } = run('system', false);
    query.matches = true;
    for (const listener of listeners) listener();
    expect(attributes['data-theme']).toBe('red-eye');
  });

  it('leaves an explicit choice alone', () => {
    expect(run('day', true).attributes['data-theme']).toBe('day');
    expect(run('red-eye', false).attributes['data-theme']).toBe('day'); // the server renders it; the script does nothing
  });
});
