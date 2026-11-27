import { describe, expect, it } from 'vitest';
import { createFakeEmail } from '../testing';
import { createWeeklyReminders, type WeeklyTarget } from './weekly-reminders';

const target = (patch: Partial<WeeklyTarget> = {}): WeeklyTarget => ({
  userId: 'u-ana',
  email: 'ana@example.com',
  name: 'Ana',
  locale: 'pt-BR',
  timeZone: 'America/Sao_Paulo',
  tripTitle: 'Lisboa',
  ...patch,
});

function setup(now: string, targets: WeeklyTarget[], failSend = false) {
  const claimed = new Set<string>();
  const email = createFakeEmail();
  const port = failSend
    ? {
        async send() {
          throw new Error('smtp down');
        },
      }
    : email.port;
  const reminders = createWeeklyReminders({
    store: {
      async due() {
        return targets.filter((t) => !claimed.has(t.userId));
      },
      async claim(userId) {
        if (claimed.has(userId)) return false;
        claimed.add(userId);
        return true;
      },
      async release(userId) {
        claimed.delete(userId);
      },
    },
    email: port,
    clock: { now: () => new Date(now) },
    appUrl: 'https://globetrot.example',
  });
  return { reminders, email, claimed };
}

describe('the weekly reminder (ADR-0026)', () => {
  it('writes on the person’s Sunday, once, in their language, linking to Today', async () => {
    // Sunday 29 November 2026, 15:00 UTC: Sunday noon in São Paulo.
    const { reminders, email } = setup('2026-11-29T15:00:00.000Z', [target()]);
    expect(await reminders.run()).toEqual({ sent: 1 });
    expect(await reminders.run()).toEqual({ sent: 0 });
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]).toMatchObject({ template: 'weeklyCheckin', locale: 'pt-BR' });
    expect(email.sent[0]?.data.url).toBe('https://globetrot.example/app/today');
  });

  it('waits until it is Sunday where the person is, and tries again when sending failed', async () => {
    // Saturday 23:30 in São Paulo is already Sunday in UTC.
    const early = setup('2026-11-29T02:30:00.000Z', [target()]);
    expect(await early.reminders.run()).toEqual({ sent: 0 });
    const failing = setup('2026-11-29T15:00:00.000Z', [target()], true);
    expect(await failing.reminders.run()).toEqual({ sent: 0 });
    expect(failing.claimed.size).toBe(0);
  });
});
