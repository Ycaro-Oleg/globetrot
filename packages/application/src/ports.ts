import type {
  PostAudience,
  PostKind,
  ReportReason,
  MotionChoice,
  ThemeChoice,
  SubscriptionState,
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
  readonly photos: readonly PhotoRecord[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A photo placed on a stop or a post: an uploaded image and the words that describe it. */
export interface PhotoRecord {
  readonly mediaId: string;
  readonly alt: string;
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
  readonly photos: readonly PhotoRecord[];
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

// --- Community -----------------------------------------------------------------------------------------

/** What a route, visa or goal post shows: copied when it was published, never a live link to a trip. */
export type PostAttachmentRecord =
  | {
      readonly kind: 'route';
      readonly title: string;
      readonly nights: number;
      readonly stops: readonly {
        readonly placeKey: string;
        readonly name: string;
        readonly countryCode: string | null;
        readonly region: string | null;
        readonly latitude: number;
        readonly longitude: number;
        readonly nights: number;
      }[];
      /** The planned total (major units, exact), only when the author chose to show it. */
      readonly total: { readonly amount: string; readonly currency: string } | null;
    }
  | {
      readonly kind: 'visa';
      readonly countryCode: string;
      readonly city: string;
      readonly stampedAt: string;
      readonly ordinal: number;
    }
  | {
      readonly kind: 'goal';
      readonly tripTitle: string;
      readonly readyMonth: string;
      readonly reached: boolean;
    };

export interface CommunityProfileRecord {
  readonly userId: string;
  readonly handle: string;
}

/** A person as the community shows them. */
export interface PersonRecord {
  readonly userId: string;
  readonly handle: string;
  readonly name: string;
  readonly pipLook: { hat: string; outfit: string; bag: string; bagColor: string } | null;
}

export interface PostRecord {
  readonly id: string;
  readonly authorId: string;
  readonly kind: PostKind;
  readonly body: string;
  readonly placeName: string | null;
  readonly placeCountry: string | null;
  readonly audience: PostAudience;
  readonly attachment: PostAttachmentRecord | null;
  readonly photos: readonly PhotoRecord[];
  readonly createdAt: Date;
  readonly editedAt: Date | null;
  readonly deletedAt: Date | null;
  readonly hiddenAt: Date | null;
}

export type NewPost = Omit<PostRecord, 'editedAt' | 'deletedAt' | 'hiddenAt'>;

export interface PostPatch {
  readonly body?: string;
  readonly editedAt?: Date;
  readonly deletedAt?: Date | null;
  readonly hiddenAt?: Date | null;
}

/** What one viewer sees about a post besides its content. */
export interface PostStatsRecord {
  readonly likes: number;
  readonly liked: boolean;
  readonly saved: boolean;
  readonly comments: number;
  /** Someone the viewer follows who liked it, or null. */
  readonly likedBy: string | null;
}

export interface CommentRecord {
  readonly id: string;
  readonly postId: string;
  readonly authorId: string;
  readonly body: string;
  readonly createdAt: Date;
  readonly deletedAt: Date | null;
}

export interface CommentWithStats extends CommentRecord {
  readonly likes: number;
  readonly liked: boolean;
}

/** Which feed: everything the viewer may see, only people they follow (and themselves), or one author. */
export type FeedScope =
  | { readonly kind: 'all' }
  | { readonly kind: 'following' }
  | { readonly kind: 'author'; readonly authorId: string };

export interface CommunityReader {
  findProfile(userId: string): Promise<CommunityProfileRecord | null>;
  findProfileByHandle(handle: string): Promise<CommunityProfileRecord | null>;
  /** Name, handle and Pip of each listed person who has a community profile. */
  people(userIds: readonly string[]): Promise<PersonRecord[]>;
  /**
   * Newest first, at most `limit`, older than `before` (a post id: ids are time-ordered) when given. Applies the
   * visibility rule (`canSeePost`) for `viewerId`.
   */
  feed(input: {
    readonly viewerId: string;
    readonly scope: FeedScope;
    readonly before?: string | undefined;
    readonly limit: number;
  }): Promise<PostRecord[]>;
  findPost(id: string): Promise<PostRecord | null>;
  /** Live posts that show this image. */
  postsWithMedia(mediaId: string): Promise<PostRecord[]>;
  /** How `viewerId` relates to each listed person. */
  relations(
    viewerId: string,
    userIds: readonly string[],
  ): Promise<{ following: Set<string>; muted: Set<string> }>;
  hasReported(viewerId: string, postId: string): Promise<boolean>;
  stats(viewerId: string, postIds: readonly string[]): Promise<Map<string, PostStatsRecord>>;
  /** A post's comments in order, without deleted ones or those by people the viewer muted. */
  comments(viewerId: string, postId: string): Promise<CommentWithStats[]>;
  findComment(id: string): Promise<CommentRecord | null>;
  /** People with recent public posts whom the viewer neither follows nor muted, most active first. */
  suggestions(
    viewerId: string,
    since: Date,
    limit: number,
  ): Promise<{ userId: string; posts: number }[]>;
  /** Countries most tagged on recent public posts. */
  trending(since: Date, limit: number): Promise<{ countryCode: string; posts: number }[]>;
  personStats(userId: string): Promise<{ posts: number; followers: number; following: number }>;
  countPostsSince(authorId: string, since: Date): Promise<number>;
  countCommentsSince(authorId: string, since: Date): Promise<number>;
}

export interface CommunityWriter extends CommunityReader {
  /** `false` when the handle is taken. */
  createProfile(userId: string, handle: string, now: Date): Promise<boolean>;
  /** `false` when the handle is taken. */
  updateHandle(userId: string, handle: string): Promise<boolean>;
  insertPost(post: NewPost): Promise<void>;
  updatePost(id: string, patch: PostPatch): Promise<void>;
  setLike(postId: string, userId: string, on: boolean, now: Date): Promise<void>;
  setSave(postId: string, userId: string, on: boolean, now: Date): Promise<void>;
  setCommentLike(commentId: string, userId: string, on: boolean, now: Date): Promise<void>;
  insertComment(comment: Omit<CommentRecord, 'deletedAt'>): Promise<void>;
  setCommentDeleted(id: string, deletedAt: Date | null): Promise<void>;
  setFollow(followerId: string, followeeId: string, on: boolean, now: Date): Promise<void>;
  setMute(userId: string, mutedId: string, on: boolean, now: Date): Promise<void>;
  /** Records the report once per person; answers how many people reported the post. */
  report(postId: string, reporterId: string, reason: ReportReason, now: Date): Promise<number>;
}

// --- Media (uploaded images) ---------------------------------------------------------------------------

export interface MediaRecord {
  readonly id: string;
  readonly ownerId: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly width: number;
  readonly height: number;
  readonly createdAt: Date;
}

export interface MediaReader {
  findById(id: string): Promise<MediaRecord | null>;
  findMany(ids: readonly string[]): Promise<MediaRecord[]>;
}

export interface MediaWriter extends MediaReader {
  insert(record: MediaRecord): Promise<void>;
  countSince(ownerId: string, since: Date): Promise<number>;
}

/** Object storage for the bytes (S3-compatible). Keys are chosen by the application, never by a client. */
export interface StoragePort {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** `null` when there is no such object. */
  get(key: string): Promise<Uint8Array | null>;
  /** Removes the object; a missing one is not an error. */
  delete(key: string): Promise<void>;
  /** Keys under a prefix, a page at a time (`next` continues; null at the end). */
  list(prefix: string, after?: string): Promise<{ keys: string[]; next: string | null }>;
}

// --- Account (export and deletion) --------------------------------------------------------------------

export interface AccountReader {
  /** Everything the account holds, as plain JSON (never password hashes or tokens); null without the user. */
  exportFor(userId: string): Promise<Record<string, unknown> | null>;
}

export interface AccountWriter extends AccountReader {
  /** Ids of the account's uploads, read before deleting it. */
  mediaIdsOf(userId: string): Promise<string[]>;
  /** Deletes the user and everything they own. The audit log keeps its rows (no personal data in them). */
  deleteAccount(userId: string): Promise<void>;
  /** Deletes an archived trip of `ownerId` and everything in it; `false` when there is no such trip. */
  deleteArchivedTrip(tripId: string, ownerId: string): Promise<boolean>;
}

// --- Pip (AI proposals) --------------------------------------------------------------------------------

export interface ProposalRecord {
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

export interface AssistantReader {
  findProposal(id: string): Promise<ProposalRecord | null>;
  /** Newest first. */
  listProposals(tripId: string, limit: number): Promise<ProposalRecord[]>;
  /** How many times the person asked an AI in a window (each costs tokens, answered or not). */
  countRequestsSince(userId: string, since: Date): Promise<number>;
}

export interface AssistantWriter extends AssistantReader {
  insertProposal(
    record: Omit<ProposalRecord, 'applied' | 'undo' | 'decidedAt' | 'status'>,
  ): Promise<void>;
  updateProposal(
    id: string,
    patch: {
      readonly status: string;
      readonly decidedAt: Date;
      readonly applied?: number[];
      readonly undo?: unknown;
    },
  ): Promise<void>;
  recordUsage(row: {
    readonly id: string;
    readonly userId: string;
    readonly provider: string;
    readonly model: string;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly createdAt: Date;
  }): Promise<void>;
}

/**
 * A language model that answers one JSON object for a system and a user message. Adapters (DeepSeek today) keep
 * their keys on the server. `null` means the provider is not configured or did not answer.
 */
export interface AiPort {
  completeJson(input: {
    readonly system: string;
    readonly user: string;
    readonly maxTokens: number;
  }): Promise<{
    readonly content: string;
    readonly provider: string;
    readonly model: string;
    readonly inputTokens: number;
    readonly outputTokens: number;
  } | null>;
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

// --- Sharing a trip -------------------------------------------------------------------------------------

export interface TripShareRecord {
  readonly slug: string;
  readonly tripId: string;
  readonly ownerId: string;
  readonly showAmounts: boolean;
  readonly createdAt: Date;
}

export interface ShareReader {
  findByTrip(tripId: string): Promise<TripShareRecord | null>;
  findBySlug(slug: string): Promise<TripShareRecord | null>;
}

export interface ShareWriter extends ShareReader {
  insert(record: TripShareRecord): Promise<void>;
  setShowAmounts(tripId: string, showAmounts: boolean): Promise<void>;
  deleteByTrip(tripId: string): Promise<void>;
}

// --- Billing (ADR-0019) --------------------------------------------------------------------------------

export interface BillingAccount {
  /** When the account was created: the trial runs from here. */
  readonly signedUpAt: Date;
  readonly subscription: SubscriptionState | null;
  /** Bought credits left (the ledger's sum). */
  readonly topUpBalance: number;
}

export interface SubscriptionRecord extends SubscriptionState {
  readonly providerCustomerId: string | null;
  readonly providerSubscriptionId: string | null;
}

export interface BillingReader {
  findAccount(userId: string): Promise<BillingAccount | null>;
  /** The account a provider subscription belongs to, for webhooks. */
  findUserByProviderSubscription(providerSubscriptionId: string): Promise<string | null>;
  /** The provider's customer id for the account, once it has paid for anything. */
  findProviderCustomer(userId: string): Promise<string | null>;
}

export interface BillingWriter extends BillingReader {
  /** Adds a ledger line; false (and nothing added) when `ref` was already used. */
  addCredits(row: {
    readonly id: string;
    readonly userId: string;
    readonly delta: number;
    readonly reason: 'top-up' | 'pip' | 'grant';
    readonly ref: string | null;
    readonly createdAt: Date;
  }): Promise<boolean>;
  saveSubscription(userId: string, record: SubscriptionRecord, updatedAt: Date): Promise<void>;
}

export type CheckoutItem = 'explorer' | 'voyager' | 'top-up';

/** The payment provider (Stripe, ADR-0019). `null` from a method means payments are not configured. */
export interface PaymentsPort {
  /** A hosted checkout page for a plan or a credit top-up; the caller sends the person there. */
  checkoutUrl(input: {
    readonly userId: string;
    readonly email: string;
    readonly item: CheckoutItem;
    readonly interval: 'month' | 'year';
  }): Promise<string | null>;
  /** The provider's page to change the card, switch or cancel the plan. */
  portalUrl(input: { readonly providerCustomerId: string }): Promise<string | null>;
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
  readonly community: CommunityWriter;
  readonly media: MediaWriter;
  readonly account: AccountWriter;
  readonly assistant: AssistantWriter;
  readonly billing: BillingWriter;
  readonly shares: ShareWriter;
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
  /** 128 random bits as 22 base64url characters: for secrets in links (a shared trip). */
  newToken(): string;
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
  readonly community: CommunityReader;
  readonly media: MediaReader;
  readonly storage: StoragePort;
  readonly account: AccountReader;
  readonly assistant: AssistantReader;
  readonly billing: BillingReader;
  readonly payments: PaymentsPort;
  readonly shares: ShareReader;
  readonly ai: AiPort;
  readonly unitOfWork: UnitOfWork;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly geocoding: GeocodingPort;
  readonly rateLimiter: RateLimiter;
}
