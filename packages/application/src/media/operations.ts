import { canSeePost, cleanImage, UPLOADS_PER_DAY } from '@globetrot/domain';
import { z } from 'zod';
import type { Actor } from '../actor';
import { NotFoundError, RateLimitedError, ValidationError } from '../errors';
import { defineOperation } from '../operation';
import type { MediaReader, PhotoRecord, Ports } from '../ports';
import { mediaSchema } from './schemas';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Where an image's bytes live. Chosen here, never by a client. */
export const mediaKey = (id: string) => `media/${id}`;

/**
 * Checks that every photo is an image the actor uploaded, once each, or one already in place (a trip member
 * keeping the photos another member added). Anything else is refused, so nobody can place another person's image.
 */
export async function ownedPhotos(
  media: MediaReader,
  actor: Actor,
  photos: readonly PhotoRecord[],
  field: string,
  alreadyPlaced: ReadonlySet<string> = new Set(),
): Promise<PhotoRecord[]> {
  const ids = photos.map((photo) => photo.mediaId);
  if (new Set(ids).size !== ids.length) {
    throw new ValidationError([
      { field, code: 'duplicate_photo', message: 'A photo is listed twice' },
    ]);
  }
  const found = await media.findMany(ids);
  const mine = new Set(
    found.filter((m) => m.ownerId === actor.userId || alreadyPlaced.has(m.id)).map((m) => m.id),
  );
  if (ids.some((id) => !mine.has(id))) {
    throw new ValidationError([{ field, code: 'unknown_photo', message: 'No such photo' }]);
  }
  return photos.map((photo) => ({ mediaId: photo.mediaId, alt: photo.alt }));
}

/**
 * Stores an uploaded image. Its type is read from the bytes; anything that is not a JPEG, PNG or WebP within the
 * limits is refused, and metadata (EXIF, GPS, XMP, comments) is removed before it is stored.
 */
export function createUploadMedia(deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids' | 'storage'>) {
  return defineOperation({
    name: 'uploadMedia',
    kind: 'command',
    input: z.object({ bytes: z.custom<Uint8Array>((value) => value instanceof Uint8Array) }),
    output: mediaSchema,
    async handler(actor, input) {
      const image = cleanImage(input.bytes);
      if (!image) {
        throw new ValidationError([
          {
            field: 'body',
            code: 'unsupported_image',
            message: 'Send a JPEG, PNG or WebP image up to 8 MB and 8192 px',
          },
        ]);
      }
      const now = deps.clock.now();
      const id = deps.ids.newId();
      return deps.unitOfWork.run(async (tx) => {
        const recent = await tx.media.countSince(actor.userId, new Date(now.getTime() - DAY_MS));
        if (recent >= UPLOADS_PER_DAY) throw new RateLimitedError('Too many uploads today');
        await deps.storage.put(mediaKey(id), image.bytes, image.info.type);
        await tx.media.insert({
          id,
          ownerId: actor.userId,
          contentType: image.info.type,
          byteSize: image.bytes.length,
          width: image.info.width,
          height: image.info.height,
          createdAt: now,
        });
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'media.upload',
          entityType: 'media',
          entityId: id,
          metadata: { type: image.info.type },
        });
        return {
          id,
          contentType: image.info.type,
          width: image.info.width,
          height: image.info.height,
        };
      });
    },
  });
}

/**
 * An image's bytes, for its owner, for someone who may see a post that shows it, or for a member of a trip whose
 * stop shows it. Everyone else, and a missing image, get the same "not found".
 */
export function createGetMedia(
  deps: Pick<Ports, 'media' | 'community' | 'storage' | 'destinations' | 'trips'>,
) {
  return defineOperation({
    name: 'getMedia',
    kind: 'query',
    input: z.object({ mediaId: z.uuid() }),
    output: z.object({
      bytes: z.custom<Uint8Array>((value) => value instanceof Uint8Array),
      contentType: z.string(),
    }),
    async handler(actor, input) {
      const media = await deps.media.findById(input.mediaId);
      if (!media) throw new NotFoundError();
      if (
        media.ownerId !== actor.userId &&
        !(await visibleThroughATrip(deps, actor, media.id)) &&
        !(await visibleThroughAPost(deps, actor, media.id))
      ) {
        throw new NotFoundError();
      }
      const bytes = await deps.storage.get(mediaKey(media.id));
      if (!bytes) throw new NotFoundError();
      return { bytes, contentType: media.contentType };
    },
  });
}

async function visibleThroughATrip(
  deps: Pick<Ports, 'destinations' | 'trips'>,
  actor: Actor,
  mediaId: string,
): Promise<boolean> {
  for (const tripId of await deps.destinations.tripIdsWithPhoto(mediaId)) {
    const trip = await deps.trips.findById(tripId);
    if (!trip) continue;
    if (trip.ownerId === actor.userId || (await deps.trips.roleOf(tripId, actor.userId)))
      return true;
  }
  return false;
}

async function visibleThroughAPost(
  deps: Pick<Ports, 'community'>,
  actor: Actor,
  mediaId: string,
): Promise<boolean> {
  const posts = await deps.community.postsWithMedia(mediaId);
  if (posts.length === 0) return false;
  const relations = await deps.community.relations(actor.userId, [
    ...new Set(posts.map((post) => post.authorId)),
  ]);
  for (const post of posts) {
    const visible = canSeePost(
      {
        authorId: post.authorId,
        audience: post.audience,
        deleted: post.deletedAt !== null,
        hidden: post.hiddenAt !== null,
      },
      {
        viewerId: actor.userId,
        follows: relations.following.has(post.authorId),
        muted: relations.muted.has(post.authorId),
        reported: await deps.community.hasReported(actor.userId, post.id),
      },
    );
    if (visible) return true;
  }
  return false;
}
