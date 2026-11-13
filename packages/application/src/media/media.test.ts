import { describe, expect, it } from 'vitest';
import {
  createApplication,
  NotFoundError,
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
const as = (who: UserRecord): Actor => ({ kind: 'user', userId: who.id });

/** A tiny PNG (1×1) with a text chunk naming the author, which must not survive. */
const chunk = (type: string, data: number[]) => [
  0,
  0,
  0,
  data.length,
  ...[...type].map((c) => c.charCodeAt(0)),
  ...data,
  0,
  0,
  0,
  0,
];
const PNG = new Uint8Array([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  ...chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]),
  ...chunk(
    'tEXt',
    [...'Author\0Ana'].map((c) => c.charCodeAt(0)),
  ),
  ...chunk('IDAT', [1, 2]),
  ...chunk('IEND', []),
]);

function setup() {
  const fake = createFakePorts({ users: [ana, leo] });
  const app = createApplication(fake.ports);
  return { ...fake, app };
}

describe('media', () => {
  it('stores an image without its metadata and serves it to its owner', async () => {
    const { app } = setup();
    const media = await app.uploadMedia.execute(as(ana), { bytes: PNG });
    expect(media).toMatchObject({ contentType: 'image/png', width: 1, height: 1 });
    const { bytes } = await app.getMedia.execute(as(ana), { mediaId: media.id });
    expect(Buffer.from(bytes).includes(Buffer.from('Author'))).toBe(false);
  });

  it('refuses what is not an image', async () => {
    const { app } = setup();
    await expect(
      app.uploadMedia.execute(as(ana), {
        bytes: new TextEncoder().encode('<script>x</script>'.repeat(3)),
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('shows a post photo to whoever may see the post, and to nobody else', async () => {
    const { app } = setup();
    const media = await app.uploadMedia.execute(as(ana), { bytes: PNG });
    await expect(app.getMedia.execute(as(leo), { mediaId: media.id })).rejects.toThrow(
      NotFoundError,
    );
    const post = await app.createPost.execute(as(ana), {
      kind: 'moment',
      photos: [{ mediaId: media.id, alt: 'Salt flat at dawn' }],
    });
    expect(post.photos).toEqual([{ mediaId: media.id, alt: 'Salt flat at dawn' }]);
    await expect(app.getMedia.execute(as(leo), { mediaId: media.id })).resolves.toBeDefined();
    await app.deletePost.execute(as(ana), { postId: post.id });
    await expect(app.getMedia.execute(as(leo), { mediaId: media.id })).rejects.toThrow(
      NotFoundError,
    );
  });

  it('never lets someone place another person’s image', async () => {
    const { app } = setup();
    const media = await app.uploadMedia.execute(as(ana), { bytes: PNG });
    await expect(
      app.createPost.execute(as(leo), { kind: 'moment', photos: [{ mediaId: media.id, alt: '' }] }),
    ).rejects.toThrow(ValidationError);
    const trip = await app.createTrip.execute(as(leo), { title: 'Mine', startDate: null });
    await expect(
      app.replaceDestinations.execute(as(leo), {
        tripId: trip.id,
        destinations: [
          {
            placeKey: 't:x',
            name: 'Kyoto',
            latitude: 35,
            longitude: 135,
            nights: 1,
            photos: [{ mediaId: media.id, alt: '' }],
          },
        ],
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('keeps photos on a stop across saves and leaves them out of a shared route', async () => {
    const { app } = setup();
    const media = await app.uploadMedia.execute(as(ana), { bytes: PNG });
    const trip = await app.createTrip.execute(as(ana), { title: 'Japan', startDate: null });
    const saved = await app.replaceDestinations.execute(as(ana), {
      tripId: trip.id,
      destinations: [
        {
          placeKey: 't:kyoto',
          name: 'Kyoto',
          latitude: 35,
          longitude: 135,
          nights: 2,
          photos: [{ mediaId: media.id, alt: 'Torii gates' }],
        },
      ],
    });
    expect(saved.destinations[0]!.photos).toEqual([{ mediaId: media.id, alt: 'Torii gates' }]);
    const shared = await app.createPost.execute(as(ana), { kind: 'route', tripId: trip.id });
    const copy = await app.copyRoute.execute(as(leo), { postId: shared.id });
    const stops = await app.listDestinations.execute(as(leo), { tripId: copy.id });
    expect(stops.destinations[0]!.photos).toEqual([]);
  });

  it('lets a moment be only photos, but not a route', async () => {
    const { app } = setup();
    const media = await app.uploadMedia.execute(as(ana), { bytes: PNG });
    await expect(
      app.createPost.execute(as(ana), { kind: 'route', photos: [{ mediaId: media.id, alt: '' }] }),
    ).rejects.toThrow(ValidationError);
  });
});
