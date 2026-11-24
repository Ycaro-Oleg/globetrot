import { catalogs, SUPPORTED_LOCALES, type SupportedLocale } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { VisaData } from '../../../lib/trips';
import { PassportView } from './passport-view';

const VISAS: VisaData[] = [
  { countryCode: 'PT', city: 'Lisbon', stampedAt: '2027-05-02T10:00:00.000Z' },
  { countryCode: 'JP', city: 'Tokyo', stampedAt: '2027-04-01T10:00:00.000Z' },
];

function render(locale: SupportedLocale, visas: VisaData[] | null) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
      <PassportView visas={visas} />
    </NextIntlClientProvider>,
  );
}

describe('PassportView', () => {
  it.each(SUPPORTED_LOCALES)('lists each visa with its country, city and date (%s)', (locale) => {
    const html = render(locale, VISAS);
    const names = new Intl.DisplayNames([locale], { type: 'region' });
    expect(html).toContain(`<h1>${catalogs[locale].passportPage.title}</h1>`);
    expect(html).toContain(names.of('JP'));
    expect(html).toContain(names.of('PT'));
    expect(html).toContain('Lisbon');
    expect(html).toContain('Tokyo');
    expect((html.match(/<li /g) ?? []).length).toBe(2);
    expect(html).toContain(catalogs[locale].passportPage.disclaimer);
    expect(html).not.toMatch(/passportPage\.[a-zA-Z]+/);
  });

  it('counts the countries and dates the first stamp (the oldest)', () => {
    const html = render('en', VISAS);
    expect(html).toContain('2 countries visited.');
    expect(html).toContain('First stamp on April 1, 2027.');
  });

  it.each(SUPPORTED_LOCALES)('explains how to earn a visa when empty (%s)', (locale) => {
    const html = render(locale, []);
    expect(html).toContain(catalogs[locale].passportPage.emptyTitle);
    expect(html).toContain('href="/app/board"');
    expect(html).not.toContain('<ul');
  });

  it('says so when the passport cannot be loaded', () => {
    const html = render('pt-BR', null);
    expect(html).toContain('role="alert"');
    expect(html).toContain(catalogs['pt-BR'].passportPage.loadError);
  });
});
