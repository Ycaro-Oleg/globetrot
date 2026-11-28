import { catalogs, SUPPORTED_LOCALES, type SupportedLocale } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MoneyPanel } from './money-panel';
import type { BudgetMoney, SavingsHistory } from './money-series';

const brl = (amount: string) => ({ amount, currency: 'BRL' });
const BUDGET: BudgetMoney = {
  currency: 'BRL',
  total: brl('10000.00'),
  byCategory: [
    { category: 'flights', amount: brl('6000.00') },
    { category: 'stay', amount: brl('4000.00') },
  ],
  byStatus: [
    { status: 'paid', amount: brl('4000.00') },
    { status: 'estimate', amount: brl('6000.00') },
  ],
  savings: {
    status: 'saving',
    saved: brl('2500.00'),
    monthly: brl('3000.00'),
    left: brl('7500.00'),
    progressBasisPoints: 2500,
    readyMonth: '2027-03',
    departure: '2027-06-01',
    monthlyNeeded: brl('1250.00'),
    onTime: true,
  },
};
const HISTORY: SavingsHistory = {
  currency: 'BRL',
  saved: brl('2500.00'),
  start: brl('1000.00'),
  weeks: [{ week: '2026-W48', amount: brl('1500.00'), saved: brl('2500.00') }],
};

function render(locale: SupportedLocale, budget: BudgetMoney, variant: 'summary' | 'full') {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
      <MoneyPanel budget={budget} history={HISTORY} today="2026-11-27" variant={variant} />
    </NextIntlClientProvider>,
  );
}
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

describe.each(SUPPORTED_LOCALES)('money panel (%s)', (locale) => {
  const copy = catalogs[locale].money;
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
      .format(n)
      .replace(/\s/g, ' ');

  it('shows the headline figures with a heading, and links to the budget from the overview', () => {
    const html = render(locale, BUDGET, 'summary');
    const plain = text(html).replace(/\s/g, ' ');
    expect(html).toMatch(new RegExp(`<h2[^>]*>${copy.title}</h2>`));
    for (const label of [copy.total, copy.saved, copy.left, copy.monthly])
      expect(plain).toContain(label);
    for (const value of [10000, 2500, 7500, 3000]) expect(plain).toContain(money(value));
    expect(html).toContain('href="/app/budget"');
  });

  it('gives the savings chart a table of its numbers for screen readers', () => {
    const html = render(locale, BUDGET, 'summary');
    expect(html).toContain(`<caption>${copy.savingsChart}</caption>`);
    // The start, the week, today and three plan months.
    expect(html.match(/<tr><th scope="row">/g)).toHaveLength(6);
  });

  it('on the budget page adds where the money goes and how much is settled, with glyphs and words', () => {
    const html = render(locale, BUDGET, 'full');
    expect(html).toContain(`<caption>${copy.byCategory}</caption>`);
    expect(text(html)).toContain(copy.byStatus);
    const statuses = catalogs[locale].budgetPage.statuses;
    for (const status of ['paid', 'confirmed', 'estimate', 'unknown'] as const)
      expect(html).toContain(statuses[status]);
    expect(html).toContain('≈');
    expect(html).not.toContain('href="/app/budget"');
  });

  it('asks for costs before drawing anything when the trip has none', () => {
    const html = render(
      locale,
      { ...BUDGET, total: brl('0.00'), savings: { ...BUDGET.savings, status: 'no-costs' } },
      'summary',
    );
    expect(text(html)).toContain(copy.noCosts);
    expect(html).not.toContain('<caption>');
  });
});
