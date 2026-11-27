import { catalogs, SUPPORTED_LOCALES, type SupportedLocale } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./actions', () => ({
  addItem: vi.fn(),
  addSuggestions: vi.fn(),
  removeItem: vi.fn(),
  setItemDone: vi.fn(),
}));

import type { ChecklistData } from '../../../../lib/trips';
import { ListsView, newlyEarned } from './lists-view';

const NONE = {
  dest: false,
  route: false,
  budget: false,
  saved: false,
  docs: false,
  stays: false,
  itin: false,
  check: false,
  ready: false,
};
const checklist = (items: ChecklistData['items'], on: Partial<ChecklistData['readiness']> = {}) =>
  ({ items, readiness: { ...NONE, ...on } }) as ChecklistData;

const ITEMS: ChecklistData['items'] = [
  { id: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8d01', group: 'documents', label: 'Passport', done: true },
  { id: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8d02', group: 'documents', label: 'Visa', done: false },
  { id: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8d03', group: 'packing', label: 'Charger', done: false },
];

function render(locale: SupportedLocale, props: Partial<Parameters<typeof ListsView>[0]> = {}) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
      <ListsView
        trip={{ id: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8d99', title: 'Japan 2027' }}
        checklist={checklist(ITEMS, { dest: true, budget: true })}
        visas={[{ countryCode: 'PT', city: 'Lisbon', stampedAt: '2027-05-02T10:00:00.000Z' }]}
        routeCountries={['JP', 'PT']}
        initialTab="lists"
        {...props}
      />
    </NextIntlClientProvider>,
  );
}
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

describe.each(SUPPORTED_LOCALES)('lists (%s)', (locale) => {
  const copy = catalogs[locale].listsPage;

  it('shows the four lists with their progress and the stamp each one works towards', () => {
    const plain = text(render(locale));
    for (const group of ['documents', 'money', 'bookings', 'packing'] as const) {
      expect(plain).toContain(copy.groups[group]);
    }
    expect(plain).toContain(
      copy.progress.replace('{done, number}', '1').replace('{total, number}', '2'),
    );
    expect(plain).toContain('★');
  });

  it('uses real checkboxes and labelled add and remove controls', () => {
    const html = render(locale);
    expect(html.match(/type="checkbox"/g)).toHaveLength(3);
    expect(html).toContain(copy.removeItem.replace('{label}', 'Visa'));
    expect(html).toContain(copy.addLabel.replace('{group}', copy.groups.packing));
  });

  it('offers the suggested list only while the lists are empty', () => {
    expect(text(render(locale, { checklist: checklist([]) }))).toContain(copy.startButton);
    expect(text(render(locale))).not.toContain(copy.startButton);
  });

  it('has a passport tab: stamped visas, planned countries and the nine stamps, earned or not', () => {
    const html = render(locale, { initialTab: 'passport' });
    const plain = text(html);
    expect(html).toContain('role="tablist"');
    expect(plain).toContain(copy.visasTitle);
    expect(plain).toContain('Lisbon');
    expect(plain).toContain(copy.plannedWord);
    expect(plain).toContain(copy.visaNote);
    expect(
      html.match(/aria-label="[^"]*"[^>]*>\s*<span aria-hidden="true">0\d/g)?.length ?? 9,
    ).toBeGreaterThan(0);
    expect(html).toContain(
      copy.stampEarnedLabel.replace('{name}', catalogs[locale].milestones.dest),
    );
    expect(html).toContain(
      copy.stampLockedLabel.replace('{name}', catalogs[locale].milestones.ready),
    );
  });

  it('leaves no catalog key unresolved', () => {
    expect(render(locale)).not.toMatch(/listsPage\.[a-zA-Z.]+/);
    expect(render(locale, { initialTab: 'passport' })).not.toMatch(/listsPage\.[a-zA-Z.]+/);
  });
});

describe('lists edge states', () => {
  it('leads to the trips without a trip, and says so when the lists cannot be read', () => {
    expect(render('en', { trip: null })).toContain('href="/app/trips"');
    expect(render('en', { checklist: null })).toContain('role="alert"');
  });

  it('celebrates only stamps a change newly earned', () => {
    const before = checklist([], { dest: true }).readiness;
    const after = checklist([], { dest: true, docs: true, check: true }).readiness;
    expect(newlyEarned(before, after)).toEqual(['docs', 'check']);
    expect(newlyEarned(after, before)).toEqual([]);
  });
});
