/**
 * Measurement (ADR-0018, ADR-0021). Off unless configured at build time:
 * - `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`: Plausible, cookieless and aggregate, so it needs no consent;
 * - `NEXT_PUBLIC_META_PIXEL_ID`: the Meta Pixel, loaded **only after the visitor accepts** marketing cookies;
 * - `NEXT_PUBLIC_POSTHOG_KEY`: PostHog product analytics (funnels, retention), kept in memory only until the
 *   visitor accepts, then remembered across visits.
 * Events never carry personal data: no email, no name, no trip content, no amounts.
 */

export const CONSENT_COOKIE = 'globetrot.consent';
export type Consent = 'granted' | 'denied';

/** The moments a campaign optimises for, and the product's own steps (funnel and retention). */
export type ConversionEvent =
  | 'cta_click'
  | 'plan_saved'
  | 'sign_up'
  | 'first_trip'
  | 'trip_shared'
  | 'plan_built'
  | 'trip_created'
  | 'savings_goal_set'
  | 'savings_checkin'
  | 'member_invited'
  | 'member_joined'
  | 'pass_bought';

/** Only the campaign moments reach the Meta Pixel; the product steps stay in Plausible and PostHog. */
const META_EVENTS: Partial<
  Record<ConversionEvent, [method: 'track' | 'trackCustom', name: string]>
> = {
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
  posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY || null,
  posthogHost: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
});

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string> }) => void;
    fbq?: (...args: unknown[]) => void;
    posthog?: { capture: (event: string) => void };
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
    window.posthog?.capture(event);
    const meta = META_EVENTS[event];
    if (meta && readConsent() === 'granted' && window.fbq) window.fbq(meta[0], meta[1]);
  } catch {
    // Measurement must never break the page.
  }
}
