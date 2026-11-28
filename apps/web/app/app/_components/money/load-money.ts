import { localDateIn } from '@globetrot/domain';
import { fetchStoredPreferences, type FetchOptions } from '../../../../lib/stored-preferences';
import { fetchSavingsHistory, type SavingsHistoryData } from '../../../../lib/trips';

/** What the money panel needs besides the budget: the savings history and today in the person's calendar. */
export async function loadMoneyExtras(
  options: FetchOptions,
  tripId: string,
): Promise<{ history: SavingsHistoryData | null; today: string }> {
  const [history, preferences] = await Promise.all([
    fetchSavingsHistory(options, tripId),
    fetchStoredPreferences(options),
  ]);
  return { history, today: localDateIn(new Date(), preferences?.timeZone) };
}
