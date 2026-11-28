/**
 * Measurement (ADR-0018, ADR-0021). Off unless configured at build time:
 * - `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`: Plausible, cookieless and aggregate, so it needs no consent;
 * - `NEXT_PUBLIC_META_PIXEL_ID`: the Meta Pixel, loaded **only after the visitor accepts** marketing cookies;
 * - `NEXT_PUBLIC_POSTHOG_KEY`: PostHog product analytics (funnels, retention), cookieless until the visitor
 *   accepts, then remembered across visits.
 * Events never carry personal data: no email, no name, no trip content, no amounts. The only property is the
 * page's `locale`. The team's own devices send nothing (`docs/engineering/analytics.md`).
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

const CONVERSION_EVENTS: readonly ConversionEvent[] = [
  'cta_click',
  'plan_saved',
  'sign_up',
  'first_trip',
  'trip_shared',
  'plan_built',
  'trip_created',
  'savings_goal_set',
  'savings_checkin',
  'member_invited',
  'member_joined',
  'pass_bought',
];

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

/** Whether any measurement is configured at all; without it there is nothing to exclude or ask. */
export const measurementConfigured = () => {
  const { plausibleDomain, metaPixelId, posthogKey } = analyticsConfig();
  return Boolean(plausibleDomain || metaPixelId || posthogKey);
};

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

// ---------------------------------------------------------------------------------------------------------------
// The team's own devices (the internal mark)
// ---------------------------------------------------------------------------------------------------------------

/** A browser marked as the team's: it sends nothing until the mark is cleared. Kept on the device only. */
export const INTERNAL_KEY = 'globetrot.internal';
/** `?interno=1` on any page marks the browser, `?interno=0` clears it (`docs/engineering/analytics.md`). */
export const INTERNAL_PARAM = 'interno';
/** Plausible's own switch: its script skips every pageview and event while this is set. */
const PLAUSIBLE_IGNORE_KEY = 'plausible_ignore';
/** Set once a tab has asked whether the signed-in account is an admin, so it asks once per visit. */
export const ADMIN_CHECKED_KEY = 'globetrot.admin_checked';
export const INTERNAL_EVENT = 'globetrot:internal';

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStore(kind: 'localStorage' | 'sessionStorage'): KeyValueStore | null {
  try {
    return typeof window === 'undefined' ? null : window[kind];
  } catch {
    // Storage can be switched off; measurement then just has less to go on.
    return null;
  }
}

/** What a page address asks of the internal mark: `true` to set it, `false` to clear it, `null` for nothing. */
export function internalParam(search: string): boolean | null {
  const value = new URLSearchParams(search).get(INTERNAL_PARAM);
  return value === '1' ? true : value === '0' ? false : null;
}

export function isInternal(store: KeyValueStore | null = browserStore('localStorage')): boolean {
  try {
    return store?.getItem(INTERNAL_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Whether this page view must send nothing: the device is marked, or the address is marking it right now (the
 * mark is written a moment later, and the first pageview must not slip through before it).
 */
export function isExcluded(
  search: string,
  store: KeyValueStore | null = browserStore('localStorage'),
): boolean {
  const asked = internalParam(search);
  return asked ?? isInternal(store);
}

export function setInternal(
  on: boolean,
  store: KeyValueStore | null = browserStore('localStorage'),
) {
  try {
    if (on) {
      store?.setItem(INTERNAL_KEY, '1');
      store?.setItem(PLAUSIBLE_IGNORE_KEY, 'true');
    } else {
      store?.removeItem(INTERNAL_KEY);
      store?.removeItem(PLAUSIBLE_IGNORE_KEY);
    }
  } catch {
    // Nothing to remember it in: the page still sends nothing while `?interno=1` is in the address.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(INTERNAL_EVENT));
}

// ---------------------------------------------------------------------------------------------------------------
// Once per action
// ---------------------------------------------------------------------------------------------------------------

const ONCE_KEY = 'globetrot.tracked';
const ONCE_LIMIT = 50;

/**
 * `true` the first time this tab sees `id`, `false` after. A re-render, a reload or a back button then never
 * counts the same action twice. Without storage it lets the event through.
 */
export function firstTime(
  id: string,
  store: KeyValueStore | null = browserStore('sessionStorage'),
): boolean {
  if (!store) return true;
  try {
    const seen = (store.getItem(ONCE_KEY) ?? '').split('|').filter(Boolean);
    if (seen.includes(id)) return false;
    store.setItem(ONCE_KEY, [...seen, id].slice(-ONCE_LIMIT).join('|'));
  } catch {
    // Fall through: better one count too many than a page that breaks.
  }
  return true;
}

// ---------------------------------------------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------------------------------------------

export type AnalyticsLocale = 'en' | 'pt-BR';

/** The language the page is shown in, the one property every event and pageview carries. */
export function pageLocale(): AnalyticsLocale {
  return typeof document !== 'undefined' && document.documentElement.lang === 'pt-BR'
    ? 'pt-BR'
    : 'en';
}

/**
 * PostHog's last step before an event leaves (pageviews included): nothing from the team's devices, and the
 * page's `locale` added. It never adds anything else.
 */
export function prepareEvent<T extends { properties?: Record<string, unknown> }>(
  event: T | null,
  excluded: boolean,
  locale: AnalyticsLocale,
): T | null {
  if (!event || excluded) return null;
  return { ...event, properties: { ...event.properties, locale } };
}

/**
 * Records a conversion in whatever is loaded; does nothing when nothing is configured or allowed, or on a team
 * device. With `once`, the same action (`event` + `once`, for example a trip's id) counts a single time per tab.
 */
export function track(event: ConversionEvent, once?: string) {
  if (typeof window === 'undefined') return;
  try {
    if (isExcluded(window.location.search)) return;
    if (once !== undefined && !firstTime(`${event}:${once}`)) return;
    window.plausible?.(event, { props: { locale: pageLocale() } });
    window.posthog?.capture(event);
    const meta = META_EVENTS[event];
    if (meta && readConsent() === 'granted' && window.fbq) window.fbq(meta[0], meta[1]);
  } catch {
    // Measurement must never break the page.
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Events finished on the server
// ---------------------------------------------------------------------------------------------------------------

/**
 * A server action or route that finishes an action and redirects (a trip created, the onboarding done) leaves the
 * event here for the next page to send. Short-lived, readable by the page, and it holds only event names and an
 * id to count each one once.
 */
export const EVENTS_COOKIE = 'globetrot.events';
const ONCE_PATTERN = /^[\w-]{1,64}$/;

export interface PendingEvent {
  readonly event: ConversionEvent;
  readonly once: string;
}

export function parsePendingEvents(raw: string | undefined | null): PendingEvent[] {
  if (!raw) return [];
  let text: string;
  try {
    text = decodeURIComponent(raw);
  } catch {
    return [];
  }
  return text.split('|').flatMap((part) => {
    const [event, once] = part.split('~');
    return CONVERSION_EVENTS.includes(event as ConversionEvent) && once && ONCE_PATTERN.test(once)
      ? [{ event: event as ConversionEvent, once }]
      : [];
  });
}

interface CookieWriter {
  get(name: string): { value: string } | undefined;
  set(
    name: string,
    value: string,
    options: { path: string; maxAge: number; sameSite: 'lax'; httpOnly: boolean; secure: boolean },
  ): unknown;
}

/** Leaves events for the next page (see `EVENTS_COOKIE`). Called on the server, before the redirect. */
export function queueEvents(store: CookieWriter, ...events: PendingEvent[]) {
  const kept = [...parsePendingEvents(store.get(EVENTS_COOKIE)?.value), ...events]
    .filter((item) => ONCE_PATTERN.test(item.once))
    .slice(-10);
  if (kept.length === 0) return;
  store.set(
    EVENTS_COOKIE,
    encodeURIComponent(kept.map((item) => `${item.event}~${item.once}`).join('|')),
    {
      path: '/',
      maxAge: 120,
      sameSite: 'lax',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
    },
  );
}

/** Sends and clears the events the server left; each counts once thanks to its id. */
export function flushPendingEvents() {
  if (typeof document === 'undefined') return;
  const match = new RegExp(`(?:^|; )${EVENTS_COOKIE.replace('.', '\\.')}=([^;]*)`).exec(
    document.cookie,
  );
  if (!match) return;
  document.cookie = `${EVENTS_COOKIE}=; path=/; max-age=0; samesite=lax`;
  for (const item of parsePendingEvents(match[1])) track(item.event, item.once);
}

// ---------------------------------------------------------------------------------------------------------------
// Where a visit came from
// ---------------------------------------------------------------------------------------------------------------

/**
 * The origin of a visit, kept in the tab's `sessionStorage` from its first page: no cookie, no id, gone when the
 * tab closes. The interest list and the sign-up send it along (#192).
 */
export const ORIGIN_KEY = 'globetrot.origin';
const ORIGIN_MAX = 100;

export interface VisitOrigin {
  readonly utmSource: string;
  readonly utmMedium: string;
  readonly utmCampaign: string;
  /** The referring site's domain only, never its address; empty for a direct visit or the site itself. */
  readonly referrer: string;
  /** The first page's path, at most two segments deep, so no token in a path is ever kept. */
  readonly landing: string;
}

export function visitOrigin(input: {
  search: string;
  referrer: string;
  host: string;
  pathname: string;
}): VisitOrigin {
  const params = new URLSearchParams(input.search);
  const cut = (value: string | null) => (value ?? '').trim().slice(0, ORIGIN_MAX);
  let referrer = '';
  try {
    const from = new URL(input.referrer).hostname.replace(/^www\./, '');
    if (from !== input.host.replace(/^www\./, '')) referrer = from;
  } catch {
    // No referrer, or not a URL: a direct visit.
  }
  const landing = `/${input.pathname.split('/').filter(Boolean).slice(0, 2).join('/')}`;
  return {
    utmSource: cut(params.get('utm_source')),
    utmMedium: cut(params.get('utm_medium')),
    utmCampaign: cut(params.get('utm_campaign')),
    referrer: cut(referrer),
    landing: cut(landing),
  };
}

/** Keeps the origin of the visit's first page; later pages of the same tab change nothing. */
export function rememberVisitOrigin(
  input: Parameters<typeof visitOrigin>[0],
  store: KeyValueStore | null = browserStore('sessionStorage'),
) {
  try {
    if (!store || store.getItem(ORIGIN_KEY)) return;
    store.setItem(ORIGIN_KEY, JSON.stringify(visitOrigin(input)));
  } catch {
    // No storage: the lead and the sign-up go without an origin.
  }
}

/** The origin kept for this tab, or `null` when there is none or it was tampered with. */
export function readVisitOrigin(
  store: KeyValueStore | null = browserStore('sessionStorage'),
): VisitOrigin | null {
  try {
    const value: unknown = JSON.parse(store?.getItem(ORIGIN_KEY) ?? 'null');
    if (typeof value !== 'object' || value === null) return null;
    const fields = ['utmSource', 'utmMedium', 'utmCampaign', 'referrer', 'landing'] as const;
    const record = value as Record<string, unknown>;
    if (!fields.every((field) => typeof record[field] === 'string')) return null;
    return Object.fromEntries(
      fields.map((field) => [field, (record[field] as string).slice(0, ORIGIN_MAX)]),
    ) as unknown as VisitOrigin;
  } catch {
    return null;
  }
}
