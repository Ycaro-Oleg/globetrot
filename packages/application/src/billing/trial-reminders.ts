import {
  priceCurrencyFor,
  TRIAL_ENDED_NOTICE_DAYS,
  TRIAL_ENDING_NOTICE_HOURS,
  TRIAL_TERMS,
} from '@globetrot/domain';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@globetrot/i18n';
import type { EmailPort } from '../email/templates';
import type { Clock } from '../ports';

export type TrialNoticeKind = 'trial-ending' | 'trial-ended';

export interface TrialNoticeTarget {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly locale: string;
  /** The person's chosen currency: prices are quoted in reais only when it is BRL (ADR-0023). */
  readonly currency?: string;
  readonly signedUpAt: Date;
  /** The trip changed most recently (not archived), named in the email; null without one. */
  readonly tripTitle?: string | null;
}

export interface TrialNoticeStore {
  /** Verified accounts that signed up in `(after, upTo]`, without a plan paid past `now`, not yet sent `kind`. */
  due(
    kind: TrialNoticeKind,
    range: { after: Date; upTo: Date },
    now: Date,
    limit: number,
  ): Promise<TrialNoticeTarget[]>;
  claim(userId: string, kind: TrialNoticeKind, at: Date): Promise<boolean>;
  release(userId: string, kind: TrialNoticeKind): Promise<void>;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const BATCH = 100;

/**
 * The two trial emails (ADR-0019): two days before the free week ends, and once after it ended. Each is sent at
 * most once per account: it is claimed before sending and the claim is given back if sending fails.
 */
export function createTrialReminders(deps: {
  readonly store: TrialNoticeStore;
  readonly email: EmailPort;
  readonly clock: Clock;
  /** The public web origin, for the link to the plans. */
  readonly appUrl: string;
}) {
  const trial = TRIAL_TERMS.days * DAY;
  const planUrl = new URL('/app/plan', deps.appUrl).toString();

  async function send(kind: TrialNoticeKind, range: { after: Date; upTo: Date }, now: Date) {
    let sent = 0;
    for (const target of await deps.store.due(kind, range, now, BATCH)) {
      if (!(await deps.store.claim(target.userId, kind, now))) continue;
      const locale: SupportedLocale = (SUPPORTED_LOCALES as readonly string[]).includes(
        target.locale,
      )
        ? (target.locale as SupportedLocale)
        : 'en';
      const endsAt = target.signedUpAt.getTime() + trial;
      try {
        await deps.email.send({
          to: target.email,
          template: kind === 'trial-ending' ? 'trialEnding' : 'trialEnded',
          locale,
          data: {
            url: planUrl,
            name: target.name,
            expiresInHours: Math.max(1, Math.round((endsAt - now.getTime()) / HOUR)),
            priceCurrency: priceCurrencyFor(target.currency),
            ...(target.tripTitle ? { tripTitle: target.tripTitle } : {}),
          },
        });
        sent += 1;
      } catch {
        await deps.store.release(target.userId, kind);
      }
    }
    return sent;
  }

  return {
    async run(): Promise<{ ending: number; ended: number }> {
      const now = deps.clock.now();
      const t = now.getTime();
      // Ends within the next 48 hours: signed up between 7 days ago and 5 days ago.
      const ending = await send(
        'trial-ending',
        {
          after: new Date(t - trial),
          upTo: new Date(t - trial + TRIAL_ENDING_NOTICE_HOURS * HOUR),
        },
        now,
      );
      // Ended in the last 3 days.
      const ended = await send(
        'trial-ended',
        { after: new Date(t - trial - TRIAL_ENDED_NOTICE_DAYS * DAY), upTo: new Date(t - trial) },
        now,
      );
      return { ending, ended };
    },
  };
}
