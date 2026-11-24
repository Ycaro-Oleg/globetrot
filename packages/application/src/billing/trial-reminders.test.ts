import { describe, expect, it } from 'vitest';
import type { EmailMessage } from '../email/templates';
import {
  createTrialReminders,
  type TrialNoticeKind,
  type TrialNoticeStore,
  type TrialNoticeTarget,
} from './trial-reminders';

const NOW = new Date('2026-11-14T12:00:00.000Z');
const DAY = 86_400_000;
const person = (id: string, daysAgo: number, locale = 'en'): TrialNoticeTarget => ({
  userId: id,
  email: `${id}@example.com`,
  name: id,
  locale,
  signedUpAt: new Date(NOW.getTime() - daysAgo * DAY),
});

/** Applies the range like the SQL does, and remembers claims. */
function store(people: TrialNoticeTarget[]) {
  const sent = new Set<string>();
  const ranges: Record<string, { after: Date; upTo: Date }> = {};
  const port: TrialNoticeStore = {
    async due(kind, range) {
      ranges[kind] = range;
      return people.filter(
        (p) =>
          p.signedUpAt > range.after &&
          p.signedUpAt <= range.upTo &&
          !sent.has(`${p.userId}:${kind}`),
      );
    },
    async claim(userId: string, kind: TrialNoticeKind) {
      const key = `${userId}:${kind}`;
      if (sent.has(key)) return false;
      sent.add(key);
      return true;
    },
    async release(userId, kind) {
      sent.delete(`${userId}:${kind}`);
    },
  };
  return { port, sent, ranges };
}

function setup(people: TrialNoticeTarget[], failFor: string | null = null) {
  const s = store(people);
  const outbox: EmailMessage[] = [];
  const reminders = createTrialReminders({
    store: s.port,
    clock: { now: () => NOW },
    appUrl: 'https://globetrot.example',
    email: {
      async send(message) {
        if (message.to.startsWith(failFor ?? '\u0000')) throw new Error('smtp down');
        outbox.push(message);
      },
    },
  });
  return { ...s, outbox, reminders };
}

describe('trial reminders', () => {
  it('writes two days before the end and once after it, in the person’s language, with the plans link', async () => {
    const { reminders, outbox } = setup([
      person('fresh', 2),
      person('soon', 5.5, 'pt-BR'),
      person('over', 7.5),
      person('old', 12),
    ]);
    expect(await reminders.run()).toEqual({ ending: 1, ended: 1 });
    expect(outbox.map((m) => [m.to, m.template, m.locale])).toEqual([
      ['soon@example.com', 'trialEnding', 'pt-BR'],
      ['over@example.com', 'trialEnded', 'en'],
    ]);
    expect(outbox[0]!.data).toEqual({
      url: 'https://globetrot.example/app/plan',
      name: 'soon',
      expiresInHours: 36,
    });
  });

  it('sends each email once, and tries again later when sending failed', async () => {
    const { reminders, outbox } = setup([person('soon', 6)], 'soon');
    expect(await reminders.run()).toEqual({ ending: 0, ended: 0 });
    const again = setup([person('soon', 6)]);
    await again.reminders.run();
    await again.reminders.run();
    expect(again.outbox).toHaveLength(1);
    expect(outbox).toHaveLength(0);
  });

  it('falls back to English for a language it does not know', async () => {
    const { reminders, outbox } = setup([person('x', 6, 'xx')]);
    await reminders.run();
    expect(outbox[0]!.locale).toBe('en');
  });

  it('passes the person’s latest trip to the email, and leaves it out without one', async () => {
    const { reminders, outbox } = setup([
      { ...person('trip', 6), tripTitle: 'Japan in two weeks' },
      { ...person('none', 6), tripTitle: null },
    ]);
    await reminders.run();
    expect(outbox.find((m) => m.to.startsWith('trip'))!.data.tripTitle).toBe('Japan in two weeks');
    expect(outbox.find((m) => m.to.startsWith('none'))!.data).not.toHaveProperty('tripTitle');
  });
});
