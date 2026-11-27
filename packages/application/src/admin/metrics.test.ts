import { describe, expect, it } from 'vitest';
import { createApplication, type UserRecord } from '../index';
import { createFakePorts } from '../testing';

const owner: UserRecord = {
  id: 'u-owner',
  email: 'owner@example.com',
  name: 'Owner',
  emailVerified: true,
};
const other: UserRecord = {
  id: 'u-other',
  email: 'o@example.com',
  name: 'Other',
  emailVerified: true,
};

describe('the internal dashboard (ADR-0031)', () => {
  it('shows counts to admins and "not found" to everyone else', async () => {
    const fake = createFakePorts({ users: [owner, other] });
    fake.state.admins.push(owner.id);
    const app = createApplication(fake.ports);
    expect(
      (await app.getAdminMetrics.execute({ kind: 'user', userId: owner.id }, {})).accounts.total,
    ).toBe(2);
    await expect(
      app.getAdminMetrics.execute({ kind: 'user', userId: other.id }, {}),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
