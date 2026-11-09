import { describe, expect, it, vi } from 'vitest';
import { fetchTrip, fetchTrips } from './trips';

const TRIP = {
  id: '01a1c28d-afc9-7767-af40-c937c80dd9dc',
  title: 'Japan 2027',
  startDate: null,
  currency: 'JPY',
  status: 'active',
  visibility: 'private',
  createdAt: '2026-11-08T12:00:00.000Z',
  updatedAt: '2026-11-08T12:00:00.000Z',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const options = (fetchImpl: typeof fetch) => ({
  cookieHeader: 'globetrot.session_token=abc',
  apiUrl: 'http://api.internal:4000',
  fetch: fetchImpl,
});

describe('fetchTrips', () => {
  it('returns the trips and forwards the session cookie', async () => {
    const fetchImpl = vi.fn(async (request: Request) => {
      expect(request.headers.get('cookie')).toBe('globetrot.session_token=abc');
      return json(200, { trips: [TRIP] });
    });
    expect(await fetchTrips(options(fetchImpl as unknown as typeof fetch))).toEqual([TRIP]);
  });

  it('asks for archived trips only when told to', async () => {
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (request: Request) => {
      urls.push(request.url);
      return json(200, { trips: [] });
    });
    await fetchTrips(options(fetchImpl as unknown as typeof fetch));
    await fetchTrips(options(fetchImpl as unknown as typeof fetch), true);
    expect(urls[0]).toContain('includeArchived=false');
    expect(urls[1]).toContain('includeArchived=true');
  });

  it('is null, not an exception, when there is no session or the API fails', async () => {
    const unauthorized = async () => json(401, { code: 'UNAUTHENTICATED' });
    const broken = async () => {
      throw new Error('connection refused');
    };
    expect(await fetchTrips(options(unauthorized as unknown as typeof fetch))).toBeNull();
    expect(await fetchTrips(options(broken as unknown as typeof fetch))).toBeNull();
  });
});

describe('fetchTrip', () => {
  it('returns the trip', async () => {
    const fetchImpl = async () => json(200, TRIP);
    expect(await fetchTrip(options(fetchImpl as unknown as typeof fetch), TRIP.id)).toEqual(TRIP);
  });

  it("is null for a trip that is not there (or is someone else's: the API answers the same)", async () => {
    const fetchImpl = async () => json(404, { code: 'NOT_FOUND' });
    expect(await fetchTrip(options(fetchImpl as unknown as typeof fetch), TRIP.id)).toBeNull();
  });
});
