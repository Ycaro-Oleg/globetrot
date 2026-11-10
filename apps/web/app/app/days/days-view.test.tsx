import { catalogs, SUPPORTED_LOCALES, type SupportedLocale } from '@globetrot/i18n';
import { tripDays, toLocalDate } from '@globetrot/domain';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DaysView } from './days-view';

const STOPS = [
  { id: 'a', name: 'Tokyo', nights: 2 },
  { id: 'b', name: 'Osaka', nights: 0 },
  { id: 'c', name: 'Kyoto', nights: 3 },
];

function render(
  locale: SupportedLocale,
  startDate: string | null,
  stops = STOPS,
  trip: { title: string } | null = { title: 'Japan 2027' },
) {
  const days = tripDays({
    startDate: startDate ? toLocalDate(startDate) : null,
    stops: stops.map((stop) => ({
      id: stop.id,
      nights: stop.nights,
      state: 'planned' as const,
      places: [],
    })),
  });
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
      <DaysView trip={trip} stops={stops} days={days} startDate={startDate} />
    </NextIntlClientProvider>,
  );
}
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

describe('days view', () => {
  it.each(SUPPORTED_LOCALES)(
    'numbers one day per night across the stops, skipping day trips (%s)',
    (locale) => {
      const copy = catalogs[locale].daysPage;
      const html = render(locale, null);
      expect(html.match(/<li[^>]*><b>/g)).toHaveLength(5);
      for (let index = 1; index <= 5; index++)
        expect(html).toContain(copy.day.replace('{index}', String(index)));
      expect(text(html)).not.toContain('Osaka'); // a day trip has no day of its own
      expect(html.match(new RegExp(`<em>${copy.arrival}</em>`, 'g'))).toHaveLength(2); // arrival at Tokyo and at Kyoto
      expect(text(html)).toContain(copy.noStartDate);
    },
  );

  it('prints real dates from the start date, in the language of the page', () => {
    expect(text(render('en', '2027-04-10'))).toMatch(/Sat, Apr 10/);
    expect(text(render('pt-BR', '2027-04-10'))).toMatch(/sáb\.?,? 10 de abr/i);
    expect(text(render('en', '2027-04-10'))).toContain('Starts April 10, 2027');
  });

  it.each(SUPPORTED_LOCALES)(
    'explains an empty route, a route with no nights and no trip (%s)',
    (locale) => {
      const copy = catalogs[locale].daysPage;
      expect(text(render(locale, null, []))).toContain(copy.noStops);
      expect(text(render(locale, null, [{ id: 'a', name: 'Tokyo', nights: 0 }]))).toContain(
        copy.noNights,
      );
      const none = render(locale, null, [], null);
      expect(text(none)).toContain(copy.noTrip);
      expect(none).toContain('href="/app/trips"');
    },
  );

  it('links to the board when there is nothing to show yet', () => {
    expect(render('en', null, [])).toContain('href="/app/board"');
  });
});
