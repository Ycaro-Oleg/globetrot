import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from './index';

describe('@globetrot/ui', () => {
  it('exposes its package name', () => {
    expect(PACKAGE_NAME).toBe('@globetrot/ui');
  });
});
