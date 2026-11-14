/**
 * @globetrot/application: commands and queries with authorization, idempotency and audit; ports for adapters
 * (ADR-0006). No HTTP, database or UI imports: adapters pass their implementations in through `Ports`.
 */
import { createGetPreferences, createUpdatePreferences } from './preferences/operations';
import {
  createGetBilling,
  createOpenBillingPortal,
  createStartCheckout,
  guardReadOnly,
} from './billing/operations';
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
export { billingSchema } from './billing/operations';
export { canonicalJson } from './canonical-json';
export {
  ApplicationError,
  ForbiddenError,
  IdempotencyKeyReusedError,
  NotFoundError,
  PlanLimitError,
  RateLimitedError,
  UnauthenticatedError,
  UnavailableError,
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
import {
  createAddDayPlace,
  createListDayPlaces,
  createMoveDayPlace,
  createRemoveDayPlace,
} from './days/operations';
import { createCreateTripFromExample } from './examples/operations';
import { createReversePlace, createSearchPlaces } from './places/operations';
import {
  createListDestinations,
  createListVisas,
  createReplaceDestinations,
} from './destinations/operations';
import {
  createAddComment,
  createCopyRoute,
  createCreatePost,
  createDeleteComment,
  createDeletePost,
  createGetCommunityMe,
  createGetDiscover,
  createGetPerson,
  createGetPost,
  createListComments,
  createListFeed,
  createListPersonPosts,
  createReportPost,
  createSetCommentLike,
  createSetPostReaction,
  createSetRelation,
  createUpdateHandle,
  createUpdatePost,
} from './community/operations';
import { createGetMedia, createUploadMedia } from './media/operations';
import { createDeleteAccount, createDeleteTrip, createExportAccount } from './account/operations';
import {
  createApplyProposal,
  createAskPip,
  createDiscardProposal,
  createListProposals,
  createUndoProposal,
} from './assistant/operations';
export { defineOperation, type Operation } from './operation';
export type {
  GeocodingPort,
  PlaceResult,
  RateLimiter,
  ChecklistItemPatch,
  CommentRecord,
  CommentWithStats,
  CommunityProfileRecord,
  CommunityReader,
  CommunityWriter,
  AccountReader,
  AccountWriter,
  AiPort,
  BillingAccount,
  BillingReader,
  BillingWriter,
  CheckoutItem,
  PaymentsPort,
  SubscriptionRecord,
  AssistantReader,
  AssistantWriter,
  ProposalRecord,
  FeedScope,
  MediaReader,
  MediaRecord,
  MediaWriter,
  PhotoRecord,
  StoragePort,
  NewPost,
  PersonRecord,
  PostAttachmentRecord,
  PostPatch,
  PostRecord,
  PostStatsRecord,
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
  StopSpotRecord,
  StopTodoRecord,
  VisaReader,
  VisaRecord,
  VisaWriter,
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
  PLACE_LOOKUPS_PER_MINUTE,
  placeSchema,
  reversePlaceInput,
  searchPlacesInput,
} from './places/operations';

export {
  EXAMPLE_TRIP_IDS,
  EXAMPLE_TRIPS,
  findExampleTrip,
  type ExampleStop,
  type ExampleTrip,
  type ExampleTripId,
} from './examples/catalog';
export { createTripFromExampleFields } from './examples/operations';

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
  addDayPlaceFields,
  DAY_PLACES_MAX,
  dayPlaceSchema,
  dayPlanSchema,
  moveDayPlaceFields,
  type DayPlaceView,
  type DayPlanView,
} from './days/schemas';

export {
  destinationFields,
  destinationListSchema,
  destinationSchema,
  replaceDestinationsBody,
  replaceDestinationsResult,
  stopSpotSchema,
  stopTodoSchema,
  visaListSchema,
  visaSchema,
  type DestinationView,
  type VisaView,
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

export {
  attachmentSchema,
  commentFields,
  commentListSchema,
  communityMeSchema,
  createPostFields,
  discoverSchema,
  feedQuery,
  feedSchema,
  handleSchema,
  personPageSchema,
  personSchema,
  postSchema,
  reportFields,
  toggleFields,
  updateHandleFields,
  updatePostFields,
  type CommentView,
  type CommunityMeView,
  type DiscoverView,
  type FeedView,
  type PersonPageView,
  type PersonView,
  type PostView,
} from './community/schemas';

export {
  mediaSchema,
  photoFields,
  photoSchema,
  type MediaView,
  type PhotoView,
} from './media/schemas';
export { mediaKey } from './media/operations';
export {
  createMaintenance,
  IDEMPOTENCY_KEEP_DAYS,
  STRAY_OBJECT_HOURS,
  UNPLACED_MEDIA_HOURS,
  type MaintenanceReport,
  type MaintenanceStore,
} from './maintenance/maintenance';
export {
  applyProposalFields,
  askPipFields,
  pipChangeSchema,
  proposalListSchema,
  proposalSchema,
  type PipChange,
  type ProposalView,
} from './assistant/schemas';
export { systemPrompt, userPrompt, type PipContext } from './assistant/prompt';
export {
  ACCOUNT_EXPORT_VERSION,
  accountExportSchema,
  deleteAccountFields,
} from './account/operations';

/** Composition root: every operation, wired to the given ports. */
export function createApplication(ports: Ports) {
  const operations = {
    getCurrentUser: createGetCurrentUser({ users: ports.users }),
    listTrips: createListTrips(ports),
    getTrip: createGetTrip(ports),
    createTrip: createCreateTrip(ports),
    updateTrip: createUpdateTrip(ports),
    archiveTrip: createArchiveTrip(ports),
    listDestinations: createListDestinations(ports),
    createTripFromExample: createCreateTripFromExample(ports),
    searchPlaces: createSearchPlaces(ports),
    reversePlace: createReversePlace(ports),
    getChecklist: createGetChecklist(ports),
    addChecklistItems: createAddChecklistItems(ports),
    updateChecklistItem: createUpdateChecklistItem(ports),
    deleteChecklistItem: createDeleteChecklistItem(ports),
    listDayPlaces: createListDayPlaces(ports),
    addDayPlace: createAddDayPlace(ports),
    moveDayPlace: createMoveDayPlace(ports),
    removeDayPlace: createRemoveDayPlace(ports),
    getBudget: createGetBudget(ports),
    listExpenses: createListExpenses(ports),
    createExpense: createCreateExpense(ports),
    updateExpense: createUpdateExpense(ports),
    deleteExpense: createDeleteExpense(ports),
    updateSavings: createUpdateSavings(ports),
    replaceDestinations: createReplaceDestinations(ports),
    listVisas: createListVisas(ports),
    getPreferences: createGetPreferences(ports),
    updatePreferences: createUpdatePreferences(ports),
    listFeed: createListFeed(ports),
    getPost: createGetPost(ports),
    listComments: createListComments(ports),
    getPerson: createGetPerson(ports),
    listPersonPosts: createListPersonPosts(ports),
    getCommunityMe: createGetCommunityMe(ports),
    getDiscover: createGetDiscover(ports),
    createPost: createCreatePost(ports),
    updatePost: createUpdatePost(ports),
    deletePost: createDeletePost(ports),
    setPostLike: createSetPostReaction(ports, 'like'),
    setPostSave: createSetPostReaction(ports, 'save'),
    addComment: createAddComment(ports),
    deleteComment: createDeleteComment(ports),
    setCommentLike: createSetCommentLike(ports),
    setFollow: createSetRelation(ports, 'follow'),
    setMute: createSetRelation(ports, 'mute'),
    reportPost: createReportPost(ports),
    copyRoute: createCopyRoute(ports),
    updateHandle: createUpdateHandle(ports),
    uploadMedia: createUploadMedia(ports),
    getMedia: createGetMedia(ports),
    exportAccount: createExportAccount(ports),
    deleteAccount: createDeleteAccount(ports),
    deleteTrip: createDeleteTrip(ports),
    askPip: createAskPip(ports),
    listProposals: createListProposals(ports),
    applyProposal: createApplyProposal(ports),
    discardProposal: createDiscardProposal(ports),
    undoProposal: createUndoProposal(ports),
    getBilling: createGetBilling(ports),
    startCheckout: createStartCheckout(ports),
    openBillingPortal: createOpenBillingPortal(ports),
  };
  // After the trial, without a plan, the account is read-only: every command but a few passes this guard.
  return Object.fromEntries(
    Object.entries(operations).map(([name, operation]) => [name, guardReadOnly(operation, ports)]),
  ) as typeof operations;
}
export type Application = ReturnType<typeof createApplication>;
