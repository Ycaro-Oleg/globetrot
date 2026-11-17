/**
 * Where a change the read-only account cannot save leads: the plans, with the reason said once. Server actions
 * redirect here when the API answers `402 PLAN_REQUIRED`; client code that calls the API directly goes here too.
 */
export const PLAN_REQUIRED_PATH = '/app/plan?status=plan-required';

/** True when the API refused the change because the free week is over and there is no plan. */
export async function isPlanRequired(response: Response): Promise<boolean> {
  if (response.status !== 402) return false;
  const body: unknown = await response
    .clone()
    .json()
    .catch(() => null);
  return (
    typeof body === 'object' && body !== null && 'code' in body && body.code === 'PLAN_REQUIRED'
  );
}
