/**
 * @globetrot/application: commands and queries with authorization, idempotency and audit; ports for adapters
 * (ADR-0006). No HTTP, database or UI imports: adapters pass their implementations in through `Ports`.
 */
import type { Ports } from './ports';
import { createGetCurrentUser } from './queries/get-current-user';

export const PACKAGE_NAME = '@globetrot/application' as const;

export type { Actor } from './actor';
export { assertOwner } from './authorization';
export {
  ApplicationError,
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
  ValidationError,
  type FieldIssue,
} from './errors';
export { defineOperation, type Operation } from './operation';
export type { Ports, UserReader, UserRecord } from './ports';
export {
  createGetCurrentUser,
  currentUserSchema,
  type CurrentUser,
} from './queries/get-current-user';

/** Composition root: every operation, wired to the given ports. */
export function createApplication(ports: Ports) {
  return {
    getCurrentUser: createGetCurrentUser({ users: ports.users }),
  };
}
export type Application = ReturnType<typeof createApplication>;
