/** Limits of a trip's route (its ordered stops). Business rules, "Trips". */
export const MAX_DESTINATIONS = 100;
export const MAX_NIGHTS_PER_DESTINATION = 365;
export const DESTINATION_NAME_MAX_LENGTH = 200;
export const DESTINATION_NOTE_MAX_LENGTH = 500;
/** How you travel from a stop to the next one (the leg after it). */
export const LEG_MODES = ['flight', 'train', 'bus', 'car', 'boat', 'walk', 'other'] as const;
export type LegMode = (typeof LEG_MODES)[number];
