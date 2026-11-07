'use server';

import { isSupportedLocale } from '@globetrot/i18n';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE } from '../i18n/locale';

/** Store only supported locale choices; this temporary scaffold does not alter other preferences. */
export async function setScaffoldLocale(formData: FormData): Promise<void> {
  const value = formData.get('locale');
  if (typeof value !== 'string' || !isSupportedLocale(value)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}
