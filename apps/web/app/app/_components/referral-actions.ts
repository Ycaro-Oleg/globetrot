'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { actionApiClient } from '../../../lib/action-client';
import { isReferralCode, REFERRAL_COOKIE } from '../../../lib/referral';

/** Records who sent this account, from the kept link code, then forgets the code. */
export async function claimKeptReferral(): Promise<void> {
  const store = await cookies();
  const code = store.get(REFERRAL_COOKIE)?.value;
  store.delete(REFERRAL_COOKIE);
  if (!isReferralCode(code)) return;
  const api = await actionApiClient();
  await api?.POST('/v1/me/referral/claim', { body: { code } }).catch(() => null);
}

/** Uses a free trip pass on a trip. `true` when it worked. */
export async function redeemFreePass(tripId: string): Promise<boolean> {
  const api = await actionApiClient();
  if (!api) return false;
  const { data } = await api.POST('/v1/trips/{id}/pass/redeem', {
    params: { path: { id: tripId } },
  });
  if (data) revalidatePath(`/app/trips/${tripId}`);
  return Boolean(data);
}
