import { catalogs, SUPPORTED_LOCALES, type SupportedLocale } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

let pathname = '/app';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  // The real one throws this error shape; the test only needs a recognisable throw.
  notFound: () => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404');
  },
}));
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn() }));

import { AccountMenu, initialOf } from './account-menu';
import { AppShell } from './app-shell';
import { ComingSoon, type ComingSoonSection } from './coming-soon';
import MorePage from '../more/page';
import PipPage from '../pip/page';

function render(locale: SupportedLocale, element: ReactElement): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
      {element}
    </NextIntlClientProvider>,
  );
}

function shell(locale: SupportedLocale, pipEnabled: boolean, path = '/app'): string {
  pathname = path;
  return render(
    locale,
    <AppShell userName="Ana Souza" pipEnabled={pipEnabled}>
      <h1>Page</h1>
    </AppShell>,
  );
}

/** The `<nav>` elements, each as its inner markup. */
function navs(html: string): string[] {
  return [...html.matchAll(/<nav\b[^>]*>([\s\S]*?)<\/nav>/g)].map((match) => match[1] ?? '');
}

function linkLabels(markup: string): string[] {
  return [...markup.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)].map((match) =>
    (match[1] ?? '')
      .replace(/<svg[\s\S]*?<\/svg>/g, '')
      .replace(/<[^>]+>/g, '')
      .trim(),
  );
}

afterEach(() => {
  pathname = '/app';
  vi.unstubAllEnvs();
});

describe.each(SUPPORTED_LOCALES)('app shell (%s)', (locale) => {
  const copy = catalogs[locale].shell;

  it('has a skip link to the main region, which is the one main landmark', () => {
    const html = shell(locale, false);
    expect(html).toContain(`<a href="#main"`);
    expect(html).toContain(copy.skipLink);
    expect(html.match(/<main\b/g)).toHaveLength(1);
    expect(html).toMatch(/<main[^>]*id="main"/);
  });

  it('renders the page it wraps', () => {
    expect(shell(locale, false)).toContain('<h1>Page</h1>');
  });

  it('labels both navigations and lists the seven destinations on the rail', () => {
    const html = shell(locale, false);
    const found = navs(html);
    expect(found).toHaveLength(2);
    expect(html.match(new RegExp(`<nav[^>]*aria-label="${copy.nav.label}"`, 'g'))).toHaveLength(2);
    expect(linkLabels(found[0] ?? '')).toEqual([
      copy.nav.home,
      copy.nav.trips,
      copy.nav.board,
      copy.nav.days,
      copy.nav.budget,
      copy.nav.lists,
      copy.nav.passport,
    ]);
  });

  it('has exactly five tabs on the phone, ending with More', () => {
    const tabs = linkLabels(navs(shell(locale, false))[1] ?? '');
    expect(tabs).toEqual([
      copy.nav.board,
      copy.nav.days,
      copy.nav.budget,
      copy.nav.lists,
      copy.nav.more,
    ]);
  });

  it('marks the current page in both navigations, and only that page', () => {
    const found = navs(shell(locale, false, '/app/budget'));
    for (const markup of found) {
      expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
      expect(markup).toMatch(new RegExp(`aria-current="page"[^>]*>[\\s\\S]*?${copy.nav.budget}`));
    }
  });

  it('marks Home on /app and nothing in the tab bar', () => {
    const [rail, tabs] = navs(shell(locale, false, '/app'));
    expect(rail?.match(/aria-current="page"/g)).toHaveLength(1);
    expect(tabs).not.toContain('aria-current');
  });

  it('marks the More tab for the pages it holds', () => {
    const [, tabs] = navs(shell(locale, false, '/app/passport'));
    expect(tabs).toMatch(new RegExp(`aria-current="page"[^>]*>[\\s\\S]*?${copy.nav.more}`));
  });

  it('names the account button after the person and keeps the panel closed', () => {
    const html = shell(locale, false);
    const label = copy.account.menu.replace('{name}', 'Ana Souza');
    expect(html).toContain(`aria-label="${label}"`);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toMatch(/<div[^>]*hidden=""/);
    expect(html).toContain(copy.account.settings);
    expect(html).toContain(copy.account.signOut);
  });

  it('shows no Pip entry point while the flag is off', () => {
    const html = shell(locale, false);
    expect(html).not.toContain('/app/pip');
    expect(html).not.toContain(copy.pip.ask);
  });

  it('shows the Pip entry point in the wide header and as the phone button when the flag is on', () => {
    const html = shell(locale, true);
    expect(html.match(/href="\/app\/pip"/g)).toHaveLength(2);
    expect(html).toContain(`aria-label="${copy.pip.ask}"`);
  });

  it('leaves no catalog key unresolved', () => {
    const html = shell(locale, true);
    expect(html).not.toMatch(/shell\.[a-zA-Z.]+/);
  });
});

describe('placeholder pages', () => {
  const sections: ComingSoonSection[] = ['board', 'passport'];

  it.each(
    SUPPORTED_LOCALES.flatMap((locale) => sections.map((section) => [locale, section] as const)),
  )('%s %s says plainly that it is not built yet and leads home', (locale, section) => {
    const copy = catalogs[locale].shell;
    const html = render(locale, <ComingSoon section={section} />);
    expect(html).toContain(`<h1`);
    expect(html).toContain(copy.nav[section]);
    expect(html).toContain(copy.comingSoon[section]);
    expect(html).toContain(copy.comingSoon.label);
    expect(html).toContain('href="/app"');
  });

  it('has copy for every section in every language', () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const section of sections) {
        expect(catalogs[locale].shell.comingSoon[section].length).toBeGreaterThan(10);
      }
    }
  });
});

describe('More page', () => {
  it.each(SUPPORTED_LOCALES)('lists what the tab bar leaves out (%s)', (locale) => {
    const copy = catalogs[locale].shell;
    const html = render(locale, <MorePage />);
    expect(linkLabels(html)).toEqual([
      copy.nav.home,
      copy.nav.trips,
      copy.nav.passport,
      copy.nav.settings,
    ]);
    expect(html).toContain('href="/settings"');
  });

  it('adds Pip only when the flag is on', () => {
    vi.stubEnv('FEATURE_PIP', 'true');
    expect(render('en', <MorePage />)).toContain('href="/app/pip"');
  });
});

describe('Pip page', () => {
  it('is a 404 while the flag is off', () => {
    expect(() => render('en', <PipPage />)).toThrow('404');
  });

  it.each(SUPPORTED_LOCALES)('says Pip is not built when the flag is on (%s)', (locale) => {
    vi.stubEnv('FEATURE_PIP', 'true');
    const html = render(locale, <PipPage />);
    expect(html).toContain(catalogs[locale].shell.pip.notBuilt);
  });
});

describe('account menu', () => {
  it('uses the first letter of the name as the avatar', () => {
    expect(initialOf('ana souza')).toBe('A');
    expect(initialOf('  émile')).toBe('É');
    expect(initialOf('')).toBe('•');
    expect(initialOf('🙂 Smile')).toBe('🙂');
  });

  it('opens above in the rail and below in the top bar', () => {
    const above = render('en', <AccountMenu name="Ana" placement="above" />);
    const below = render('en', <AccountMenu name="Ana" placement="below" />);
    expect(above).toContain('panelAbove');
    expect(below).toContain('panelBelow');
  });
});
