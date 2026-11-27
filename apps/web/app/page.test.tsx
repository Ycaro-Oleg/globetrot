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
    for (const key of ['step1Title', 'step2Title', 'step3Title', 'pipTitle', 'faq5Q'] as const) {
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
    expect(html.match(/<details/g)).toHaveLength(4);
    expect(html).toContain('/world-halftone-ink.svg');
  });

  it.each(SUPPORTED_LOCALES)(
    'asks one question at a time, starting with where to go (%s)',
    (locale) => {
      const html = render(locale);
      const copy = catalogs[locale].landing.suggest;
      const text = visibleText(html);
      expect(text).toContain(copy.title);
      expect(text).toContain(copy.step.replace('{n}', '1').replace('{total}', '4'));
      expect(text).toContain(copy.next);
      expect(text).not.toContain(copy.stepMoney);
      expect(html).toMatch(/aria-pressed="true"[^>]*><strong>(Japan|Japão)<\/strong>/);
    },
  );

  it.each(SUPPORTED_LOCALES)(
    'closes with a call to action and the questions that hold people back (%s)',
    (locale) => {
      const text = visibleText(render(locale));
      const copy = catalogs[locale].landing;
      for (const key of ['closeTitle', 'faq5Q', 'faq6Q', 'faq7Q', 'faq8Q'] as const) {
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
    'shows the free plan, the two paid plans and the trip pass at their real prices, in USD until the visitor picks reais (%s)',
    (locale) => {
      const text = visibleText(render(locale));
      const plans = catalogs[locale].plans;
      expect(text).toContain(plans.free.name);
      expect(text).toMatch(locale === 'en' ? /\$0\b/ : /US\$\s?0\b/);
      expect(text).toContain(plans.pass.name);
      expect(text).toContain(plans.explorer.name);
      expect(text).toContain(plans.voyager.name);
      expect(text).toMatch(locale === 'en' ? /\$4\.99/ : /US\$\s?4,99/);
      expect(text).toMatch(locale === 'en' ? /\$9\.99/ : /US\$\s?9,99/);
      expect(text).not.toMatch(/placeholder|provisório/i);
    },
  );

  it.each(SUPPORTED_LOCALES)(
    'keeps a box for the live map, loaded when it comes into view, with the photo credits (%s)',
    (locale) => {
      const html = render(locale);
      const live = catalogs[locale].landing.liveDemo;
      expect(html).toContain(`aria-label="${live.map}"`);
      expect(visibleText(html)).toContain(live.loading);
      expect(visibleText(html)).toContain(live.credits);
      expect(html).toContain('https://commons.wikimedia.org/wiki/File:Sensoji_2023.jpg');
    },
  );

  it('never shows an amount in reais until the visitor picks them: USD is the default currency', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(visibleText(render(locale))).not.toMatch(/R\$/);
    }
  });
});
