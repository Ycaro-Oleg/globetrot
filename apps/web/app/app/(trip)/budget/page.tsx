import { cookies } from 'next/headers';
import { isPipEnabled } from '../../../../lib/flags';
import { getLocale, getTranslations } from 'next-intl/server';
import { apiInternalUrl } from '../../../../lib/api-proxy';
import { createServerApiClient, sessionCookieHeader } from '../../../../lib/stored-preferences';
import {
  fetchBudget,
  fetchExpenses,
  fetchTrips,
  SELECTED_TRIP_COOKIE,
} from '../../../../lib/trips';
import { currencyOptions } from '../../../settings/options';
import { loadMoneyExtras } from '../../_components/money/load-money';
import { MoneyPanel } from '../../_components/money/money-panel';
import { BudgetView } from './budget-view';

export async function generateMetadata() {
  const t = await getTranslations('budgetPage');
  return { title: t('title') };
}

/** The budget of the current trip: what it costs, what is saved, and when you can afford it. */
export default async function BudgetPage() {
  const [store, locale] = await Promise.all([cookies(), getLocale()]);
  const cookieHeader = sessionCookieHeader(store.getAll());
  const options = cookieHeader ? { cookieHeader, apiUrl: apiInternalUrl() } : null;
  const trips = options ? ((await fetchTrips(options)) ?? []) : [];
  const savedId = store.get(SELECTED_TRIP_COOKIE)?.value;
  const trip = trips.find((candidate) => candidate.id === savedId) ?? trips[0] ?? null;
  const [budget, expenses, group, miles, extras] =
    options && trip
      ? await Promise.all([
          fetchBudget(options, trip.id),
          fetchExpenses(options, trip.id),
          createServerApiClient(options)
            .GET('/v1/trips/{id}/money', { params: { path: { id: trip.id } } })
            .then((response) => response.data ?? null)
            .catch(() => null),
          createServerApiClient(options)
            .GET('/v1/trips/{id}/miles', { params: { path: { id: trip.id } } })
            .then((response) => response.data ?? null)
            .catch(() => null),
          loadMoneyExtras(options, trip.id),
        ])
      : [null, null, null, null, null];

  return (
    <BudgetView
      pipEnabled={isPipEnabled()}
      trip={
        trip
          ? { id: trip.id, title: trip.title, currency: trip.currency, startDate: trip.startDate }
          : null
      }
      budget={budget}
      expenses={expenses ?? []}
      currencies={currencyOptions(locale)}
      // The group's money shows only when someone else plans the trip too.
      group={group && group.people.length > 1 ? group : null}
      miles={miles}
      analytics={
        budget && extras ? (
          <MoneyPanel
            budget={budget}
            history={extras.history}
            today={extras.today}
            variant="full"
          />
        ) : null
      }
    />
  );
}
