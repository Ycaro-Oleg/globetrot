/**
 * Example trips anyone can copy into their account: a route with nights per stop, nothing else. They show what a
 * planned trip looks like; they are not offers, and carry no prices, dates or entry rules. Names are the places'
 * common English names; the board localises the country from `countryCode`.
 */
export interface ExampleStop {
  readonly placeKey: string;
  readonly name: string;
  readonly countryCode: string;
  readonly region: string | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly nights: number;
}

export interface ExampleTrip {
  readonly id: string;
  /** Used when the client does not send a title in the person's language. */
  readonly defaultTitle: string;
  readonly stops: readonly ExampleStop[];
}

const stop = (
  key: string,
  name: string,
  countryCode: string,
  region: string | null,
  latitude: number,
  longitude: number,
  nights: number,
): ExampleStop => ({
  placeKey: `example:${key}`,
  name,
  countryCode,
  region,
  latitude,
  longitude,
  nights,
});

export const EXAMPLE_TRIPS = [
  {
    id: 'japan',
    defaultTitle: 'Japan in two weeks',
    stops: [
      stop('tokyo', 'Tokyo', 'JP', 'Kanto', 35.6762, 139.6503, 4),
      stop('hakone', 'Hakone', 'JP', 'Kanagawa', 35.2324, 139.1069, 1),
      stop('kyoto', 'Kyoto', 'JP', 'Kansai', 35.0116, 135.7681, 4),
      stop('nara', 'Nara', 'JP', 'Kansai', 34.6851, 135.8048, 0),
      stop('osaka', 'Osaka', 'JP', 'Kansai', 34.6937, 135.5023, 3),
      stop('hiroshima', 'Hiroshima', 'JP', 'Chugoku', 34.3853, 132.4553, 2),
    ],
  },
  {
    id: 'portugal',
    defaultTitle: 'Portugal by train',
    stops: [
      stop('lisbon', 'Lisbon', 'PT', 'Lisbon', 38.7223, -9.1393, 3),
      stop('sintra', 'Sintra', 'PT', 'Lisbon', 38.8029, -9.3817, 0),
      stop('coimbra', 'Coimbra', 'PT', 'Centro', 40.2033, -8.4103, 1),
      stop('porto', 'Porto', 'PT', 'Norte', 41.1579, -8.6291, 3),
    ],
  },
  {
    id: 'rio-de-la-plata',
    defaultTitle: 'Around the Río de la Plata',
    stops: [
      stop('buenos-aires', 'Buenos Aires', 'AR', 'Buenos Aires', -34.6037, -58.3816, 4),
      stop('colonia', 'Colonia del Sacramento', 'UY', 'Colonia', -34.4626, -57.8398, 1),
      stop('montevideo', 'Montevideo', 'UY', 'Montevideo', -34.9011, -56.1645, 3),
    ],
  },
] as const satisfies readonly ExampleTrip[];

export type ExampleTripId = (typeof EXAMPLE_TRIPS)[number]['id'];
export const EXAMPLE_TRIP_IDS = EXAMPLE_TRIPS.map((trip) => trip.id) as [
  ExampleTripId,
  ...ExampleTripId[],
];

export function findExampleTrip(id: string): ExampleTrip | undefined {
  return EXAMPLE_TRIPS.find((trip) => trip.id === id);
}
