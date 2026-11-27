import { catalogs, SUPPORTED_LOCALES } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./actions', () => ({ saveMiles: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { MilesCard, type MilesData } from './miles-card';

const brl = (amount: string) => ({ amount, currency: 'BRL' });
const empty: MilesData = {
  programs: [],
  researchedOn: '2026-11-26',
  sources: ['MilhasBot (Sep 2026)'],
  applied: null,
  withMiles: null,
};
const withSmiles: MilesData = {
  ...empty,
  programs: [
    {
      program: 'smiles',
      balance: 100000,
      onTrip: 60000,
      value: { low: brl('1600.00'), high: brl('2200.00') },
    },
  ],
  applied: { low: brl('960.00'), high: brl('1320.00'), middle: brl('1140.00') },
  withMiles: { left: brl('4860.00'), readyMonth: '2027-04' },
};

describe.each(SUPPORTED_LOCALES)('miles card (%s)', (locale) => {
  const copy = catalogs[locale].miles;
  const render = (miles: MilesData) =>
    renderToStaticMarkup(
      <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
        <MilesCard tripId="t1" miles={miles} />
      </NextIntlClientProvider>,
    );

  it('starts folded for someone without miles, with the sources and the estimate note', () => {
    const html = render(empty);
    expect(html).toContain('<details');
    expect(html).toContain(copy.add);
    expect(html).toMatch(/MilhasBot/);
  });

  it('answers counting the miles put towards the trip', () => {
    const html = render(withSmiles);
    expect(html).not.toContain('<details');
    expect(html).toMatch(/60[.,]000/);
    expect(html).toMatch(/2027/);
    expect(html).toContain('value="60000"');
  });
});
