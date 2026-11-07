import { PACKAGE_NAME as DOMAIN_PACKAGE } from '@globetrot/domain';
import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from './index';

describe('@globetrot/application', () => {
  it('exposes its package name', () => {
    expect(PACKAGE_NAME).toBe('@globetrot/application');
  });

  it('can import the domain package through the workspace', () => {
    expect(DOMAIN_PACKAGE).toBe('@globetrot/domain');
  });
});
