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
    const headline = copy.heroTitle.replace('<accent>', '').replace('</accent>', '');
    expect(visibleText(html)).toContain(headline);
    expect(visibleText(html)).toContain(copy.heroLead);
    expect(html).toContain(`aria-label="${catalogs[locale].auth.language}"`);
    expect(html).toContain('href="/signup"');
    expect(html).toContain('href="/login"');
    for (const key of ['step1Title', 'step2Title', 'step3Title', 'pipTitle', 'faq1Q'] as const) {
      expect(visibleText(html)).toContain(copy[key]);
    }
    expect(visibleText(html)).toContain(copy.trip3Body);
    expect(html).not.toMatch(/landing\.[a-zA-Z.]+/);
  });

  it('shows different copy per locale', () => {
    expect(render('en')).not.toBe(render('pt-BR'));
    expect(catalogs.en.landing.heroTitle).not.toBe(catalogs['pt-BR'].landing.heroTitle);
  });

  it.each([
    ['en', 'true', 'false'],
    ['pt-BR', 'false', 'true'],
  ] as const)('marks the active language button when the locale is %s', (locale, en, ptBR) => {
    const html = render(locale);
    expect(pressed(html, 'en')).toBe(en);
    expect(pressed(html, 'pt-BR')).toBe(ptBR);
  });

  it('has one coral call to action in the hero, the Pip demo and the FAQ as native disclosures', () => {
    const html = render('en');
    expect(visibleText(html)).toContain(catalogs.en.landing.approve);
    expect(html.match(/<details/g)).toHaveLength(8);
    expect(html).toContain('/world-halftone-blue.svg');
  });

  it.each(SUPPORTED_LOCALES)(
    'answers "Can I go?" with the savings rule before anyone types, and leads to sign-up (%s)',
    (locale) => {
      const html = render(locale);
      const copy = catalogs[locale].landing;
      const text = visibleText(html);
      expect(text).toContain(copy.calc.title);
      // US$3,000 trip, US$500 saved, US$300 a month: 9 months to go.
      expect(text).toContain(copy.calc.yes);
      expect(text).toMatch(/9/);
      expect(text).toContain(copy.calc.note);
      expect(html).toContain('href="/signup"');
      expect(html).toMatch(/type="range"/);
    },
  );

  it.each(SUPPORTED_LOCALES)(
    'closes with a call to action, honest facts and the questions that hold people back (%s)',
    (locale) => {
      const text = visibleText(render(locale));
      const copy = catalogs[locale].landing;
      for (const key of ['closeTitle', 'fact1Title', 'fact5Title', 'faq5Q', 'faq6Q'] as const) {
        expect(text).toContain(copy[key]);
      }
      expect(text).not.toContain('Most popular');
    },
  );

  it('sends each example card through sign-up, keeping the example', () => {
    const html = render('en');
    for (const id of ['portugal', 'japan', 'rio-de-la-plata']) {
      expect(html).toContain(`href="/signup?next=%2Fapp%2Ftrips%3Fexample%3D${id}"`);
    }
  });

  it.each(SUPPORTED_LOCALES)(
    'shows the free week and the two plans at their real prices, in USD (%s)',
    (locale) => {
      const text = visibleText(render(locale));
      const plans = catalogs[locale].plans;
      expect(text).toContain(plans.trial.price);
      expect(text).toContain(plans.explorer.name);
      expect(text).toContain(plans.voyager.name);
      expect(text).toMatch(locale === 'en' ? /\$4\.99/ : /US\$\s?4,99/);
      expect(text).toMatch(locale === 'en' ? /\$9\.99/ : /US\$\s?9,99/);
      expect(text).not.toMatch(/placeholder|provisório/i);
    },
  );

  it.each([
    ['en', 'board-en.webp'],
    ['pt-BR', 'board-pt-BR.webp'],
  ] as const)("shows a real screen of the app in the visitor's language (%s)", (locale, file) => {
    const html = render(locale);
    expect(html).toContain(`/landing/${file}`);
    expect(html).toContain(`/landing/${file.replace('board-', 'board-phone-')}`);
    expect(html).toContain(`alt="${catalogs[locale].landing.seeAlt}"`);
  });

  it('never shows an amount in reais: examples are in USD, the default currency', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(visibleText(render(locale))).not.toMatch(/R\$/);
    }
  });
});
