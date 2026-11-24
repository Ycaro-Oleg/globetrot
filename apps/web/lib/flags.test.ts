import { describe, expect, it } from 'vitest';
import { isPipEnabled } from './flags';

describe('isPipEnabled', () => {
  it('is off when the variable is missing', () => {
    expect(isPipEnabled({})).toBe(false);
  });

  it('is on only for the exact value "true"', () => {
    expect(isPipEnabled({ FEATURE_PIP: 'true' })).toBe(true);
    for (const value of ['false', 'TRUE', '1', 'yes', '', ' true']) {
      expect(isPipEnabled({ FEATURE_PIP: value })).toBe(false);
    }
  });
});
