import { sql } from 'drizzle-orm';
import type { Database } from './client';

/**
 * The internal metrics (ADR-0031): counts only, straight from the database, for the owner's dashboard. Nothing
 * here returns a person, an email or a trip's content.
 */
type Executor = Pick<Database, 'execute'>;

const num = (value: unknown) => Number(value ?? 0);

export function createMetricsRepository(executor: Executor) {
  const one = async (query: ReturnType<typeof sql>) => {
    const result = await executor.execute(query);
    return (result.rows[0] ?? {}) as Record<string, unknown>;
  };
  return {
    async snapshot(now: Date) {
      const since30 = new Date(now.getTime() - 30 * 86_400_000);
      const since7 = new Date(now.getTime() - 7 * 86_400_000);
      const accounts = await one(sql`
        select count(*) as total,
          count(*) filter (where created_at > ${since7}) as last7,
          count(*) filter (where created_at > ${since30}) as last30,
          count(*) filter (where email_verified) as verified
        from "user"`);
      const trips = await one(sql`
        select count(*) filter (where status <> 'archived') as active,
          count(*) filter (where created_at > ${since30}) as created30
        from trip`);
      const sources = await one(sql`
        select
          count(*) filter (where metadata ? 'fromSuggestion') as from_plan,
          count(*) filter (where metadata ? 'fromExample') as from_example,
          count(*) filter (where not (metadata ? 'fromSuggestion') and not (metadata ? 'fromExample')) as by_hand
        from audit_event
        where action = 'trip.create' and occurred_at > ${since30}`);
      const goals = await one(sql`
        select count(*) as saving from trip_savings s join trip t on t.id = s.trip_id
        where t.status <> 'archived' and s.monthly_minor > 0`);
      const checkins = await executor.execute(sql`
        select week, count(*) as n from savings_checkin group by week order by week desc limit 8`);
      const sharing = await one(sql`
        select
          count(*) filter (where action = 'trip.invite.create') as invites,
          count(*) filter (where action = 'trip.member.join') as joins,
          count(distinct actor_id) filter (where action = 'trip.invite.create') as inviters
        from audit_event where occurred_at > ${since30}`);
      const retention = await one(sql`
        with cohort as (
          select id, created_at from "user"
          where created_at <= ${new Date(now.getTime() - 56 * 86_400_000)}
            and created_at > ${new Date(now.getTime() - 112 * 86_400_000)}
        ),
        active as (
          select c.id,
            bool_or(a.occurred_at between c.created_at + interval '7 days' and c.created_at + interval '14 days') as w1,
            bool_or(a.occurred_at between c.created_at + interval '28 days' and c.created_at + interval '35 days') as w4,
            bool_or(a.occurred_at between c.created_at + interval '56 days' and c.created_at + interval '63 days') as w8
          from cohort c left join audit_event a on a.actor_id = c.id
          group by c.id
        )
        select count(*) as cohort,
          count(*) filter (where w1) as w1, count(*) filter (where w4) as w4, count(*) filter (where w8) as w8
        from active`);
      const money = await one(sql`
        select
          (select count(*) from subscription where status = 'active' and plan = 'explorer' and current_period_end > ${now}) as explorer,
          (select count(*) from subscription where status = 'active' and plan = 'voyager' and current_period_end > ${now}) as voyager,
          (select count(*) from trip_pass where valid_until > ${now}) as passes,
          (select count(*) from referral) as referrals`);
      return {
        accounts: {
          total: num(accounts.total),
          last7: num(accounts.last7),
          last30: num(accounts.last30),
          verified: num(accounts.verified),
        },
        trips: {
          active: num(trips.active),
          created30: num(trips.created30),
          fromPlan30: num(sources.from_plan),
          fromExample30: num(sources.from_example),
          byHand30: num(sources.by_hand),
          savingMonthly: num(goals.saving),
        },
        checkinsByWeek: (checkins.rows as { week: string; n: unknown }[]).map((row) => ({
          week: row.week,
          count: num(row.n),
        })),
        sharing: {
          invites30: num(sharing.invites),
          joins30: num(sharing.joins),
          inviters30: num(sharing.inviters),
        },
        retention: {
          cohort: num(retention.cohort),
          week1: num(retention.w1),
          week4: num(retention.w4),
          week8: num(retention.w8),
        },
        money: {
          explorer: num(money.explorer),
          voyager: num(money.voyager),
          activePasses: num(money.passes),
          referrals: num(money.referrals),
        },
      };
    },
  };
}

export type MetricsRepository = ReturnType<typeof createMetricsRepository>;
