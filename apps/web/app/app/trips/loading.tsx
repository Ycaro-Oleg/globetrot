import { getTranslations } from 'next-intl/server';
import styles from './trips.module.css';

export default async function LoadingTrips() {
  const t = await getTranslations('tripWorkspace');
  return (
    <section className={styles.page} aria-busy="true" aria-live="polite">
      <p className={styles.loading}>{t('loading')}</p>
    </section>
  );
}
