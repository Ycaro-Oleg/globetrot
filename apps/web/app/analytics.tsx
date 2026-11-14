'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { analyticsConfig, readConsent, writeConsent, type Consent } from '../lib/analytics';
import styles from './analytics.module.css';

const META_LOADER = (
  id: string,
) => `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');`;

/**
 * Loads the configured measurement (ADR-0018): Plausible always (cookieless), the Meta Pixel only after the
 * visitor accepts. The banner offers Accept and Reject with the same weight, and can be reopened from the
 * footer ("Cookie preferences").
 */
export function Analytics() {
  const t = useTranslations('consent');
  const { plausibleDomain, plausibleSrc, metaPixelId } = analyticsConfig();
  // The cookie is the source of truth; the server knows nothing ('unknown'), so nothing renders there.
  const consent = useSyncExternalStore<Consent | null | 'unknown'>(
    (notify) => {
      window.addEventListener('globetrot:consent', notify);
      return () => window.removeEventListener('globetrot:consent', notify);
    },
    readConsent,
    () => 'unknown',
  );
  const [reopened, setReopened] = useState(false);
  useEffect(() => {
    const reopen = () => setReopened(true);
    window.addEventListener('globetrot:consent-open', reopen);
    return () => window.removeEventListener('globetrot:consent-open', reopen);
  }, []);
  const open = metaPixelId !== null && (consent === null || reopened);

  const choose = (value: Consent) => {
    setReopened(false);
    writeConsent(value);
  };

  return (
    <>
      {plausibleDomain ? (
        <Script
          defer
          data-domain={plausibleDomain}
          src={plausibleSrc}
          strategy="afterInteractive"
        />
      ) : null}
      {metaPixelId && consent === 'granted' ? (
        <Script id="meta-pixel" strategy="afterInteractive">
          {META_LOADER(metaPixelId)}
        </Script>
      ) : null}
      {open ? (
        <section className={styles.banner} aria-labelledby="consent-title" role="region">
          <div>
            <h2 id="consent-title">{t('title')}</h2>
            <p>
              {t('body')} <Link href="/privacy">{t('privacy')}</Link>
            </p>
          </div>
          <div className={styles.actions}>
            <button type="button" onClick={() => choose('denied')}>
              {t('reject')}
            </button>
            <button type="button" onClick={() => choose('granted')}>
              {t('accept')}
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}

/** Reopens the consent banner (the footer's "Cookie preferences"); shown only when the Pixel is configured. */
export function ConsentLink({ label }: { label: string }) {
  if (!analyticsConfig().metaPixelId) return null;
  return (
    <button
      type="button"
      className={styles.link}
      onClick={() => window.dispatchEvent(new Event('globetrot:consent-open'))}
    >
      {label}
    </button>
  );
}
