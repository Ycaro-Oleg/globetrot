import { describe, expect, it } from 'vitest';
import { createApplication, type Actor, type UserRecord } from '../index';
import { createFakePorts } from '../testing';

const user = (id: string, name: string): UserRecord => ({
  id,
  email: `${id}@example.com`,
  name,
  emailVerified: true,
});
const ana = user('u-ana', 'Ana');
const bruno = user('u-bruno', 'Bruno');
const as = (who: UserRecord): Actor => ({ kind: 'user', userId: who.id });

async function setup() {
  const fake = createFakePorts({ users: [ana, bruno], now: new Date('2026-11-27T12:00:00.000Z') });
  const app = createApplication(fake.ports);
  const trip = await app.createTrip.execute(as(ana), {
    title: 'Lisboa',
    startDate: '2027-01-15',
    currency: 'BRL',
  });
  return { ...fake, app, trip };
}

describe('the weekly check-in (ADR-0026)', () => {
  it('adds the week’s amount to the trip’s savings once, changing it when checked in again', async () => {
    const { app, trip, state } = await setup();
    await app.updateSavings.execute(as(ana), { tripId: trip.id, saved: '100', monthly: '870' });
    const before = await app.getHabit.execute(as(ana), { tripId: trip.id });
    expect(before).toMatchObject({ week: '2026-W48', checkedIn: null, streak: 0 });
    expect(before.suggested.amount).toBe('200.00');
    await app.checkIn.execute(as(ana), { tripId: trip.id, amount: '200' });
    await app.checkIn.execute(as(ana), { tripId: trip.id, amount: '250' });
    expect(state.savings.get(trip.id)?.savedMinor).toBe(35_000n);
    expect(await app.getHabit.execute(as(ana), { tripId: trip.id })).toMatchObject({
      checkedIn: { amount: '250.00' },
      streak: 1,
    });
  });

  it('counts weeks in a row and keeps a member’s check-ins in their own savings', async () => {
    const { app, trip, state, setNow } = await setup();
    const { token } = await app.createInvite.execute(as(ana), { tripId: trip.id });
    await app.acceptInvite.execute(as(bruno), { token });
    await app.checkIn.execute(as(bruno), { tripId: trip.id, amount: '50' });
    setNow(new Date('2026-12-04T12:00:00.000Z'));
    await app.checkIn.execute(as(bruno), { tripId: trip.id, amount: '50' });
    const habit = await app.getHabit.execute(as(bruno), { tripId: trip.id });
    expect(habit.streak).toBe(2);
    expect(state.money.find((m) => m.userId === bruno.id)?.savedMinor).toBe(10_000n);
    expect(state.savings.get(trip.id)?.savedMinor ?? 0n).toBe(0n);
  });

  it('shows the countdown phase with its suggestions', async () => {
    const { app, trip } = await setup();
    const habit = await app.getHabit.execute(as(ana), { tripId: trip.id });
    expect(habit.countdown).toMatchObject({ daysLeft: 49, phase: 'three-months' });
    expect(habit.countdown.tasks).toContain('insurance');
  });

  it('follows the person’s own calendar for the week', async () => {
    const { app, trip, setNow } = await setup();
    await app.updatePreferences.execute(as(ana), { timeZone: 'America/Sao_Paulo' });
    // Monday 01:00 UTC is still Sunday in São Paulo: the previous week.
    setNow(new Date('2026-11-30T01:00:00.000Z'));
    expect((await app.getHabit.execute(as(ana), { tripId: trip.id })).week).toBe('2026-W48');
  });
});
