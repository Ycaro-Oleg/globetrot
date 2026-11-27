import { isCurrencyCode } from '@globetrot/domain';

/** Where the landing keeps the numbers someone tried in "Can I go?", so onboarding can start from them. */
export const PLAN_DRAFT_COOKIE = 'globetrot.plan_draft';

const AMOUNT = /^\d{1,9}(\.\d{1,2})?$/;

/** What "Can I go?" saved: three plain amounts and the currency picked there (null on older drafts). */
export type PlanDraft = { cost: string; saved: string; monthly: string; currency: string | null };

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
    return cost && saved && monthly ? { cost, saved, monthly, currency } : null;
  } catch {
    return null;
  }
}

/** Keeps what the landing's plan chose for 30 days, so sign-up and onboarding start from it (browser only). */
export function saveDraft(draft: Record<string, unknown>): void {
  document.cookie = `${PLAN_DRAFT_COOKIE}=${encodeURIComponent(JSON.stringify(draft))}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
}
