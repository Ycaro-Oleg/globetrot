'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { clearOfflineCopies } from '../../../lib/offline';
import styles from './shell.module.css';

/**
 * Offline reading of the current trip (ADR-0027). When it is allowed, a service worker keeps the last version of
 * the trip's screens and saves all of them once; when it is not, nothing is kept. Without a connection, a line
 * says the screen is the last saved version.
 */
export function OfflineSupport({ enabled }: { enabled: boolean }) {
  const t = useTranslations('shell.offline');
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (!enabled) {
      void clearOfflineCopies();
      return;
    }
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => registration.active?.postMessage({ type: 'warm' }))
      .catch(() => {});
  }, [enabled]);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;
  return (
    <p className={styles.offline} role="status">
      {enabled ? t('reading') : t('noCopy')}
    </p>
  );
}
