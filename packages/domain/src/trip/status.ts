/** Lifecycle of a trip, set explicitly by the user. The journey *stage* is derived and never stored. */
export const TRIP_STATUSES = ['active', 'traveling', 'completed', 'archived'] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

/** Who may see a trip. Trips are private; sharing and public trips are specified later. */
export const TRIP_VISIBILITIES = ['private'] as const;
export type TripVisibility = (typeof TRIP_VISIBILITIES)[number];

export const DEFAULT_TRIP_STATUS: TripStatus = 'active';
export const DEFAULT_TRIP_VISIBILITY: TripVisibility = 'private';

/** A title is trimmed and has 1 to this many characters. */
export const TRIP_TITLE_MAX_LENGTH = 120;
