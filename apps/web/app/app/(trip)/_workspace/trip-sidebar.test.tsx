import { catalogs, SUPPORTED_LOCALES, type SupportedLocale } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { readSections, SECTIONS_DEFAULT } from './sections-state';
import { ExpandMapLink, TripJumpBar, TripSidebar, type WorkspaceDay } from './trip-sidebar';

function render(locale: SupportedLocale, element: ReactElement): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
      {element}
    </NextIntlClientProvider>,
  );
}

const DAYS: WorkspaceDay[] = [
  { index: 1, label: 'Mon 30/11', stopId: 'bishkek' },
  { index: 2, label: 'Tue 1/12', stopId: 'karakol' },
];
const noop = () => undefined;

describe('the sidebar groups saved on the device', () => {
  it('start folded, and a broken value falls back to folded', () => {
    expect(SECTIONS_DEFAULT).toEqual({ itinerary: false });
    expect(readSections(null)).toEqual({ itinerary: false });
    expect(readSections('{"itinerary":true}')).toEqual({ itinerary: true });
    expect(readSections('{"itinerary":"yes"}')).toEqual({ itinerary: false });
    expect(readSections('not json')).toEqual({ itinerary: false });
  });
});

describe.each(SUPPORTED_LOCALES)('trip sidebar (%s)', (locale) => {
  const copy = catalogs[locale].workspace;
  const sidebar = (props: Partial<Parameters<typeof TripSidebar>[0]> = {}) =>
    render(
      locale,
      <TripSidebar
        tripTitle="Kyrgyzstan"
        days={DAYS}
        pathname="/app/trip"
        activeDay={null}
        itineraryOpen={false}
        onItineraryOpen={noop}
        {...props}
      />,
    );

  it('is a labelled nav with five rows in order, Places among them', () => {
    const html = sidebar();
    expect(html).toMatch(new RegExp(`<nav[^>]*aria-label="${copy.sidebarLabel}"`));
    const rows = [...html.matchAll(/<a[^>]*href="(\/app\/[^"#]*(?:#(?:places|itinerary))?)"/g)].map(
      (match) => match[1],
    );
    expect(rows).toEqual([
      '/app/trip',
      '/app/trip#places',
      '/app/trip#itinerary',
      '/app/budget',
      '/app/lists',
    ]);
    // "Expand map" is not a row: it lives in the drawer's footer.
    expect(html).not.toContain('/app/board');
    expect(render(locale, <ExpandMapLink />)).toMatch(
      new RegExp(`href="/app/board"[^>]*>.*${copy.expandMap}</a>`),
    );
  });

  it('folds the days behind a chevron beside the Itinerary link, folded by default', () => {
    const html = sidebar();
    const button = html.match(/<button[^>]*aria-controls="([^"]+)"[^>]*>/);
    expect(button?.[0]).toContain('aria-expanded="false"');
    expect(button?.[0]).toContain(`aria-label="${copy.daysShow}"`);
    // The days stay in the page but hidden, so the keyboard and screen readers skip them.
    expect(html).toMatch(new RegExp(`<ul id="${button?.[1]}"[^>]*hidden=""`));
    expect(html).toContain('#day-2');

    const open = sidebar({ itineraryOpen: true });
    expect(open).toMatch(/<button[^>]*aria-expanded="true"/);
    expect(open).toContain(`aria-label="${copy.daysHide}"`);
    expect(open).not.toMatch(/<ul[^>]*hidden/);
  });

  it('names the day being read on the folded Itinerary row', () => {
    const folded = sidebar({ activeDay: 2 });
    expect(folded).toMatch(
      /aria-current="location" href="\/app\/trip#itinerary"[^>]*><span>[^<]+<\/span><span[^>]*>Tue 1\/12<\/span>/,
    );
    // Open, the mark moves back to the day's own row.
    const open = sidebar({ activeDay: 2, itineraryOpen: true });
    expect(open).toMatch(/aria-current="location" href="\/app\/trip#day-2"/);
    expect(open.match(/aria-current="location"/g)).toHaveLength(1);
  });

  it('marks the page you are on, and no day off the trip document', () => {
    const budget = sidebar({ pathname: '/app/budget', activeDay: 2 });
    expect(budget).not.toContain('aria-current="location"');
    expect(budget).toMatch(new RegExp(`aria-current="page" href="/app/budget">${copy.budget}`));
  });

  it('has no chevron when the trip has no days yet', () => {
    const html = sidebar({ tripTitle: null, days: [] });
    expect(html).not.toContain('#day-');
    expect(html).not.toContain('<button');
    expect(html).toContain(copy.itinerary);
  });

  it('gives the phone the same sections as a jump bar', () => {
    const html = render(locale, <TripJumpBar pathname="/app/lists" />);
    expect(html).toMatch(new RegExp(`<nav[^>]*aria-label="${copy.jumpLabel}"`));
    expect(html).toMatch(new RegExp(`aria-current="page" href="/app/lists">${copy.checklist}`));
    expect(html).toContain('href="/app/trip#itinerary"');
  });
});
