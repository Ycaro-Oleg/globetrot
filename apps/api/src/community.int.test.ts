// The community against a real PostgreSQL: the feed's visibility rule in SQL, handles, likes, comments,
// follows, mutes, reports, route copies, and that another person's private things answer "not found".
import { randomBytes } from 'node:crypto';
import { createFakeEmail } from '@globetrot/application/testing';
import { createTestDatabase, type TestDatabase } from '@globetrot/db/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { loadApiConfig } from './config';
import { createServices } from './wire';

const PASSWORD = 'correct horse battery staple';
const databases: TestDatabase[] = [];
afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.drop()));
});

let addressCounter = 0;
const nextAddress = () => `198.18.4.${++addressCounter}`;

async function harness() {
  const database = await createTestDatabase();
  databases.push(database);
  const config = loadApiConfig({
    NODE_ENV: 'test',
    DATABASE_URL: database.url,
    BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
    REQUIRE_VERIFIED_EMAIL: 'false',
  });
  const { app } = createServices(database.db, config, { email: createFakeEmail().port });
  const origin = config.auth.baseURL;

  let people = 0;
  async function signUp(name: string) {
    const response = await app.request(`${origin}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json', 'x-forwarded-for': nextAddress() },
      body: JSON.stringify({
        name,
        email: `person${++people}@example.test`,
        password: PASSWORD,
      }),
    });
    expect(response.status).toBe(200);
    return response.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
  }
  const call = async (cookie: string | null, method: string, path: string, body?: unknown) => {
    const response = await app.request(`${origin}${path}`, {
      method,
      headers: {
        origin,
        ...(cookie ? { cookie } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    // The answers are checked against the contract loosely here; the OpenAPI types are tested elsewhere.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose reads of JSON answers in a test
    return { status: response.status, json: (await response.json()) as Record<string, any> };
  };
  const bodies = async (cookie: string, feed = 'all') =>
    (
      (await call(cookie, 'GET', `/v1/community/feed?feed=${feed}`)).json.posts as {
        body: string;
      }[]
    ).map((post) => post.body);
  return { call, signUp, bodies, database };
}

describe('community (PostgreSQL)', () => {
  it('needs a session', async () => {
    const { call } = await harness();
    expect((await call(null, 'GET', '/v1/community/feed')).status).toBe(401);
  });

  it('applies the visibility rule in the feed', async () => {
    const { call, signUp, bodies } = await harness();
    const ana = await signUp('Ana Ribeiro');
    const leo = await signUp('Leo Tanaka');
    const bia = await signUp('Bia Costa');

    const created = await call(ana, 'POST', '/v1/community/posts', {
      kind: 'tip',
      body: 'public tip',
      place: { name: 'Kyoto', countryCode: 'JP' },
    });
    expect(created.status).toBe(201);
    expect(created.json.author).toMatchObject({ handle: 'ana.ribeiro', name: 'Ana Ribeiro' });
    const secret = await call(ana, 'POST', '/v1/community/posts', {
      kind: 'moment',
      body: 'followers only',
      audience: 'followers',
    });
    await call(bia, 'POST', '/v1/community/posts', { kind: 'tip', body: 'bia tip' });

    expect(await bodies(leo)).toEqual(['bia tip', 'public tip']);
    expect((await call(leo, 'GET', `/v1/community/posts/${secret.json.id}`)).status).toBe(404);

    const followed = await call(leo, 'PUT', '/v1/community/people/ana.ribeiro/follow');
    expect(followed.json).toMatchObject({ followed: true, followers: 1, posts: 2 });
    expect(await bodies(leo)).toEqual(['bia tip', 'followers only', 'public tip']);
    expect(await bodies(leo, 'following')).toEqual(['followers only', 'public tip']);

    await call(leo, 'PUT', '/v1/community/people/bia.costa/mute');
    expect(await bodies(leo)).toEqual(['followers only', 'public tip']);
    expect((await call(leo, 'PUT', '/v1/community/people/leo.tanaka/follow')).status).toBe(422);

    // Paging by id.
    const page = await call(ana, 'GET', '/v1/community/feed?limit=1');
    expect(page.json.posts).toHaveLength(1);
    const next = await call(
      ana,
      'GET',
      `/v1/community/feed?limit=5&before=${page.json.nextBefore as string}`,
    );
    expect((next.json.posts as { body: string }[]).map((p) => p.body)).toEqual([
      'followers only',
      'public tip',
    ]);
  });

  it('likes, saves, comments and the follower who liked it', async () => {
    const { call, signUp } = await harness();
    const ana = await signUp('Ana Ribeiro');
    const leo = await signUp('Leo Tanaka');
    const bia = await signUp('Bia Costa');
    const { json: post } = await call(ana, 'POST', '/v1/community/posts', {
      kind: 'tip',
      body: 'tip',
    });
    await call(bia, 'PUT', `/v1/community/posts/${post.id}/like`);
    await call(leo, 'PUT', '/v1/community/people/bia.costa/follow');
    const liked = await call(leo, 'PUT', `/v1/community/posts/${post.id}/like`);
    expect(liked.json).toMatchObject({ likes: 2, liked: true, likedBy: { handle: 'bia.costa' } });
    const saved = await call(leo, 'PUT', `/v1/community/posts/${post.id}/save`);
    expect(saved.json.saved).toBe(true);
    const unliked = await call(leo, 'DELETE', `/v1/community/posts/${post.id}/like`);
    expect(unliked.json).toMatchObject({ likes: 1, liked: false });

    const comment = await call(leo, 'POST', `/v1/community/posts/${post.id}/comments`, {
      body: 'Thanks!',
    });
    expect(comment.status).toBe(201);
    await call(ana, 'PUT', `/v1/community/comments/${comment.json.id}/like`);
    const { json: list } = await call(ana, 'GET', `/v1/community/posts/${post.id}/comments`);
    expect(list.comments).toMatchObject([
      { body: 'Thanks!', likes: 1, liked: true, mine: false, canDelete: true },
    ]);
    expect((await call(bia, 'DELETE', `/v1/community/comments/${comment.json.id}`)).status).toBe(
      404,
    );
    await call(ana, 'DELETE', `/v1/community/comments/${comment.json.id}`);
    expect((await call(leo, 'GET', `/v1/community/posts/${post.id}`)).json.comments).toBe(0);
    await call(leo, 'POST', `/v1/community/comments/${comment.json.id}/restore`);
    expect((await call(leo, 'GET', `/v1/community/posts/${post.id}`)).json.comments).toBe(1);
  });

  it('edits, deletes and restores only one’s own posts', async () => {
    const { call, signUp, bodies } = await harness();
    const ana = await signUp('Ana Ribeiro');
    const leo = await signUp('Leo Tanaka');
    const { json: post } = await call(ana, 'POST', '/v1/community/posts', {
      kind: 'tip',
      body: 'first',
    });
    expect((await call(leo, 'PATCH', `/v1/community/posts/${post.id}`, { body: 'x' })).status).toBe(
      404,
    );
    expect((await call(leo, 'DELETE', `/v1/community/posts/${post.id}`)).status).toBe(404);
    const edited = await call(ana, 'PATCH', `/v1/community/posts/${post.id}`, { body: 'second' });
    expect(edited.json.editedAt).not.toBeNull();
    await call(ana, 'DELETE', `/v1/community/posts/${post.id}`);
    expect(await bodies(leo)).toEqual([]);
    await call(ana, 'POST', `/v1/community/posts/${post.id}/restore`);
    expect(await bodies(leo)).toEqual(['second']);
  });

  it('hides reported posts, from the reporter at once and from everyone after three', async () => {
    const { call, signUp, bodies } = await harness();
    const ana = await signUp('Ana Ribeiro');
    const others = await Promise.all(
      ['Leo Tanaka', 'Bia Costa', 'Caio Lima', 'Dani Rocha'].map(signUp),
    );
    const { json: post } = await call(ana, 'POST', '/v1/community/posts', {
      kind: 'tip',
      body: 'spam',
    });
    await call(others[0]!, 'POST', `/v1/community/posts/${post.id}/report`, { reason: 'spam' });
    expect(await bodies(others[0]!)).toEqual([]);
    expect(await bodies(others[3]!)).toEqual(['spam']);
    await call(others[1]!, 'POST', `/v1/community/posts/${post.id}/report`, { reason: 'spam' });
    await call(others[2]!, 'POST', `/v1/community/posts/${post.id}/report`, { reason: 'abuse' });
    expect(await bodies(others[3]!)).toEqual([]);
    expect(await bodies(ana)).toEqual(['spam']);
  });

  it('shares a route without amounts or coordinates, and copies it into a new trip', async () => {
    const { call, signUp } = await harness();
    const ana = await signUp('Ana Ribeiro');
    const leo = await signUp('Leo Tanaka');
    const { json: trip } = await call(ana, 'POST', '/v1/trips', { title: 'Portugal' });
    await call(ana, 'PUT', `/v1/trips/${trip.id}/destinations`, {
      destinations: [
        {
          placeKey: 't:lis',
          name: 'Lisbon',
          countryCode: 'PT',
          latitude: 38.7,
          longitude: -9.1,
          nights: 4,
        },
        {
          placeKey: 't:opo',
          name: 'Porto',
          countryCode: 'PT',
          latitude: 41.1,
          longitude: -8.6,
          nights: 3,
        },
      ],
    });
    expect(
      (await call(leo, 'POST', '/v1/community/posts', { kind: 'route', tripId: trip.id })).status,
    ).toBe(404);
    const shared = await call(ana, 'POST', '/v1/community/posts', {
      kind: 'route',
      body: 'Nine nights.',
      tripId: trip.id,
    });
    expect(shared.status).toBe(201);
    expect(shared.json.attachment).toEqual({
      kind: 'route',
      title: 'Portugal',
      nights: 7,
      stops: [
        { name: 'Lisbon', countryCode: 'PT', nights: 4 },
        { name: 'Porto', countryCode: 'PT', nights: 3 },
      ],
      total: null,
    });
    const copy = await call(leo, 'POST', `/v1/community/posts/${shared.json.id}/copy-route`);
    expect(copy.status).toBe(201);
    expect(copy.json).toMatchObject({ title: 'Portugal', currency: 'USD' });
    const stops = await call(leo, 'GET', `/v1/trips/${copy.json.id}/destinations`);
    expect((stops.json.destinations as { name: string }[]).map((d) => d.name)).toEqual([
      'Lisbon',
      'Porto',
    ]);
    // A second copy is the same trip, and the feed tells Leo he has it.
    const again = await call(leo, 'POST', `/v1/community/posts/${shared.json.id}/copy-route`);
    expect(again.json.id).toBe(copy.json.id);
    const feed = await call(leo, 'GET', '/v1/community/feed');
    const seen = (feed.json.posts as { id: string; copiedTripId: string | null }[]).find(
      (post) => post.id === shared.json.id,
    );
    expect(seen?.copiedTripId).toBe(copy.json.id);
  });

  it('suggests people, shows trending countries and handles handles', async () => {
    const { call, signUp } = await harness();
    const ana = await signUp('Ana Ribeiro');
    const leo = await signUp('Leo Tanaka');
    const twin = await signUp('Ana Ribeiro');
    expect((await call(leo, 'GET', '/v1/community/me')).json).toMatchObject({
      handle: null,
      suggestedHandle: 'leo.tanaka',
    });
    await call(ana, 'POST', '/v1/community/posts', {
      kind: 'tip',
      body: 'a',
      place: { name: 'Kyoto', countryCode: 'JP' },
    });
    const second = await call(twin, 'POST', '/v1/community/posts', { kind: 'tip', body: 'b' });
    expect(second.json.author.handle).toBe('ana.ribeiro2');
    const discover = await call(leo, 'GET', '/v1/community/discover');
    expect(discover.json.trending).toEqual([{ countryCode: 'JP', posts: 1 }]);
    expect(
      (discover.json.suggestions as { person: { handle: string } }[]).map((s) => s.person.handle),
    ).toEqual(expect.arrayContaining(['ana.ribeiro', 'ana.ribeiro2']));
    expect((await call(leo, 'PATCH', '/v1/community/me', { handle: 'ana.ribeiro' })).status).toBe(
      422,
    );
    const renamed = await call(leo, 'PATCH', '/v1/community/me', { handle: 'leo.t' });
    expect(renamed.json.handle).toBe('leo.t');
    expect((await call(leo, 'GET', '/v1/community/people/leo.t')).json.mine).toBe(true);
    expect((await call(leo, 'GET', '/v1/community/people/nobody.here')).status).toBe(404);
  });
});
