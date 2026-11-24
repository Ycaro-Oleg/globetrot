import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { uuidV7, uuidV7Time } from './uuid-v7';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const bytes = (value: number) => new Uint8Array(10).fill(value);

describe('uuidV7', () => {
  it('matches the RFC 9562 example layout', () => {
    // The timestamp of the RFC's example (0x017F22E279B0 ms) with all-zero random bits.
    expect(uuidV7(0x017f22e279b0, bytes(0))).toBe('017f22e2-79b0-7000-8000-000000000000');
  });

  it('sets the version and variant bits whatever the random bytes are', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 48 - 1 }),
        fc.uint8Array({ minLength: 10, maxLength: 10 }),
        (time, random) => {
          expect(uuidV7(time, random)).toMatch(UUID_V7);
        },
      ),
    );
  });

  it('sorts by time, which is what makes it a good primary key', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 48 - 2 }),
        fc.integer({ min: 1, max: 1000 }),
        fc.uint8Array({ minLength: 10, maxLength: 10 }),
        fc.uint8Array({ minLength: 10, maxLength: 10 }),
        (time, gap, a, b) => {
          const later = Math.min(time + gap, 2 ** 48 - 1);
          fc.pre(later > time);
          expect(uuidV7(time, a) < uuidV7(later, b)).toBe(true);
        },
      ),
    );
  });

  it('changes with the random bytes', () => {
    expect(uuidV7(1, bytes(1))).not.toBe(uuidV7(1, bytes(2)));
  });

  it.each([-1, 1.5, 2 ** 48, Number.NaN])('refuses the timestamp %s', (time) => {
    expect(() => uuidV7(time, bytes(0))).toThrow(RangeError);
  });

  it('refuses too few random bytes', () => {
    expect(() => uuidV7(1, new Uint8Array(9))).toThrow(RangeError);
  });
});

describe('uuidV7Time', () => {
  it('reads back the time a UUIDv7 was made, and refuses anything else', () => {
    const at = Date.UTC(2026, 10, 13, 12, 0, 0);
    expect(uuidV7Time(uuidV7(at, new Uint8Array(10)))?.getTime()).toBe(at);
    expect(uuidV7Time('not-an-id')).toBeNull();
    expect(uuidV7Time('0193c0a8-7b1e-4c4a-9e2f-3d5a6b7c8d01')).toBeNull();
  });
});
