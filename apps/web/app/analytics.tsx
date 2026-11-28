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
  const { plausibleDomain, plausibleSrc, metaPixelId, posthogKey, posthogHost } = analyticsConfig();
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
  const asks = metaPixelId !== null || posthogKey !== null;
  const open = asks && (consent === null || reopened);

  // PostHog loads only when configured: in memory until the visitor accepts, then remembered across visits.
  useEffect(() => {
    if (!posthogKey || consent === 'unknown') return;
    let cancelled = false;
    void import('posthog-js').then(({ default: posthog }) => {
      if (cancelled) return;
      const persistence = consent === 'granted' ? 'localStorage+cookie' : 'memory';
      if (window.posthog) {
        posthog.set_config({ persistence });
        return;
      }
      posthog.init(posthogKey, {
        api_host: posthogHost,
        persistence,
        person_profiles: 'identified_only',
        autocapture: false,
        disable_session_recording: true,
        capture_pageview: 'history_change',
      });
      window.posthog = posthog;
    });
    return () => {
      cancelled = true;
    };
  }, [posthogKey, posthogHost, consent]);

  const choose = (value: Consent) => {
    setReopened(false);
    writeConsent(value);
  };

  // The banner names exactly what this build would load: the Pixel, PostHog, or both.
  const tools = metaPixelId && posthogKey ? 'both' : metaPixelId ? 'pixel' : 'posthog';

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
            <h2 id="consent-title">{t('title', { tools })}</h2>
            <p>
              {t('body', { tools })} <Link href="/privacy">{t('privacy')}</Link>
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

/** Reopens the consent banner (the footer's "Cookie preferences"); shown only when something asks for consent. */
export function ConsentLink({ label }: { label: string }) {
  const { metaPixelId, posthogKey } = analyticsConfig();
  if (!metaPixelId && !posthogKey) return null;
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
