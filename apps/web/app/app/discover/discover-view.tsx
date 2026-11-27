import {
  formatMoney,
  SUGGEST_COMFORTS,
  SUGGEST_LIKES,
  SUGGEST_MAX_DAYS,
  SUGGEST_MIN_DAYS,
  SUGGESTED_DESTINATIONS,
  suggestPlan,
} from '@globetrot/domain';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { buildSuggestedTrip } from './actions';
import styles from './discover.module.css';

const DAY_CHOICES = [7, 10, 12, 14, 21].filter(
  (days) => days >= SUGGEST_MIN_DAYS && days <= SUGGEST_MAX_DAYS,
);

/**
 * Ready plans from the curated catalog (ADR-0020): each card shows the route and the typical cost per person, and
 * builds the trip with the days, likes and comfort picked on it. Plain forms, so it works before any script.
 */
export function DiscoverView({
  communityEnabled,
  failed,
}: {
  communityEnabled: boolean;
  failed: boolean;
}) {
  const t = useTranslations('discoverPage');
  const likesCopy = useTranslations('landing.suggest.likes');
  const comfortCopy = useTranslations('landing.suggest.comfort');
  const locale = useLocale();
  const pt = locale.startsWith('pt');
  const money = (value: Parameters<typeof formatMoney>[0]) =>
    formatMoney(value, locale, { precision: 'whole' });

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>{t('title')}</h1>
        <p>{t('lead')}</p>
      </header>
      {failed ? (
        <p className={styles.error} role="alert">
          {t('error')}
        </p>
      ) : null}

      <section aria-labelledby="discover-plans" className={styles.section}>
        <h2 id="discover-plans">{t('plans')}</h2>
        <ul className={styles.cards}>
          {SUGGESTED_DESTINATIONS.map((destination) => {
            const days = destination.stops.reduce((sum, stop) => sum + stop.nights, 0) + 1;
            const plan = suggestPlan({
              destination: destination.id,
              likes: [],
              days,
              comfort: 'budget',
            })!;
            const name = pt ? destination.namePt : destination.name;
            return (
              <li key={destination.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <h3>{name}</h3>
                  <p className={styles.route}>
                    {destination.stops.map((stop) => (pt ? stop.namePt : stop.name)).join(' → ')}
                  </p>
                  <p className={styles.range}>
                    {t('range', {
                      low: money(plan.estimate.low),
                      high: money(plan.estimate.high),
                      days,
                    })}
                  </p>
                </div>
                <form action={buildSuggestedTrip} className={styles.form}>
                  <input type="hidden" name="destination" value={destination.id} />
                  <label className={styles.field}>
                    <span>{t('days')}</span>
                    <select name="days" defaultValue={String(days)} id={`days-${destination.id}`}>
                      {[...new Set([...DAY_CHOICES, days])]
                        .sort((a, b) => a - b)
                        .map((choice) => (
                          <option key={choice} value={choice}>
                            {t('daysValue', { count: choice })}
                          </option>
                        ))}
                    </select>
                  </label>
                  <fieldset className={styles.likes}>
                    <legend>{t('likes')}</legend>
                    {SUGGEST_LIKES.map((like) => (
                      <label key={like} className={styles.chip}>
                        <input
                          type="checkbox"
                          name="likes"
                          value={like}
                          id={`like-${destination.id}-${like}`}
                        />
                        <span>{likesCopy(like)}</span>
                      </label>
                    ))}
                  </fieldset>
                  <fieldset className={styles.likes}>
                    <legend>{t('comfort')}</legend>
                    {SUGGEST_COMFORTS.map((option, index) => (
                      <label key={option} className={styles.chip}>
                        <input
                          type="radio"
                          name="comfort"
                          value={option}
                          defaultChecked={index === 0}
                          id={`comfort-${destination.id}-${option}`}
                        />
                        <span>{comfortCopy(option)}</span>
                      </label>
                    ))}
                  </fieldset>
                  <button type="submit" className={styles.build}>
                    {t('build', { name })} <span aria-hidden="true">→</span>
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
        <p className={styles.note}>{t('note')}</p>
      </section>

      {communityEnabled ? (
        <section aria-labelledby="discover-community" className={styles.section}>
          <h2 id="discover-community">{t('community')}</h2>
          <p>{t('communityBody')}</p>
          <Link href="/app/community" className={styles.link}>
            {t('communityLink')} <span aria-hidden="true">→</span>
          </Link>
        </section>
      ) : null}
    </div>
  );
}
