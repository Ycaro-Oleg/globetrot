import { z } from 'zod';
import { NotFoundError, ValidationError } from '../errors';
import { mediaKey } from '../media/operations';
import { defineOperation } from '../operation';
import type { Ports } from '../ports';
import { loadOwnedTrip } from '../trips/operations';
import { tripIdSchema } from '../trips/schemas';

/** Bumped when the export's shape changes in a way a reader would notice. */
export const ACCOUNT_EXPORT_VERSION = 1;

export const accountExportSchema = z.object({
  format: z.literal('globetrot-account-export'),
  version: z.number().int(),
  exportedAt: z.iso.datetime(),
  /** Account, preferences, trips with everything in them, visas, community, uploads (ids) and the person's own history. */
  data: z.record(z.string(), z.unknown()),
});

const okSchema = z.object({ ok: z.literal(true) });

export const deleteAccountFields = z.object({
  confirmEmail: z
    .string()
    .trim()
    .min(1)
    .meta({ description: 'The account’s email, typed again to confirm.' }),
});

/** The person's whole account as JSON (LGPD/GDPR access and portability). Never another person's data. */
export function createExportAccount(deps: Pick<Ports, 'account' | 'clock'>) {
  return defineOperation({
    name: 'exportAccount',
    kind: 'query',
    input: z.object({}),
    output: accountExportSchema,
    async handler(actor) {
      const data = await deps.account.exportFor(actor.userId);
      if (!data) throw new NotFoundError();
      return {
        format: 'globetrot-account-export' as const,
        version: ACCOUNT_EXPORT_VERSION,
        exportedAt: deps.clock.now().toISOString(),
        data,
      };
    },
  });
}

/**
 * Deletes the account for good: trips and everything in them, visas, the community profile, posts, comments,
 * likes, follows, uploads (rows and stored bytes), sessions and sign-in methods. The person types their email
 * again to confirm. The audit log keeps its rows: they name an id that no longer belongs to anyone and never
 * held personal data.
 */
export function createDeleteAccount(
  deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids' | 'users' | 'storage'>,
) {
  return defineOperation({
    name: 'deleteAccount',
    kind: 'command',
    input: deleteAccountFields,
    output: okSchema,
    async handler(actor, input) {
      const user = await deps.users.findById(actor.userId);
      if (!user) throw new NotFoundError();
      if (user.email.trim().toLowerCase() !== input.confirmEmail.toLowerCase()) {
        throw new ValidationError([
          {
            field: 'confirmEmail',
            code: 'confirmation_mismatch',
            message: 'Type the account’s email to confirm',
          },
        ]);
      }
      const now = deps.clock.now();
      const mediaIds = await deps.unitOfWork.run(async (tx) => {
        const ids = await tx.account.mediaIdsOf(actor.userId);
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'account.delete',
          entityType: 'user',
          entityId: actor.userId,
          metadata: { uploads: ids.length },
        });
        await tx.account.deleteAccount(actor.userId);
        return ids;
      });
      // The rows are gone; the stored bytes follow. A failure here leaves an unreachable object, never data
      // someone can open, and the next deletion attempt or a cleanup job removes it.
      await Promise.allSettled(mediaIds.map((id) => deps.storage.delete(mediaKey(id))));
      return { ok: true as const };
    },
  });
}

/** Deletes an archived trip for good, with everything in it. An active trip must be archived first. */
export function createDeleteTrip(deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids'>) {
  return defineOperation({
    name: 'deleteTrip',
    kind: 'command',
    input: z.object({ id: tripIdSchema }),
    output: okSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const trip = await loadOwnedTrip(tx.trips, actor, input.id);
        if (trip.status !== 'archived') {
          throw new ValidationError([
            { field: 'id', code: 'not_archived', message: 'Archive the trip before deleting it' },
          ]);
        }
        if (!(await tx.account.deleteArchivedTrip(trip.id, actor.userId)))
          throw new NotFoundError();
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'trip.delete',
          entityType: 'trip',
          entityId: trip.id,
          metadata: {},
        });
        return { ok: true as const };
      });
    },
  });
}
