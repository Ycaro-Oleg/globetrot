import type { CurrencyCode, Money } from '../money';
import type { LocalDate } from '../time';

/**
 * The trip shape the derivation rules read. It is a domain view, not a database schema:
 * adapters map persisted rows into it. Rules: docs/product/business-rules.md.
 */
export interface TripPlan {
  /** Budgeting currency. Every `TripExpense.amount` and the savings values must be in it. */
  readonly currency: CurrencyCode;
  /** Departure (first day). `null` while the user hasn't picked dates. */
  readonly startDate: LocalDate | null;
  /** Route order. */
  readonly stops: readonly TripStop[];
  readonly expenses: readonly TripExpense[];
  readonly checklist: readonly ChecklistItem[];
  readonly savings: SavingsInput;
}

export type StopState = 'planned' | 'draft';

export interface TripStop {
  readonly id: string;
  /** Nights spent here; 0 for a day trip. Must be a non-negative integer. */
  readonly nights: number;
  /** `draft` = proposed by Pip and not yet applied; drafts don't count towards days or milestones. */
  readonly state: StopState;
  readonly places: readonly PlannedPlace[];
}

export interface PlannedPlace {
  readonly id: string;
  /** 1-based trip day index, or `null` when not scheduled yet. */
  readonly day: number | null;
  readonly done: boolean;
}

export const EXPENSE_CATEGORIES = [
  'flights',
  'stay',
  'local_transport',
  'intercity_transport',
  'food',
  'experiences',
  'insurance',
  'documents',
  'taxes',
  'shopping',
  'buffer',
  'other',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_STATUSES = ['estimate', 'confirmed', 'paid', 'unknown'] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export interface TripExpense {
  readonly id: string;
  readonly category: ExpenseCategory;
  /** The stop it belongs to, or `null` for the whole trip. */
  readonly stopId: string | null;
  readonly status: ExpenseStatus;
  /** Amount in the trip currency (already converted; the original lives on the persisted expense). */
  readonly amount: Money;
}

export const CHECKLIST_GROUPS = ['documents', 'money', 'bookings', 'packing'] as const;
export type ChecklistGroup = (typeof CHECKLIST_GROUPS)[number];

export interface ChecklistItem {
  readonly id: string;
  readonly group: ChecklistGroup;
  readonly done: boolean;
}

export interface SavingsInput {
  /** Already set aside for this trip. */
  readonly saved: Money;
  /** Planned monthly contribution; zero means "not saving monthly". */
  readonly monthly: Money;
}

/** Thrown when a trip violates a structural invariant (e.g. negative nights). */
export class InvalidTripError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTripError';
  }
}
