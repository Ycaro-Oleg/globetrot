import type {
  MotionChoice,
  ThemeChoice,
  TripStatus,
  TripVisibility,
  UnitSystem,
} from '@globetrot/domain';
import type { Actor } from './actor';

/**
 * What the application layer needs from the outside world. Adapters implement these ports (apps/api wires
 * them; the SQL lives in packages/db), and unit tests use in-memory fakes.
 */

export interface UserRecord {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly emailVerified: boolean;
}

export interface UserReader {
  findById(userId: string): Promise<UserRecord | null>;
}

// --- Trips ---------------------------------------------------------------------------------------------

export interface TripRecord {
  readonly id: string;
  readonly ownerId: string;
  readonly title: string;
  /** Calendar date `YYYY-MM-DD`, or null. */
  readonly startDate: string | null;
  readonly currency: string;
  readonly status: TripStatus;
  readonly visibility: TripVisibility;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewTrip {
  readonly id: string;
  readonly ownerId: string;
  readonly title: string;
  readonly startDate: string | null;
  readonly currency: string;
  readonly status: TripStatus;
  readonly visibility: TripVisibility;
  readonly createdAt: Date;
}

/** Only the fields present are changed. `startDate: null` clears the date. */
export interface TripPatch {
  readonly title?: string | undefined;
  readonly startDate?: string | null | undefined;
  readonly currency?: string | undefined;
  readonly status?: TripStatus | undefined;
}

export interface TripReader {
  /** By id alone: the caller decides, with `assertOwner`, whether the actor may see the record. */
  findById(id: string): Promise<TripRecord | null>;
  /** Newest first. Archived trips only when `includeArchived`. */
  listByOwner(
    ownerId: string,
    options: { readonly includeArchived: boolean },
  ): Promise<TripRecord[]>;
}

export interface TripWriter extends TripReader {
  insert(trip: NewTrip): Promise<TripRecord>;
  update(id: string, patch: TripPatch, updatedAt: Date): Promise<TripRecord>;
}

// --- Preferences ---------------------------------------------------------------------------------------

export interface PreferencesRecord {
  readonly locale: string;
  readonly currency: string;
  readonly homeCountry: string | null;
  readonly nationality: string | null;
  readonly timeZone: string | null;
  readonly units: UnitSystem;
  readonly theme: ThemeChoice;
  readonly motion: MotionChoice;
}

/** Only the fields present are written. `null` clears country, nationality or time zone. */
export interface PreferencesPatch {
  readonly locale?: string | undefined;
  readonly currency?: string | undefined;
  readonly homeCountry?: string | null | undefined;
  readonly nationality?: string | null | undefined;
  readonly timeZone?: string | null | undefined;
  readonly units?: UnitSystem | undefined;
  readonly theme?: ThemeChoice | undefined;
  readonly motion?: MotionChoice | undefined;
}

export interface PreferencesReader {
  /** `null` until the user saved something (or signed up through the API hook). */
  find(userId: string): Promise<PreferencesRecord | null>;
}

export interface PreferencesWriter extends PreferencesReader {
  /** Creates the row with defaults for what the patch leaves out, or changes only the fields in the patch. */
  upsert(userId: string, patch: PreferencesPatch, now: Date): Promise<PreferencesRecord>;
}

// --- Destinations (a trip's route) ---------------------------------------------------------------------

export interface DestinationRecord {
  readonly id: string;
  readonly tripId: string;
  /** 0-based order on the route. */
  readonly position: number;
  readonly placeKey: string;
  readonly name: string;
  readonly countryCode: string | null;
  readonly region: string | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly nights: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewDestination {
  readonly id: string;
  readonly placeKey: string;
  readonly name: string;
  readonly countryCode: string | null;
  readonly region: string | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly nights: number;
}

export interface DestinationReader {
  /** In route order. */
  listByTrip(tripId: string): Promise<DestinationRecord[]>;
}

export interface DestinationWriter extends DestinationReader {
  /** Replaces the trip's whole route with `items` (position = index) and returns what is stored. */
  replaceForTrip(
    tripId: string,
    items: readonly NewDestination[],
    now: Date,
  ): Promise<DestinationRecord[]>;
}

// --- Audit ---------------------------------------------------------------------------------------------

export type AuditMetadata = Readonly<Record<string, string | number | boolean | readonly string[]>>;

export interface AuditEventInput {
  readonly id: string;
  readonly occurredAt: Date;
  readonly actor: Actor;
  /** `<entity>.<verb>`, for example `trip.create`. */
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  /** Field *names* and non-personal enumerations only: never titles, names, emails or other user text. */
  readonly metadata: AuditMetadata;
}

/** Append-only. Written in the same transaction as the change it describes. */
export interface AuditLog {
  record(event: AuditEventInput): Promise<void>;
}

// --- Idempotency ---------------------------------------------------------------------------------------

export type IdempotencyStart =
  | { readonly state: 'new' }
  /** The same key and request were completed before: return `response` instead of doing the work again. */
  | { readonly state: 'replay'; readonly response: unknown }
  /** The key was used for a different request. */
  | { readonly state: 'mismatch' };

export interface IdempotencyStore {
  /** Reserves the key for this owner, or reports what an earlier use of it did. Safe under concurrency. */
  begin(input: {
    readonly ownerId: string;
    readonly key: string;
    readonly fingerprint: string;
    readonly createdAt: Date;
  }): Promise<IdempotencyStart>;
  /** Stores what a retry will get back. Called once, after `begin` returned `new`. */
  complete(ownerId: string, key: string, response: unknown): Promise<void>;
}

// --- Transactions, time and ids ------------------------------------------------------------------------

/** What a mutation may touch. Everything in one `UnitOfWork.run` commits or rolls back together. */
export interface Transaction {
  readonly trips: TripWriter;
  readonly destinations: DestinationWriter;
  readonly preferences: PreferencesWriter;
  readonly audit: AuditLog;
  readonly idempotency: IdempotencyStore;
}

export interface UnitOfWork {
  run<T>(work: (transaction: Transaction) => Promise<T>): Promise<T>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  /** A new UUIDv7. */
  newId(): string;
}

export interface Ports {
  readonly users: UserReader;
  /** Reads outside a transaction (queries). */
  readonly trips: TripReader;
  readonly destinations: DestinationReader;
  readonly preferences: PreferencesReader;
  readonly unitOfWork: UnitOfWork;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}
