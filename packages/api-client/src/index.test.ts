import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from './index';

describe('@globetrot/api-client', () => {
  it('exposes its package name', () => {
    expect(PACKAGE_NAME).toBe('@globetrot/api-client');
  });
});
