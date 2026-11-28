import type { SupportedLocale } from '@globetrot/i18n';
import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { LOCALE_COOKIE, suggestedLocale } from '../i18n/locale';
import { chooseAppearance, MOTION_COOKIE, THEME_COOKIE, THEME_SCRIPT } from '../lib/appearance';
import { getStoredPreferences } from '../lib/request-preferences';
import { siteOrigin } from '../lib/site-url';
import { Analytics } from './analytics';
import { ReferralCapture } from './referral-capture';
import { LanguageSuggestion } from './language-suggestion';
import { SITE_NAME } from './site';
import { ThemeSync } from './theme-sync';
import '@globetrot/tokens/tokens.css';
import '@globetrot/ui/styles.css';
import './globals.css';

/** Absolute links (the social image) resolve against the request's own origin on every page. */
/** The phone's browser bar takes the app's ink colour, as the installed app does. */
export const viewport: Viewport = { themeColor: '#ffffff' };

export async function generateMetadata(): Promise<Metadata> {
  return { metadataBase: await siteOrigin(), title: SITE_NAME };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [locale, store, stored, requestHeaders] = await Promise.all([
    getLocale(),
    cookies(),
    getStoredPreferences(),
    headers(),
  ]);
  // Only someone who has never chosen a language (no cookie, not signed in) is offered one.
  const offer =
    stored || store.has(LOCALE_COOKIE)
      ? null
      : suggestedLocale(requestHeaders.get('accept-language'), locale as SupportedLocale);
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
        {/* The headline and text fonts, fetched with the page so the first words do not jump when they arrive. */}
        <link
          rel="preload"
          href="/fonts/bricolage-grotesque/latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
        <link
          rel="preload"
          href="/fonts/instrument-sans/latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
      </head>
      <body>
        <ThemeSync choice={theme} />
        <NextIntlClientProvider>
          {offer ? (
            <LanguageSuggestion suggested={offer} current={locale as SupportedLocale} />
          ) : null}
          {children}
          <Analytics />
          <ReferralCapture />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
