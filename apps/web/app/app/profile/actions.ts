'use server';

import { toPipLook } from '@globetrot/domain';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { createServerApiClient, sessionCookieHeader } from '../../../lib/stored-preferences';

/** Saves the person's Pip: its look (checked against the domain's lists by the API) and its name. */
export async function savePip(look: unknown, name: string): Promise<{ ok: boolean }> {
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  if (!cookieHeader) return { ok: false };
  const client = createServerApiClient({ cookieHeader, apiUrl: apiInternalUrl() });
  const { data } = await client.PATCH('/v1/me/preferences', {
    body: { pipLook: toPipLook(look), pipName: name.trim().slice(0, 16) || null },
  });
  // Every Pip in the app wears the new look: refresh the whole signed-in shell.
  if (data) revalidatePath('/app', 'layout');
  return { ok: Boolean(data) };
}
