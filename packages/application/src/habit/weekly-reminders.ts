import { isoWeekOf, localDateIn } from '@globetrot/domain';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@globetrot/i18n';
import type { EmailPort } from '../email/templates';
import type { Clock } from '../ports';

export interface WeeklyTarget {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly locale: string;
  readonly timeZone: string | null;
  readonly tripTitle: string | null;
}

export interface WeeklyNoticeStore {
  /**
   * Verified accounts with the weekly reminder on, saving monthly for an active trip, with no check-in and no
   * reminder in `week`.
   */
  due(week: string, limit: number): Promise<WeeklyTarget[]>;
  claim(userId: string, week: string, at: Date): Promise<boolean>;
  release(userId: string, week: string): Promise<void>;
}

const BATCH = 200;

/**
 * The weekly saving reminder (ADR-0026): on the person's Sunday, if the week has no check-in yet, one short email
 * with the link to check in. At most one per person and week; claimed before sending, given back if it failed.
 */
export function createWeeklyReminders(deps: {
  readonly store: WeeklyNoticeStore;
  readonly email: EmailPort;
  readonly clock: Clock;
  readonly appUrl: string;
}) {
  const todayUrl = new URL('/app/today', deps.appUrl).toString();
  return {
    async run(): Promise<{ sent: number }> {
      const now = deps.clock.now();
      const week = isoWeekOf(localDateIn(now, null));
      let sent = 0;
      for (const target of await deps.store.due(week, BATCH)) {
        const local = localDateIn(now, target.timeZone);
        // Only on the person's own Sunday, and only for the week it is for them too.
        if (new Date(`${local}T00:00:00Z`).getUTCDay() !== 0 || isoWeekOf(local) !== week) continue;
        if (!(await deps.store.claim(target.userId, week, now))) continue;
        const locale: SupportedLocale = (SUPPORTED_LOCALES as readonly string[]).includes(
          target.locale,
        )
          ? (target.locale as SupportedLocale)
          : 'en';
        try {
          await deps.email.send({
            to: target.email,
            template: 'weeklyCheckin',
            locale,
            data: {
              url: todayUrl,
              name: target.name,
              expiresInHours: 24,
              ...(target.tripTitle ? { tripTitle: target.tripTitle } : {}),
            },
          });
          sent += 1;
        } catch {
          await deps.store.release(target.userId, week);
        }
      }
      return { sent };
    },
  };
}

export type WeeklyReminders = ReturnType<typeof createWeeklyReminders>;
