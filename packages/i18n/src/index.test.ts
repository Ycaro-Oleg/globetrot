import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from './index';

describe('@globetrot/i18n', () => {
  it('exposes its package name', () => {
    expect(PACKAGE_NAME).toBe('@globetrot/i18n');
  });
});
