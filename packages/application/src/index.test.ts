import { fromDecimal, toDecimalString } from '@globetrot/domain';
import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from './index';

describe('@globetrot/application', () => {
  it('exposes its package name', () => {
    expect(PACKAGE_NAME).toBe('@globetrot/application');
  });

  it('can import the domain package through the workspace', () => {
    expect(toDecimalString(fromDecimal('12.5', 'USD'))).toBe('12.50');
  });
});
