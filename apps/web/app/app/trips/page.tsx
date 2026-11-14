import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { createServerApiClient, sessionCookieHeader } from '../../../lib/stored-preferences';
import { fetchDestinations, fetchTrips, SELECTED_TRIP_COOKIE } from '../../../lib/trips';
import { currencyOptions } from '../../settings/options';
import { findExampleTrip } from '@globetrot/application';
import {
  archiveTrip,
  copyExampleTrip,
  createTrip,
  deleteTrip,
  openTrip,
  undoArchiveTrip,
} from './actions';
import styles from './trips.module.css';

const FILTERS = ['all', 'active', 'traveling', 'completed', 'archived'] as const;
type Filter = (typeof FILTERS)[number];

function displayCurrency(code: string, locale: string) {
  const name = new Intl.DisplayNames([locale], { type: 'currency' }).of(code);
  return name ? `${code} · ${name}` : code;
}

function dateLabel(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

export async function generateMetadata() {
  const t = await getTranslations('tripWorkspace');
  return { title: t('title') };
}

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    archived?: string;
    status?: string;
    example?: string;
    confirmDelete?: string;
  }>;
}) {
  const [locale, t, store, query] = await Promise.all([
    getLocale(),
    getTranslations('tripWorkspace'),
    cookies(),
    searchParams,
  ]);
  const cookieHeader = sessionCookieHeader(store.getAll());
  const options = cookieHeader ? { cookieHeader, apiUrl: apiInternalUrl() } : null;
  const fetchedTrips = options ? await fetchTrips(options, true) : null;
  const preferences = options
    ? await createServerApiClient(options)
        .GET('/v1/me/preferences')
        .catch(() => null)
    : null;

  const error = fetchedTrips === null;
  const trips = fetchedTrips ?? [];
  // Each card says where the trip goes (a few small reads; a person keeps a handful of trips).
  const routes = new Map(
    options
      ? await Promise.all(
          trips.map(
            async (trip) => [trip.id, (await fetchDestinations(options, trip.id)) ?? []] as const,
          ),
        )
      : [],
  );
  const routeSummary = (tripId: string) => {
    const stops = routes.get(tripId) ?? [];
    if (stops.length === 0) return t('noDestinations');
    const names = stops.map((stop) => stop.name);
    const shown = names.length > 3 ? [...names.slice(0, 3), `+${names.length - 3}`] : names;
    return t('routeSummary', {
      route: shown.join(' → '),
      nights: stops.reduce((sum, stop) => sum + stop.nights, 0),
    });
  };
  const selectedFilter: Filter = FILTERS.includes(query.filter as Filter)
    ? (query.filter as Filter)
    : 'all';
  const filtered = trips.filter((trip) =>
    selectedFilter === 'all'
      ? trip.status !== 'archived'
      : selectedFilter === 'archived'
        ? trip.status === 'archived'
        : trip.status === selectedFilter,
  );
  const selectedTripId = store.get(SELECTED_TRIP_COOKIE)?.value;
  const selectedTrip = trips.find((trip) => trip.id === selectedTripId) ?? trips[0];
  const preferredCurrency = preferences?.data?.currency ?? 'USD';
  const currencies = currencyOptions(locale);
  const statusMessage =
    query.status === 'create-error'
      ? t('createError')
      : query.status === 'not-found'
        ? t('notFound')
        : query.status === 'error'
          ? t('requestError')
          : query.status === 'example-error'
            ? t('example.copyError')
            : query.status === 'trip-limit'
              ? t('tripLimit')
              : query.status === 'plan-required'
                ? t('planRequired')
                : null;
  const planLink = query.status === 'trip-limit' || query.status === 'plan-required';
  const example = query.example ? findExampleTrip(query.example) : undefined;
  const archivedTrip = query.archived ? trips.find((trip) => trip.id === query.archived) : null;
  const deleting = query.confirmDelete
    ? trips.find((trip) => trip.id === query.confirmDelete && trip.status === 'archived')
    : undefined;

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.headingGroup}>
          <p className={styles.eyebrow}>{t('eyebrow')}</p>
          <h1>{t('title')}</h1>
          <p className={styles.description}>{t('description')}</p>
        </div>
        <details
          className={styles.createDetails}
          id="create-trip-form"
          open={query.status === 'create-error'}
        >
          <summary className={styles.primaryAction}>
            <span className={styles.createPlus} aria-hidden="true">
              +
            </span>
            {t('create')}
          </summary>
          <div className={styles.createPopover}>
            <h2>{t('createTitle')}</h2>
            <p>{t('createDescription')}</p>
            <form action={createTrip} className={styles.createForm} id="create-trip-form-body">
              <input type="hidden" name="idempotencyKey" value={randomUUID()} />
              <label className={styles.field}>
                <span>{t('tripName')}</span>
                <input name="title" required maxLength={120} autoComplete="off" />
              </label>
              <div className={styles.createFields}>
                <label className={styles.field}>
                  <span>{t('startDate')}</span>
                  <input type="date" name="startDate" />
                </label>
                <label className={styles.field}>
                  <span>{t('currency')}</span>
                  <select name="currency" defaultValue={preferredCurrency} required>
                    {currencies.map((currency) => (
                      <option key={currency.id} value={currency.id}>
                        {currency.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button type="submit" className={styles.primaryAction}>
                {t('create')}
              </button>
            </form>
          </div>
        </details>
      </header>

      {example ? (
        <section className={styles.exampleCard} aria-labelledby="example-title">
          <p className={styles.eyebrow}>{t('example.title')}</p>
          <h2 id="example-title">{t(`example.trips.${example.id}` as 'example.trips.japan')}</h2>
          <p>{t('example.body')}</p>
          <p className={styles.exampleRoute}>
            {example.stops.map((stop) => stop.name).join(' → ')}
            <br />
            <small>
              {t('example.stops', {
                count: example.stops.length,
                nights: example.stops.reduce((sum, stop) => sum + stop.nights, 0),
              })}
            </small>
          </p>
          <div className={styles.exampleActions}>
            <form action={copyExampleTrip}>
              <input type="hidden" name="exampleId" value={example.id} />
              <input type="hidden" name="idempotencyKey" value={randomUUID()} />
              <button type="submit" className={styles.primaryAction}>
                {t('example.copy')}
              </button>
            </form>
            <Link href="/app/trips">{t('example.dismiss')}</Link>
          </div>
        </section>
      ) : null}

      {statusMessage ? (
        <p className={styles.banner} role="alert">
          {statusMessage}
          {planLink ? (
            <>
              {' '}
              <Link href="/app/plan">{t('seePlans')}</Link>
            </>
          ) : null}
        </p>
      ) : null}
      {query.status === 'deleted' ? (
        <p className={styles.banner} role="status">
          {t('deletedMessage')}
        </p>
      ) : null}
      {deleting ? (
        <section className={styles.banner} aria-labelledby="delete-trip-title" role="alertdialog">
          <div>
            <h2 id="delete-trip-title" className={styles.dangerTitle}>
              {t('deleteTitle', { title: deleting.title })}
            </h2>
            <p>{t('deleteBody')}</p>
          </div>
          <div className={styles.cardActions}>
            <Link href="/app/trips?filter=archived" className={styles.secondaryAction}>
              {t('deleteCancel')}
            </Link>
            <form action={deleteTrip}>
              <input type="hidden" name="tripId" value={deleting.id} />
              <button className={styles.dangerAction} type="submit">
                {t('deleteConfirm')}
              </button>
            </form>
          </div>
        </section>
      ) : null}
      {archivedTrip ? (
        <div className={styles.banner} role="status" aria-live="polite">
          <span>{t('archivedMessage', { title: archivedTrip.title })}</span>
          <form action={undoArchiveTrip}>
            <input type="hidden" name="tripId" value={archivedTrip.id} />
            <button className={styles.undoAction} type="submit">
              {t('undo')}
            </button>
          </form>
        </div>
      ) : null}

      <div className={styles.workspace}>
        <section className={styles.listSection} aria-labelledby="trip-list-title">
          <div className={styles.sectionHeader}>
            <h2 id="trip-list-title">{t('yourTrips')}</h2>
            <span className={styles.tripCount}>{filtered.length}</span>
          </div>
          <nav className={styles.filters} aria-label={t('filterLabel')}>
            {FILTERS.map((filter) => (
              <Link
                key={filter}
                href={filter === 'all' ? '/app/trips' : `/app/trips?filter=${filter}`}
                aria-current={selectedFilter === filter ? 'page' : undefined}
                className={styles.filter}
              >
                {t(`filter.${filter}`)}
              </Link>
            ))}
          </nav>

          {error ? (
            <div className={styles.emptyState} role="alert">
              <h3>{t('loadErrorTitle')}</h3>
              <p>{t('loadError')}</p>
              <Link className={styles.primaryAction} href="/app/trips">
                {t('retry')}
              </Link>
            </div>
          ) : filtered.length ? (
            <div className={styles.tripGrid}>
              {filtered.map((trip) => (
                <article className={styles.tripCard} key={trip.id} aria-label={trip.title}>
                  <div className={styles.cardHeader}>
                    <p className={styles.tripStatus}>
                      <span aria-hidden="true">
                        {trip.status === 'completed'
                          ? '✓'
                          : trip.status === 'traveling'
                            ? '✈'
                            : '◇'}
                      </span>
                      {t(`status.${trip.status}`)}
                    </p>
                    {trip.id === selectedTrip?.id ? (
                      <span className={styles.currentTrip}>{t('current')}</span>
                    ) : null}
                  </div>
                  <h3 className={styles.tripTitle}>{trip.title}</h3>
                  <p className={styles.tripMeta}>
                    {trip.startDate ? dateLabel(trip.startDate, locale) : t('dateNotSet')}
                    <span aria-hidden="true"> · </span>
                    {displayCurrency(trip.currency, locale)}
                  </p>
                  <p className={styles.tripSummary}>{routeSummary(trip.id)}</p>
                  <div className={styles.cardActions}>
                    <form action={openTrip}>
                      <input type="hidden" name="tripId" value={trip.id} />
                      <button className={styles.primaryAction} type="submit">
                        {t('open')}
                      </button>
                    </form>
                    {trip.status !== 'archived' ? (
                      <form action={archiveTrip}>
                        <input type="hidden" name="tripId" value={trip.id} />
                        <button className={styles.secondaryAction} type="submit">
                          {t('archive')}
                        </button>
                      </form>
                    ) : (
                      <Link
                        href={`/app/trips?filter=archived&confirmDelete=${encodeURIComponent(trip.id)}`}
                        className={styles.secondaryAction}
                      >
                        {t('deleteForever')}
                      </Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <h3>{selectedFilter === 'all' ? t('emptyTitle') : t('filterEmptyTitle')}</h3>
              <p>{selectedFilter === 'all' ? t('emptyDescription') : t('filterEmpty')}</p>
              {selectedFilter !== 'all' ? (
                <Link href="/app/trips" className={styles.secondaryAction}>
                  {t('clearFilters')}
                </Link>
              ) : (
                <>
                  <Link href="/onboarding" className={styles.primaryAction}>
                    {t('planFirst')}
                  </Link>
                  <a href="#create-trip-form" className={styles.secondaryAction}>
                    {t('create')}
                  </a>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
