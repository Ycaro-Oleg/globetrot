import type { BillingView } from './billing';

/** The cache the service worker keeps the trip's screens in (`public/sw.js`). */
export const OFFLINE_CACHE = 'globetrot-trip-v1';

/**
 * Whether the current trip may be read offline (ADR-0027): a paid tool, so on a paid plan, during the free week
 * (everything is open), or on a trip with a pass. Without plan facts, no.
 */
export function offlineAllowed(billing: BillingView | null, tripId: string | null): boolean {
  if (!billing || !tripId) return false;
  if (billing.access === 'explorer' || billing.access === 'voyager' || billing.access === 'trial') {
    return true;
  }
  return billing.passes.some((pass) => pass.tripId === tripId);
}

/**
 * Forgets every saved trip screen (on sign-out, or when offline is no longer allowed). The worker is removed
 * first, so nothing is saved again on the way out.
 */
export async function clearOfflineCopies(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker?.getRegistration('/');
    // The worker still answering this page stops saving at once; then it is removed.
    navigator.serviceWorker?.controller?.postMessage({ type: 'clear' });
    registration?.active?.postMessage({ type: 'clear' });
    await registration?.unregister();
    if ('caches' in window) await caches.delete(OFFLINE_CACHE);
  } catch {
    // Nothing saved, or no service worker: nothing to clear.
  }
}
