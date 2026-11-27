'use server';

import { isMotionChoice, isThemeChoice, UNIT_SYSTEMS } from '@globetrot/domain';
import { isSupportedLocale } from '@globetrot/i18n';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { LOCALE_COOKIE, localeCookieOptions } from '../i18n/locale';
import { apiInternalUrl } from '../lib/api-proxy';
import { MOTION_COOKIE, THEME_COOKIE } from '../lib/appearance';
import { createServerApiClient, sessionCookieHeader } from '../lib/stored-preferences';
import { NOT_SET } from './settings/options';

/**
 * The language switch on the public pages (landing, sign-in, sign-up, the language offer). Stores only a supported
 * language and touches no other preference. Someone signed in has a stored language that wins over the cookie,
 * so for them the choice is saved to their account too, or the switch would seem to do nothing. That save is
 * best effort: if the API is down or the session expired, the cookie still changes.
 */
export async function setScaffoldLocale(formData: FormData): Promise<void> {
  const value = formData.get('locale');
  if (typeof value !== 'string' || !isSupportedLocale(value)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, value, localeCookieOptions());
  const cookieHeader = sessionCookieHeader(store.getAll());
  if (!cookieHeader) return;
  try {
    const client = createServerApiClient({ cookieHeader, apiUrl: apiInternalUrl() });
    await client.PATCH('/v1/me/preferences', { body: { locale: value } });
  } catch {
    // The cookie is set; the stored language catches up the next time the person saves it.
  }
}

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === 'string' ? value : undefined;
};
/** An optional field: "Not set" clears it. */
const optional = (formData: FormData, name: string) => {
  const value = text(formData, name);
  return value === undefined ? undefined : value === NOT_SET ? null : value;
};

/**
 * Saves the settings form through the API as the signed-in user. The API validates every value and answers
 * with stable codes, so nothing is checked twice here. On success the language cookie is aligned with the
 * stored language, so signing out keeps the language the person chose.
 */
export async function savePreferences(formData: FormData): Promise<void> {
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  if (!cookieHeader) redirect('/settings');

  // Fields the form did not send stay out of the request, so they keep their value.
  const locale = text(formData, 'locale');
  const currency = text(formData, 'currency');
  const submittedUnits = text(formData, 'units');
  // Anything but a known unit system is left out, so the API keeps the stored value.
  const units = UNIT_SYSTEMS.find((system) => system === submittedUnits);
  const homeCountry = optional(formData, 'homeCountry');
  const nationality = optional(formData, 'nationality');
  const timeZone = optional(formData, 'timeZone');
  // A blank home city clears it.
  const rawHomeCity = formData.get('homeCity');
  const homeCity =
    typeof rawHomeCity === 'string' ? rawHomeCity.trim().slice(0, 120) || null : undefined;
  const submittedTheme = text(formData, 'theme');
  const submittedMotion = text(formData, 'motion');
  const theme = isThemeChoice(submittedTheme) ? submittedTheme : undefined;
  const motion = isMotionChoice(submittedMotion) ? submittedMotion : undefined;
  const body = {
    ...(locale === undefined ? {} : { locale }),
    ...(currency === undefined ? {} : { currency }),
    ...(homeCountry === undefined ? {} : { homeCountry }),
    ...(nationality === undefined ? {} : { nationality }),
    ...(timeZone === undefined ? {} : { timeZone }),
    ...(homeCity === undefined ? {} : { homeCity }),
    ...(units === undefined ? {} : { units }),
    ...(theme === undefined ? {} : { theme }),
    ...(motion === undefined ? {} : { motion }),
  };
  const client = createServerApiClient({ cookieHeader, apiUrl: apiInternalUrl() });
  const { error } = await client.PATCH('/v1/me/preferences', { body });

  if (error) {
    const fields = [...new Set((error.errors ?? []).map((issue) => issue.field))].join(',');
    redirect(`/settings?status=error:${encodeURIComponent(fields || 'form')}`);
  }
  if (locale !== undefined && isSupportedLocale(locale)) {
    store.set(LOCALE_COOKIE, locale, localeCookieOptions());
  }
  // Aligned with the stored choice, so signing out keeps the look the person chose on this device.
  if (theme) store.set(THEME_COOKIE, theme, localeCookieOptions());
  if (motion) store.set(MOTION_COOKIE, motion, localeCookieOptions());
  redirect('/settings?status=saved');
}
