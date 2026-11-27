import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { apiInternalUrl } from '../../../../lib/api-proxy';
import { createServerApiClient, sessionCookieHeader } from '../../../../lib/stored-preferences';
import {
  fetchBudget,
  fetchChecklist,
  fetchDestinations,
  fetchTrip,
  SELECTED_TRIP_COOKIE,
} from '../../../../lib/trips';
import { PipAvatar } from '../../_components/pip-avatar';
import { StartDateForm } from '../../_components/start-date-form';
import { openTripAt } from '../../_components/trip-actions';
import { archiveTrip, undoArchiveTrip } from '../actions';
import { fetchBilling } from '../../../../lib/billing';
import { MakeCurrent } from './make-current';
import { MembersCard, type MembersView } from './members-card';
import { PassCard } from './pass-card';
import { ShareCard } from './share-card';
import { TitleEditor } from './title-editor';
import styles from './trip-hub.module.css';

export async function generateMetadata() {
  const t = await getTranslations('tripHub');
  return { title: t('metaTitle') };
}

/** The stamps in the order a trip usually earns them, each with the tool that earns it. */
const STEPS = [
  ['dest', '/app/board'],
  ['route', '/app/board'],
  ['budget', '/app/budget'],
  ['saved', '/app/budget'],
  ['itin', '/app/days'],
  ['stays', '/app/budget'],
  ['docs', '/app/lists'],
  ['check', '/app/lists'],
  ['ready', '/app/lists'],
] as const;

/**
 * A trip's own page (where the trip switcher leads): its name and start date, how far along it is (the nine
 * stamps), what to do next with a button that opens the right tool, and archive. Opening it makes the trip current, so the
 * bar's Map, Days, Budget and Lists already point at it (no second copy of them here).
 */
export default async function TripHub({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const [{ id }, { paid }, locale, t, tm, store] = await Promise.all([
    params,
    searchParams,
    getLocale(),
    getTranslations('tripHub'),
    getTranslations('milestones'),
    cookies(),
  ]);
  const cookieHeader = sessionCookieHeader(store.getAll());
  const options = cookieHeader ? { cookieHeader, apiUrl: apiInternalUrl() } : null;
  const trip = options ? await fetchTrip(options, id) : null;
  const share =
    options && trip
      ? await createServerApiClient(options)
          .GET('/v1/trips/{id}/share', { params: { path: { id: trip.id } } })
          .then((response) => response.data ?? { slug: null, showAmounts: false })
          .catch(() => ({ slug: null, showAmounts: false }))
      : { slug: null, showAmounts: false };

  if (!options || !trip) {
    return (
      <section className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>{t('notFoundTitle')}</h1>
          <p>{t('notFound')}</p>
          <Link className={styles.primary} href="/app/trips">
            {t('backToTrips')}
          </Link>
        </div>
      </section>
    );
  }

  const [checklist, stops, budget, billing, members] = await Promise.all([
    fetchChecklist(options, trip.id),
    fetchDestinations(options, trip.id),
    fetchBudget(options, trip.id),
    fetchBilling(options),
    createServerApiClient(options)
      .GET('/v1/trips/{id}/members', { params: { path: { id: trip.id } } })
      .then((response): MembersView | null => response.data ?? null)
      .catch(() => null),
  ]);
  // Members plan the trip; only the owner manages it (archive, public link, pass, people).
  const isOwner = trip.role === 'owner';
  const canEdit = trip.role !== 'viewer';
  const pass = billing?.passes.find((entry) => entry.tripId === trip.id) ?? null;
  const onPaidPlan = billing?.access === 'explorer' || billing?.access === 'voyager';
  const readiness = checklist?.readiness;
  const earned = readiness ? STEPS.filter(([key]) => readiness[key]).length : 0;
  const next = readiness ? STEPS.filter(([key]) => !readiness[key]).slice(0, 3) : [];
  const nights = (stops ?? []).reduce((sum, stop) => sum + stop.nights, 0);
  const money = (amount: string, currency: string) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(amount));
  const month = (yyyyMm: string) =>
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${yyyyMm}-15T12:00:00Z`),
    );
  const savings = budget?.savings;
  const answer = !savings
    ? null
    : savings.status === 'no-costs'
      ? t('answer.noCosts')
      : savings.status === 'fully-saved'
        ? t('answer.ready')
        : savings.readyMonth
          ? t('answer.by', { month: month(savings.readyMonth) })
          : t('answer.notYet');
  const archived = trip.status === 'archived';

  return (
    <section className={styles.page} aria-labelledby="trip-title">
      <MakeCurrent tripId={trip.id} current={store.get(SELECTED_TRIP_COOKIE)?.value === trip.id} />
      <Link href="/app/trips" className={styles.back}>
        <span aria-hidden="true">←</span> {t('backToTrips')}
      </Link>
      <header className={styles.header}>
        {canEdit ? (
          <TitleEditor tripId={trip.id} title={trip.title} />
        ) : (
          <h1 id="trip-title" className={styles.title}>
            {trip.title}
          </h1>
        )}
        <p className={styles.meta}>
          <span className={styles.chip}>
            <span aria-hidden="true">{archived ? '▣ ' : '◇ '}</span>
            {t(`status.${trip.status}`)}
          </span>
          <span>{t('stops', { count: stops?.length ?? 0 })}</span>
          <span>{t('nights', { count: nights })}</span>
          {budget ? <span>{money(budget.total.amount, budget.currency)}</span> : null}
          <span>{trip.currency}</span>
        </p>
      </header>

      {archived ? (
        <div className={styles.notice} role="status">
          <span>{t('archivedNote')}</span>
          <form action={undoArchiveTrip}>
            <input type="hidden" name="tripId" value={trip.id} />
            <button type="submit" className={styles.primary}>
              {t('restore')}
            </button>
          </form>
        </div>
      ) : null}

      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="next-title">
          <h2 id="next-title">{t('nextTitle')}</h2>
          {readiness ? (
            <>
              <p className={styles.progressText}>
                {tm('progress', { earned, total: STEPS.length })}
              </p>
              <div
                className={styles.bar}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={STEPS.length}
                aria-valuenow={earned}
                aria-label={t('progressLabel')}
              >
                <span style={{ width: `${(earned / STEPS.length) * 100}%` }} />
              </div>
              {next.length > 0 ? (
                <ol className={styles.steps}>
                  {next.map(([key, to]) => (
                    <li key={key}>
                      <span>
                        <strong>{t(`next.${key}.title`)}</strong>
                        <small>{t(`next.${key}.body`)}</small>
                      </span>
                      <form action={openTripAt}>
                        <input type="hidden" name="tripId" value={trip.id} />
                        <input type="hidden" name="to" value={to} />
                        <button type="submit" className={styles.primary}>
                          {t(`next.${key}.action`)} <span aria-hidden="true">→</span>
                        </button>
                      </form>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className={styles.done}>
                  <PipAvatar size={48} pose="celebrate" still /> {t('allDone')}
                </p>
              )}
            </>
          ) : (
            <p>{t('progressError')}</p>
          )}
        </section>

        <div className={styles.side}>
          <section className={styles.card} aria-labelledby="when-title">
            <h2 id="when-title">{t('whenTitle')}</h2>
            {canEdit ? <StartDateForm tripId={trip.id} startDate={trip.startDate} /> : null}
            {answer ? <p className={styles.answer}>{answer}</p> : null}
            <p className={styles.hint}>{t('whenHint')}</p>
          </section>

          {!archived && members ? (
            <MembersCard tripId={trip.id} isOwner={isOwner} initial={members} />
          ) : null}

          {!archived && isOwner ? (
            <ShareCard tripId={trip.id} title={trip.title} initial={share} />
          ) : null}

          {!archived && isOwner && billing && !onPaidPlan ? (
            <PassCard
              tripId={trip.id}
              currency={billing.priceCurrency}
              validUntil={pass?.validUntil ?? null}
              justPaid={paid === 'trip-pass'}
              freePasses={billing.passCredits}
            />
          ) : null}

          {!archived && isOwner ? (
            <form action={archiveTrip} className={styles.archive}>
              <input type="hidden" name="tripId" value={trip.id} />
              <button type="submit" className={styles.ghost}>
                {t('archive')}
              </button>
              <span>{t('archiveHint')}</span>
            </form>
          ) : null}
        </div>
      </div>
    </section>
  );
}
