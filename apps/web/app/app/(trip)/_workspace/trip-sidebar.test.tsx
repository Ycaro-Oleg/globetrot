import { catalogs, SUPPORTED_LOCALES, type SupportedLocale } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TripJumpBar, TripSidebar, type WorkspaceDay } from './trip-sidebar';

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

describe.each(SUPPORTED_LOCALES)('trip sidebar (%s)', (locale) => {
  const copy = catalogs[locale].workspace;

  it('is a labelled nav with the sections in order and a link into every day', () => {
    const html = render(
      locale,
      <TripSidebar tripTitle="Kyrgyzstan" days={DAYS} pathname="/app/trip" activeDay={null} />,
    );
    expect(html).toMatch(new RegExp(`<nav[^>]*aria-label="${copy.sidebarLabel}"`));
    const links = [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g)].map((match) => [
      match[1],
      match[2],
    ]);
    expect(links).toEqual([
      ['/app/trip', copy.overview],
      ['/app/trip#places', copy.places],
      ['/app/trip#itinerary', copy.itinerary],
      ['/app/trip#day-1', 'Mon 30/11'],
      ['/app/trip#day-2', 'Tue 1/12'],
      ['/app/budget', copy.budget],
      ['/app/lists', copy.checklist],
    ]);
    // "Expand map" is an action under the list, not one of its sections.
    expect(html).toMatch(
      new RegExp(`</ul><a[^>]*href="/app/board"[^>]*>.*${copy.expandMap}</a></nav>`),
    );
  });

  it('shows a short trip’s days and folds a long trip’s behind a button', () => {
    const short = render(
      locale,
      <TripSidebar tripTitle="Kyrgyzstan" days={DAYS} pathname="/app/trip" activeDay={null} />,
    );
    expect(short).toMatch(/<button[^>]*aria-expanded="true"/);
    expect(short).toContain(`aria-label="${copy.daysHide}"`);
    expect(short).not.toMatch(/<ul[^>]*hidden/);

    const fortnight: WorkspaceDay[] = Array.from({ length: 15 }, (_, i) => ({
      index: i + 1,
      label: `Day ${i + 1}`,
      stopId: null,
    }));
    const long = render(
      locale,
      <TripSidebar tripTitle="Japan" days={fortnight} pathname="/app/trip" activeDay={null} />,
    );
    const button = long.match(/<button[^>]*aria-controls="([^"]+)"[^>]*>/);
    expect(button?.[0]).toContain('aria-expanded="false"');
    expect(button?.[0]).toContain(`aria-label="${copy.daysShow.replace('{count}', '15')}"`);
    // The folded list stays in the page but hidden, so the keyboard skips it until it is opened.
    expect(long).toMatch(new RegExp(`<ul id="${button?.[1]}"[^>]*hidden`));
    expect(long).toContain('#day-15');
  });

  it('marks the page you are on and the day being read', () => {
    const home = render(
      locale,
      <TripSidebar tripTitle="Kyrgyzstan" days={DAYS} pathname="/app/trip" activeDay={2} />,
    );
    expect(home).toMatch(/aria-current="page"[^>]*>[^<]*<\/a>/);
    expect(home).toMatch(/aria-current="location" href="\/app\/trip#day-2"/);
    expect(home.match(/aria-current="location"/g)).toHaveLength(1);

    // On the budget the day is not marked: the document is not on screen.
    const budget = render(
      locale,
      <TripSidebar tripTitle="Kyrgyzstan" days={DAYS} pathname="/app/budget" activeDay={2} />,
    );
    expect(budget).not.toContain('aria-current="location"');
    expect(budget).toMatch(new RegExp(`aria-current="page" href="/app/budget">${copy.budget}`));
  });

  it('lists no days when the trip has no stops yet', () => {
    const html = render(
      locale,
      <TripSidebar tripTitle={null} days={[]} pathname="/app/trip" activeDay={null} />,
    );
    expect(html).not.toContain('#day-');
    expect(html).toContain(copy.itinerary);
  });

  it('gives the phone the same sections as a jump bar', () => {
    const html = render(locale, <TripJumpBar pathname="/app/lists" />);
    expect(html).toMatch(new RegExp(`<nav[^>]*aria-label="${copy.jumpLabel}"`));
    expect(html).toMatch(new RegExp(`aria-current="page" href="/app/lists">${copy.checklist}`));
    expect(html).toContain('href="/app/trip#itinerary"');
  });
});
