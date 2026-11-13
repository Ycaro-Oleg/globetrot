import { Banner } from '@globetrot/ui';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { VisaData } from '../../../lib/trips';
import styles from './passport.module.css';

/** Ring colours cycle so neighbouring stamps differ; the text never depends on them. */
const INKS = ['airmail', 'confirmed', 'danger', 'sea', 'thread'] as const;
/** Small fixed tilts, so the page looks stamped by hand but renders the same every time. */
const TILTS = [-8, 5, -3, 7, -6, 2];

function countryName(locale: string, code: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * The commemorative passport. Visas are souvenirs, labelled as such: never an official document. Newest first,
 * as the API returns them. An empty passport says how to earn the first visa and leads to the board.
 */
export function PassportView({ visas }: { visas: readonly VisaData[] | null }) {
  const t = useTranslations('passportPage');
  const locale = useLocale();

  if (visas === null) {
    return (
      <section className={styles.page}>
        <h1>{t('title')}</h1>
        <Banner tone="error" role="alert">
          {t('loadError')}
        </Banner>
      </section>
    );
  }

  const longDate = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' });
  const stampDate = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const first = visas.at(-1);

  return (
    <section className={styles.page}>
      <p className={styles.eyebrow}>{t('eyebrow')}</p>
      <h1>{t('title')}</h1>
      <p className={styles.lead}>
        {t('lead', { count: visas.length })}{' '}
        {first ? t('since', { date: longDate.format(new Date(first.stampedAt)) }) : null}
      </p>

      {visas.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyStamp} aria-hidden="true">
            <span>{t('entry')}</span>
            <strong>?</strong>
          </div>
          <div>
            <h2>{t('emptyTitle')}</h2>
            <p>{t('emptyBody')}</p>
            <Link className={styles.action} href="/app/board">
              {t('goBoard')}
            </Link>
          </div>
        </div>
      ) : (
        <ul className={styles.stamps} aria-label={t('listLabel')}>
          {visas.map((visa, index) => {
            const country = countryName(locale, visa.countryCode);
            const when = new Date(visa.stampedAt);
            return (
              <li
                key={visa.countryCode}
                className={styles.visa}
                data-ink={INKS[index % INKS.length]}
              >
                <div
                  className={styles.stamp}
                  style={{ rotate: `${TILTS[index % TILTS.length]}deg` }}
                  aria-hidden="true"
                >
                  <span>{t('entry')}</span>
                  <strong>{visa.countryCode}</strong>
                  <span>{stampDate.format(when).replace(/\./g, '').toUpperCase()}</span>
                </div>
                <h2>{t('country', { country, code: visa.countryCode })}</h2>
                <p>{t('stampedIn', { city: visa.city, date: longDate.format(when) })}</p>
              </li>
            );
          })}
        </ul>
      )}

      <p className={styles.disclaimer}>{t('disclaimer')}</p>
    </section>
  );
}
