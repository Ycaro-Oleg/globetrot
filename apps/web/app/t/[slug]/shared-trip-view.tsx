import { formatMoney, fromDecimal } from '@globetrot/domain';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { formatMonth, type SharedTrip } from '../../../lib/shared-trip';
import { arcPath, routeSketch, visibleLabels } from '../../../lib/route-sketch';
import { Logomark } from '../../logomark';
import { SITE_NAME } from '../../site';
import { TrackedLink } from '../../tracked-link';
import styles from './shared-trip.module.css';

const W = 640;
const H = 260;

export function SharedTripView({ trip, locale }: { trip: SharedTrip; locale: string }) {
  const t = useTranslations('sharedTrip');
  const country = (code: string | null) => {
    if (!code) return null;
    try {
      return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
    } catch {
      return code;
    }
  };
  const amount = (value: { amount: string; currency: string }) =>
    formatMoney(fromDecimal(value.amount, value.currency), locale, {
      precision: 'whole',
    });
  const points = routeSketch(trip.stops, W, H, 36);
  const labelled = visibleLabels(points);
  const percent = Math.round(trip.savings.progressBasisPoints / 100);

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <Link href="/" className={styles.logo}>
          <Logomark className={styles.logoRing} />
          {SITE_NAME}
        </Link>
      </header>

      <section className={styles.hero}>
        <p className={styles.kicker}>{t('kicker')}</p>
        <h1>{trip.title}</h1>
        <p className={styles.meta}>
          {t('meta', {
            month: trip.startMonth ? formatMonth(trip.startMonth, locale) : t('noDate'),
            nights: trip.totalNights,
            stops: trip.stops.length,
          })}
        </p>
      </section>

      {points.length > 0 ? (
        <figure className={styles.map}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('mapLabel')}>
            <defs>
              <pattern id="paper" width="16" height="16" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.6" className={styles.dot} />
              </pattern>
            </defs>
            <rect width={W} height={H} fill="url(#paper)" />
            {points.slice(1).map((point, index) => (
              <path
                key={`arc-${index}`}
                d={arcPath(points[index]!, point)}
                className={styles.arc}
              />
            ))}
            {points.map((point, index) => {
              const right = point.x < W - 160;
              return (
                <g key={`pin-${index}`}>
                  <circle cx={point.x} cy={point.y} r="18" className={styles.pin} />
                  <text
                    x={point.x}
                    y={point.y + 6}
                    textAnchor="middle"
                    className={styles.pinNumber}
                  >
                    {index + 1}
                  </text>
                  {labelled[index] ? (
                    <text
                      x={right ? point.x + 26 : point.x - 26}
                      y={point.y + 6}
                      textAnchor={right ? 'start' : 'end'}
                      className={styles.pinLabel}
                    >
                      {trip.stops[index]!.name}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        </figure>
      ) : null}

      <section className={styles.card} aria-labelledby="route-title">
        <h2 id="route-title">{t('routeLabel')}</h2>
        <ol className={styles.stops}>
          {trip.stops.map((stop, index) => (
            <li key={`${stop.name}-${index}`}>
              <span className={styles.number} aria-hidden="true">
                {index + 1}
              </span>
              <span className={styles.stopName}>
                {stop.name}
                {country(stop.countryCode) ? (
                  <span className={styles.country}>{country(stop.countryCode)}</span>
                ) : null}
              </span>
              <span className={styles.nights}>{t('nights', { count: stop.nights })}</span>
            </li>
          ))}
        </ol>
      </section>

      {trip.savings.status !== 'no-costs' ? (
        <section className={styles.card} aria-labelledby="answer-title">
          <h2 id="answer-title">{t('answerTitle')}</h2>
          <p className={styles.answer}>
            {trip.savings.status === 'fully-saved'
              ? t('saved')
              : trip.savings.readyMonth
                ? t('ready', { month: formatMonth(trip.savings.readyMonth, locale) })
                : t('noPlan')}
          </p>
          <div
            className={styles.bar}
            role="meter"
            aria-label={t('progress', { percent })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <span style={{ width: `${percent}%` }} />
          </div>
          <p className={styles.small}>
            {trip.amounts
              ? t('amounts', {
                  saved: amount(trip.amounts.saved),
                  total: amount(trip.amounts.total),
                  monthly: amount(trip.amounts.monthly),
                })
              : t('progress', { percent })}
          </p>
        </section>
      ) : null}

      <section className={styles.cta}>
        <h2>{t('ctaTitle')}</h2>
        <p>{t('ctaBody')}</p>
        <TrackedLink href="/signup" event="cta_click" className={styles.ctaButton}>
          {t('cta')} <span aria-hidden="true">→</span>
        </TrackedLink>
      </section>

      <p className={styles.note}>{t('note')}</p>
    </main>
  );
}
