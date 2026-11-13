import { MEDIA_ALT_MAX } from '@globetrot/domain';
import { z } from 'zod';

/** A photo placed on a stop or a post: an uploaded image of the caller and the words that describe it. */
export const photoFields = z.object({
  mediaId: z.uuid(),
  alt: z
    .string()
    .trim()
    .max(MEDIA_ALT_MAX)
    .default('')
    .meta({ description: 'What the photo shows, for people who cannot see it. Blank is allowed.' }),
});

export const photoSchema = z.object({
  mediaId: z.uuid(),
  alt: z.string(),
});
export type PhotoView = z.infer<typeof photoSchema>;

export const mediaSchema = z.object({
  id: z.uuid(),
  contentType: z.string(),
  width: z.number().int(),
  height: z.number().int(),
});
export type MediaView = z.infer<typeof mediaSchema>;
