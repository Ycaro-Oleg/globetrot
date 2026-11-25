import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const set = vi.fn();
const getAll = vi.fn((): { name: string; value: string }[] => []);
vi.mock('next/headers', () => ({ cookies: async () => ({ set, getAll }) }));

import { LOCALE_COOKIE } from '../i18n/locale';
import { setScaffoldLocale } from './actions';

function form(value?: FormDataEntryValue): FormData {
  const data = new FormData();
  if (value !== undefined) data.set('locale', value);
  return data;
}

describe('setScaffoldLocale', () => {
  beforeEach(() => {
    set.mockClear();
    getAll.mockReset().mockReturnValue([]);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each(['en', 'pt-BR'])(
    'stores %s in one httpOnly cookie and sets nothing else',
    async (locale) => {
      await setScaffoldLocale(form(locale));
      expect(set).toHaveBeenCalledTimes(1);
      expect(set).toHaveBeenCalledWith(
        LOCALE_COOKIE,
        locale,
        expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/', secure: false }),
      );
      // The only cookie written is the language one: currency, country and nationality are untouched.
      expect(set.mock.calls.map(([name]) => name)).toEqual([LOCALE_COOKIE]);
    },
  );

  it('marks the cookie secure in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await setScaffoldLocale(form('pt-BR'));
    expect(set).toHaveBeenCalledWith(
      LOCALE_COOKIE,
      'pt-BR',
      expect.objectContaining({ secure: true }),
    );
  });

  it.each(['pt', 'fr', 'EN', 'pt-br', '', 'USD', '<script>alert(1)</script>'])(
    'ignores the unsupported value %j',
    async (value) => {
      await setScaffoldLocale(form(value));
      expect(set).not.toHaveBeenCalled();
    },
  );

  it('ignores a missing value and a file upload', async () => {
    await setScaffoldLocale(form());
    await setScaffoldLocale(form(new File(['pt-BR'], 'locale.txt')));
    expect(set).not.toHaveBeenCalled();
  });

  it('makes no API call for an anonymous visitor', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await setScaffoldLocale(form('pt-BR'));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('saves the language to the account of someone signed in, whose stored language wins', async () => {
    getAll.mockReturnValue([{ name: 'globetrot.session_token', value: 'abc' }]);
    vi.stubEnv('API_INTERNAL_URL', 'http://api.internal:4000');
    const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    await setScaffoldLocale(form('en'));
    expect(set).toHaveBeenCalledWith(LOCALE_COOKIE, 'en', expect.anything());
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const request = (fetchSpy.mock.calls[0] as unknown as [Request])[0];
    expect(request.method).toBe('PATCH');
    expect(request.url).toBe('http://api.internal:4000/v1/me/preferences');
    expect(request.headers.get('cookie')).toBe('globetrot.session_token=abc');
    expect(await request.json()).toEqual({ locale: 'en' });
  });

  it('still changes the cookie when the API cannot save the language', async () => {
    getAll.mockReturnValue([{ name: 'globetrot.session_token', value: 'abc' }]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('down');
      }),
    );
    await expect(setScaffoldLocale(form('pt-BR'))).resolves.toBeUndefined();
    expect(set).toHaveBeenCalledWith(LOCALE_COOKIE, 'pt-BR', expect.anything());
  });
});
