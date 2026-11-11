import { cookies } from 'next/headers';
import { getLocale, getTranslations } from 'next-intl/server';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { sessionCookieHeader } from '../../../lib/stored-preferences';
import { fetchBudget, fetchExpenses, fetchTrips, SELECTED_TRIP_COOKIE } from '../../../lib/trips';
import { currencyOptions } from '../../settings/options';
import { BudgetView } from './budget-view';

export async function generateMetadata() {
  const t = await getTranslations('budgetPage');
  return { title: t('title') };
}

/** The budget of the current trip: what it costs, what is saved, and when you can afford it. */
export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [store, query, locale] = await Promise.all([cookies(), searchParams, getLocale()]);
  const cookieHeader = sessionCookieHeader(store.getAll());
  const options = cookieHeader ? { cookieHeader, apiUrl: apiInternalUrl() } : null;
  const trips = options ? ((await fetchTrips(options)) ?? []) : [];
  const savedId = store.get(SELECTED_TRIP_COOKIE)?.value;
  const trip = trips.find((candidate) => candidate.id === savedId) ?? trips[0] ?? null;
  const [budget, expenses] =
    options && trip
      ? await Promise.all([fetchBudget(options, trip.id), fetchExpenses(options, trip.id)])
      : [null, null];

  return (
    <BudgetView
      trip={trip ? { id: trip.id, title: trip.title, currency: trip.currency } : null}
      budget={budget}
      expenses={expenses ?? []}
      currencies={currencyOptions(locale)}
      status={query.status}
    />
  );
}
