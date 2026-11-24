import { describe, expect, it } from 'vitest';
import { SITE_NAME } from './site';

describe('web site constants', () => {
  it('has the brand name', () => {
    expect(SITE_NAME).toBe('Globetrot');
  });
});
