const RANDOM_BYTES = 10;

/**
 * A UUIDv7 (RFC 9562): 48 bits of Unix time in milliseconds, then random bits. Ids sort by creation time,
 * are not guessable, and are known before the row is inserted. Pure: the caller supplies the clock reading
 * and the random bytes (an adapter uses `Date.now()` and `crypto.getRandomValues`), which keeps this
 * package free of I/O and makes ids reproducible in tests.
 *
 * Ordering is by millisecond; two ids made in the same millisecond are not ordered among themselves.
 */
export function uuidV7(timestampMs: number, random: Uint8Array): string {
  if (!Number.isSafeInteger(timestampMs) || timestampMs < 0 || timestampMs >= 2 ** 48) {
    throw new RangeError('uuidV7 needs a timestamp that fits in 48 bits of milliseconds');
  }
  if (random.length < RANDOM_BYTES) {
    throw new RangeError(`uuidV7 needs ${RANDOM_BYTES} random bytes`);
  }

  const bytes = new Uint8Array(16);
  let rest = timestampMs;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = rest % 256;
    rest = Math.floor(rest / 256);
  }
  bytes.set(random.subarray(0, RANDOM_BYTES), 6);
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x70; // version 7
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80; // variant 10

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** When a UUIDv7 was made (its first 48 bits are milliseconds since 1970), or null for anything else. */
export function uuidV7Time(id: string): Date | null {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
    return null;
  return new Date(Number.parseInt(id.replace(/-/g, '').slice(0, 12), 16));
}
