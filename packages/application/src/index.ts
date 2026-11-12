/**
 * @globetrot/application: commands and queries with authorization, idempotency and audit; ports for adapters
 * (ADR-0006). No HTTP, database or UI imports: adapters pass their implementations in through `Ports`.
 */
import { createGetPreferences, createUpdatePreferences } from './preferences/operations';
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
export {
  renderEmail,
  type EmailData,
  type EmailMessage,
  type EmailPort,
  type EmailTemplate,
  type RenderedEmail,
} from './email/templates';
import {
  createCreateExpense,
  createDeleteExpense,
  createGetBudget,
  createListExpenses,
  createUpdateExpense,
  createUpdateSavings,
} from './budget/operations';
import {
  createAddChecklistItems,
  createDeleteChecklistItem,
  createGetChecklist,
  createUpdateChecklistItem,
} from './checklists/operations';
import { createListDestinations, createReplaceDestinations } from './destinations/operations';
export { defineOperation, type Operation } from './operation';
export type {
  ChecklistItemPatch,
  ChecklistItemRecord,
  ChecklistReader,
  ChecklistWriter,
  NewChecklistItem,
  AuditEventInput,
  AuditLog,
  AuditMetadata,
  Clock,
  DestinationReader,
  DestinationRecord,
  DestinationWriter,
  ExpensePatch,
  ExpenseReader,
  ExpenseRecord,
  ExpenseWriter,
  NewExpense,
  SavingsReader,
  SavingsRecord,
  SavingsWriter,
  NewDestination,
  IdempotencyStart,
  IdempotencyStore,
  IdGenerator,
  NewTrip,
  Ports,
  PreferencesPatch,
  PreferencesReader,
  PreferencesRecord,
  PreferencesWriter,
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

export {
  budgetSchema,
  expenseFields,
  expenseListSchema,
  expenseSchema,
  savingsFields,
  type BudgetView,
  type ExpenseView,
} from './budget/schemas';

export {
  addChecklistItemsFields,
  CHECKLIST_MAX_ITEMS,
  checklistItemSchema,
  checklistSchema,
  updateChecklistItemFields,
  type ChecklistItemView,
  type ChecklistView,
} from './checklists/schemas';

export {
  destinationFields,
  destinationListSchema,
  destinationSchema,
  replaceDestinationsBody,
  type DestinationView,
} from './destinations/schemas';

export {
  countrySchema,
  DEFAULT_PREFERENCES,
  localeSchema,
  preferencesSchema,
  preferredCurrencySchema,
  timeZoneSchema,
  unitsSchema,
  updatePreferencesBodySchema,
  type PreferencesView,
} from './preferences/schemas';

/** Composition root: every operation, wired to the given ports. */
export function createApplication(ports: Ports) {
  return {
    getCurrentUser: createGetCurrentUser({ users: ports.users }),
    listTrips: createListTrips(ports),
    getTrip: createGetTrip(ports),
    createTrip: createCreateTrip(ports),
    updateTrip: createUpdateTrip(ports),
    archiveTrip: createArchiveTrip(ports),
    listDestinations: createListDestinations(ports),
    getChecklist: createGetChecklist(ports),
    addChecklistItems: createAddChecklistItems(ports),
    updateChecklistItem: createUpdateChecklistItem(ports),
    deleteChecklistItem: createDeleteChecklistItem(ports),
    getBudget: createGetBudget(ports),
    listExpenses: createListExpenses(ports),
    createExpense: createCreateExpense(ports),
    updateExpense: createUpdateExpense(ports),
    deleteExpense: createDeleteExpense(ports),
    updateSavings: createUpdateSavings(ports),
    replaceDestinations: createReplaceDestinations(ports),
    getPreferences: createGetPreferences(ports),
    updatePreferences: createUpdatePreferences(ports),
  };
}
export type Application = ReturnType<typeof createApplication>;
