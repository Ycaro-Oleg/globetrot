import { catalogs, SUPPORTED_LOCALES, type SupportedLocale } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./actions', () => ({}));

import type { ProposalData } from './actions';
import { PipView } from './pip-view';

const TRIP = { id: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8d99', title: 'Japan 2027', currency: 'USD' };
const KYOTO = '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8d02';
const proposal = (extra: Partial<ProposalData> = {}): ProposalData => ({
  id: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c9d01',
  tripId: TRIP.id,
  request: 'Slower please',
  summary: 'A calmer pace.',
  currency: 'USD',
  changes: [
    { kind: 'setNights', stopId: KYOTO, nights: 4, reason: 'More time.' },
    { kind: 'addExpense', category: 'food', description: 'Meals', amount: '300', reason: '' },
  ],
  status: 'proposed',
  applied: [],
  undoable: false,
  createdAt: '2026-11-13T10:00:00.000Z',
  decidedAt: null,
  ...extra,
});

function render(locale: SupportedLocale, initial: ProposalData[], trip: typeof TRIP | null = TRIP) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
      <PipView trip={trip} stops={[{ id: KYOTO, name: 'Kyoto' }]} initial={initial} />
    </NextIntlClientProvider>,
  );
}
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe.each(SUPPORTED_LOCALES)('Pip (%s)', (locale) => {
  const copy = catalogs[locale].pipPage;

  it('says what is sent to the model, and offers ideas', () => {
    const plain = text(render(locale, []));
    expect(plain).toContain('DeepSeek');
    expect(plain).toContain(copy.suggestions.packing);
  });

  it('shows a waiting proposal as a list to tick, with estimates marked', () => {
    const html = render(locale, [proposal()]);
    const plain = text(html);
    expect(plain).toContain('A calmer pace.');
    expect(plain).toContain('Kyoto');
    expect(plain).toContain(copy.estimate);
    expect(plain).toContain(copy.discard);
    expect((html.match(/type="checkbox"/g) ?? []).length).toBe(2);
    expect(html).not.toMatch(/type="checkbox"[^>]*disabled/);
  });

  it('lists earlier proposals with a glyph and a word', () => {
    const plain = text(render(locale, [proposal({ status: 'discarded' })]));
    expect(plain).toContain(copy.statuses.discarded);
  });

  it('asks for a trip first when there is none', () => {
    expect(text(render(locale, [], null))).toContain(copy.noTrip);
  });
});
