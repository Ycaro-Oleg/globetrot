import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const set = vi.fn();
vi.mock('next/headers', () => ({ cookies: async () => ({ set }) }));

import { LOCALE_COOKIE } from '../i18n/locale';
import { setScaffoldLocale } from './actions';

function form(value?: FormDataEntryValue): FormData {
  const data = new FormData();
  if (value !== undefined) data.set('locale', value);
  return data;
}

describe('setScaffoldLocale', () => {
  beforeEach(() => set.mockClear());
  afterEach(() => vi.unstubAllEnvs());

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
});
