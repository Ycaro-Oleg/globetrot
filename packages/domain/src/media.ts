/**
 * Uploaded images (business rules, "Privacy": EXIF location is stripped). Pure byte handling: the type is read
 * from the bytes, never from a file name or a header, and metadata blocks are cut out without decoding pixels.
 */

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

/** Largest upload accepted. The web app resizes photos before sending, so real ones are far smaller. */
export const MEDIA_MAX_BYTES = 8 * 1024 * 1024;
/** Largest width or height accepted. */
export const MEDIA_MAX_SIDE = 8192;
export const MEDIA_ALT_MAX = 200;
export const POST_PHOTOS_MAX = 4;
export const STOP_PHOTOS_MAX = 12;
/** Uploads one person may make in a rolling day. */
export const UPLOADS_PER_DAY = 100;

export interface ImageInfo {
  readonly type: ImageType;
  readonly width: number;
  readonly height: number;
}

const ascii = (bytes: Uint8Array, at: number, length: number) =>
  String.fromCharCode(...bytes.subarray(at, at + length));
const u16be = (b: Uint8Array, at: number) => (b[at]! << 8) | b[at + 1]!;
const u32be = (b: Uint8Array, at: number) =>
  ((b[at]! << 24) >>> 0) + (b[at + 1]! << 16) + (b[at + 2]! << 8) + b[at + 3]!;
const u32le = (b: Uint8Array, at: number) =>
  b[at]! + (b[at + 1]! << 8) + (b[at + 2]! << 16) + ((b[at + 3]! << 24) >>> 0);
const u24le = (b: Uint8Array, at: number) => b[at]! + (b[at + 1]! << 8) + (b[at + 2]! << 16);

class Malformed extends Error {}
const need = (condition: boolean) => {
  if (!condition) throw new Malformed();
};

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

// --- JPEG -----------------------------------------------------------------------------------------------

const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

/** Keeps JFIF (APP0), the colour profile (APP2 "ICC_PROFILE") and Adobe (APP14); drops EXIF, XMP, IPTC and comments. */
function keepJpegSegment(marker: number, bytes: Uint8Array, dataAt: number): boolean {
  if (marker === 0xe0 || marker === 0xee) return true;
  if (marker === 0xe2) return ascii(bytes, dataAt, 12) === 'ICC_PROFILE\0';
  if (marker >= 0xe1 && marker <= 0xef) return false;
  return marker !== 0xfe;
}

function jpeg(bytes: Uint8Array): { info: ImageInfo; clean: Uint8Array } {
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let width = 0;
  let height = 0;
  let at = 2;
  for (;;) {
    need(at + 4 <= bytes.length && bytes[at] === 0xff);
    const marker = bytes[at + 1]!;
    if (marker === 0xff) {
      at += 1; // fill byte
      continue;
    }
    if (marker === 0xda) {
      // Start of scan: the compressed image follows, kept as it is.
      parts.push(bytes.subarray(at));
      break;
    }
    need(marker !== 0xd9);
    const length = u16be(bytes, at + 2);
    need(length >= 2 && at + 2 + length <= bytes.length);
    if (SOF.has(marker)) {
      need(length >= 7);
      height = u16be(bytes, at + 5);
      width = u16be(bytes, at + 7);
    }
    if (keepJpegSegment(marker, bytes, at + 4)) parts.push(bytes.subarray(at, at + 2 + length));
    at += 2 + length;
  }
  need(width > 0 && height > 0);
  return { info: { type: 'image/jpeg', width, height }, clean: concat(parts) };
}

// --- PNG ------------------------------------------------------------------------------------------------

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** What a picture needs to look right; everything else (text, time, eXIf) is dropped. */
const PNG_KEEP = new Set([
  'IHDR',
  'PLTE',
  'IDAT',
  'IEND',
  'tRNS',
  'gAMA',
  'cHRM',
  'sRGB',
  'iCCP',
  'sBIT',
  'pHYs',
  'acTL',
  'fcTL',
  'fdAT',
]);

function png(bytes: Uint8Array): { info: ImageInfo; clean: Uint8Array } {
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let at = 8;
  let width = 0;
  let height = 0;
  let ended = false;
  while (!ended) {
    need(at + 12 <= bytes.length);
    const length = u32be(bytes, at);
    const type = ascii(bytes, at + 4, 4);
    need(at + 12 + length <= bytes.length);
    if (type === 'IHDR') {
      need(at === 8 && length === 13);
      width = u32be(bytes, at + 8);
      height = u32be(bytes, at + 12);
    }
    if (PNG_KEEP.has(type)) parts.push(bytes.subarray(at, at + 12 + length));
    ended = type === 'IEND';
    at += 12 + length;
  }
  need(width > 0 && height > 0);
  return { info: { type: 'image/png', width, height }, clean: concat(parts) };
}

// --- WebP -----------------------------------------------------------------------------------------------

function webp(bytes: Uint8Array): { info: ImageInfo; clean: Uint8Array } {
  const chunks: Uint8Array[] = [];
  let at = 12;
  let width = 0;
  let height = 0;
  while (at < bytes.length) {
    need(at + 8 <= bytes.length);
    const type = ascii(bytes, at, 4);
    const size = u32le(bytes, at + 4);
    const end = at + 8 + size + (size % 2);
    need(at + 8 + size <= bytes.length);
    const data = at + 8;
    if (type === 'VP8X') {
      need(size >= 10);
      width = u24le(bytes, data + 4) + 1;
      height = u24le(bytes, data + 7) + 1;
      const chunk = bytes.slice(at, Math.min(end, bytes.length));
      chunk[8] = chunk[8]! & ~0x0c; // no EXIF (0x08) or XMP (0x04) any more
      chunks.push(chunk);
    } else if (type === 'VP8 ') {
      need(
        size >= 10 &&
          bytes[data + 3] === 0x9d &&
          bytes[data + 4] === 0x01 &&
          bytes[data + 5] === 0x2a,
      );
      if (!width) {
        width = (bytes[data + 6]! | (bytes[data + 7]! << 8)) & 0x3fff;
        height = (bytes[data + 8]! | (bytes[data + 9]! << 8)) & 0x3fff;
      }
      chunks.push(bytes.subarray(at, Math.min(end, bytes.length)));
    } else if (type === 'VP8L') {
      need(size >= 5 && bytes[data] === 0x2f);
      if (!width) {
        const bits = u32le(bytes, data + 1);
        width = (bits & 0x3fff) + 1;
        height = ((bits >>> 14) & 0x3fff) + 1;
      }
      chunks.push(bytes.subarray(at, Math.min(end, bytes.length)));
    } else if (type !== 'EXIF' && type !== 'XMP ') {
      chunks.push(bytes.subarray(at, Math.min(end, bytes.length)));
    }
    at = end;
  }
  need(width > 0 && height > 0);
  const body = concat(chunks);
  const header = new Uint8Array(12);
  header.set(bytes.subarray(0, 4));
  const riffSize = body.length + 4;
  header.set(
    [riffSize & 0xff, (riffSize >>> 8) & 0xff, (riffSize >>> 16) & 0xff, (riffSize >>> 24) & 0xff],
    4,
  );
  header.set(bytes.subarray(8, 12), 8);
  return { info: { type: 'image/webp', width, height }, clean: concat([header, body]) };
}

/**
 * Reads an uploaded image: its real type and size from the bytes, and a copy without metadata (EXIF, GPS,
 * XMP, IPTC, comments, text chunks). `null` for anything that is not a well-formed JPEG, PNG or WebP within
 * the limits.
 */
export function cleanImage(bytes: Uint8Array): { info: ImageInfo; bytes: Uint8Array } | null {
  if (bytes.length < 16 || bytes.length > MEDIA_MAX_BYTES) return null;
  try {
    let result: { info: ImageInfo; clean: Uint8Array };
    if (bytes[0] === 0xff && bytes[1] === 0xd8) result = jpeg(bytes);
    else if (PNG_SIGNATURE.every((value, index) => bytes[index] === value)) result = png(bytes);
    else if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') result = webp(bytes);
    else return null;
    const { width, height } = result.info;
    if (width > MEDIA_MAX_SIDE || height > MEDIA_MAX_SIDE) return null;
    return { info: result.info, bytes: result.clean };
  } catch (error) {
    if (error instanceof Malformed || error instanceof RangeError) return null;
    throw error;
  }
}
