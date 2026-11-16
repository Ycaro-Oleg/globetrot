import { catalogs, SUPPORTED_LOCALES, type SupportedLocale } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SharedTrip } from '../../../lib/shared-trip';
import { SharedTripView } from './shared-trip-view';

const trip: SharedTrip = {
  title: 'Portugal',
  locale: 'en',
  startMonth: '2027-03',
  totalNights: 7,
  stops: [
    { name: 'Lisbon', countryCode: 'PT', nights: 4, latitude: 38.72, longitude: -9.14 },
    { name: 'Porto', countryCode: 'PT', nights: 3, latitude: 41.16, longitude: -8.63 },
  ],
  savings: { status: 'saving', progressBasisPoints: 2500, readyMonth: '2027-01' },
  amounts: null,
};

const render = (locale: SupportedLocale, value: SharedTrip = trip) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
      <SharedTripView trip={value} locale={locale} />
    </NextIntlClientProvider>,
  );
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe.each(SUPPORTED_LOCALES)('shared trip page (%s)', (locale) => {
  const copy = catalogs[locale].sharedTrip;

  it('shows the route drawn and listed, the month, the answer and one call to sign up', () => {
    const html = render(locale);
    expect(html).toContain('Lisbon');
    expect(html).toContain('Porto');
    expect(html.match(/<path /g)).toHaveLength(1);
    expect(html).toContain('role="meter"');
    expect(html).toContain('aria-valuenow="25"');
    expect(html).toContain('href="/signup"');
    expect(text(html)).toContain(copy.ctaTitle);
    expect(text(html)).toMatch(locale === 'en' ? /March 2027/ : /março de 2027/);
    expect(html).not.toMatch(/sharedTrip\./);
  });

  it('shows amounts only when they were shared', () => {
    expect(render(locale)).not.toMatch(/\$|US\$/);
    const withAmounts = render(locale, {
      ...trip,
      amounts: {
        total: { amount: '1000.00', currency: 'USD' },
        saved: { amount: '250.00', currency: 'USD' },
        monthly: { amount: '250.00', currency: 'USD' },
      },
    });
    expect(withAmounts).toMatch(locale === 'en' ? /\$1,000/ : /US\$\s?1\.000/);
  });

  it('leaves the answer out when the trip has no costs yet', () => {
    const html = render(locale, {
      ...trip,
      savings: { status: 'no-costs', progressBasisPoints: 0, readyMonth: null },
    });
    expect(html).not.toContain('role="meter"');
  });
});
