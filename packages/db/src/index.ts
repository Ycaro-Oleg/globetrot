/**
 * @globetrot/db: Drizzle schema, migrations and connection helpers for PostgreSQL + PostGIS.
 * Conventions: docs/architecture/data-model.md.
 */
export { DatabaseConfigError, loadDatabaseConfig, type DatabaseConfig } from './config';
export { connectDatabase, type ConnectOptions, type Database, type DatabaseHandle } from './client';
export { MIGRATIONS_FOLDER, runMigrations } from './migrate';
export * as schema from './schema';
export {
  createAuditLog,
  createCooldown,
  createDestinationRepository,
  createChecklistRepository,
  createDayPlaceRepository,
  createVisaRepository,
  createExpenseRepository,
  createSavingsRepository,
  createIdempotencyStore,
  createMediaRepository,
  type MediaRepository,
  type MediaRow,
  createPreferencesRepository,
  createTripRepository,
  createUnitOfWork,
  MAX_LISTED_TRIPS,
  type AuditLog,
  type Cooldown,
  type DestinationRepository,
  type DestinationRow,
  type ChecklistItemRow,
  type DayPlaceRepository,
  type DayPlaceRow,
  type VisaRepository,
  type VisaRow,
  type ChecklistRepository,
  type ExpenseRepository,
  type ExpenseRow,
  type SavingsRepository,
  type SavingsRow,
  type NewDestinationRow,
  type IdempotencyStore,
  type PreferencesRepository,
  type PreferencesRow,
  type Transaction,
  type TripRepository,
  type TripRow,
} from './repositories';
export { createAccountRepository, type AccountRepository } from './account-repository';
export { createMaintenanceRepository, type MaintenanceRepository } from './maintenance-repository';
export { createBillingRepository, type BillingRepository } from './billing-repository';
export {
  createNoticeRepository,
  createWeeklyNoticeRepository,
  type NoticeRepository,
} from './notice-repository';
export { createShareRepository, type ShareRepository } from './share-repository';
export { createMemberRepository, type MemberRepository } from './member-repository';
export {
  createAssistantRepository,
  type AssistantRepository,
  type ProposalRow,
} from './assistant-repository';
export {
  createCommunityRepository,
  type CommentRow,
  type CommunityRepository,
  type PostRow,
} from './community-repository';
export {
  assertLocalDatabase,
  assertSafeDatabaseName,
  createEmptyDatabase,
  databaseExists,
  databaseNameOf,
  dropDatabase,
  isLocalHost,
  quoteIdentifier,
  recreateDatabase,
  withDatabase,
} from './admin';
