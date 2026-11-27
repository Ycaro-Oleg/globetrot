import { catalogs, SUPPORTED_LOCALES, type SupportedLocale } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('./actions', () => ({ addExpense: vi.fn(), removeExpense: vi.fn(), saveSavings: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

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
    guess: null,
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
      ceiling: null,
      ceilingSlack: null,
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
    guess: false,
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
    guess: false,
    createdAt: '2026-11-08T12:05:00.000Z',
  },
];

function render(locale: SupportedLocale, props: Partial<Parameters<typeof BudgetView>[0]> = {}) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
      <BudgetView
        trip={{
          id: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8d99',
          title: 'Japan 2027',
          currency: 'USD',
          startDate: '2027-07-03',
        }}
        budget={budget()}
        expenses={EXPENSES}
        currencies={[
          { id: 'USD', label: 'USD · US Dollar' },
          { id: 'JPY', label: 'JPY · Yen' },
        ]}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

// The answer is recomputed with the domain rule against today's date: pin it.
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-13T12:00:00Z'));
});
afterAll(() => vi.useRealTimers());

describe.each(SUPPORTED_LOCALES)('budget (%s)', (locale) => {
  const copy = catalogs[locale].budgetPage;

  it('puts the answer first, with a coloured lead word and a status pill', () => {
    const html = render(locale);
    const plain = text(html);
    expect(html).toContain(`<h1`);
    expect(plain).toContain(copy.title);
    expect(plain).toContain(copy.leadYes);
    expect(plain).toContain(copy.pillOk);
    expect(html).toContain('aria-live="polite"');
    expect(plain.indexOf(copy.leadYes)).toBeLessThan(plain.indexOf(copy.totalKicker));
  });

  it('shows the total by status with a glyph and a word for each, never colour alone', () => {
    const plain = text(render(locale));
    for (const status of ['paid', 'confirmed', 'estimate', 'unknown'] as const) {
      expect(plain).toContain(copy.statuses[status]);
    }
    for (const glyph of ['●', '✓', '≈', '?']) expect(plain).toContain(glyph);
  });

  it('lists the expenses with the original amount when it was converted, and a remove button each', () => {
    const html = render(locale);
    expect(text(html)).toContain('Flights to Tokyo');
    expect(text(html)).toContain('Ryokan');
    expect(html.match(/aria-label="[^"]*Ryokan"/g)).toHaveLength(1);
    expect(html).toMatch(/title="[^"]*0\.0065/);
  });

  it('says honestly that Globetrot never holds money and estimates are not quotes', () => {
    const plain = text(render(locale));
    expect(plain).toContain(copy.estNote);
  });

  it('asks for a ceiling until there is one, then shows the slack or the overrun', () => {
    expect(text(render(locale))).toContain(copy.slackNone);
    const over = text(
      render(locale, {
        budget: budget({ ceiling: money('2000.00'), ceilingSlack: money('-225.00') }),
      }),
    );
    expect(over).toContain('▲');
  });

  it('has one coral call to action and no unresolved keys', () => {
    const html = render(locale);
    expect(html.match(/class="[^"]*cta[^"]*"/g)).toHaveLength(1);
    expect(html).not.toMatch(/budgetPage\.[a-zA-Z.]+/);
  });
});

describe.each(SUPPORTED_LOCALES)('the rough guess (%s)', (locale) => {
  const copy = catalogs[locale].budgetPage;
  const guess: ExpenseData = {
    id: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8d03',
    description: 'Whole-trip estimate',
    category: 'other',
    status: 'estimate',
    original: money('2500.00'),
    inTripCurrency: money('2500.00'),
    fx: null,
    guess: true,
    createdAt: '2026-11-08T11:00:00.000Z',
  };
  const withGuess = (amount: string, counted: string) =>
    ({ ...budget(), guess: { amount: money(amount), counted: money(counted) } }) as BudgetData;

  it('says real costs come out of it, and shows only what it still counts for', () => {
    const shown = text(
      render(locale, { expenses: [guess, ...EXPENSES], budget: withGuess('2500.00', '275.00') }),
    );
    // The words after the guess's amount, which every language keeps fixed.
    expect(shown).toContain(copy.guessLeft.split('{amount}')[1]!.trim());
    expect(shown).toMatch(locale === 'en' ? /\$275\.00/ : /US\$\s?275,00/);
    expect(shown).toMatch(locale === 'en' ? /\$2,500\.00/ : /US\$\s?2\.500,00/);
  });

  it('explains the guess on its own before any real cost', () => {
    const shown = text(
      render(locale, { expenses: [guess], budget: withGuess('2500.00', '2500.00') }),
    );
    expect(shown).toContain(copy.guessNote);
  });

  it('says when real costs cover it, so it can be removed', () => {
    const shown = text(
      render(locale, { expenses: [guess, ...EXPENSES], budget: withGuess('2500.00', '0.00') }),
    );
    expect(shown).toContain(copy.guessCovered);
  });
});

describe('budget answers', () => {
  it('says "not yet" and how much to save when the pace misses departure', () => {
    const plain = text(render('en', { budget: budget({ monthly: money('100.00') }) }));
    expect(plain).toContain('Not yet:');
    expect(plain).toContain('a month to make it');
  });

  it('asks for a monthly amount when there is none', () => {
    const plain = text(render('en', { budget: budget({ monthly: money('0.00') }) }));
    expect(plain).toContain(catalogs.en.budgetPage.restSetMonthly);
  });

  it('says so when everything is saved', () => {
    const plain = text(render('en', { budget: budget({ saved: money('3000.00') }) }));
    expect(plain).toContain(catalogs.en.budgetPage.restAlready);
  });

  it('asks for a cost before answering', () => {
    const plain = text(render('en', { budget: budget({}, '0.00'), expenses: [] }));
    expect(plain).toContain(catalogs.en.savings.noCosts);
    expect(plain).toContain(catalogs.en.budgetPage.empty);
  });

  it('leads to the trips without a trip, and says so when the budget cannot be read', () => {
    expect(text(render('en', { trip: null }))).toContain(catalogs.en.budgetPage.noTrip);
    expect(render('en', { budget: null })).toContain('role="alert"');
  });
});
