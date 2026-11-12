/** What the budget answers to "can I afford this, and when?", before it is turned into words. */
export type Answer =
  | { readonly kind: 'noCosts' }
  | { readonly kind: 'fullySaved' }
  /** Not saving monthly yet, so there is no date; `needed` is what would be ready by departure, when known. */
  | {
      readonly kind: 'setMonthly';
      readonly needed: string | null;
      readonly departure: string | null;
    }
  /** At the monthly amount the goal is reached in `month`, before leaving (or with no date to leave on). */
  | { readonly kind: 'yes'; readonly month: string }
  /** At the monthly amount the goal is reached in `month`, after leaving on `departure`. */
  | { readonly kind: 'almost'; readonly month: string; readonly departure: string };

export interface SavingsAnswerInput {
  readonly status: 'no-costs' | 'fully-saved' | 'saving';
  readonly monthly: { readonly amount: string };
  readonly readyMonth: string | null;
  readonly departure: string | null;
  readonly onTime: boolean | null;
  readonly monthlyNeeded: { readonly amount: string } | null;
}

/** Business rules, "Savings plan": the sentence comes from the plan, never from a guess in the screen. */
export function answerOf(savings: SavingsAnswerInput): Answer {
  if (savings.status === 'no-costs') return { kind: 'noCosts' };
  if (savings.status === 'fully-saved') return { kind: 'fullySaved' };
  const saving = Number(savings.monthly.amount) > 0;
  if (!saving || savings.readyMonth === null) {
    return {
      kind: 'setMonthly',
      needed: savings.monthlyNeeded?.amount ?? null,
      departure: savings.departure,
    };
  }
  if (savings.onTime === false && savings.departure !== null) {
    return { kind: 'almost', month: savings.readyMonth, departure: savings.departure };
  }
  return { kind: 'yes', month: savings.readyMonth };
}
