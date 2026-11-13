import { POSTS_PER_DAY } from '@globetrot/domain';
import { describe, expect, it } from 'vitest';
import {
  createApplication,
  NotFoundError,
  RateLimitedError,
  ValidationError,
  type Actor,
  type UserRecord,
} from '../index';
import { createFakePorts } from '../testing';

const user = (id: string, name: string): UserRecord => ({
  id,
  email: `${id}@example.com`,
  name,
  emailVerified: true,
});
const ana = user('u-ana', 'Ana Ribeiro');
const leo = user('u-leo', 'Leo Tanaka');
const bia = user('u-bia', 'Bia Costa');
const caio = user('u-caio', 'Caio Lima');
const dani = user('u-dani', 'Ana Ribeiro');
const as = (who: UserRecord): Actor => ({ kind: 'user', userId: who.id });

function setup() {
  const fake = createFakePorts({
    users: [ana, leo, bia, caio, dani],
    now: new Date('2026-11-13T12:00:00.000Z'),
  });
  const app = createApplication(fake.ports);
  const post = (who: UserRecord, body: string, extra: Record<string, unknown> = {}) =>
    app.createPost.execute(as(who), { kind: 'tip', body, ...extra });
  const feed = async (who: UserRecord, feedName: 'all' | 'following' = 'all') =>
    (await app.listFeed.execute(as(who), { feed: feedName })).posts.map((p) => p.body);
  return { ...fake, app, post, feed };
}

describe('posting', () => {
  it('gives the author a handle from their name, with a number when it is taken', async () => {
    const { post } = setup();
    const first = await post(ana, 'Get to Fushimi Inari before 7.');
    const second = await post(dani, 'Same name, different person.');
    expect(first.author.handle).toBe('ana.ribeiro');
    expect(second.author.handle).toBe('ana.ribeiro2');
    expect(first.mine).toBe(true);
  });

  it('needs words for moments and tips', async () => {
    const { app } = setup();
    await expect(app.createPost.execute(as(ana), { kind: 'moment', body: '  ' })).rejects.toThrow(
      ValidationError,
    );
  });

  it('limits posts per day', async () => {
    const { post } = setup();
    for (let n = 0; n < POSTS_PER_DAY; n++) await post(ana, `tip ${n}`);
    await expect(post(ana, 'one more')).rejects.toThrow(RateLimitedError);
  });

  it('shares a route as a snapshot, amounts hidden unless asked, and others can copy it', async () => {
    const { app } = setup();
    const trip = await app.createTrip.execute(as(ana), { title: 'Portugal', startDate: null });
    await app.replaceDestinations.execute(as(ana), {
      tripId: trip.id,
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
    const shared = await app.createPost.execute(as(ana), {
      kind: 'route',
      body: 'Tested and approved.',
      tripId: trip.id,
    });
    expect(shared.attachment).toMatchObject({ kind: 'route', nights: 7, total: null });
    const copy = await app.copyRoute.execute(as(leo), { postId: shared.id });
    expect(copy.title).toBe('Portugal');
    expect(copy.currency).toBe('USD');
    const stops = await app.listDestinations.execute(as(leo), { tripId: copy.id });
    expect(stops.destinations.map((d) => d.name)).toEqual(['Lisbon', 'Porto']);
  });

  it('refuses to share someone else’s trip', async () => {
    const { app } = setup();
    const trip = await app.createTrip.execute(as(ana), { title: 'Mine', startDate: null });
    await expect(
      app.createPost.execute(as(leo), { kind: 'route', body: '', tripId: trip.id }),
    ).rejects.toThrow(NotFoundError);
  });

  it('shares a visa with its place in the passport', async () => {
    const { app, state } = setup();
    state.visas.set('u-ana\u0000PE', {
      userId: ana.id,
      countryCode: 'PE',
      city: 'Cusco',
      stampedAt: new Date('2026-11-09T10:00:00Z'),
    });
    state.visas.set('u-ana\u0000PT', {
      userId: ana.id,
      countryCode: 'PT',
      city: 'Lisbon',
      stampedAt: new Date('2025-05-02T10:00:00Z'),
    });
    const visa = await app.createPost.execute(as(ana), { kind: 'visa', visaCountry: 'PE' });
    expect(visa.attachment).toMatchObject({ kind: 'visa', city: 'Cusco', ordinal: 2 });
    expect(visa.place).toEqual({ name: 'Cusco', countryCode: 'PE' });
  });
});

describe('who sees what', () => {
  it('shows followers-only posts to followers and the following feed only followed people', async () => {
    const { app, post, feed } = setup();
    await post(ana, 'public');
    await post(ana, 'for followers', { audience: 'followers' });
    await post(bia, 'from bia');
    expect(await feed(leo)).toEqual(['from bia', 'public']);
    await app.setFollow.execute(as(leo), { handle: 'ana.ribeiro', on: true });
    expect(await feed(leo)).toEqual(['from bia', 'for followers', 'public']);
    expect(await feed(leo, 'following')).toEqual(['for followers', 'public']);
  });

  it('answers "not found" for a post the viewer may not see', async () => {
    const { app, post } = setup();
    const hidden = await post(ana, 'followers', { audience: 'followers' });
    await expect(app.getPost.execute(as(leo), { postId: hidden.id })).rejects.toThrow(
      NotFoundError,
    );
    await expect(
      app.addComment.execute(as(leo), { postId: hidden.id, body: 'hi' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('hides muted people’s posts and comments', async () => {
    const { app, post, feed } = setup();
    const tip = await post(ana, 'tip');
    await post(bia, 'noise');
    await app.addComment.execute(as(bia), { postId: tip.id, body: 'me too' });
    await app.setMute.execute(as(leo), { handle: 'bia.costa', on: true });
    expect(await feed(leo)).toEqual(['tip']);
    const { comments } = await app.listComments.execute(as(leo), { postId: tip.id });
    expect(comments).toEqual([]);
  });

  it('hides a post after enough distinct reports, except from its author', async () => {
    const { app, post, feed } = setup();
    const bad = await post(ana, 'spam spam');
    await app.reportPost.execute(as(leo), { postId: bad.id, reason: 'spam' });
    expect(await feed(leo)).toEqual([]);
    expect(await feed(bia)).toEqual(['spam spam']);
    await app.reportPost.execute(as(bia), { postId: bad.id, reason: 'spam' });
    await app.reportPost.execute(as(caio), { postId: bad.id, reason: 'abuse' });
    expect(await feed(dani)).toEqual([]);
    expect(await feed(ana)).toEqual(['spam spam']);
  });

  it('refuses reporting one’s own post and following oneself', async () => {
    const { app, post } = setup();
    const mine = await post(ana, 'mine');
    await expect(
      app.reportPost.execute(as(ana), { postId: mine.id, reason: 'spam' }),
    ).rejects.toThrow(ValidationError);
    await expect(
      app.setFollow.execute(as(ana), { handle: 'ana.ribeiro', on: true }),
    ).rejects.toThrow(ValidationError);
  });
});

describe('changing posts and comments', () => {
  it('lets only the author edit, delete and restore a post', async () => {
    const { app, post, feed } = setup();
    const tip = await post(ana, 'first');
    await expect(
      app.updatePost.execute(as(leo), { postId: tip.id, body: 'hacked' }),
    ).rejects.toThrow(NotFoundError);
    const edited = await app.updatePost.execute(as(ana), { postId: tip.id, body: 'second' });
    expect(edited.body).toBe('second');
    expect(edited.editedAt).not.toBeNull();
    await app.deletePost.execute(as(ana), { postId: tip.id });
    expect(await feed(leo)).toEqual([]);
    await app.deletePost.execute(as(ana), { postId: tip.id, restore: true });
    expect(await feed(leo)).toEqual(['second']);
  });

  it('lets the post author remove someone else’s comment', async () => {
    const { app, post } = setup();
    const tip = await post(ana, 'tip');
    const { id } = await app.addComment.execute(as(leo), { postId: tip.id, body: 'nice' });
    await expect(app.deleteComment.execute(as(bia), { commentId: id })).rejects.toThrow(
      NotFoundError,
    );
    await app.deleteComment.execute(as(ana), { commentId: id });
    expect((await app.listComments.execute(as(leo), { postId: tip.id })).comments).toEqual([]);
  });

  it('counts likes and names a followed liker', async () => {
    const { app, post } = setup();
    const tip = await post(ana, 'tip');
    await app.setPostLike.execute(as(bia), { postId: tip.id, on: true });
    await app.setFollow.execute(as(leo), { handle: 'bia.costa', on: true });
    const liked = await app.setPostLike.execute(as(leo), { postId: tip.id, on: true });
    expect(liked).toMatchObject({ likes: 2, liked: true });
    expect(liked.likedBy?.handle).toBe('bia.costa');
    const saved = await app.setPostSave.execute(as(leo), { postId: tip.id, on: true });
    expect(saved.saved).toBe(true);
  });

  it('changes the handle, refusing one that is taken', async () => {
    const { app, post } = setup();
    await post(ana, 'tip');
    await expect(app.updateHandle.execute(as(leo), { handle: 'ana.ribeiro' })).rejects.toThrow(
      ValidationError,
    );
    const me = await app.updateHandle.execute(as(leo), { handle: 'LeoT' });
    expect(me.handle).toBe('leot');
  });

  it('suggests active people and trending countries', async () => {
    const { app, post } = setup();
    await post(ana, 'a', { place: { name: 'Kyoto', countryCode: 'JP' } });
    await post(ana, 'b', { place: { name: 'Tokyo', countryCode: 'JP' } });
    await post(bia, 'c', { place: { name: 'Porto', countryCode: 'PT' } });
    const discover = await app.getDiscover.execute(as(leo), {});
    expect(discover.suggestions.map((s) => s.person.handle)).toEqual(['ana.ribeiro', 'bia.costa']);
    expect(discover.trending).toEqual([
      { countryCode: 'JP', posts: 2 },
      { countryCode: 'PT', posts: 1 },
    ]);
  });
});
