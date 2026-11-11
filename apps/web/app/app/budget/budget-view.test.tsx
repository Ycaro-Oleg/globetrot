import { catalogs, SUPPORTED_LOCALES, type SupportedLocale } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./actions', () => ({ addExpense: vi.fn(), removeExpense: vi.fn(), saveSavings: vi.fn() }));

import type { BudgetData, ExpenseData } from '../../../lib/trips';
import { BudgetView } from './budget-view';

const money = (amount: string, currency = 'USD') => ({ amount, currency });
const zeroes = (keys: string[], key: 'category' | 'status') =>
  keys.map((value) => ({ [key]: value, amount: money('0.00') }));
const CATEGORIES = [
  'flights',
  'stay',
  'local_transport',
  'intercity_transport',
  'food',
  'experiences',
  'insurance',
  'documents',
  'taxes',
  'shopping',
  'buffer',
  'other',
];

function budget(overrides: Partial<BudgetData['savings']> = {}, total = '2225.00'): BudgetData {
  return {
    currency: 'USD',
    total: money(total),
    byCategory: zeroes(CATEGORIES, 'category').map((entry) =>
      entry.category === 'flights'
        ? { ...entry, amount: money('1250.00') }
        : entry.category === 'stay'
          ? { ...entry, amount: money('975.00') }
          : entry,
    ) as BudgetData['byCategory'],
    byStatus: zeroes(['estimate', 'confirmed', 'paid', 'unknown'], 'status').map((entry) =>
      entry.status === 'estimate'
        ? { ...entry, amount: money('1250.00') }
        : entry.status === 'paid'
          ? { ...entry, amount: money('975.00') }
          : entry,
    ) as BudgetData['byStatus'],
    savings: {
      status: 'saving',
      saved: money('500.00'),
      monthly: money('300.00'),
      left: money('1725.00'),
      progressBasisPoints: 2247,
      monthsNeeded: 6,
      readyMonth: '2027-05',
      departure: '2027-07-03',
      departed: false,
      monthsUntilDeparture: 8,
      monthlyNeeded: money('220.00'),
      onTime: true,
      ...overrides,
    },
  } as BudgetData;
}

const EXPENSES: ExpenseData[] = [
  {
    id: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8d01',
    description: 'Flights to Tokyo',
    category: 'flights',
    status: 'estimate',
    original: money('1250.00'),
    inTripCurrency: money('1250.00'),
    fx: null,
    createdAt: '2026-11-08T12:00:00.000Z',
  },
  {
    id: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8d02',
    description: 'Ryokan',
    category: 'stay',
    status: 'paid',
    original: money('150000', 'JPY'),
    inTripCurrency: money('975.00'),
    fx: { rate: '0.0065', source: 'manual', asOf: '2026-11-01' },
    createdAt: '2026-11-08T12:05:00.000Z',
  },
];

function render(locale: SupportedLocale, props: Partial<Parameters<typeof BudgetView>[0]> = {}) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
      <BudgetView
        trip={{ id: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8d99', title: 'Japan 2027', currency: 'USD' }}
        budget={budget()}
        expenses={EXPENSES}
        currencies={[
          { id: 'USD', label: 'USD · US Dollar' },
          { id: 'JPY', label: 'JPY · Yen' },
        ]}
        status={undefined}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

describe('budget view', () => {
  it('answers yes with the month and the monthly amount, in the language of the page', () => {
    expect(text(render('en'))).toMatch(/Yes — by May 2027, if you put aside \$300\.00 a month/);
    expect(text(render('pt-BR'))).toMatch(/Sim.*maio de 2027.*US\$\s?300,00/);
  });

  it('says "almost" when the goal is reached after leaving', () => {
    const html = render('en', { budget: budget({ readyMonth: '2027-09', onTime: false }) });
    expect(text(html)).toMatch(
      /Almost\. At \$300\.00 a month you.ll have it by September 2027 — after you leave on July 3, 2027/,
    );
  });

  it('asks for a monthly amount, offering what would be ready by departure', () => {
    const html = render('en', {
      budget: budget({
        monthly: money('0.00'),
        readyMonth: null,
        monthsNeeded: null,
        onTime: false,
      }),
    });
    expect(text(html)).toContain(catalogs.en.budgetPage.setMonthly);
    expect(text(html)).toContain('To leave on July 3, 2027, put aside $220.00 a month.');
  });

  it('says there is nothing to save for before any cost, and hides the progress bar', () => {
    const html = render('en', { budget: budget({ status: 'no-costs' }, '0.00'), expenses: [] });
    expect(text(html)).toContain(catalogs.en.savings.noCosts);
    expect(html).not.toContain('<progress');
    expect(text(html)).toContain(catalogs.en.budgetPage.noExpenses);
  });

  it('shows the progress as a labelled progress bar with the amounts', () => {
    const html = render('en');
    expect(html).toMatch(
      /<progress[^>]*value="2247"[^>]*max="10000"[^>]*aria-label="Saved \$500\.00 of \$2,225\.00"/,
    );
    expect(text(html)).toContain('22% · $500.00 of $2,225.00');
  });

  it.each(SUPPORTED_LOCALES)(
    'lists each cost with its category, a status with a glyph and word, and the amount in the trip currency (%s)',
    (locale) => {
      const copy = catalogs[locale].budgetPage;
      const html = render(locale);
      expect(text(html)).toContain('Flights to Tokyo');
      expect(text(html)).toContain(copy.categories.flights);
      expect(html).toContain('gt-status--estimate');
      expect(html).toContain('gt-status--paid');
      expect(text(html)).toContain(copy.statuses.paid);
      // one remove button per cost, named for it
      expect(
        html.match(
          new RegExp(`aria-label="${copy.removeExpense.replace('{description}', 'Ryokan')}"`, 'g'),
        ),
      ).toHaveLength(1);
    },
  );

  it('shows how a foreign cost was converted: what was typed, the rate and the day', () => {
    const t = text(render('en'));
    expect(t).toContain('¥150,000 at 0.0065 USD each · rate you typed on Nov 1, 2026');
    expect(t).toContain('$975.00');
  });

  it('breaks the total down by category and by status, leaving out the empty ones', () => {
    const t = text(render('en'));
    expect(t).toContain('By category');
    expect(t).toMatch(/Flights \$1,250\.00/);
    expect(t).toMatch(/Stays \$975\.00/);
    expect(t).not.toMatch(/Food \$0\.00/);
  });

  it.each(SUPPORTED_LOCALES)('has the forms, with labels for every field (%s)', (locale) => {
    const copy = catalogs[locale].budgetPage;
    const html = render(locale);
    for (const key of ['description', 'category', 'status', 'amount', 'currency'] as const) {
      expect(text(html)).toContain(copy[key]);
    }
    for (const name of [
      'description',
      'category',
      'status',
      'amount',
      'currency',
      'fxRate',
      'saved',
      'monthly',
    ]) {
      expect(html, name).toMatch(new RegExp(`name="${name}"`));
    }
    expect(html.match(/name="tripId"/g)).toHaveLength(2 + EXPENSES.length);
    expect(text(html)).toContain(copy.fxHelp.replaceAll('{currency}', 'USD'));
  });

  it('offers every category and status', () => {
    const html = render('en');
    for (const category of CATEGORIES) expect(html).toContain(`value="${category}"`);
    for (const status of ['estimate', 'confirmed', 'paid', 'unknown'])
      expect(html).toContain(`value="${status}"`);
  });

  it('shows a confirmation or an alert after an action, and an error when the budget cannot load', () => {
    expect(render('en', { status: 'expense-added' })).toContain('role="status"');
    expect(render('en', { status: 'expense-error' })).toContain('role="alert"');
    expect(render('en', { status: 'nonsense' })).not.toContain('role="alert"');
    const failed = render('en', { budget: null });
    expect(text(failed)).toContain(catalogs.en.budgetPage.loadError);
    expect(failed).toContain('role="alert"');
  });

  it.each(SUPPORTED_LOCALES)(
    'explains there is no trip yet and links to the trips (%s)',
    (locale) => {
      const html = render(locale, { trip: null, budget: null });
      expect(text(html)).toContain(catalogs[locale].budgetPage.noTrip);
      expect(html).toContain('href="/app/trips"');
    },
  );
});
