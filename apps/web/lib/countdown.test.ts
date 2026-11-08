import { describe, expect, it } from 'vitest';
import { RESEND_COOLDOWN_SECONDS, secondsLeft } from './countdown';

describe('secondsLeft', () => {
  it('counts down in whole seconds, rounding up', () => {
    const end = 1_000_000;
    expect(secondsLeft(end, end - 30_000)).toBe(30);
    expect(secondsLeft(end, end - 29_001)).toBe(30);
    expect(secondsLeft(end, end - 29_000)).toBe(29);
    expect(secondsLeft(end, end - 1)).toBe(1);
  });

  it('is zero at and after the end, never negative', () => {
    expect(secondsLeft(1_000, 1_000)).toBe(0);
    expect(secondsLeft(1_000, 9_999)).toBe(0);
    expect(secondsLeft(0, Date.now())).toBe(0);
  });

  it('matches the cooldown the server enforces', () => {
    expect(RESEND_COOLDOWN_SECONDS).toBe(30);
  });
});
