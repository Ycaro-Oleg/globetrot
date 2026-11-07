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
    .replace(/\s+/g, ' ')
    .trim();
}

/** The pressed state of the language button whose submitted value is `value`. */
function pressed(html: string, value: string): string | undefined {
  const button = new RegExp(`<button[^>]*value="${value}"[^>]*>`).exec(html)?.[0];
  return button && /aria-pressed="(true|false)"/.exec(button)?.[1];
}

describe('web scaffold home page', () => {
  it.each(SUPPORTED_LOCALES)('renders its copy from the shared %s catalog', (locale) => {
    const html = render(locale);
    const copy = catalogs[locale].webScaffold;
    expect(html).toContain(copy.headline);
    expect(html).toContain(copy.description);
    expect(html).toContain(`aria-label="${copy.language}"`);
    expect(html).toContain(copy.english);
    expect(html).toContain(copy.portuguese);
  });

  it('shows different copy per locale', () => {
    expect(render('en')).not.toBe(render('pt-BR'));
    expect(catalogs.en.webScaffold.headline).not.toBe(catalogs['pt-BR'].webScaffold.headline);
  });

  it.each([
    ['en', 'true', 'false'],
    ['pt-BR', 'false', 'true'],
  ] as const)('marks the active language button when the locale is %s', (locale, en, ptBR) => {
    const html = render(locale);
    expect(pressed(html, 'en')).toBe(en);
    expect(pressed(html, 'pt-BR')).toBe(ptBR);
  });

  it('keeps language choice separate from currency and country', () => {
    for (const locale of SUPPORTED_LOCALES) {
      // No currency symbol, code or country is shown or implied by choosing a language.
      expect(visibleText(render(locale))).not.toMatch(/[$€£¥]|\b(USD|BRL|EUR)\b/);
    }
  });
});
