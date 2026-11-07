/**
 * @globetrot/application: commands and queries with authorization, idempotency and audit; ports for adapters
 * (ADR-0006). No HTTP, database or UI imports: adapters pass their implementations in through `Ports`.
 */
import type { Ports } from './ports';
import { createGetCurrentUser } from './queries/get-current-user';
import {
  createArchiveTrip,
  createCreateTrip,
  createGetTrip,
  createListTrips,
  createUpdateTrip,
} from './trips/operations';

export const PACKAGE_NAME = '@globetrot/application' as const;

export type { Actor } from './actor';
export { assertOwner } from './authorization';
export { canonicalJson } from './canonical-json';
export {
  ApplicationError,
  ForbiddenError,
  IdempotencyKeyReusedError,
  NotFoundError,
  UnauthenticatedError,
  ValidationError,
  type FieldIssue,
} from './errors';
export { defineOperation, type Operation } from './operation';
export type {
  AuditEventInput,
  AuditLog,
  AuditMetadata,
  Clock,
  IdempotencyStart,
  IdempotencyStore,
  IdGenerator,
  NewTrip,
  Ports,
  Transaction,
  TripPatch,
  TripReader,
  TripRecord,
  TripWriter,
  UnitOfWork,
  UserReader,
  UserRecord,
} from './ports';
export {
  createGetCurrentUser,
  currentUserSchema,
  type CurrentUser,
} from './queries/get-current-user';
export {
  createTripFields,
  currencySchema,
  dateSchema,
  statusSchema,
  titleSchema,
  tripIdSchema,
  tripSchema,
  updateTripBodySchema,
  type TripView,
} from './trips/schemas';
export { idempotencyKeySchema } from './trips/operations';

/** Composition root: every operation, wired to the given ports. */
export function createApplication(ports: Ports) {
  return {
    getCurrentUser: createGetCurrentUser({ users: ports.users }),
    listTrips: createListTrips(ports),
    getTrip: createGetTrip(ports),
    createTrip: createCreateTrip(ports),
    updateTrip: createUpdateTrip(ports),
    archiveTrip: createArchiveTrip(ports),
  };
}
export type Application = ReturnType<typeof createApplication>;
