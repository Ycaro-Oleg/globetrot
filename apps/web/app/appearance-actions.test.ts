import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = new Map<string, string>();
const set = vi.fn((name: string, value: string) => void jar.set(name, value));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    set,
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
  }),
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

import { MOTION_COOKIE, THEME_COOKIE } from '../lib/appearance';
import { savePreferences } from './actions';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let requests: Request[];
let respond: () => Response;

beforeEach(() => {
  jar.clear();
  set.mockClear();
  requests = [];
  respond = () => json(200, {});
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: Request) => {
      requests.push(input);
      return respond();
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const signIn = () => jar.set('globetrot.session_token', 'abc');

describe('savePreferences with the appearance', () => {
  const form = (fields: Record<string, string>) => {
    const data = new FormData();
    for (const [name, value] of Object.entries(fields)) data.set(name, value);
    return data;
  };
  const run = async (data: FormData) => {
    try {
      await savePreferences(data);
    } catch (error) {
      return (error as Error).message;
    }
    return 'no redirect';
  };

  it('sends the theme and motion with the rest and aligns the cookies', async () => {
    signIn();
    const outcome = await run(form({ locale: 'en', theme: 'red-eye', motion: 'reduced' }));
    expect(outcome).toBe('REDIRECT /settings?status=saved');
    expect(await requests[0]!.json()).toEqual({
      locale: 'en',
      theme: 'red-eye',
      motion: 'reduced',
    });
    expect(jar.get(THEME_COOKIE)).toBe('red-eye');
    expect(jar.get(MOTION_COOKIE)).toBe('reduced');
  });

  it('leaves out a theme it does not know, so the stored one stays', async () => {
    signIn();
    await run(form({ locale: 'en', theme: 'night', motion: 'none' }));
    expect(await requests[0]!.json()).toEqual({ locale: 'en' });
    expect(jar.has(THEME_COOKIE)).toBe(false);
  });

  it('does not touch the look cookies when the API refuses the save', async () => {
    signIn();
    respond = () => json(422, { code: 'VALIDATION', errors: [{ field: 'locale' }] });
    expect(await run(form({ locale: 'fr', theme: 'day' }))).toContain(
      'REDIRECT /settings?status=error',
    );
    expect(jar.has(THEME_COOKIE)).toBe(false);
  });
});
