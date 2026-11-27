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

import { initialOf } from './account-menu';
import { AppShell } from './app-shell';
import { ComingSoon, type ComingSoonSection } from './coming-soon';
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

  it('has the trip tools on the full map, each labelled', () => {
    const html = shell(locale, false, '/app/board');
    const found = navs(html);
    // Inline trip tabs, the account places, the phone's trip row (the bottom bar steps aside on the map).
    expect(found).toHaveLength(3);
    expect(html.match(new RegExp(`<nav[^>]*aria-label="${copy.nav.tripLabel}"`, 'g'))).toHaveLength(
      2,
    );
    const tools = [copy.nav.overview, copy.nav.board, copy.nav.budget, copy.nav.lists];
    expect(linkLabels(found[0] ?? '')).toEqual(tools);
    expect(linkLabels(found[1] ?? '')).toEqual([copy.nav.discover]);
    expect(linkLabels(found[2] ?? '')).toEqual(tools);
  });

  it('marks the current trip tool', () => {
    const [inline, places, row] = navs(shell(locale, false, '/app/board'));
    for (const markup of [inline, row]) {
      expect(markup?.match(/aria-current="page"/g)).toHaveLength(1);
      expect(markup).toMatch(new RegExp(`aria-current="page"[^>]*>${copy.nav.board}`));
    }
    expect(places).not.toContain('aria-current');
  });

  it.each(['/app/trip', '/app/budget', '/app/lists'])(
    'leaves the trip navigation to the workspace on %s and marks "Trip" in the bottom bar',
    (path) => {
      const html = shell(locale, false, path);
      expect(html).not.toMatch(new RegExp(`<nav[^>]*aria-label="${copy.nav.tripLabel}"`));
      const found = navs(html);
      // The account places and the bottom bar.
      expect(found).toHaveLength(2);
      expect(linkLabels(found[1] ?? '')).toEqual([
        copy.nav.trip,
        copy.nav.discover,
        copy.nav.profile,
      ]);
      expect(found[1]).toMatch(new RegExp(`aria-current="page"[\\s\\S]*?${copy.nav.trip}`));
    },
  );

  it('drops the trip row off trip pages and marks the account place instead', () => {
    const found = navs(shell(locale, false, '/app/discover'));
    expect(found).toHaveLength(3);
    const [inline, places, bottom] = found;
    expect(inline).not.toContain('aria-current');
    expect(places).toMatch(new RegExp(`aria-current="page"[^>]*>${copy.nav.discover}`));
    expect(bottom?.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it('hides the bottom bar on the map, where the route sheet sits', () => {
    const html = shell(locale, false, '/app/board');
    expect(html).not.toContain('data-shell-tabbar');
  });

  it('names the account button after the person and keeps the panel closed', () => {
    const html = shell(locale, false);
    const label = copy.account.menu.replace('{name}', 'Ana Souza');
    expect(html).toContain(`aria-label="${label}"`);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toMatch(/<div[^>]*hidden=""/);
    expect(html).toContain(copy.account.settings);
    expect(html).toContain(copy.account.signOut);
    expect(html).toContain('Ana Souza');
  });

  it('shows no Pip entry point while the flag is off', () => {
    const html = shell(locale, false);
    expect(html).not.toContain('/app/pip');
    expect(html).not.toContain(copy.pip.ask);
  });

  it('floats one Pip button when the flag is on', () => {
    const html = shell(locale, true);
    expect(html.match(/href="\/app\/pip[^"]*"/g)).toHaveLength(1);
    expect(html).toContain(copy.pip.ask);
  });

  it('leaves no catalog key unresolved', () => {
    const html = shell(locale, true);
    expect(html).not.toMatch(/shell\.[a-zA-Z.]+/);
  });
});

describe('placeholder pages', () => {
  const sections: ComingSoonSection[] = ['board'];

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

describe('Pip page', () => {
  it('is a 404 while the flag is off', async () => {
    await expect(PipPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('404');
  });
});

describe('account menu', () => {
  it('uses the first letter of the name as the avatar', () => {
    expect(initialOf('ana souza')).toBe('A');
    expect(initialOf('  émile')).toBe('É');
    expect(initialOf('')).toBe('•');
    expect(initialOf('🙂 Smile')).toBe('🙂');
  });
});
