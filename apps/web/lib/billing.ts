import type { paths } from '@globetrot/api-client';
import { createServerApiClient, type FetchOptions } from './stored-preferences';

export type BillingView =
  paths['/v1/me/billing']['get']['responses'][200]['content']['application/json'];

/** The person's plan, trial and Pip credits, or null when they cannot be read (pages then show nothing about it). */
export async function fetchBilling(options: FetchOptions): Promise<BillingView | null> {
  try {
    const { data } = await createServerApiClient(options).GET('/v1/me/billing');
    return data ?? null;
  } catch {
    return null;
  }
}
