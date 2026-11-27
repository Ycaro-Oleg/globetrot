import { z } from 'zod';
import { NotFoundError } from '../errors';
import { defineOperation } from '../operation';
import type { Ports } from '../ports';

const count = z.number().int();

export const adminMetricsSchema = z.object({
  accounts: z.object({ total: count, last7: count, last30: count, verified: count }),
  trips: z.object({
    active: count,
    created30: count,
    /** Trips created in the last 30 days from the landing's plan, an example, or by hand. */
    fromPlan30: count,
    fromExample30: count,
    byHand30: count,
    /** Active trips with a monthly saving amount. */
    savingMonthly: count,
  }),
  checkinsByWeek: z.array(z.object({ week: z.string(), count })),
  sharing: z.object({ invites30: count, joins30: count, inviters30: count }),
  /** Accounts that signed up 8 to 16 weeks ago, and how many were active in weeks 1, 4 and 8. */
  retention: z.object({ cohort: count, week1: count, week4: count, week8: count }),
  money: z.object({ explorer: count, voyager: count, activePasses: count, referrals: count }),
});

/**
 * The owner's dashboard numbers (ADR-0031): counts only, for the accounts in `ADMIN_EMAILS`. Everyone else gets
 * "not found", like a page that does not exist.
 */
export function createGetAdminMetrics(deps: Pick<Ports, 'admins' | 'metrics' | 'clock'>) {
  return defineOperation({
    name: 'getAdminMetrics',
    kind: 'query',
    input: z.object({}),
    output: adminMetricsSchema,
    async handler(actor) {
      if (!(await deps.admins.isAdmin(actor.userId))) throw new NotFoundError();
      return deps.metrics.snapshot(deps.clock.now());
    },
  });
}
