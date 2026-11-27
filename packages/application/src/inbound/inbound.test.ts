import { PIP_REQUEST_MAX } from '@globetrot/domain';
import { describe, expect, it } from 'vitest';
import { createApplication, createInboundEmail, inboundRequest, type UserRecord } from '../index';
import { createFakePorts } from '../testing';

const ana: UserRecord = { id: 'u-ana', email: 'ana@example.com', name: 'Ana', emailVerified: true };

function setup() {
  const fake = createFakePorts({ users: [ana], now: new Date('2026-11-27T12:00:00.000Z') });
  const app = createApplication(fake.ports);
  return { ...fake, app, inbound: createInboundEmail(fake.ports, app) };
}

describe('bookings forwarded by email (ADR-0032)', () => {
  it('asks Pip to add the booking from the email’s start, within Pip’s limit', () => {
    const request = inboundRequest({
      subject: 'Your stay in Lisbon',
      text: 'Check-in   12 March\n\nTotal €420 '.repeat(80),
    });
    expect(request.length).toBeLessThanOrEqual(PIP_REQUEST_MAX);
    expect(request).toContain('Your stay in Lisbon | Check-in 12 March Total €420');
    expect(request).toMatch(/^Add this booking/);
  });

  it('turns an email to the person’s address into a proposal on their latest trip, to review', async () => {
    const { app, inbound, state, ai } = setup();
    const { token } = await app.getInboundToken.execute({ kind: 'user', userId: ana.id }, {});
    expect(token).toMatch(/^[a-z0-9]{16,40}$/);
    expect((await app.getInboundToken.execute({ kind: 'user', userId: ana.id }, {})).token).toBe(
      token,
    );
    expect(await inbound.receive({ token, subject: 'Hotel', text: 'Lisbon 12 March' })).toBe(
      'no-trip',
    );
    const trip = await app.createTrip.execute(
      { kind: 'user', userId: ana.id },
      { title: 'Lisboa', startDate: null },
    );
    expect(await inbound.receive({ token, subject: 'Hotel', text: 'Lisbon 12 March' })).toBe(
      'proposed',
    );
    expect([...state.proposals.values()].map((p) => [p.tripId, p.status])).toEqual([
      [trip.id, 'proposed'],
    ]);
    expect(ai.requests.at(-1)?.user).toContain('Lisbon 12 March');
  });

  it('ignores unknown addresses, and keeps the email when Pip does not answer', async () => {
    const { app, inbound, ai } = setup();
    expect(
      await inbound.receive({ token: 'nobodyknowsthisaddress1', subject: 's', text: 't' }),
    ).toBe('unknown-address');
    expect(await inbound.receive({ token: 'BAD TOKEN', subject: 's', text: 't' })).toBe(
      'unknown-address',
    );
    const { token } = await app.getInboundToken.execute({ kind: 'user', userId: ana.id }, {});
    await app.createTrip.execute(
      { kind: 'user', userId: ana.id },
      { title: 'Roma', startDate: null },
    );
    ai.next = null;
    expect(await inbound.receive({ token, subject: 'Hotel', text: 'Rome' })).toBe('not-answered');
  });
});
