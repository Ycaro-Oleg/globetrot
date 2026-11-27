'use server';

import { revalidatePath } from 'next/cache';
import { CHECKLIST_GROUPS, type ChecklistGroup } from '@globetrot/domain';
import { actionApiClient } from '../../../lib/action-client';

/** "I set this aside this week". `true` when it saved. */
export async function checkIn(tripId: string, amount: string): Promise<boolean> {
  const client = await actionApiClient();
  if (!client || !tripId || !/^\d{1,12}([.,]\d{1,2})?$/.test(amount.trim())) return false;
  const { data } = await client.POST('/v1/trips/{id}/checkin', {
    params: { path: { id: tripId } },
    body: { amount: amount.trim().replace(',', '.') },
  });
  if (data) {
    revalidatePath('/app/today');
    revalidatePath('/app/budget');
  }
  return Boolean(data);
}

/** Adds a phase's suggestion to the trip's checklist, in the person's language. `true` when it did. */
export async function addPhaseTask(
  tripId: string,
  group: ChecklistGroup,
  label: string,
): Promise<boolean> {
  const client = await actionApiClient();
  if (!client || !label.trim() || !CHECKLIST_GROUPS.includes(group)) return false;
  const { data } = await client.POST('/v1/trips/{id}/checklist', {
    params: { path: { id: tripId } },
    body: { items: [{ group, label: label.trim().slice(0, 120) }] },
  });
  return Boolean(data);
}
