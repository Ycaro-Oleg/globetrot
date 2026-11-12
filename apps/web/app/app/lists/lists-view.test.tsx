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

import type { ChecklistData } from '../../../lib/trips';
import { ListsView } from './lists-view';

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

describe('lists view', () => {
  it.each(SUPPORTED_LOCALES)('shows the four groups with their progress (%s)', (locale) => {
    const page = text(render(locale));
    for (const group of ['documents', 'money', 'bookings', 'packing'] as const) {
      expect(page).toContain(catalogs[locale].listsPage.groups[group]);
    }
    expect(page).toContain(locale === 'en' ? '1 of 2 done' : '1 de 2 feitos');
    expect(page).toContain(locale === 'en' ? '0 of 0 done' : '0 de 0 feitos');
  });

  it('exposes every item as a checkbox that says whether it is done, and a named remove button', () => {
    const html = render('en');
    expect(html.match(/role="checkbox"/g)).toHaveLength(3);
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html.match(/aria-checked="false"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Remove Visa"');
    // pressing a done item sends "false", an open one sends "true"
    expect(html).toContain('name="done" value="false"');
    expect(html).toContain('name="done" value="true"');
  });

  it('counts the stamps left and says earned or not yet in words', () => {
    const page = text(render('en'));
    expect(page).toContain('7 stamps to go');
    expect(page).toContain('Destination chosen earned');
    expect(page).toContain('Documents checked not yet');
    expect(text(render('pt-BR'))).toContain('faltam 7 carimbos');
  });

  it('celebrates when every stamp is earned', () => {
    const all = Object.fromEntries(Object.keys(NONE).map((key) => [key, true]));
    expect(text(render('en', { checklist: checklist(ITEMS, all) }))).toContain(
      catalogs.en.listsPage.allEarned,
    );
  });

  it('offers the suggested list only while there are no items, and says it is not an entry rule', () => {
    const empty = render('en', { checklist: checklist([]) });
    expect(text(empty)).toContain(catalogs.en.listsPage.startTitle);
    expect(text(empty)).toContain('We cannot confirm entry rules');
    expect(text(render('en'))).not.toContain(catalogs.en.listsPage.startTitle);
  });

  it('asks for a trip when there is none, and reports a load failure', () => {
    expect(text(render('en', { trip: null, checklist: null }))).toContain(
      catalogs.en.listsPage.noTrip,
    );
    const failed = render('en', { checklist: null });
    expect(failed).toContain('role="alert"');
    expect(text(failed)).toContain(catalogs.en.listsPage.loadError);
  });

  it('shows the error banner from the status', () => {
    const html = render('pt-BR', { status: 'error' });
    expect(html).toContain('role="alert"');
    expect(text(html)).toContain(catalogs['pt-BR'].listsPage.flash.error);
  });
});
