import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = {
  values: new Map<string, string>(),
  getAll: () => [...store.values].map(([name, value]) => ({ name, value })),
  get: (name: string) =>
    store.values.has(name) ? { name, value: store.values.get(name)! } : undefined,
  set: vi.fn((name: string, value: string) => void store.values.set(name, value)),
  delete: vi.fn((name: string) => void store.values.delete(name)),
};

vi.mock('next/headers', () => ({ cookies: async () => store }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

import { archiveTrip, createTrip, openTrip, undoArchiveTrip } from './actions';

const ID = '01a1c28d-afc9-7767-af40-c937c80dd9dc';
const OTHER = '01a1c28d-afc9-7767-af40-c937c80dd9dd';
const KEY = '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8d9e';
const TRIP = {
  id: ID,
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

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};

/** What an action redirected to (they always redirect: that is how a form action finishes). */
async function outcome(run: () => Promise<void>): Promise<string> {
  try {
    await run();
  } catch (error) {
    const match = /^REDIRECT (.*)$/.exec((error as Error).message);
    if (match?.[1]) return match[1];
    throw error;
  }
  throw new Error('the action did not redirect');
}

let requests: Request[];
let respond: (request: Request) => Response;

beforeEach(() => {
  store.values.clear();
  store.set.mockClear();
  store.delete.mockClear();
  store.values.set('globetrot.session_token', 'abc');
  requests = [];
  respond = () => json(500, { code: 'INTERNAL' });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: Request) => {
      requests.push(input);
      return respond(input);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('without a session', () => {
  it('sends the visitor to log in and never calls the API', async () => {
    store.values.clear();
    expect(await outcome(() => openTrip(form({ tripId: ID })))).toBe('/login?next=%2Fapp%2Ftrips');
    expect(requests).toHaveLength(0);
  });
});

describe('openTrip', () => {
  it('remembers the trip and opens its overview', async () => {
    respond = () => json(200, TRIP);
    expect(await outcome(() => openTrip(form({ tripId: ID })))).toBe(`/app/trips/${ID}`);
    expect(store.set).toHaveBeenCalledWith(
      'globetrot.selected_trip',
      ID,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
    );
  });

  it("does not select a trip the API does not return (missing, or someone else's)", async () => {
    respond = () => json(404, { code: 'NOT_FOUND' });
    expect(await outcome(() => openTrip(form({ tripId: OTHER })))).toBe(
      '/app/trips?status=not-found',
    );
    expect(store.set).not.toHaveBeenCalled();
  });

  it('rejects a missing id without calling the API', async () => {
    expect(await outcome(() => openTrip(form({})))).toBe('/app/trips?status=not-found');
    expect(requests).toHaveLength(0);
  });
});

describe('createTrip', () => {
  it('posts the trip with its idempotency key, then opens it', async () => {
    respond = () => json(201, TRIP);
    const target = await outcome(() =>
      createTrip(
        form({ title: 'Japan 2027', currency: 'JPY', startDate: '', idempotencyKey: KEY }),
      ),
    );
    expect(target).toBe(`/app/trips/${ID}`);
    const request = requests[0]!;
    expect(request.method).toBe('POST');
    expect(request.headers.get('idempotency-key')).toBe(KEY);
    expect(request.headers.get('cookie')).toBe('globetrot.session_token=abc');
    expect(await request.json()).toEqual({ title: 'Japan 2027', currency: 'JPY', startDate: null });
    expect(store.values.get('globetrot.selected_trip')).toBe(ID);
  });

  it('sends a chosen start date', async () => {
    respond = () => json(201, TRIP);
    await outcome(() =>
      createTrip(
        form({ title: 'Japan', currency: 'USD', startDate: '2027-04-10', idempotencyKey: KEY }),
      ),
    );
    expect(await requests[0]!.json()).toMatchObject({ startDate: '2027-04-10' });
  });

  it('refuses a form without a valid idempotency key, before calling the API', async () => {
    expect(
      await outcome(() =>
        createTrip(form({ title: 'x', currency: 'USD', idempotencyKey: 'nope' })),
      ),
    ).toBe('/app/trips?status=create-error');
    expect(requests).toHaveLength(0);
  });

  it('refuses a form without a title', async () => {
    expect(await outcome(() => createTrip(form({ currency: 'USD', idempotencyKey: KEY })))).toBe(
      '/app/trips?status=create-error',
    );
  });

  it('shows the error when the API rejects the trip, and selects nothing', async () => {
    respond = () => json(422, { code: 'VALIDATION' });
    expect(
      await outcome(() =>
        createTrip(form({ title: 'Japan', currency: 'XXX', idempotencyKey: KEY })),
      ),
    ).toBe('/app/trips?status=create-error');
    expect(store.set).not.toHaveBeenCalled();
  });
});

describe('archiveTrip and undo', () => {
  it('archives, then selects another trip when the archived one was selected', async () => {
    store.values.set('globetrot.selected_trip', ID);
    respond = (request) =>
      request.method === 'POST'
        ? json(200, { ...TRIP, status: 'archived' })
        : json(200, { trips: [{ ...TRIP, id: OTHER }] });
    expect(await outcome(() => archiveTrip(form({ tripId: ID })))).toBe(
      `/app/trips?archived=${ID}`,
    );
    expect(store.values.get('globetrot.selected_trip')).toBe(OTHER);
  });

  it('forgets the selection when no trip is left', async () => {
    store.values.set('globetrot.selected_trip', ID);
    respond = (request) =>
      request.method === 'POST'
        ? json(200, { ...TRIP, status: 'archived' })
        : json(200, { trips: [] });
    await outcome(() => archiveTrip(form({ tripId: ID })));
    expect(store.delete).toHaveBeenCalledWith('globetrot.selected_trip');
  });

  it('keeps the selection when another trip was archived', async () => {
    store.values.set('globetrot.selected_trip', OTHER);
    respond = () => json(200, { ...TRIP, status: 'archived' });
    await outcome(() => archiveTrip(form({ tripId: ID })));
    expect(store.values.get('globetrot.selected_trip')).toBe(OTHER);
  });

  it('reports an error when the API refuses', async () => {
    respond = () => json(404, { code: 'NOT_FOUND' });
    expect(await outcome(() => archiveTrip(form({ tripId: ID })))).toBe('/app/trips?status=error');
  });

  it('undo makes the trip active again and opens it', async () => {
    respond = () => json(200, TRIP);
    expect(await outcome(() => undoArchiveTrip(form({ tripId: ID })))).toBe(`/app/trips/${ID}`);
    const request = requests[0]!;
    expect(request.method).toBe('PATCH');
    expect(await request.json()).toEqual({ status: 'active' });
  });
});
