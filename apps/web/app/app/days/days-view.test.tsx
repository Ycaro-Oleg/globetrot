import { tripDays, toLocalDate } from '@globetrot/domain';
import { catalogs, SUPPORTED_LOCALES, type SupportedLocale } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./actions', () => ({ addPlace: vi.fn(), movePlace: vi.fn(), removePlace: vi.fn() }));

import type { BoardPlace, BoardStop } from './day-board';
import { DaysView } from './days-view';

const STOPS: BoardStop[] = [
  { id: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8e01', name: 'Tokyo', nights: 2, legMode: 'train' },
  { id: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8e02', name: 'Kyoto', nights: 1, legMode: null },
];
const [TOKYO, KYOTO] = STOPS as [BoardStop, BoardStop];
const PLACES: BoardPlace[] = [
  { id: 'p1', name: 'Senso-ji', minutes: 120, day: 1, destinationId: TOKYO.id },
  { id: 'p2', name: 'Fushimi Inari', minutes: 180, day: 2, destinationId: KYOTO.id },
  { id: 'p3', name: 'Golden Gai', minutes: 90, day: null, destinationId: TOKYO.id },
];
const days = (startDate: string | null) =>
  tripDays({
    startDate: startDate ? toLocalDate(startDate) : null,
    stops: STOPS.map((stop) => ({
      id: stop.id,
      nights: stop.nights,
      state: 'planned',
      places: [],
    })),
  });

function render(locale: SupportedLocale, props: Partial<Parameters<typeof DaysView>[0]> = {}) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
      <DaysView
        trip={{ id: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8d99', title: 'Japan 2027' }}
        stops={STOPS}
        days={days('2027-04-03')}
        places={PLACES}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

describe.each(SUPPORTED_LOCALES)('days (%s)', (locale) => {
  const copy = catalogs[locale].daysPage;

  it('has the "No day" tray first and one column per night', () => {
    const html = render(locale);
    const headings = [...html.matchAll(/<h2 id="day-[^"]+">([^<]+)<\/h2>/g)].map((m) => m[1]);
    expect(headings).toEqual([
      copy.tray,
      copy.dayLabel.replace('{index}', '1'),
      copy.dayLabel.replace('{index}', '2'),
      copy.dayLabel.replace('{index}', '3'),
    ]);
  });

  it('gives every card a "Move to" select (the keyboard and phone path) and a remove button', () => {
    const html = render(locale);
    expect(html.match(/<select aria-label=/g)).toHaveLength(3);
    expect(html.match(/draggable="true"/g)).toHaveLength(3);
    expect(html).toContain(copy.remove.replace('{name}', 'Golden Gai'));
  });

  it('warns about a place on a day in another city, and shows the train between cities', () => {
    const plain = text(render(locale));
    expect(plain).toContain('▲');
    expect(plain).toContain(copy.outside.replace('{stop}', 'Tokyo'));
    expect(plain).toContain(`${copy.legs.train} Tokyo → Kyoto`);
  });

  it('has one coral call to action and no unresolved keys', () => {
    const html = render(locale);
    expect(html.match(/class="[^"]*cta[^"]*"/g)).toHaveLength(1);
    expect(html).not.toMatch(/daysPage\.[a-zA-Z.]+/);
  });
});

describe('days without what they need', () => {
  it('numbers the days without a start date', () => {
    expect(text(render('en', { days: days(null) }))).toContain(catalogs.en.daysPage.noDate);
  });

  it('leads to the trips, or to the board when the route is empty', () => {
    expect(render('en', { trip: null })).toContain('href="/app/trips"');
    expect(render('en', { stops: [], days: [] })).toContain('href="/app/board"');
  });

  it('says so when the plan cannot be read', () => {
    expect(render('en', { places: null })).toContain('role="alert"');
  });
});
