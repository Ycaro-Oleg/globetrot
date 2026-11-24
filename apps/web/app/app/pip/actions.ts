'use server';

import type { paths } from '@globetrot/api-client';
import { cookies } from 'next/headers';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { createServerApiClient, sessionCookieHeader } from '../../../lib/stored-preferences';

export type ProposalData =
  paths['/v1/trips/{id}/pip/proposals']['post']['responses'][201]['content']['application/json'];

/** The model can take tens of seconds to answer, so asking gets a longer timeout than other calls. */
const ASK_TIMEOUT_MS = 90_000;

async function apiClient(timeoutMs?: number) {
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  return cookieHeader
    ? createServerApiClient({
        cookieHeader,
        apiUrl: apiInternalUrl(),
        ...(timeoutMs ? { timeoutMs } : {}),
      })
    : null;
}

/** The API's problem code on failure, so the screen can say the right thing. */
export type PipFailure = {
  error: 'RATE_LIMITED' | 'SERVICE_UNAVAILABLE' | 'OUT_OF_CREDITS' | 'PLAN_REQUIRED' | 'UNKNOWN';
};
const KNOWN = ['RATE_LIMITED', 'SERVICE_UNAVAILABLE', 'OUT_OF_CREDITS', 'PLAN_REQUIRED'] as const;
const failure = (error: unknown): PipFailure => {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  const known = KNOWN.find((candidate) => candidate === code);
  return { error: known ?? 'UNKNOWN' };
};

export async function askPip(tripId: string, request: string): Promise<ProposalData | PipFailure> {
  const client = await apiClient(ASK_TIMEOUT_MS);
  if (!client) return { error: 'UNKNOWN' };
  try {
    const { data, error } = await client.POST('/v1/trips/{id}/pip/proposals', {
      params: { path: { id: tripId } },
      body: { request: request.trim().slice(0, 500) },
    });
    return data ?? failure(error);
  } catch {
    // A timeout or a dropped connection: the same answer as "Pip is not available".
    return { error: 'SERVICE_UNAVAILABLE' };
  }
}

export async function decide(
  proposalId: string,
  action: 'apply' | 'discard' | 'undo',
  include: number[] = [],
): Promise<ProposalData | null> {
  const client = await apiClient();
  if (!client) return null;
  const path = { params: { path: { proposalId } } };
  try {
    const { data } =
      action === 'apply'
        ? await client.POST('/v1/pip/proposals/{proposalId}/apply', { ...path, body: { include } })
        : action === 'discard'
          ? await client.POST('/v1/pip/proposals/{proposalId}/discard', path)
          : await client.POST('/v1/pip/proposals/{proposalId}/undo', path);
    return data ?? null;
  } catch {
    return null;
  }
}
