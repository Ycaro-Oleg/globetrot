import { IMAGE_TYPES, MEDIA_MAX_BYTES } from '@globetrot/domain';
import { mediaSchema, type Application } from '@globetrot/application';
import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import { bodyLimit } from 'hono/body-limit';
import { problem } from '../problem';
import { problemResponse, type Env } from '../http';

const security = [{ cookieAuth: [] }];
const binary = z.string().meta({ format: 'binary' });

const uploadRoute = createRoute({
  method: 'post',
  path: '/v1/media',
  operationId: 'uploadMedia',
  tags: ['Media'],
  summary: 'Upload an image',
  description:
    'The raw bytes of a JPEG, PNG or WebP (up to 8 MB and 8192 px a side) as the body. The type is read from the ' +
    'bytes, not from `Content-Type`. EXIF (including GPS), XMP, IPTC, comments and text chunks are removed before ' +
    'the image is stored. The image is private until it is placed on a post or a stop. At most 100 uploads a day.',
  security,
  request: {
    body: {
      required: true,
      content: Object.fromEntries(IMAGE_TYPES.map((type) => [type, { schema: binary }])),
    },
  },
  responses: {
    201: {
      description: 'The stored image.',
      content: { 'application/json': { schema: mediaSchema } },
    },
    401: problemResponse('No valid session.'),
    413: problemResponse('The body is larger than 8 MB.'),
    422: problemResponse('Not a JPEG, PNG or WebP within the limits (`unsupported_image`).'),
    429: problemResponse('Too many uploads today.'),
  },
});

const getRoute = createRoute({
  method: 'get',
  path: '/v1/media/{mediaId}',
  operationId: 'getMedia',
  tags: ['Media'],
  summary: 'An image',
  description:
    'For its owner, or for someone who may see a post that shows it. Stop photos stay with the trip’s owner. ' +
    'Anything else is `404`.',
  security,
  request: { params: z.object({ mediaId: z.uuid() }) },
  responses: {
    200: {
      description: 'The image bytes.',
      content: Object.fromEntries(IMAGE_TYPES.map((type) => [type, { schema: binary }])),
    },
    401: problemResponse('No valid session.'),
    404: problemResponse('No such image, or the session may not see it.'),
    422: problemResponse('The id is not valid.'),
  },
});

export function registerMediaRoutes(app: OpenAPIHono<Env>, application: Application) {
  app.use(
    '/v1/media',
    bodyLimit({
      maxSize: MEDIA_MAX_BYTES,
      onError: () => problem(413, 'PAYLOAD_TOO_LARGE', { detail: 'The image is larger than 8 MB' }),
    }),
  );
  app.openapi(uploadRoute, async (c) => {
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    return c.json(await application.uploadMedia.execute(c.get('actor'), { bytes }), 201);
  });
  app.openapi(getRoute, async (c) => {
    const media = await application.getMedia.execute(c.get('actor'), c.req.valid('param'));
    return c.body(media.bytes as Uint8Array<ArrayBuffer>, 200, {
      'content-type': media.contentType,
      // Private: the access check runs on every request; the bytes for an id never change.
      'cache-control': 'private, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'",
    }) as never;
  });
}
