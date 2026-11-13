/**
 * Pip, the optional AI companion (business rules, "AI (Pip)"): it only proposes a change list that the person
 * previews, partly applies and can undo. These are the kinds of change Pip may propose and the limits on asking.
 */

export const PIP_CHANGE_KINDS = [
  'addStop',
  'removeStop',
  'setNights',
  'reorder',
  'addPlace',
  'addChecklistItem',
  'addExpense',
  'setMonthly',
] as const;
export type PipChangeKind = (typeof PIP_CHANGE_KINDS)[number];

export const PROPOSAL_STATUSES = ['proposed', 'applied', 'discarded', 'undone'] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

/** Longest request a person may type. */
export const PIP_REQUEST_MAX = 500;
/** Most changes one proposal may carry. */
export const PIP_CHANGES_MAX = 12;
/** Requests one person may make in a rolling day (until plans set their own). */
export const PIP_REQUESTS_PER_DAY = 20;
/** How long after applying a proposal it can be undone. */
export const PIP_UNDO_HOURS = 24;

export interface ProposalState {
  readonly status: ProposalStatus;
  readonly decidedAt: Date | null;
}

/** A proposal moves only forward: proposed → applied → undone, or proposed → discarded. */
export function canDecide(
  proposal: ProposalState,
  action: 'apply' | 'discard' | 'undo',
  now: Date,
): boolean {
  if (action === 'apply' || action === 'discard') return proposal.status === 'proposed';
  if (proposal.status !== 'applied' || !proposal.decidedAt) return false;
  return now.getTime() - proposal.decidedAt.getTime() <= PIP_UNDO_HOURS * 60 * 60 * 1000;
}
