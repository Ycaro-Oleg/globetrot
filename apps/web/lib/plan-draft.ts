import {
  convert,
  DEFAULT_CURRENCY,
  fromDecimal,
  isCurrencyCode,
  SUGGEST_COMFORTS,
  SUGGEST_LIKES,
  SUGGEST_MAX_DAYS,
  SUGGEST_MIN_DAYS,
  SUGGESTED_DESTINATIONS,
  suggestPlan,
  suggestReferenceRate,
  type Money,
  type SuggestComfort,
  type SuggestLike,
} from '@globetrot/domain';

/** Where the landing keeps the numbers someone tried in "Can I go?", so onboarding can start from them. */
export const PLAN_DRAFT_COOKIE = 'globetrot.plan_draft';

const AMOUNT = /^\d{1,9}(\.\d{1,2})?$/;

/** The plan built on the landing, enough to rebuild it with `suggestPlan` (ADR-0020). */
export type DraftSuggestion = {
  destination: string;
  likes: SuggestLike[];
  days: number;
  comfort: SuggestComfort;
};

/**
 * What the landing saved: three plain amounts, the currency picked there (null on older drafts) and the plan built,
 * when there was one (null on older drafts or anything that does not check out).
 */
export type PlanDraft = {
  cost: string;
  saved: string;
  monthly: string;
  currency: string | null;
  suggestion: DraftSuggestion | null;
};

function readSuggestion(value: unknown): DraftSuggestion | null {
  if (!value || typeof value !== 'object') return null;
  const { destination, likes, days, comfort } = value as Record<string, unknown>;
  if (!SUGGESTED_DESTINATIONS.some((place) => place.id === destination)) return null;
  if (!Array.isArray(likes) || !likes.every((like) => SUGGEST_LIKES.includes(like as SuggestLike)))
    return null;
  if (typeof days !== 'number' || !Number.isInteger(days)) return null;
  if (days < SUGGEST_MIN_DAYS || days > SUGGEST_MAX_DAYS) return null;
  if (!SUGGEST_COMFORTS.includes(comfort as SuggestComfort)) return null;
  return {
    destination: destination as string,
    likes: [...new Set(likes as SuggestLike[])],
    days,
    comfort: comfort as SuggestComfort,
  };
}

/** The landing's saved numbers, or null when missing or not plain amounts. */
export function readDraft(raw: string | undefined): PlanDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    const pick = (key: string) =>
      typeof value[key] === 'string' && AMOUNT.test(value[key]) ? value[key] : null;
    const cost = pick('cost');
    const saved = pick('saved');
    const monthly = pick('monthly');
    const currency = isCurrencyCode(value.currency) ? value.currency : null;
    const suggestion = readSuggestion(value.suggestion);
    return cost && saved && monthly ? { cost, saved, monthly, currency, suggestion } : null;
  } catch {
    return null;
  }
}

/**
 * The trip's estimated cost for a saved plan, the amount `/app/start` stores as the trip's estimate: the plan's
 * typical cost (the middle of its range) read in the plan's currency at the recorded reference rate, by the same
 * domain functions. Older drafts without the plan fall back to the amount the landing saved. Always an estimate.
 */
export function draftEstimate(draft: PlanDraft): Money {
  const currency = draft.currency ?? DEFAULT_CURRENCY;
  const plan = draft.suggestion ? suggestPlan(draft.suggestion) : null;
  if (!plan) return fromDecimal(draft.cost, currency, { rounding: 'half-even' });
  const rate = suggestReferenceRate(currency);
  return rate ? convert(plan.estimate.middle, rate).converted : plan.estimate.middle;
}

/** Keeps what the landing's plan chose for 30 days, so sign-up and onboarding start from it (browser only). */
export function saveDraft(draft: Record<string, unknown>): void {
  document.cookie = `${PLAN_DRAFT_COOKIE}=${encodeURIComponent(JSON.stringify(draft))}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
}
