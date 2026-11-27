import { catalogs, SUPPORTED_LOCALES } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./actions', () => ({ saveMyMoney: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { GroupMoney, type GroupMoneyData } from './group-money';

const brl = (amount: string) => ({ amount, currency: 'BRL' });
const group: GroupMoneyData = {
  currency: 'BRL',
  custom: false,
  people: [
    {
      userId: 'ana',
      name: 'Ana',
      you: false,
      shareBp: null,
      share: brl('1500.00'),
      saved: brl('1500.00'),
      monthly: brl('0.00'),
      left: brl('0.00'),
      readyMonth: '2026-11',
    },
    {
      userId: 'bruno',
      name: 'Bruno',
      you: true,
      shareBp: null,
      share: brl('1500.00'),
      saved: brl('500.00'),
      monthly: brl('250.00'),
      left: brl('1000.00'),
      readyMonth: '2027-03',
    },
  ],
  group: { total: brl('3000.00'), saved: brl('2000.00'), left: brl('1000.00') },
  settlement: {
    transfers: [
      { from: 'bruno', to: 'ana', fromName: 'Bruno', toName: 'Ana', amount: brl('400.00') },
    ],
    paid: brl('1000.00'),
    unassigned: brl('50.00'),
  },
};

describe.each(SUPPORTED_LOCALES)('each person’s part (%s)', (locale) => {
  const copy = catalogs[locale].groupMoney;
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
      <GroupMoney tripId="t1" group={group} />
    </NextIntlClientProvider>,
  );

  it('says the person’s part and when they will have it, with their savings to edit', () => {
    expect(html).toContain(copy.title);
    expect(html).toMatch(/2027/);
    expect(html).toContain(copy.mySaved);
    expect(html).toContain('value="500"');
  });

  it('shows everyone’s progress in words as well as bars, and who pays whom', () => {
    expect(html.match(/role="progressbar"/g)).toHaveLength(2);
    expect(html).toContain(copy.youShort);
    expect(html).toMatch(/400/);
    expect(html).not.toMatch(/groupMoney\./);
  });
});
