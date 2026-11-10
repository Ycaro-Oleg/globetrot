import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { chooseAppearance, MOTION_COOKIE, THEME_COOKIE, THEME_SCRIPT } from '../lib/appearance';
import { getStoredPreferences } from '../lib/request-preferences';
import { SITE_NAME } from './site';
import '@globetrot/tokens/tokens.css';
import '@globetrot/ui/styles.css';
import './globals.css';

export const metadata: Metadata = { title: SITE_NAME };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [locale, store, stored] = await Promise.all([
    getLocale(),
    cookies(),
    getStoredPreferences(),
  ]);
  const { theme, motion } = chooseAppearance(
    { theme: store.get(THEME_COOKIE)?.value, motion: store.get(MOTION_COOKIE)?.value },
    stored,
  );
  return (
    // An explicit theme is rendered here, so the first paint is right with no script. `system` starts as day and
    // the head script switches it before anything is painted, hence `suppressHydrationWarning`.
    <html
      lang={locale}
      data-theme={theme === 'system' ? 'day' : theme}
      data-theme-choice={theme}
      data-motion={motion}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
