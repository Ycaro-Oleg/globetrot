/**
 * Money between the people planning a trip together (ADR-0025, docs/product/business-rules.md#planning-together): each person's share of the cost, how much each has
 * set aside towards it, and who pays whom to settle up. Pure functions over minor units in the trip's currency.
 */

/** Basis points: 10 000 is the whole trip. */
export const WHOLE_SHARE_BP = 10_000;

export interface ShareMember {
  readonly userId: string;
  /** This person's part in basis points; when no one has one, the trip is split equally. */
  readonly shareBp?: number | null;
}

/**
 * Splits `totalMinor` between the members: equally when no one set a part, otherwise by basis points (which must
 * add up to 10 000). The few minor units a division leaves over go to the first members, so the parts always add
 * up to the total exactly.
 */
export function memberShares(
  totalMinor: bigint,
  members: readonly ShareMember[],
): Map<string, bigint> {
  const shares = new Map<string, bigint>();
  if (members.length === 0) return shares;
  const custom = members.some((member) => member.shareBp !== undefined && member.shareBp !== null);
  const weights = members.map((member) => BigInt(custom ? (member.shareBp ?? 0) : 1));
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0n);
  if (weightSum === 0n) {
    members.forEach((member) => shares.set(member.userId, 0n));
    return shares;
  }
  let given = 0n;
  members.forEach((member, index) => {
    const part = (totalMinor * weights[index]!) / weightSum;
    shares.set(member.userId, part);
    given += part;
  });
  // Hand out what integer division left, one unit each, to members with a weight.
  let left = totalMinor - given;
  for (let index = 0; left > 0n; index = (index + 1) % members.length) {
    if (weights[index]! === 0n) continue;
    const id = members[index]!.userId;
    shares.set(id, shares.get(id)! + 1n);
    left -= 1n;
  }
  return shares;
}

/** Whether custom parts are valid: whole basis points, none negative, adding up to the whole trip. */
export function validShares(parts: readonly number[]): boolean {
  return (
    parts.every((part) => Number.isInteger(part) && part >= 0) &&
    parts.reduce((sum, part) => sum + part, 0) === WHOLE_SHARE_BP
  );
}

export interface PaidExpense {
  /** Who paid it; null when nobody said (it is left out of the settling). */
  readonly paidBy: string | null;
  readonly amountMinor: bigint;
}

export interface Transfer {
  readonly from: string;
  readonly to: string;
  readonly amountMinor: bigint;
}

export interface Settlement {
  /** What each person paid, their share of what was paid, and the difference (positive: they are owed). */
  readonly balances: readonly {
    readonly userId: string;
    readonly paidMinor: bigint;
    readonly shareMinor: bigint;
    readonly balanceMinor: bigint;
  }[];
  /** As few payments as this greedy pairing finds (at most one fewer than the people). */
  readonly transfers: readonly Transfer[];
  /** Paid costs nobody is named on: not part of the settling. */
  readonly unassignedMinor: bigint;
}

/**
 * Who pays whom so that everyone has paid their share of the costs already paid. Costs nobody is named on, and
 * costs paid by someone no longer on the trip, stay out. The largest debt is paired with the largest credit
 * until everyone is even.
 */
export function settleUp(
  expenses: readonly PaidExpense[],
  members: readonly ShareMember[],
): Settlement {
  const ids = new Set(members.map((member) => member.userId));
  const paid = new Map<string, bigint>(members.map((member) => [member.userId, 0n]));
  let unassignedMinor = 0n;
  for (const expense of expenses) {
    if (expense.paidBy && ids.has(expense.paidBy)) {
      paid.set(expense.paidBy, paid.get(expense.paidBy)! + expense.amountMinor);
    } else {
      unassignedMinor += expense.amountMinor;
    }
  }
  const total = [...paid.values()].reduce((sum, value) => sum + value, 0n);
  const shares = memberShares(total, members);
  const balances = members.map((member) => {
    const paidMinor = paid.get(member.userId)!;
    const shareMinor = shares.get(member.userId)!;
    return { userId: member.userId, paidMinor, shareMinor, balanceMinor: paidMinor - shareMinor };
  });

  const creditors = balances
    .filter((b) => b.balanceMinor > 0n)
    .map((b) => ({ id: b.userId, left: b.balanceMinor }));
  const debtors = balances
    .filter((b) => b.balanceMinor < 0n)
    .map((b) => ({ id: b.userId, left: -b.balanceMinor }));
  const byLeft = (a: { left: bigint }, b: { left: bigint }) =>
    a.left === b.left ? 0 : a.left > b.left ? -1 : 1;
  const transfers: Transfer[] = [];
  while (creditors.length && debtors.length) {
    creditors.sort(byLeft);
    debtors.sort(byLeft);
    const creditor = creditors[0]!;
    const debtor = debtors[0]!;
    const amountMinor = creditor.left < debtor.left ? creditor.left : debtor.left;
    transfers.push({ from: debtor.id, to: creditor.id, amountMinor });
    creditor.left -= amountMinor;
    debtor.left -= amountMinor;
    if (creditor.left === 0n) creditors.shift();
    if (debtor.left === 0n) debtors.shift();
  }
  return { balances, transfers, unassignedMinor };
}

export interface MemberSavings {
  readonly userId: string;
  readonly savedMinor: bigint;
  readonly monthlyMinor: bigint;
}

/**
 * Each person's progress towards their own share of the trip's total, and the group's towards the whole. A
 * person with nothing to pay is counted as ready.
 */
export function groupSavings(
  totalMinor: bigint,
  members: readonly ShareMember[],
  savings: readonly MemberSavings[],
) {
  const shares = memberShares(totalMinor, members);
  const byUser = new Map(savings.map((entry) => [entry.userId, entry]));
  const people = members.map((member) => {
    const shareMinor = shares.get(member.userId)!;
    const entry = byUser.get(member.userId);
    const savedMinor = entry?.savedMinor ?? 0n;
    const leftMinor = shareMinor > savedMinor ? shareMinor - savedMinor : 0n;
    return {
      userId: member.userId,
      shareMinor,
      savedMinor,
      monthlyMinor: entry?.monthlyMinor ?? 0n,
      leftMinor,
      ready: leftMinor === 0n,
    };
  });
  const savedMinor = people.reduce((sum, person) => sum + person.savedMinor, 0n);
  return {
    people,
    savedMinor,
    leftMinor: totalMinor > savedMinor ? totalMinor - savedMinor : 0n,
  };
}
