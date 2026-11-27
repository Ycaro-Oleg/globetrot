import { canonicalTimeZone } from '@globetrot/domain';
import { z } from 'zod';
import { defineOperation } from '../operation';
import type { PreferencesPatch, Ports } from '../ports';
import {
  DEFAULT_PREFERENCES,
  hasAPreferenceChange,
  preferencesSchema,
  toPreferencesView,
  updatePreferencesFields,
} from './schemas';

/** The caller's own settings. Takes no user id: the actor is the only source of "who". */
export function createGetPreferences(deps: Pick<Ports, 'preferences'>) {
  return defineOperation({
    name: 'getPreferences',
    kind: 'query',
    input: z.object({}),
    output: preferencesSchema,
    async handler(actor) {
      const record = await deps.preferences.find(actor.userId);
      return record ? toPreferencesView(record) : DEFAULT_PREFERENCES;
    },
  });
}

/**
 * Partial update of the caller's own settings. Only the fields sent are written; every other column keeps
 * its value. The first save creates the row, with the defaults for whatever was not sent.
 */
export function createUpdatePreferences(deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids'>) {
  return defineOperation({
    name: 'updatePreferences',
    kind: 'command',
    input: updatePreferencesFields.refine(hasAPreferenceChange, {
      error: 'Provide at least one field to change',
    }),
    output: preferencesSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      const patch: PreferencesPatch = {
        locale: input.locale,
        currency: input.currency,
        homeCountry: input.homeCountry,
        nationality: input.nationality,
        // Stored in the canonical spelling ("america/sao_paulo" becomes "America/Sao_Paulo").
        timeZone: input.timeZone === undefined ? undefined : canonicalTimeZone(input.timeZone),
        units: input.units,
        theme: input.theme,
        motion: input.motion,
        homeCity: input.homeCity,
        // A home city changed without a point (typed in settings) must not keep the old city's point.
        homePoint:
          input.homePoint !== undefined
            ? input.homePoint
            : input.homeCity !== undefined
              ? null
              : undefined,
        pipOptIn: input.pipOptIn,
        pipLook: input.pipLook,
        pipName: input.pipName,
      };
      const fields = (Object.keys(patch) as (keyof PreferencesPatch)[]).filter(
        (field) => patch[field] !== undefined,
      );

      return deps.unitOfWork.run(async (tx) => {
        const record = await tx.preferences.upsert(actor.userId, patch, now);
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'preferences.update',
          entityType: 'user_preference',
          entityId: actor.userId,
          // Names of the fields, never their values (a country or a time zone says where someone lives).
          metadata: { fields },
        });
        return toPreferencesView(record);
      });
    },
  });
}
