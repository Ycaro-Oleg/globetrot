import { toLocalDate, tripDays } from '@globetrot/domain';
import { formatLocalDate, type SupportedLocale } from '@globetrot/i18n';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { loadCurrentDestinations, loadCurrentTrip } from '../../../lib/current-trip';
import { fromDestination } from '../board/board-route';
import { TripWorkspace } from './_workspace/trip-workspace';
import type { WorkspaceDay } from './_workspace/trip-sidebar';

/**
 * The trip workspace around the trip's document, its budget and its checklists: the sections on the left and the
 * map on the right stay put while the page in the middle changes. It reads the current trip and its route once;
 * the page inside asks for the same data and gets it from the request's cache.
 */
export default async function TripWorkspaceLayout({ children }: { children: ReactNode }) {
  const [{ trip }, destinations, locale, t] = await Promise.all([
    loadCurrentTrip(),
    loadCurrentDestinations(),
    getLocale(),
    getTranslations('workspace'),
  ]);
  const route = (destinations ?? []).map(fromDestination);
  const startDate = trip?.startDate ?? null;
  const days: WorkspaceDay[] = tripDays({
    startDate: startDate ? toLocalDate(startDate) : null,
    stops: route.map((stop) => ({
      id: stop.id,
      nights: stop.nights,
      state: 'planned',
      places: [],
    })),
  }).map((day) => ({
    index: day.index,
    // "Mon 30/11" when the trip has a start date, "Day 1" when it does not (the date stays optional).
    label: day.date
      ? formatLocalDate(day.date, locale as SupportedLocale, {
          weekday: 'short',
          day: 'numeric',
          month: 'numeric',
        })
      : t('day', { index: day.index }),
    stopId: day.stopId,
  }));

  return (
    <TripWorkspace
      trip={trip ? { id: trip.id, title: trip.title } : null}
      days={days}
      stops={route}
    >
      {children}
    </TripWorkspace>
  );
}
