import { catalogs, SUPPORTED_LOCALES, type SupportedLocale } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The server action only matters on submit; keep `next/headers` out of the render test.
vi.mock('./actions', () => ({ setScaffoldLocale: vi.fn() }));

import HomePage from './page';

function render(locale: SupportedLocale): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
      <HomePage />
    </NextIntlClientProvider>,
  );
}

/** What a reader sees: markup and React's inline form-replay script (which contains `$$`) removed. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The pressed state of the language button whose submitted value is `value`. */
function pressed(html: string, value: string): string | undefined {
  const button = new RegExp(`<button[^>]*value="${value}"[^>]*>`).exec(html)?.[0];
  return button && /aria-pressed="(true|false)"/.exec(button)?.[1];
}

describe('Globetrot landing page', () => {
  it.each(SUPPORTED_LOCALES)('renders its copy from the shared %s catalog', (locale) => {
    const html = render(locale);
    const copy = catalogs[locale].landing;
    const headline = copy.headline.replace('<accent>', '').replace('</accent>', '');
    expect(visibleText(html)).toContain(headline);
    expect(visibleText(html)).toContain(copy.heroCopy);
    expect(html).toContain(`aria-label="${catalogs[locale].auth.language}"`);
    expect(html).toContain('href="/signup"');
    expect(html).toContain('href="/login"');
    expect(visibleText(html)).toContain(copy.step1Title);
    expect(visibleText(html)).toContain(copy.step4Title);
    expect(visibleText(html)).toContain(copy.stage5Title);
    expect(visibleText(html)).toContain(copy.trip3Body);
  });

  it('shows different copy per locale', () => {
    expect(render('en')).not.toBe(render('pt-BR'));
    expect(catalogs.en.landing.headline).not.toBe(catalogs['pt-BR'].landing.headline);
  });

  it.each([
    ['en', 'true', 'false'],
    ['pt-BR', 'false', 'true'],
  ] as const)('marks the active language button when the locale is %s', (locale, en, ptBR) => {
    const html = render(locale);
    expect(pressed(html, 'en')).toBe(en);
    expect(pressed(html, 'pt-BR')).toBe(ptBR);
  });

  it('renders the full map-led story, budget planner, examples and product previews', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const html = visibleText(render(locale));
      const copy = catalogs[locale].landing;
      expect(html).toContain(copy.moneyEyebrow);
      expect(html).toContain(copy.pipChanges);
      expect(html).toContain(copy.platformPhone);
      expect(html).toContain(copy.finalButton);
    }
  });

  it('opens a copyable example trip from each postcard', () => {
    const html = render('en');
    for (const id of ['portugal', 'japan', 'rio-de-la-plata']) {
      expect(html).toContain(`href="/app/trips?example=${id}"`);
    }
  });

  it.each(SUPPORTED_LOCALES)(
    'shows the mock plans in USD, labelled as placeholder pricing (%s)',
    (locale) => {
      const text = visibleText(render(locale));
      const copy = catalogs[locale].landing;
      expect(text).toContain(copy.pricingPlaceholder);
      expect(text).toContain(copy.plans.explorer.name);
      expect(text).toMatch(locale === 'en' ? /\$4\.99 \/ month/ : /US\$\s?4,99 \/ mês/);
    },
  );

  it('never shows an amount in reais: examples are in USD, the default currency', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(visibleText(render(locale))).not.toMatch(/R\$/);
    }
  });
});
