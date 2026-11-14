/**
 * Conversion measurement for launch campaigns (ADR-0018). Off unless configured at build time:
 * - `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`: Plausible, cookieless and aggregate, so it needs no consent;
 * - `NEXT_PUBLIC_META_PIXEL_ID`: the Meta Pixel, loaded **only after the visitor accepts** marketing cookies.
 * Events never carry personal data: no email, no name, no trip content, no amounts.
 */

export const CONSENT_COOKIE = 'globetrot.consent';
export type Consent = 'granted' | 'denied';

/** The moments a campaign optimises for. */
export type ConversionEvent = 'cta_click' | 'plan_saved' | 'sign_up' | 'first_trip' | 'trip_shared';

const META_EVENTS: Record<ConversionEvent, [method: 'track' | 'trackCustom', name: string]> = {
  cta_click: ['trackCustom', 'StartPlanningClick'],
  plan_saved: ['track', 'Lead'],
  sign_up: ['track', 'CompleteRegistration'],
  first_trip: ['trackCustom', 'FirstTripCreated'],
  trip_shared: ['trackCustom', 'TripShared'],
};

export const analyticsConfig = () => ({
  plausibleDomain: process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || null,
  plausibleSrc: process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || 'https://plausible.io/js/script.js',
  metaPixelId: /^\d{5,20}$/.test(process.env.NEXT_PUBLIC_META_PIXEL_ID ?? '')
    ? (process.env.NEXT_PUBLIC_META_PIXEL_ID as string)
    : null,
});

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string> }) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

export function readConsent(): Consent | null {
  if (typeof document === 'undefined') return null;
  const match = new RegExp(`(?:^|; )${CONSENT_COOKIE.replace('.', '\\.')}=(granted|denied)`).exec(
    document.cookie,
  );
  return (match?.[1] as Consent | undefined) ?? null;
}

export function writeConsent(consent: Consent) {
  document.cookie = `${CONSENT_COOKIE}=${consent}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`;
  window.dispatchEvent(new CustomEvent('globetrot:consent', { detail: consent }));
}

/** Records a conversion in whatever is loaded; does nothing when nothing is configured or allowed. */
export function track(event: ConversionEvent) {
  if (typeof window === 'undefined') return;
  try {
    window.plausible?.(event);
    if (readConsent() === 'granted' && window.fbq) {
      const [method, name] = META_EVENTS[event];
      window.fbq(method, name);
    }
  } catch {
    // Measurement must never break the page.
  }
}
