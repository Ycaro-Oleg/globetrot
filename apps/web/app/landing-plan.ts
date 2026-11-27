import type { SuggestComfort, SuggestLike } from '@globetrot/domain';

/** What the visitor chose in the landing's plan, shared with the live map below it. */
export interface LandingPlanChoice {
  readonly destination: string;
  readonly likes: readonly SuggestLike[];
  readonly days: number;
  readonly comfort: SuggestComfort;
}

const EVENT = 'globetrot:landing-plan';

/** The plan is ready: the live map shows it. */
export function sharePlan(choice: LandingPlanChoice): void {
  window.dispatchEvent(new CustomEvent<LandingPlanChoice>(EVENT, { detail: choice }));
}

/** Calls `handler` with each plan the visitor builds; returns the way to stop listening. */
export function onPlan(handler: (choice: LandingPlanChoice) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<LandingPlanChoice>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
