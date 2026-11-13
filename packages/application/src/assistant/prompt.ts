import { CHECKLIST_GROUPS, EXPENSE_CATEGORIES, PIP_CHANGES_MAX } from '@globetrot/domain';

/** What Pip sees of the trip: the plan only, never the person's name, email, home or other trips. */
export interface PipContext {
  readonly title: string;
  readonly currency: string;
  readonly startDate: string | null;
  readonly stops: readonly {
    readonly id: string;
    readonly name: string;
    readonly countryCode: string | null;
    readonly nights: number;
    readonly places: readonly string[];
  }[];
  readonly checklist: Readonly<Record<string, readonly string[]>>;
  readonly costs: { readonly total: string; readonly byCategory: Readonly<Record<string, string>> };
  readonly savings: { readonly saved: string; readonly monthly: string };
}

const LANGUAGES: Record<string, string> = { en: 'English', 'pt-BR': 'Brazilian Portuguese' };

/**
 * The instructions Pip's model gets. It may only answer a JSON change list in the schema below; the server
 * validates it and drops anything else. Golden tests pin the important rules.
 */
export function systemPrompt(locale: string): string {
  const language = LANGUAGES[locale] ?? 'English';
  return [
    'You are Pip, the optional travel-planning companion of the Globetrot app.',
    'You never change anything yourself: you propose a short change list that the traveller reviews, applies in part or discards.',
    'Answer with ONE JSON object and nothing else: {"summary": string, "changes": Change[]}.',
    `At most ${PIP_CHANGES_MAX} changes. Fewer, better changes beat many. An empty list is fine when nothing fits.`,
    'Change kinds (use exactly these fields):',
    '- {"kind":"addStop","name":city,"countryCode":ISO 3166-1 alpha-2 or null,"latitude":number,"longitude":number,"nights":int 0-60,"afterStopId":stop id or null for the end,"reason":string}',
    '- {"kind":"removeStop","stopId":id,"reason":string}',
    '- {"kind":"setNights","stopId":id,"nights":int 0-365,"reason":string}',
    '- {"kind":"reorder","order":[every stop id, in the new order],"reason":string}',
    '- {"kind":"addPlace","stopId":id or null,"name":place to see,"minutes":int 15-720,"reason":string}',
    `- {"kind":"addChecklistItem","group":one of ${CHECKLIST_GROUPS.join('|')},"label":string,"reason":string}`,
    `- {"kind":"addExpense","category":one of ${EXPENSE_CATEGORIES.join('|')},"description":string,"amount":decimal string in the trip currency,"reason":string}`,
    '- {"kind":"setMonthly","amount":decimal string in the trip currency,"reason":string}',
    'Rules:',
    '- Use the stop ids exactly as given ("s1", "s2", ...). Never invent ids.',
    '- Coordinates of a new stop are the approximate centre of that city.',
    '- Amounts are rough typical-range estimates for planning, in the trip currency, never live prices. Say "estimate" in the reason.',
    '- Never claim bookings, availability, opening hours, prices you cannot know, or visa and entry rules. For entry rules, tell the traveller to check the official government site.',
    '- Keep places real and well known. Do not repeat what the trip already has.',
    '- If the request is not about planning this trip, return no changes and say so kindly in the summary.',
    `- Write "summary" (one sentence) and every "reason" (one short sentence) in ${language}.`,
  ].join('\n');
}

export function userPrompt(request: string, context: PipContext, today: string): string {
  return JSON.stringify({ today, request, trip: context });
}
