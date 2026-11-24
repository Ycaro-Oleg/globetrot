import { z } from 'zod';
import { NotFoundError } from '../errors';
import { defineOperation } from '../operation';
import type { UserReader } from '../ports';

/** The only user fields any client may see about the caller. Never add a credential or a token here. */
export const currentUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  emailVerified: z.boolean(),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;

/** The caller's own account. Takes no user id: the actor is the only source of "who". */
export function createGetCurrentUser(deps: { users: UserReader }) {
  return defineOperation({
    name: 'getCurrentUser',
    kind: 'query',
    input: z.object({}),
    output: currentUserSchema,
    async handler(actor) {
      const user = await deps.users.findById(actor.userId);
      // A valid session whose account vanished: report it as unknown rather than crash.
      if (!user) throw new NotFoundError('Account not found');
      return user;
    },
  });
}
