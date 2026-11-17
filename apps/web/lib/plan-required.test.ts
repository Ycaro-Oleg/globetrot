import { describe, expect, it, vi } from 'vitest';
import { isPlanRequired } from './plan-required';
import { createServerApiClient } from './stored-preferences';

const problem = (status: number, code: string) =>
  new Response(JSON.stringify({ type: 'urn:x', title: 'x', status, code }), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  });

describe('isPlanRequired', () => {
  it('is true only for 402 PLAN_REQUIRED', async () => {
    expect(await isPlanRequired(problem(402, 'PLAN_REQUIRED'))).toBe(true);
    expect(await isPlanRequired(problem(402, 'OUT_OF_CREDITS'))).toBe(false);
    expect(await isPlanRequired(problem(402, 'TRIP_LIMIT_REACHED'))).toBe(false);
    expect(await isPlanRequired(problem(422, 'PLAN_REQUIRED'))).toBe(false);
    expect(await isPlanRequired(new Response('not json', { status: 402 }))).toBe(false);
  });

  it('leaves the body readable for the caller', async () => {
    const response = problem(402, 'PLAN_REQUIRED');
    await isPlanRequired(response);
    expect(((await response.json()) as { code: string }).code).toBe('PLAN_REQUIRED');
  });
});

describe('createServerApiClient onPlanRequired', () => {
  const client = (answer: Response, onPlanRequired: () => never) =>
    createServerApiClient({
      cookieHeader: 'globetrot.session_token=abc',
      apiUrl: 'http://api.test',
      fetch: async () => answer,
      onPlanRequired,
    });

  it('hands a refused change in a read-only account to the caller (a redirect, in server actions)', async () => {
    const onPlanRequired = vi.fn((): never => {
      throw new Error('redirected');
    });
    await expect(
      client(problem(402, 'PLAN_REQUIRED'), onPlanRequired).PUT('/v1/trips/{id}/savings', {
        params: { path: { id: 't1' } },
        body: { saved: '1' },
      }),
    ).rejects.toThrow('redirected');
    expect(onPlanRequired).toHaveBeenCalledOnce();
  });

  it('lets every other refusal through as an ordinary error', async () => {
    const onPlanRequired = vi.fn((): never => {
      throw new Error('redirected');
    });
    const { error } = await client(problem(402, 'OUT_OF_CREDITS'), onPlanRequired).PUT(
      '/v1/trips/{id}/savings',
      { params: { path: { id: 't1' } }, body: { saved: '1' } },
    );
    expect(error).toMatchObject({ code: 'OUT_OF_CREDITS' });
    expect(onPlanRequired).not.toHaveBeenCalled();
  });
});
