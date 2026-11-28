'use client';

import Link from 'next/link';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import type { PostHog } from 'posthog-js';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  adminCheckNeeded,
  analyticsConfig,
  flushPendingEvents,
  INTERNAL_EVENT,
  internalParam,
  isExcluded,
  isInternal,
  measurementConfigured,
  pageLocale,
  prepareEvent,
  readConsent,
  rememberAdminCheck,
  rememberVisitOrigin,
  setInternal,
  writeConsent,
  type Consent,
} from '../lib/analytics';
import styles from './analytics.module.css';

const META_LOADER = (
  id: string,
) => `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');`;

const subscribeInternal = (notify: () => void) => {
  window.addEventListener(INTERNAL_EVENT, notify);
  window.addEventListener('storage', notify);
  return () => {
    window.removeEventListener(INTERNAL_EVENT, notify);
    window.removeEventListener('storage', notify);
  };
};

/**
 * Loads the configured measurement (ADR-0018, ADR-0021): Plausible always (cookieless), PostHog cookieless until
 * the visitor accepts, the Meta Pixel only after the visitor accepts. The banner offers Accept and Reject with the
 * same weight, and can be reopened from the footer ("Cookie preferences"). A team device (`?interno=1`, or an
 * admin account) loads nothing and says so at the bottom of the page.
 */
export function Analytics() {
  const t = useTranslations('consent');
  const pathname = usePathname();
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
  // Same for the team mark: nothing loads until the page knows the device is not the team's.
  const excluded = useSyncExternalStore<boolean | 'unknown'>(
    subscribeInternal,
    () => isExcluded(window.location.search),
    () => 'unknown',
  );
  const [reopened, setReopened] = useState(false);
  const posthogRef = useRef<PostHog | null>(null);
  useEffect(() => {
    const reopen = () => setReopened(true);
    window.addEventListener('globetrot:consent-open', reopen);
    return () => window.removeEventListener('globetrot:consent-open', reopen);
  }, []);

  // Each page: honour `?interno=`, keep the visit's origin (first page only), and send what the server left.
  useEffect(() => {
    const asked = internalParam(window.location.search);
    if (asked !== null && asked !== isInternal()) setInternal(asked);
    rememberVisitOrigin({
      search: window.location.search,
      referrer: document.referrer,
      host: window.location.hostname,
      pathname: window.location.pathname,
    });
    flushPendingEvents();
  }, [pathname]);

  // A device marked while the Pixel was already loaded stops it too.
  useEffect(() => {
    if (excluded === true) window.fbq?.('consent', 'revoke');
  }, [excluded]);

  const asks = metaPixelId !== null || posthogKey !== null;
  const open = asks && excluded === false && (consent === null || reopened);

  // PostHog loads only when configured and not on a team device. Before an answer and after a refusal it counts
  // without cookies or storage (an anonymous hash on PostHog's side); after Accept it remembers the visitor.
  useEffect(() => {
    if (!posthogKey || consent === 'unknown' || excluded !== false) return;
    let cancelled = false;
    void import('posthog-js').then(({ default: posthog }) => {
      if (cancelled) return;
      const granted = consent === 'granted';
      if (posthogRef.current) {
        posthog.set_config({ persistence: granted ? 'localStorage+cookie' : 'memory' });
        if (granted) posthog.opt_in_capturing();
        else posthog.opt_out_capturing();
        return;
      }
      posthog.init(posthogKey, {
        api_host: posthogHost,
        persistence: granted ? 'localStorage+cookie' : 'memory',
        cookieless_mode: 'on_reject',
        opt_out_capturing_by_default: !granted,
        person_profiles: 'identified_only',
        autocapture: false,
        disable_session_recording: true,
        capture_pageview: 'history_change',
        // Checked on every event, so a device marked later stops at once.
        before_send: (event) => prepareEvent(event, isInternal(), pageLocale()),
      });
      posthogRef.current = posthog;
      window.posthog = posthog;
    });
    return () => {
      cancelled = true;
    };
  }, [posthogKey, posthogHost, consent, excluded]);

  const choose = (value: Consent) => {
    setReopened(false);
    writeConsent(value);
  };

  return (
    <>
      {plausibleDomain && excluded === false ? (
        <Script
          defer
          data-domain={plausibleDomain}
          event-locale={pageLocale()}
          src={plausibleSrc}
          strategy="afterInteractive"
        />
      ) : null}
      {metaPixelId && consent === 'granted' && excluded === false ? (
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
      {excluded === true ? (
        <p className={styles.internalNote} role="note">
          {t('internalNote')}
        </p>
      ) : null}
    </>
  );
}

/**
 * Marks the browser of an admin account (`ADMIN_EMAILS`) as the team's, so it stays out of the numbers, also after
 * signing out. It asks the admin dashboard's endpoint once per account and visit (another account on the same tab
 * is asked about again): it answers only admins, and "not found" to everyone else. Nothing is asked when no
 * measurement is configured. `accountId` stays in the tab; it is never sent to any analytics tool.
 */
export function InternalAccountCheck({ accountId }: { accountId: string }) {
  useEffect(() => {
    if (!measurementConfigured() || isInternal() || !adminCheckNeeded(accountId)) return;
    const controller = new AbortController();
    fetch('/v1/admin/metrics', { credentials: 'same-origin', signal: controller.signal })
      .then((response) => {
        rememberAdminCheck(accountId);
        if (response.ok) setInternal(true);
      })
      .catch(() => {
        // Ask again on the next page.
      });
    return () => controller.abort();
  }, [accountId]);
  return null;
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
