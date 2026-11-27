import { and, count, desc, eq, gte } from 'drizzle-orm';
import type { Database } from './client';
import { aiProposal, aiUsage, inboundAddress } from './schema';

/** PostgreSQL adapter for Pip's proposals and usage (packages/application/src/ports.ts). */

type Executor = Pick<Database, 'select' | 'insert' | 'update'>;

export interface ProposalRow {
  readonly id: string;
  readonly ownerId: string;
  readonly tripId: string;
  readonly request: string;
  readonly summary: string;
  readonly changes: unknown[];
  readonly status: string;
  readonly applied: number[];
  readonly undo: unknown;
  readonly createdAt: Date;
  readonly decidedAt: Date | null;
}

export function createAssistantRepository(executor: Executor) {
  return {
    async findInboundUser(token: string): Promise<string | null> {
      const [row] = await executor
        .select({ userId: inboundAddress.userId })
        .from(inboundAddress)
        .where(eq(inboundAddress.token, token));
      return row?.userId ?? null;
    },
    async ensureInboundToken(userId: string, candidate: string, at: Date): Promise<string> {
      await executor
        .insert(inboundAddress)
        .values({ userId, token: candidate, createdAt: at })
        .onConflictDoNothing();
      const [row] = await executor
        .select({ token: inboundAddress.token })
        .from(inboundAddress)
        .where(eq(inboundAddress.userId, userId));
      if (!row) throw new Error('inbound address was not stored');
      return row.token;
    },
    async findProposal(id: string): Promise<ProposalRow | null> {
      const [row] = await executor.select().from(aiProposal).where(eq(aiProposal.id, id));
      return row ?? null;
    },
    async listProposals(tripId: string, limit: number): Promise<ProposalRow[]> {
      return executor
        .select()
        .from(aiProposal)
        .where(eq(aiProposal.tripId, tripId))
        .orderBy(desc(aiProposal.createdAt))
        .limit(limit);
    },
    async insertProposal(row: Omit<ProposalRow, 'applied' | 'undo' | 'decidedAt' | 'status'>) {
      await executor.insert(aiProposal).values({ ...row, status: 'proposed' });
    },
    async updateProposal(
      id: string,
      patch: {
        readonly status: string;
        readonly decidedAt: Date;
        readonly applied?: number[];
        readonly undo?: unknown;
      },
    ) {
      await executor.update(aiProposal).set(patch).where(eq(aiProposal.id, id));
    },
    async recordUsage(row: {
      readonly id: string;
      readonly userId: string;
      readonly provider: string;
      readonly model: string;
      readonly inputTokens: number;
      readonly outputTokens: number;
      readonly createdAt: Date;
    }) {
      await executor.insert(aiUsage).values(row);
    },
    async countRequestsSince(userId: string, since: Date): Promise<number> {
      const [row] = await executor
        .select({ n: count() })
        .from(aiUsage)
        .where(and(eq(aiUsage.userId, userId), gte(aiUsage.createdAt, since)));
      return row?.n ?? 0;
    },
  };
}

export type AssistantRepository = ReturnType<typeof createAssistantRepository>;
