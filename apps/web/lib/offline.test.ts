import { describe, expect, it } from 'vitest';
import type { BillingView } from './billing';
import { offlineAllowed } from './offline';

const billing = (patch: Partial<BillingView>): BillingView =>
  ({ access: 'free', passes: [], ...patch }) as BillingView;

describe('offline reading (ADR-0027)', () => {
  it('is a paid tool: on a plan, in the free week, or on a trip with a pass', () => {
    expect(offlineAllowed(billing({ access: 'explorer' }), 't1')).toBe(true);
    expect(offlineAllowed(billing({ access: 'trial' }), 't1')).toBe(true);
    expect(offlineAllowed(billing({}), 't1')).toBe(false);
    expect(
      offlineAllowed(
        billing({ passes: [{ tripId: 't1', validUntil: '2027-01-01T00:00:00Z' }] }),
        't1',
      ),
    ).toBe(true);
    expect(
      offlineAllowed(
        billing({ passes: [{ tripId: 't2', validUntil: '2027-01-01T00:00:00Z' }] }),
        't1',
      ),
    ).toBe(false);
    expect(offlineAllowed(null, 't1')).toBe(false);
    expect(offlineAllowed(billing({ access: 'voyager' }), null)).toBe(false);
  });
});
