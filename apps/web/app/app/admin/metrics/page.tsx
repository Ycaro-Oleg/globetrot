import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { apiInternalUrl } from '../../../../lib/api-proxy';
import { createServerApiClient, sessionCookieHeader } from '../../../../lib/stored-preferences';
import styles from './metrics.module.css';

export async function generateMetadata() {
  const t = await getTranslations('adminMetrics');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * The owner's dashboard (ADR-0031): the numbers that say whether Globetrot works, counts only, for admins. Anyone
 * else gets "not found".
 */
export default async function AdminMetricsPage() {
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  if (!cookieHeader) notFound();
  const { data } = await createServerApiClient({ cookieHeader, apiUrl: apiInternalUrl() })
    .GET('/v1/admin/metrics')
    .catch(() => ({ data: undefined }));
  if (!data) notFound();
  const t = await getTranslations('adminMetrics');
  const pct = (part: number, whole: number) =>
    whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—';
  const groups: { title: string; rows: [string, string | number][] }[] = [
    {
      title: t('accounts'),
      rows: [
        [t('total'), data.accounts.total],
        [t('verified'), data.accounts.verified],
        [t('last7'), data.accounts.last7],
        [t('last30'), data.accounts.last30],
      ],
    },
    {
      title: t('trips'),
      rows: [
        [t('active'), data.trips.active],
        [t('created30'), data.trips.created30],
        [t('fromPlan'), data.trips.fromPlan30],
        [t('fromExample'), data.trips.fromExample30],
        [t('byHand'), data.trips.byHand30],
        [t('saving'), data.trips.savingMonthly],
      ],
    },
    {
      title: t('retention'),
      rows: [
        [t('cohort'), data.retention.cohort],
        [t('week1'), pct(data.retention.week1, data.retention.cohort)],
        [t('week4'), pct(data.retention.week4, data.retention.cohort)],
        [t('week8'), pct(data.retention.week8, data.retention.cohort)],
      ],
    },
    {
      title: t('sharing'),
      rows: [
        [t('invites'), data.sharing.invites30],
        [t('joins'), data.sharing.joins30],
        [
          t('viral'),
          data.sharing.inviters30
            ? (data.sharing.joins30 / data.sharing.inviters30).toFixed(2)
            : '—',
        ],
        [t('referrals'), data.money.referrals],
      ],
    },
    {
      title: t('money'),
      rows: [
        [t('explorer'), data.money.explorer],
        [t('voyager'), data.money.voyager],
        [t('passes'), data.money.activePasses],
      ],
    },
    {
      title: t('emailFailures'),
      rows: [
        [t('failedVerify7'), data.emailFailures.verifyEmail.last7],
        [t('failedVerify30'), data.emailFailures.verifyEmail.last30],
        [t('failedReset7'), data.emailFailures.resetPassword.last7],
        [t('failedReset30'), data.emailFailures.resetPassword.last30],
      ],
    },
  ];
  return (
    <section className={styles.page}>
      <h1>{t('title')}</h1>
      <p className={styles.note}>{t('note')}</p>
      <div className={styles.grid}>
        {groups.map((group) => (
          <section key={group.title} className={styles.card} aria-label={group.title}>
            <h2>{group.title}</h2>
            <dl>
              {group.rows.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <section className={styles.card} aria-label={t('checkins')}>
          <h2>{t('checkins')}</h2>
          {data.checkinsByWeek.length ? (
            <dl>
              {data.checkinsByWeek.map((week) => (
                <div key={week.week}>
                  <dt>{week.week}</dt>
                  <dd>{week.count}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className={styles.note}>{t('none')}</p>
          )}
        </section>
      </div>
    </section>
  );
}
