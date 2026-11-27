import { PIP_REQUEST_MAX } from '@globetrot/domain';
import { z } from 'zod';
import { defineOperation } from '../operation';
import type { Application } from '../index';
import type { Ports } from '../ports';

/** The account's forwarding token (ADR-0032), made the first time it is asked for. */
export function createGetInboundToken(deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids'>) {
  return defineOperation({
    name: 'getInboundToken',
    kind: 'command',
    input: z.object({}),
    output: z.object({ token: z.string() }),
    async handler(actor) {
      // 128 random bits, letters and digits only, so it reads cleanly in an email address.
      const candidate = deps.ids
        .newToken()
        .replace(/[^A-Za-z0-9]/g, '')
        .toLowerCase();
      return deps.unitOfWork.run(async (tx) => ({
        token: await tx.assistant.ensureInboundToken(actor.userId, candidate, deps.clock.now()),
      }));
    },
  });
}

export interface InboundEmail {
  /** The part of the address after `+`, which says whose it is. */
  readonly token: string;
  readonly subject: string;
  readonly text: string;
}

export type InboundOutcome = 'proposed' | 'unknown-address' | 'no-trip' | 'not-answered';

/** What Pip is asked: to add the booking, using only what the email says. The start of the email fits. */
export function inboundRequest(email: Pick<InboundEmail, 'subject' | 'text'>): string {
  const intro =
    'Add this booking from my email to the trip. Use only what it says; leave out what it does not: ';
  const body = `${email.subject.trim()} | ${email.text.replace(/\s+/g, ' ').trim()}`;
  return `${intro}${body}`.slice(0, PIP_REQUEST_MAX);
}

/**
 * A forwarded booking email becomes a Pip proposal for the person's latest active trip (ADR-0032), which they
 * review and apply like any other: Pip never books or changes anything itself, and credits apply as usual. Not an
 * operation: no session is acting; the address's token says whose it is, and the webhook's secret says the email
 * came from the email provider.
 */
export function createInboundEmail(
  deps: Pick<Ports, 'assistant' | 'trips'>,
  application: Application,
) {
  return {
    async receive(email: InboundEmail): Promise<InboundOutcome> {
      if (!/^[a-z0-9]{16,40}$/.test(email.token)) return 'unknown-address';
      const userId = await deps.assistant.findInboundUser(email.token);
      if (!userId) return 'unknown-address';
      const [trip] = await deps.trips.listByOwner(userId, { includeArchived: false });
      if (!trip) return 'no-trip';
      try {
        await application.askPip.execute(
          { kind: 'user', userId },
          { tripId: trip.id, request: inboundRequest(email) },
        );
        return 'proposed';
      } catch {
        // Out of credits, the daily cap, or the model not answering: the email is not lost on the provider's side.
        return 'not-answered';
      }
    },
  };
}
