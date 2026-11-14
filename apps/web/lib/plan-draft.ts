/** Where the landing keeps the numbers someone tried in "Can I go?", so onboarding can start from them. */
export const PLAN_DRAFT_COOKIE = 'globetrot.plan_draft';

const AMOUNT = /^\d{1,9}(\.\d{1,2})?$/;

/** The landing's saved numbers, or null when missing or not plain amounts. */
export function readDraft(
  raw: string | undefined,
): { cost: string; saved: string; monthly: string } | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    const pick = (key: string) =>
      typeof value[key] === 'string' && AMOUNT.test(value[key]) ? value[key] : null;
    const cost = pick('cost');
    const saved = pick('saved');
    const monthly = pick('monthly');
    return cost && saved && monthly ? { cost, saved, monthly } : null;
  } catch {
    return null;
  }
}
