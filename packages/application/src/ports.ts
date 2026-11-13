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
  /** The city the person usually leaves from, or null. */
  readonly homeCity: string | null;
  readonly pipOptIn: boolean;
  /** The person's Pip: hat, outfit, bag and bag colour (values from the domain's lists). */
  readonly pipLook: { hat: string; outfit: string; bag: string; bagColor: string };
  /** Pip's name as the person chose it, or null for "Pip". */
  readonly pipName: string | null;
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
  readonly homeCity?: string | null | undefined;
  readonly pipOptIn?: boolean | undefined;
  readonly pipLook?: { hat: string; outfit: string; bag: string; bagColor: string } | undefined;
  readonly pipName?: string | null | undefined;
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
  readonly note: string | null;
  readonly legMode: string | null;
  readonly visited: boolean;
  readonly spots: readonly StopSpotRecord[];
  readonly todos: readonly StopTodoRecord[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A place to see at a stop. */
export interface StopSpotRecord {
  readonly name: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly done: boolean;
}
/** A thing to do for a stop. */
export interface StopTodoRecord {
  readonly text: string;
  readonly done: boolean;
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
  readonly note: string | null;
  readonly legMode: string | null;
  readonly visited: boolean;
  readonly spots: readonly StopSpotRecord[];
  readonly todos: readonly StopTodoRecord[];
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

// --- Visas (commemorative passport stamps) -------------------------------------------------------------

export interface VisaRecord {
  readonly userId: string;
  readonly countryCode: string;
  readonly city: string;
  readonly stampedAt: Date;
}

export interface VisaReader {
  /** Newest first. */
  listByUser(userId: string): Promise<VisaRecord[]>;
}

export interface VisaWriter extends VisaReader {
  /** Stamps the countries the person has no visa for yet; returns only the new stamps. */
  stampMissing(
    userId: string,
    entries: readonly { countryCode: string; city: string }[],
    now: Date,
  ): Promise<VisaRecord[]>;
}

// --- Budget (expenses and savings) ---------------------------------------------------------------------

export interface ExpenseRecord {
  readonly id: string;
  readonly tripId: string;
  readonly category: string;
  readonly status: string;
  readonly description: string;
  /** What was typed, in minor units of `currency`. */
  readonly amountMinor: bigint;
  readonly currency: string;
  /** The same cost in the trip's currency (what totals add up). */
  readonly tripAmountMinor: bigint;
  readonly fxRate: string | null;
  readonly fxSource: string | null;
  readonly fxAsOf: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type NewExpense = Omit<ExpenseRecord, 'updatedAt'>;
export type ExpensePatch = Partial<
  Omit<ExpenseRecord, 'id' | 'tripId' | 'createdAt' | 'updatedAt'>
>;

export interface ExpenseReader {
  /** Newest first. */
  listByTrip(tripId: string): Promise<ExpenseRecord[]>;
  findById(id: string): Promise<ExpenseRecord | null>;
}

export interface ExpenseWriter extends ExpenseReader {
  insert(expense: NewExpense): Promise<ExpenseRecord>;
  update(id: string, patch: ExpensePatch, updatedAt: Date): Promise<ExpenseRecord>;
  delete(id: string): Promise<void>;
  countByTrip(tripId: string): Promise<number>;
}

export interface SavingsRecord {
  readonly tripId: string;
  readonly savedMinor: bigint;
  readonly monthlyMinor: bigint;
  /** The most the trip should cost, or `null` without a ceiling. */
  readonly ceilingMinor: bigint | null;
}

export interface SavingsReader {
  /** `null` until the trip's savings were set. */
  find(tripId: string): Promise<SavingsRecord | null>;
}

export interface SavingsWriter extends SavingsReader {
  upsert(
    tripId: string,
    patch: {
      readonly savedMinor?: bigint | undefined;
      readonly monthlyMinor?: bigint | undefined;
      /** `null` clears the ceiling. */
      readonly ceilingMinor?: bigint | null | undefined;
    },
    now: Date,
  ): Promise<SavingsRecord>;
}

// --- Checklists ----------------------------------------------------------------------------------------

export interface ChecklistItemRecord {
  readonly id: string;
  readonly tripId: string;
  readonly group: string;
  readonly label: string;
  readonly done: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type NewChecklistItem = Omit<ChecklistItemRecord, 'updatedAt'>;
export type ChecklistItemPatch = Partial<Pick<ChecklistItemRecord, 'label' | 'done'>>;

export interface ChecklistReader {
  /** In the order the items were added. */
  listByTrip(tripId: string): Promise<ChecklistItemRecord[]>;
  findById(id: string): Promise<ChecklistItemRecord | null>;
}

export interface ChecklistWriter extends ChecklistReader {
  insertMany(items: readonly NewChecklistItem[]): Promise<ChecklistItemRecord[]>;
  update(id: string, patch: ChecklistItemPatch, updatedAt: Date): Promise<ChecklistItemRecord>;
  delete(id: string): Promise<void>;
  countByTrip(tripId: string): Promise<number>;
}

// --- Day plan (places to see, each on a day or not yet) -----------------------------------------------

export interface DayPlaceRecord {
  readonly id: string;
  readonly tripId: string;
  /** The stop it belongs to; a stop that no longer exists reads as none. */
  readonly destinationId: string | null;
  readonly name: string;
  readonly minutes: number;
  /** 1-based trip day, or null for "No day". */
  readonly day: number | null;
  readonly position: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type NewDayPlace = Omit<DayPlaceRecord, 'updatedAt'>;

export interface DayPlaceReader {
  /** In trip order. */
  listByTrip(tripId: string): Promise<DayPlaceRecord[]>;
  findById(id: string): Promise<DayPlaceRecord | null>;
}

export interface DayPlaceWriter extends DayPlaceReader {
  insert(row: NewDayPlace): Promise<DayPlaceRecord>;
  /** Gives each listed place its new day and position. */
  placeMany(
    entries: readonly {
      readonly id: string;
      readonly day: number | null;
      readonly position: number;
    }[],
    updatedAt: Date,
  ): Promise<void>;
  delete(id: string): Promise<void>;
}

// --- Places (geocoding) -------------------------------------------------------------------------------

/** A place a geocoder found. `key` is stable for the same place from the same provider. */
export interface PlaceResult {
  readonly key: string;
  readonly name: string;
  readonly countryCode: string | null;
  readonly region: string | null;
  readonly latitude: number;
  readonly longitude: number;
  /** Who the data is from, to show with it (licence attribution). */
  readonly attribution: string;
}

/**
 * Looks places up by name or by point. Adapters (Geoapify today) keep their keys on the server. `null` means the
 * provider is not configured or did not answer; an empty list means it answered with nothing.
 */
export interface GeocodingPort {
  search(
    query: string,
    options: { readonly language: string; readonly limit: number },
  ): Promise<PlaceResult[] | null>;
  reverse(
    point: { readonly latitude: number; readonly longitude: number },
    options: { readonly language: string },
  ): Promise<PlaceResult | null | undefined>;
}

/** Counts requests per key in a short window. `true` when this one is allowed. */
export interface RateLimiter {
  consume(key: string, limitPerMinute: number): boolean;
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
  readonly expenses: ExpenseWriter;
  readonly checklist: ChecklistWriter;
  readonly dayPlaces: DayPlaceWriter;
  readonly visas: VisaWriter;
  readonly savings: SavingsWriter;
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
  readonly expenses: ExpenseReader;
  readonly checklist: ChecklistReader;
  readonly dayPlaces: DayPlaceReader;
  readonly visas: VisaReader;
  readonly savings: SavingsReader;
  readonly preferences: PreferencesReader;
  readonly unitOfWork: UnitOfWork;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly geocoding: GeocodingPort;
  readonly rateLimiter: RateLimiter;
}
