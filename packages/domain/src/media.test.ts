import { describe, expect, it } from 'vitest';
import { cleanImage, MEDIA_MAX_SIDE } from './media';

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(
    parts.flatMap((part) =>
      typeof part === 'string' ? [...part].map((c) => c.charCodeAt(0)) : part,
    ),
  );
const has = (haystack: Uint8Array, needle: string) =>
  Buffer.from(haystack).includes(Buffer.from(needle, 'latin1'));
const segment = (marker: number, body: number[] | string) => {
  const data = typeof body === 'string' ? [...body].map((c) => c.charCodeAt(0)) : body;
  const length = data.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...data];
};

describe('cleanImage: JPEG', () => {
  const exif = segment(0xe1, 'Exif\0\0GPSLatitude=-23.55;Make=Phone');
  const sof = segment(0xc0, [8, 0x01, 0xe0, 0x02, 0x80, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  const file = bytes(
    [0xff, 0xd8],
    segment(0xe0, 'JFIF\0\x01\x01\0\0\x01\0\x01\0\0'),
    exif,
    segment(0xe2, 'ICC_PROFILE\0\x01\x01profile'),
    segment(0xfe, 'a comment with a name'),
    sof,
    [0xff, 0xda, 0, 8, 1, 1, 0, 0, 0x3f, 0, 0x12, 0x34, 0xff, 0xd9],
  );

  it('reads the size and drops EXIF, GPS and comments, keeping JFIF, the profile and the scan', () => {
    const result = cleanImage(file)!;
    expect(result.info).toEqual({ type: 'image/jpeg', width: 640, height: 480 });
    expect(has(result.bytes, 'GPSLatitude')).toBe(false);
    expect(has(result.bytes, 'a comment')).toBe(false);
    expect(has(result.bytes, 'JFIF')).toBe(true);
    expect(has(result.bytes, 'ICC_PROFILE')).toBe(true);
    expect([...result.bytes.slice(-4)]).toEqual([0x12, 0x34, 0xff, 0xd9]);
    expect(result.bytes.length).toBe(
      file.length - exif.length - segment(0xfe, 'a comment with a name').length,
    );
  });

  it('refuses a truncated file', () => {
    expect(cleanImage(file.subarray(0, 30))).toBeNull();
  });
});

const chunk = (type: string, data: number[] | string) => {
  const body = typeof data === 'string' ? [...data].map((c) => c.charCodeAt(0)) : data;
  const n = body.length;
  return [
    n >>> 24,
    (n >> 16) & 255,
    (n >> 8) & 255,
    n & 255,
    ...[...type].map((c) => c.charCodeAt(0)),
    ...body,
    0,
    0,
    0,
    0,
  ];
};

describe('cleanImage: PNG', () => {
  const file = bytes(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    chunk('IHDR', [0, 0, 1, 0, 0, 0, 0, 200, 8, 6, 0, 0, 0]),
    chunk('tEXt', 'Author\0Ana Ribeiro'),
    chunk('eXIf', 'GPSLatitude'),
    chunk('IDAT', [1, 2, 3]),
    chunk('IEND', []),
  );
  it('keeps the picture and drops text and eXIf', () => {
    const result = cleanImage(file)!;
    expect(result.info).toEqual({ type: 'image/png', width: 256, height: 200 });
    expect(has(result.bytes, 'Ana Ribeiro')).toBe(false);
    expect(has(result.bytes, 'GPSLatitude')).toBe(false);
    expect(has(result.bytes, 'IDAT')).toBe(true);
  });
});

const riff = (...chunks: number[][]) => {
  const body = chunks.flat();
  const size = body.length + 4;
  return bytes(
    'RIFF',
    [size & 255, (size >> 8) & 255, (size >> 16) & 255, size >>> 24],
    'WEBP',
    body,
  );
};
const wchunk = (type: string, data: number[]) => {
  const n = data.length;
  return [
    ...[...type].map((c) => c.charCodeAt(0)),
    n & 255,
    (n >> 8) & 255,
    (n >> 16) & 255,
    n >>> 24,
    ...data,
    ...(n % 2 ? [0] : []),
  ];
};

describe('cleanImage: WebP', () => {
  const gps = [...'GPSLatitude'].map((c) => c.charCodeAt(0));
  const file = riff(
    wchunk('VP8X', [0x08, 0, 0, 0, 99, 0, 0, 49, 0, 0]),
    wchunk('VP8L', [0x2f, 0, 0, 0, 0, 0]),
    wchunk('EXIF', gps),
  );
  it('reads the canvas size, drops EXIF and clears its flag', () => {
    const result = cleanImage(file)!;
    expect(result.info).toEqual({ type: 'image/webp', width: 100, height: 50 });
    expect(has(result.bytes, 'GPSLatitude')).toBe(false);
    expect(result.bytes[20]! & 0x08).toBe(0);
    const riffSize = result.bytes[4]! + (result.bytes[5]! << 8);
    expect(riffSize).toBe(result.bytes.length - 8);
  });
});

describe('cleanImage: refusals', () => {
  it('refuses other types and huge sides', () => {
    expect(cleanImage(bytes('GIF89a', new Array(20).fill(0)))).toBeNull();
    expect(cleanImage(bytes('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    const side = MEDIA_MAX_SIDE + 1;
    const big = bytes(
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      chunk('IHDR', [0, 0, side >> 8, side & 255, 0, 0, 0, 10, 8, 6, 0, 0, 0]),
      chunk('IEND', []),
    );
    expect(cleanImage(big)).toBeNull();
  });
});

describe('cleanImage: more shapes and refusals', () => {
  it('reads a lossy WebP (VP8) without a VP8X header', () => {
    // 10-byte VP8 frame header: frame tag, start code 9d 01 2a, width 320, height 240.
    const file = riff(wchunk('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, 0x40, 0x01, 0xf0, 0x00]));
    expect(cleanImage(file)?.info).toEqual({ type: 'image/webp', width: 320, height: 240 });
  });

  it('skips JPEG fill bytes and refuses a JPEG that ends before its pixels', () => {
    const sof = segment(0xc0, [8, 0, 10, 0, 20, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
    const withFill = bytes([0xff, 0xd8], [0xff], sof, [0xff, 0xda, 0, 2, 0xff, 0xd9]);
    expect(cleanImage(withFill)?.info).toEqual({ type: 'image/jpeg', width: 20, height: 10 });
    expect(cleanImage(bytes([0xff, 0xd8], sof, [0xff, 0xd9, 0, 0]))).toBeNull();
    // A JPEG without a frame header has no size.
    expect(
      cleanImage(bytes([0xff, 0xd8], segment(0xe0, 'JFIF\0\0\0\0'), [0xff, 0xda, 0, 2])),
    ).toBeNull();
  });

  it('refuses a PNG whose first chunk is not IHDR, or that never ends', () => {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    expect(cleanImage(bytes(sig, chunk('IDAT', [1, 2, 3, 4]), chunk('IEND', [])))).toBeNull();
    expect(
      cleanImage(bytes(sig, chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]))),
    ).toBeNull();
  });

  it('refuses a WebP with a broken chunk or no image', () => {
    expect(cleanImage(riff(wchunk('EXIF', [1, 2, 3, 4, 5, 6])))).toBeNull();
    expect(cleanImage(riff(wchunk('VP8L', [0x00, 0, 0, 0, 0, 0])))).toBeNull();
  });

  it('refuses anything too small or over 8 MB', () => {
    expect(cleanImage(new Uint8Array(4))).toBeNull();
    const huge = new Uint8Array(8 * 1024 * 1024 + 1);
    huge.set([0xff, 0xd8]);
    expect(cleanImage(huge)).toBeNull();
  });
});
