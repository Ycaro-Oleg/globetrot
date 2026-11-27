import type { LegMode, SpotKind } from '../trip/destinations';

/**
 * Suggested plans (ADR-0020): a few destinations, hand-curated, with the experiences worth a trip (some that few
 * people talk about) and typical cost ranges per person. Every range is an estimate researched on
 * `SUGGEST_RESEARCHED_ON` from public listings (see docs/product/research/suggested-plans.md); it is never a
 * quote, never a booking, and international flights are not included. Names are proper nouns or short titles in
 * English and Portuguese; why each experience is worth it lives in the message catalogs (`suggest.why.<id>`).
 */
export const SUGGEST_RESEARCHED_ON = '2026-11-26';

export const SUGGEST_LIKES = ['adrenaline', 'food', 'culture', 'nature', 'nightlife'] as const;
export type SuggestLike = (typeof SUGGEST_LIKES)[number];

export const SUGGEST_COMFORTS = ['budget', 'comfort'] as const;
export type SuggestComfort = (typeof SUGGEST_COMFORTS)[number];

/** A typical range per person, in whole US dollars: [low, high]. */
export type UsdRange = readonly [low: number, high: number];

/** What a day costs one person in a city: where they sleep, what they eat, how they get around. */
export interface DailyCosts {
  readonly stay: UsdRange;
  readonly food: UsdRange;
  readonly local: UsdRange;
}

export interface SuggestedExperience {
  readonly id: string;
  readonly name: string;
  readonly namePt: string;
  readonly kind: SpotKind;
  readonly likes: readonly SuggestLike[];
  /** Few visitors know it: the plan says so. */
  readonly offbeat: boolean;
  readonly cost: UsdRange;
  readonly latitude: number;
  readonly longitude: number;
}

export interface SuggestedStop {
  readonly key: string;
  readonly name: string;
  readonly namePt: string;
  readonly countryCode: string;
  readonly region: string;
  readonly latitude: number;
  readonly longitude: number;
  /** Nights in the reference plan, and the fewest that still make the stop worth it. */
  readonly nights: number;
  readonly minNights: number;
  /** 1 = always in the plan; higher numbers drop first when the trip is short. */
  readonly priority: number;
  readonly daily: Readonly<Record<SuggestComfort, DailyCosts>>;
  readonly experiences: readonly SuggestedExperience[];
}

/** The way from one stop to the next one in the list, per person. */
export interface SuggestedLeg {
  readonly mode: LegMode;
  readonly cost: UsdRange;
}

export interface SuggestedDestination {
  readonly id: string;
  readonly name: string;
  readonly namePt: string;
  /** Its public itinerary page's address: `/itineraries/{slug}` and `/roteiros/{slugPt}`. */
  readonly slug: string;
  readonly slugPt: string;
  readonly stops: readonly SuggestedStop[];
  /** `legs[i]` goes from `stops[i]` to `stops[i + 1]`. */
  readonly legs: readonly SuggestedLeg[];
}

type Exp = readonly [
  id: string,
  name: string,
  namePt: string,
  kind: SpotKind,
  likes: readonly SuggestLike[],
  offbeat: boolean,
  cost: UsdRange,
  latitude: number,
  longitude: number,
];

const experiences = (rows: readonly Exp[]): SuggestedExperience[] =>
  rows.map(([id, name, namePt, kind, likes, offbeat, cost, latitude, longitude]) => ({
    id,
    name,
    namePt,
    kind,
    likes,
    offbeat,
    cost,
    latitude,
    longitude,
  }));

const JAPAN: SuggestedDestination = {
  id: 'japan',
  name: 'Japan',
  namePt: 'Japão',
  slug: 'japan',
  slugPt: 'japao',
  stops: [
    {
      key: 'tokyo',
      name: 'Tokyo',
      namePt: 'Tóquio',
      countryCode: 'JP',
      region: 'Tokyo',
      latitude: 35.6812,
      longitude: 139.7671,
      nights: 4,
      minNights: 2,
      priority: 1,
      daily: {
        budget: { stay: [25, 60], food: [20, 40], local: [5, 12] },
        comfort: { stay: [90, 180], food: [45, 90], local: [10, 20] },
      },
      // prettier-ignore
      experiences: experiences([
        ['tokyo-sensoji-dawn', 'Senso-ji at sunrise', 'Senso-ji ao amanhecer', 'sight', ['culture'], false, [0, 0], 35.7148, 139.7967],
        ['tokyo-tsukiji', 'Breakfast at Tsukiji Outer Market', 'Café da manhã no mercado de Tsukiji', 'food', ['food'], false, [15, 35], 35.6654, 139.7708],
        ['tokyo-teamlab', 'teamLab Planets', 'teamLab Planets', 'sight', ['culture'], false, [23, 30], 35.6491, 139.7845],
        ['tokyo-golden-gai', 'Tiny bars of Golden Gai', 'Os barzinhos de Golden Gai', 'food', ['nightlife'], true, [20, 50], 35.6938, 139.7046],
        ['tokyo-daikoku', 'Night car meet at Daikoku PA', 'Encontro de carros no Daikoku PA', 'sight', ['adrenaline'], true, [60, 120], 35.4627, 139.6847],
        ['tokyo-ebisu-drift', 'Drift ride at Ebisu Circuit (day trip)', 'Drift na pista de Ebisu (bate-volta)', 'sight', ['adrenaline'], true, [220, 320], 37.615, 140.394],
        ['tokyo-takao', 'Mount Takao trail', 'Trilha do monte Takao', 'sight', ['nature'], true, [10, 25], 35.6251, 139.2437],
        ['tokyo-shimokita', 'Vintage shops of Shimokitazawa', 'Brechós de Shimokitazawa', 'shop', ['culture'], true, [0, 60], 35.6618, 139.668],
      ]),
    },
    {
      key: 'hakone',
      name: 'Hakone',
      namePt: 'Hakone',
      countryCode: 'JP',
      region: 'Kanagawa',
      latitude: 35.2324,
      longitude: 139.1069,
      nights: 1,
      minNights: 1,
      priority: 3,
      daily: {
        budget: { stay: [45, 90], food: [25, 45], local: [15, 30] },
        comfort: { stay: [150, 350], food: [40, 80], local: [20, 30] },
      },
      // prettier-ignore
      experiences: experiences([
        ['hakone-loop', 'Ropeway, Owakudani and the Lake Ashi boat', 'Teleférico, Owakudani e o barco do lago Ashi', 'sight', ['nature'], false, [0, 15], 35.2045, 139.0235],
        ['hakone-onsen', 'A public hot spring bath', 'Um banho termal público', 'other', ['nature', 'culture'], true, [8, 15], 35.224, 139.088],
        ['hakone-openair', 'Hakone Open-Air Museum', 'Museu ao ar livre de Hakone', 'sight', ['culture'], false, [13, 15], 35.2449, 139.0517],
      ]),
    },
    {
      key: 'kyoto',
      name: 'Kyoto',
      namePt: 'Quioto',
      countryCode: 'JP',
      region: 'Kyoto',
      latitude: 34.9858,
      longitude: 135.7588,
      nights: 4,
      minNights: 2,
      priority: 1,
      daily: {
        budget: { stay: [25, 60], food: [20, 40], local: [6, 12] },
        comfort: { stay: [90, 200], food: [45, 90], local: [10, 20] },
      },
      // prettier-ignore
      experiences: experiences([
        ['kyoto-fushimi-dawn', 'Fushimi Inari to the top at sunrise', 'Fushimi Inari até o topo ao amanhecer', 'sight', ['culture', 'nature'], false, [0, 0], 34.9671, 135.7727],
        ['kyoto-kiyomizu', 'Kiyomizu-dera', 'Kiyomizu-dera', 'sight', ['culture'], false, [3, 3], 34.9949, 135.785],
        ['kyoto-nishiki', 'Tasting your way through Nishiki Market', 'Provando tudo no mercado Nishiki', 'food', ['food'], false, [15, 35], 35.005, 135.765],
        ['kyoto-pontocho', 'An izakaya in Pontocho', 'Um izakaya em Pontocho', 'food', ['nightlife', 'food'], false, [25, 60], 35.005, 135.771],
        ['kyoto-hozugawa', 'Rafting the Hozugawa river', 'Rafting no rio Hozugawa', 'sight', ['adrenaline', 'nature'], true, [25, 60], 35.013, 135.592],
        ['kyoto-kurama-kibune', 'The Kurama to Kibune mountain trail', 'A trilha de Kurama a Kibune', 'sight', ['nature'], true, [5, 12], 35.117, 135.772],
      ]),
    },
    {
      key: 'osaka',
      name: 'Osaka',
      namePt: 'Osaka',
      countryCode: 'JP',
      region: 'Osaka',
      latitude: 34.7025,
      longitude: 135.4959,
      nights: 2,
      minNights: 1,
      priority: 2,
      daily: {
        budget: { stay: [22, 55], food: [20, 40], local: [5, 10] },
        comfort: { stay: [80, 170], food: [40, 85], local: [10, 18] },
      },
      // prettier-ignore
      experiences: experiences([
        ['osaka-dotonbori', 'Street food in Dotonbori', 'Comida de rua em Dotonbori', 'food', ['food'], false, [15, 35], 34.6687, 135.5013],
        ['osaka-castle', 'Osaka Castle', 'Castelo de Osaka', 'sight', ['culture'], false, [8, 8], 34.6873, 135.5262],
        ['osaka-shinsekai', 'Kushikatsu in Shinsekai', 'Kushikatsu em Shinsekai', 'food', ['food'], true, [15, 30], 34.6525, 135.5063],
        ['osaka-usj', 'Universal Studios Japan', 'Universal Studios Japan', 'sight', ['adrenaline'], false, [55, 75], 34.6654, 135.4323],
        ['osaka-tenma', 'The izakaya alleys of Tenma', 'As vielas de izakaya de Tenma', 'food', ['nightlife'], true, [20, 45], 34.704, 135.513],
        ['osaka-minoo', 'Minoo Falls trail', 'Trilha da cachoeira de Minoo', 'sight', ['nature'], true, [3, 8], 34.853, 135.47],
      ]),
    },
  ],
  legs: [
    { mode: 'train', cost: [15, 30] },
    { mode: 'train', cost: [70, 80] },
    { mode: 'train', cost: [4, 10] },
  ],
};

const PORTUGAL: SuggestedDestination = {
  id: 'portugal',
  name: 'Portugal',
  namePt: 'Portugal',
  slug: 'portugal',
  slugPt: 'portugal',
  stops: [
    {
      key: 'lisbon',
      name: 'Lisbon',
      namePt: 'Lisboa',
      countryCode: 'PT',
      region: 'Lisbon',
      latitude: 38.7223,
      longitude: -9.1393,
      nights: 4,
      minNights: 2,
      priority: 1,
      daily: {
        budget: { stay: [25, 45], food: [22, 40], local: [6, 10] },
        comfort: { stay: [100, 190], food: [45, 90], local: [10, 18] },
      },
      // prettier-ignore
      experiences: experiences([
        ['lisbon-sintra-pena', 'Pena Palace and the Sintra hills', 'Palácio da Pena e a serra de Sintra', 'sight', ['culture', 'nature'], false, [20, 30], 38.7876, -9.3904],
        ['lisbon-alfama-fado', 'Fado in an Alfama tavern', 'Fado numa taberna de Alfama', 'food', ['culture', 'nightlife'], false, [20, 45], 38.711, -9.13],
        ['lisbon-tasca', 'Petiscos in a neighbourhood tasca', 'Petiscos numa tasca de bairro', 'food', ['food'], true, [12, 25], 38.713, -9.142],
        ['lisbon-bairro-alto', 'Bairro Alto at night', 'Bairro Alto à noite', 'other', ['nightlife'], false, [15, 40], 38.713, -9.145],
        ['lisbon-ericeira-surf', 'A surf lesson in Ericeira', 'Aula de surfe na Ericeira', 'sight', ['adrenaline', 'nature'], true, [45, 65], 38.963, -9.417],
        ['lisbon-arrabida-kayak', 'Kayaking the Arrábida coast', 'Caiaque na costa da Arrábida', 'sight', ['adrenaline', 'nature'], true, [40, 60], 38.48, -8.98],
      ]),
    },
    {
      key: 'coimbra',
      name: 'Coimbra',
      namePt: 'Coimbra',
      countryCode: 'PT',
      region: 'Coimbra',
      latitude: 40.2033,
      longitude: -8.4103,
      nights: 1,
      minNights: 1,
      priority: 3,
      daily: {
        budget: { stay: [22, 40], food: [20, 35], local: [3, 6] },
        comfort: { stay: [70, 130], food: [35, 70], local: [6, 12] },
      },
      // prettier-ignore
      experiences: experiences([
        ['coimbra-joanina', 'The Joanina Library', 'A Biblioteca Joanina', 'sight', ['culture'], false, [15, 17], 40.2075, -8.426],
        ['coimbra-fado', 'Coimbra fado, sung by students', 'Fado de Coimbra, cantado por estudantes', 'other', ['culture', 'nightlife'], true, [10, 20], 40.209, -8.429],
        ['coimbra-mondego-kayak', 'Kayaking down the Mondego', 'Descida do Mondego de caiaque', 'sight', ['adrenaline', 'nature'], true, [25, 40], 40.269, -8.281],
      ]),
    },
    {
      key: 'porto',
      name: 'Porto',
      namePt: 'Porto',
      countryCode: 'PT',
      region: 'Porto',
      latitude: 41.1579,
      longitude: -8.6291,
      nights: 3,
      minNights: 2,
      priority: 1,
      daily: {
        budget: { stay: [22, 42], food: [20, 38], local: [5, 9] },
        comfort: { stay: [90, 170], food: [40, 80], local: [8, 15] },
      },
      // prettier-ignore
      experiences: experiences([
        ['porto-port-cellar', 'A port wine cellar in Gaia', 'Uma adega de vinho do Porto em Gaia', 'food', ['food', 'culture'], false, [20, 40], 41.137, -8.613],
        ['porto-livraria', 'Livraria Lello', 'Livraria Lello', 'shop', ['culture'], false, [11, 17], 41.1469, -8.6148],
        ['porto-francesinha', 'A francesinha at a local café', 'Uma francesinha num café de bairro', 'food', ['food'], true, [12, 20], 41.149, -8.611],
        ['porto-douro', 'Douro Valley wineries day trip', 'Bate-volta às vinícolas do Douro', 'sight', ['food', 'nature'], false, [95, 125], 41.192, -7.553],
        ['porto-galerias', 'Rua Galeria de Paris at night', 'Rua Galeria de Paris à noite', 'other', ['nightlife'], false, [15, 40], 41.147, -8.615],
        ['porto-matosinhos-surf', 'A surf lesson at Matosinhos', 'Aula de surfe em Matosinhos', 'sight', ['adrenaline'], true, [30, 45], 41.177, -8.689],
      ]),
    },
  ],
  legs: [
    { mode: 'train', cost: [13, 28] },
    { mode: 'train', cost: [10, 22] },
  ],
};

const RIO_DE_LA_PLATA: SuggestedDestination = {
  id: 'rio-de-la-plata',
  name: 'Argentina and Uruguay',
  namePt: 'Argentina e Uruguai',
  slug: 'argentina-and-uruguay',
  slugPt: 'argentina-e-uruguai',
  stops: [
    {
      key: 'buenos-aires',
      name: 'Buenos Aires',
      namePt: 'Buenos Aires',
      countryCode: 'AR',
      region: 'Buenos Aires',
      latitude: -34.6037,
      longitude: -58.3816,
      nights: 4,
      minNights: 2,
      priority: 1,
      daily: {
        budget: { stay: [18, 35], food: [18, 35], local: [3, 6] },
        comfort: { stay: [70, 140], food: [40, 80], local: [8, 15] },
      },
      // prettier-ignore
      experiences: experiences([
        ['ba-parrilla', 'Dinner at a parrilla', 'Jantar numa parrilla', 'food', ['food'], false, [20, 35], -34.588, -58.43],
        ['ba-recoleta', 'Recoleta Cemetery', 'Cemitério da Recoleta', 'sight', ['culture'], false, [10, 18], -34.5875, -58.3934],
        ['ba-san-telmo', 'The San Telmo Sunday fair', 'A feira de domingo de San Telmo', 'shop', ['culture'], false, [0, 30], -34.621, -58.3725],
        ['ba-tango-show', 'A tango dinner show', 'Show de tango com jantar', 'food', ['culture', 'nightlife'], false, [60, 80], -34.6127, -58.3707],
        ['ba-milonga', 'Dancing at a neighbourhood milonga', 'Dançar numa milonga de bairro', 'other', ['nightlife', 'culture'], true, [5, 15], -34.598, -58.426],
        ['ba-skydive', 'A tandem skydive over the Pampas', 'Salto duplo de paraquedas nos Pampas', 'sight', ['adrenaline'], true, [240, 340], -35.287, -59.091],
        ['ba-tigre-kayak', 'Kayaking the Tigre delta', 'Caiaque no delta do Tigre', 'sight', ['nature', 'adrenaline'], true, [40, 80], -34.425, -58.58],
      ]),
    },
    {
      key: 'colonia',
      name: 'Colonia del Sacramento',
      namePt: 'Colonia del Sacramento',
      countryCode: 'UY',
      region: 'Colonia',
      latitude: -34.4626,
      longitude: -57.8398,
      nights: 1,
      minNights: 1,
      priority: 3,
      daily: {
        budget: { stay: [30, 55], food: [20, 35], local: [2, 5] },
        comfort: { stay: [90, 160], food: [40, 75], local: [5, 10] },
      },
      // prettier-ignore
      experiences: experiences([
        ['colonia-barrio', 'The old quarter at sunset', 'O bairro histórico ao pôr do sol', 'sight', ['culture'], false, [0, 0], -34.4716, -57.8521],
        ['colonia-bike', 'Cycling the coast to Real de San Carlos', 'De bicicleta pela costa até Real de San Carlos', 'sight', ['nature'], true, [8, 15], -34.444, -57.857],
        ['colonia-tannat', 'Tannat at a nearby winery', 'Tannat numa vinícola perto', 'food', ['food'], true, [25, 45], -34.43, -57.78],
      ]),
    },
    {
      key: 'montevideo',
      name: 'Montevideo',
      namePt: 'Montevidéu',
      countryCode: 'UY',
      region: 'Montevideo',
      latitude: -34.9011,
      longitude: -56.1645,
      nights: 3,
      minNights: 2,
      priority: 1,
      daily: {
        budget: { stay: [25, 45], food: [22, 40], local: [3, 6] },
        comfort: { stay: [80, 150], food: [45, 85], local: [8, 14] },
      },
      // prettier-ignore
      experiences: experiences([
        ['mvd-mercado', 'Asado at Mercado del Puerto', 'Assado no Mercado del Puerto', 'food', ['food'], false, [25, 45], -34.9066, -56.2125],
        ['mvd-rambla', 'Cycling the Rambla', 'De bicicleta pela Rambla', 'sight', ['nature'], false, [5, 15], -34.913, -56.16],
        ['mvd-candombe', 'Candombe drums in Barrio Sur on a Sunday', 'Tambores de candombe no Barrio Sur, aos domingos', 'other', ['culture', 'nightlife'], true, [0, 0], -34.911, -56.19],
      ]),
    },
  ],
  legs: [
    { mode: 'boat', cost: [41, 90] },
    { mode: 'bus', cost: [12, 25] },
  ],
};

const ITALY: SuggestedDestination = {
  id: 'italy',
  name: 'Italy',
  namePt: 'Itália',
  slug: 'italy',
  slugPt: 'italia',
  stops: [
    {
      key: 'rome',
      name: 'Rome',
      namePt: 'Roma',
      countryCode: 'IT',
      region: 'Lazio',
      latitude: 41.9028,
      longitude: 12.4964,
      nights: 4,
      minNights: 2,
      priority: 1,
      daily: {
        budget: { stay: [22, 38], food: [22, 38], local: [6, 9] },
        comfort: { stay: [100, 180], food: [45, 90], local: [8, 15] },
      },
      // prettier-ignore
      experiences: experiences([
        ['rome-colosseum', 'The Colosseum and the Roman Forum', 'O Coliseu e o Fórum Romano', 'sight', ['culture'], false, [20, 35], 41.8902, 12.4922],
        ['rome-vatican', 'The Vatican Museums and the Sistine Chapel', 'Os Museus do Vaticano e a Capela Sistina', 'sight', ['culture'], false, [25, 40], 41.9065, 12.4536],
        ['rome-testaccio', 'Trapizzino at the Testaccio market', 'Trapizzino no mercado de Testaccio', 'food', ['food'], true, [10, 20], 41.8763, 12.4757],
        ['rome-appia-bike', 'Cycling the Appian Way', 'De bicicleta pela Via Ápia', 'sight', ['nature', 'adrenaline'], true, [15, 35], 41.8564, 12.5157],
        ['rome-aqueducts', 'The aqueducts park at sunset', 'O parque dos aquedutos ao pôr do sol', 'sight', ['nature', 'culture'], true, [0, 0], 41.8536, 12.5578],
        ['rome-trastevere', 'Trastevere at night', 'Trastevere à noite', 'other', ['nightlife'], false, [15, 40], 41.8897, 12.4697],
      ]),
    },
    {
      key: 'florence',
      name: 'Florence',
      namePt: 'Florença',
      countryCode: 'IT',
      region: 'Tuscany',
      latitude: 43.7696,
      longitude: 11.2558,
      nights: 3,
      minNights: 2,
      priority: 1,
      daily: {
        budget: { stay: [24, 40], food: [22, 38], local: [3, 6] },
        comfort: { stay: [110, 200], food: [45, 90], local: [6, 12] },
      },
      // prettier-ignore
      experiences: experiences([
        ['florence-uffizi', 'The Uffizi', 'A Galeria Uffizi', 'sight', ['culture'], false, [25, 35], 43.7678, 11.2553],
        ['florence-lampredotto', 'Lampredotto from a street cart', 'Lampredotto num carrinho de rua', 'food', ['food'], true, [6, 10], 43.7765, 11.2534],
        ['florence-chianti-vespa', 'The Chianti hills by Vespa', 'As colinas do Chianti de Vespa', 'sight', ['adrenaline', 'food', 'nature'], true, [90, 140], 43.58, 11.32],
        ['florence-oltrarno', 'Artisan workshops in Oltrarno', 'Ateliês de artesãos em Oltrarno', 'shop', ['culture'], true, [0, 20], 43.765, 11.249],
        ['florence-santo-spirito', 'Piazza Santo Spirito at night', 'A Piazza Santo Spirito à noite', 'other', ['nightlife'], false, [10, 30], 43.7672, 11.248],
      ]),
    },
    {
      key: 'venice',
      name: 'Venice',
      namePt: 'Veneza',
      countryCode: 'IT',
      region: 'Veneto',
      latitude: 45.4408,
      longitude: 12.3155,
      nights: 2,
      minNights: 1,
      priority: 2,
      daily: {
        budget: { stay: [42, 60], food: [28, 45], local: [10, 27] },
        comfort: { stay: [140, 260], food: [55, 100], local: [15, 30] },
      },
      // prettier-ignore
      experiences: experiences([
        ['venice-st-marks', "St Mark's Basilica", 'A Basílica de São Marcos', 'sight', ['culture'], false, [3, 20], 45.4345, 12.3397],
        ['venice-cicchetti', 'A cicchetti crawl in Cannaregio', 'Um roteiro de cicchetti em Cannaregio', 'food', ['food', 'nightlife'], true, [20, 40], 45.4446, 12.3283],
        ['venice-burano', 'Burano and Torcello by water bus', 'Burano e Torcello de vaporetto', 'sight', ['culture', 'nature'], true, [10, 27], 45.4853, 12.4167],
        ['venice-rowing', 'A Venetian rowing lesson', 'Uma aula de remo veneziano', 'sight', ['adrenaline', 'culture'], true, [80, 110], 45.443, 12.33],
      ]),
    },
  ],
  legs: [
    { mode: 'train', cost: [16, 50] },
    { mode: 'train', cost: [20, 55] },
  ],
};

const CHILE: SuggestedDestination = {
  id: 'chile',
  name: 'Chile',
  namePt: 'Chile',
  slug: 'chile',
  slugPt: 'chile',
  stops: [
    {
      key: 'santiago',
      name: 'Santiago',
      namePt: 'Santiago',
      countryCode: 'CL',
      region: 'Santiago Metropolitan',
      latitude: -33.4489,
      longitude: -70.6693,
      nights: 3,
      minNights: 2,
      priority: 1,
      daily: {
        budget: { stay: [13, 25], food: [15, 30], local: [3, 6] },
        comfort: { stay: [70, 130], food: [35, 70], local: [8, 15] },
      },
      // prettier-ignore
      experiences: experiences([
        ['santiago-cajon-maipo', 'Hiking in the Cajón del Maipo', 'Trilha no Cajón del Maipo', 'sight', ['nature', 'adrenaline'], true, [40, 80], -33.64, -70.35],
        ['santiago-winery', 'A Maipo Valley winery', 'Uma vinícola no Vale do Maipo', 'food', ['food', 'culture'], false, [25, 60], -33.64, -70.57],
        ['santiago-la-vega', 'Lunch at La Vega market', 'Almoço no mercado La Vega', 'food', ['food'], true, [6, 12], -33.429, -70.649],
        ['santiago-bellavista', 'Barrio Bellavista at night', 'O bairro Bellavista à noite', 'other', ['nightlife'], false, [15, 40], -33.432, -70.634],
        ['santiago-san-cristobal', 'Cerro San Cristóbal by funicular', 'O Cerro San Cristóbal de funicular', 'sight', ['nature'], false, [3, 8], -33.425, -70.633],
      ]),
    },
    {
      key: 'valparaiso',
      name: 'Valparaíso',
      namePt: 'Valparaíso',
      countryCode: 'CL',
      region: 'Valparaíso',
      latitude: -33.0472,
      longitude: -71.6127,
      nights: 1,
      minNights: 1,
      priority: 3,
      daily: {
        budget: { stay: [15, 28], food: [12, 25], local: [2, 5] },
        comfort: { stay: [60, 110], food: [30, 60], local: [5, 10] },
      },
      // prettier-ignore
      experiences: experiences([
        ['valpo-murals', 'Street art on Cerro Alegre', 'Arte de rua no Cerro Alegre', 'sight', ['culture'], false, [0, 15], -33.041, -71.627],
        ['valpo-funiculars', 'The old funiculars', 'Os elevadores antigos', 'sight', ['culture'], true, [1, 3], -33.04, -71.629],
        ['valpo-seafood', 'Seafood at Caleta Portales', 'Frutos do mar na Caleta Portales', 'food', ['food'], true, [10, 20], -33.031, -71.592],
      ]),
    },
    {
      key: 'san-pedro',
      name: 'San Pedro de Atacama',
      namePt: 'San Pedro de Atacama',
      countryCode: 'CL',
      region: 'Antofagasta',
      latitude: -22.9087,
      longitude: -68.1997,
      nights: 3,
      minNights: 2,
      priority: 2,
      daily: {
        budget: { stay: [20, 40], food: [18, 35], local: [3, 8] },
        comfort: { stay: [110, 250], food: [40, 80], local: [10, 20] },
      },
      // prettier-ignore
      experiences: experiences([
        ['atacama-valle-luna', 'The Valley of the Moon at sunset', 'O Vale da Lua ao pôr do sol', 'sight', ['nature'], false, [15, 35], -22.913, -68.283],
        ['atacama-stars', 'Stargazing in the desert', 'Observação de estrelas no deserto', 'sight', ['nature', 'culture'], false, [35, 55], -22.95, -68.2],
        ['atacama-sandboard', 'Sandboarding in Death Valley', 'Sandboard no Vale da Morte', 'sight', ['adrenaline'], true, [25, 40], -22.92, -68.25],
        ['atacama-tatio', 'El Tatio geysers at dawn', 'Os gêiseres de El Tatio ao amanhecer', 'sight', ['nature'], false, [40, 70], -22.332, -68.011],
        ['atacama-lagoons', 'The high-plateau lagoons', 'As lagunas altiplânicas', 'sight', ['nature'], true, [50, 90], -23.73, -67.87],
      ]),
    },
  ],
  legs: [
    { mode: 'bus', cost: [6, 12] },
    { mode: 'flight', cost: [70, 180] },
  ],
};

const MEXICO: SuggestedDestination = {
  id: 'mexico',
  name: 'Mexico',
  namePt: 'México',
  slug: 'mexico',
  slugPt: 'mexico',
  stops: [
    {
      key: 'mexico-city',
      name: 'Mexico City',
      namePt: 'Cidade do México',
      countryCode: 'MX',
      region: 'Mexico City',
      latitude: 19.4326,
      longitude: -99.1332,
      nights: 4,
      minNights: 2,
      priority: 1,
      daily: {
        budget: { stay: [12, 25], food: [12, 25], local: [3, 8] },
        comfort: { stay: [70, 140], food: [35, 70], local: [8, 16] },
      },
      // prettier-ignore
      experiences: experiences([
        ['cdmx-teotihuacan', 'The Teotihuacan pyramids at opening time', 'As pirâmides de Teotihuacan na abertura', 'sight', ['culture'], false, [10, 30], 19.6925, -98.8438],
        ['cdmx-tacos', 'A taco crawl in Roma and Condesa', 'Um roteiro de tacos em Roma e Condesa', 'food', ['food'], true, [10, 25], 19.415, -99.162],
        ['cdmx-lucha', 'Lucha libre at Arena México', 'Lucha libre na Arena México', 'other', ['nightlife', 'culture'], true, [10, 35], 19.4247, -99.152],
        ['cdmx-xochimilco', 'A trajinera in Xochimilco', 'Uma trajinera em Xochimilco', 'sight', ['culture', 'nightlife'], false, [10, 30], 19.257, -99.103],
        ['cdmx-casa-azul', "Casa Azul, Frida Kahlo's house", 'A Casa Azul, de Frida Kahlo', 'sight', ['culture'], false, [15, 20], 19.3551, -99.1626],
      ]),
    },
    {
      key: 'tulum',
      name: 'Tulum',
      namePt: 'Tulum',
      countryCode: 'MX',
      region: 'Quintana Roo',
      latitude: 20.2114,
      longitude: -87.4654,
      nights: 3,
      minNights: 2,
      priority: 1,
      daily: {
        budget: { stay: [20, 40], food: [18, 35], local: [4, 10] },
        comfort: { stay: [120, 250], food: [45, 90], local: [12, 25] },
      },
      // prettier-ignore
      experiences: experiences([
        ['tulum-gran-cenote', 'Swimming in the Gran Cenote', 'Nadar no Gran Cenote', 'sight', ['nature', 'adrenaline'], false, [20, 30], 20.246, -87.464],
        ['tulum-ruins', 'The Tulum ruins above the sea', 'As ruínas de Tulum sobre o mar', 'sight', ['culture'], false, [5, 10], 20.215, -87.429],
        ['tulum-sian-kaan', "Sian Ka'an by boat", "Sian Ka'an de barco", 'sight', ['nature'], true, [60, 110], 19.83, -87.56],
        ['tulum-dos-ojos', 'Snorkelling or cave diving at Dos Ojos', 'Snorkel ou mergulho em caverna em Dos Ojos', 'sight', ['adrenaline', 'nature'], true, [30, 150], 20.327, -87.391],
        ['tulum-cochinita', 'Cochinita pibil at a local taquería', 'Cochinita pibil numa taquería local', 'food', ['food'], true, [5, 12], 20.211, -87.465],
      ]),
    },
  ],
  legs: [{ mode: 'flight', cost: [60, 180] }],
};

const PARIS: SuggestedDestination = {
  id: 'paris',
  name: 'Paris',
  namePt: 'Paris',
  slug: 'paris',
  slugPt: 'paris',
  stops: [
    {
      key: 'paris',
      name: 'Paris',
      namePt: 'Paris',
      countryCode: 'FR',
      region: 'Île-de-France',
      latitude: 48.8566,
      longitude: 2.3522,
      nights: 5,
      minNights: 3,
      priority: 1,
      daily: {
        budget: { stay: [38, 55], food: [27, 45], local: [5, 10] },
        comfort: { stay: [160, 280], food: [50, 100], local: [8, 15] },
      },
      // prettier-ignore
      experiences: experiences([
        ['paris-louvre', 'The Louvre', 'O Louvre', 'sight', ['culture'], false, [24, 30], 48.8606, 2.3376],
        ['paris-canal', 'A picnic by the Canal Saint-Martin', 'Um piquenique no Canal Saint-Martin', 'food', ['food', 'nightlife'], true, [10, 20], 48.872, 2.365],
        ['paris-catacombs', 'The Catacombs', 'As Catacumbas', 'sight', ['culture', 'adrenaline'], false, [30, 35], 48.8338, 2.3324],
        ['paris-belleville', 'Street art and bars in Belleville', 'Arte de rua e bares em Belleville', 'other', ['nightlife', 'culture'], true, [0, 30], 48.872, 2.377],
        ['paris-versailles', 'Versailles by bike', 'Versalhes de bicicleta', 'sight', ['culture', 'nature'], false, [30, 60], 48.8049, 2.1204],
        ['paris-aligre', "The Marché d'Aligre and a cheese shop", "O Marché d'Aligre e uma queijaria", 'food', ['food'], true, [10, 25], 48.849, 2.378],
      ]),
    },
  ],
  legs: [],
};

const NEW_YORK: SuggestedDestination = {
  id: 'new-york',
  name: 'New York',
  namePt: 'Nova York',
  slug: 'new-york',
  slugPt: 'nova-york',
  stops: [
    {
      key: 'new-york',
      name: 'New York',
      namePt: 'Nova York',
      countryCode: 'US',
      region: 'New York',
      latitude: 40.7128,
      longitude: -74.006,
      nights: 5,
      minNights: 3,
      priority: 1,
      daily: {
        budget: { stay: [55, 90], food: [25, 45], local: [6, 10] },
        comfort: { stay: [220, 380], food: [60, 120], local: [10, 25] },
      },
      // prettier-ignore
      experiences: experiences([
        ['nyc-high-line', 'The High Line and Chelsea Market', 'A High Line e o Chelsea Market', 'sight', ['culture', 'food'], false, [0, 25], 40.748, -74.0048],
        ['nyc-met', 'The Met', 'O Met', 'sight', ['culture'], false, [25, 30], 40.7794, -73.9632],
        ['nyc-harlem-jazz', 'Late jazz in a Harlem club', 'Jazz tarde da noite num clube do Harlem', 'other', ['nightlife', 'culture'], true, [15, 40], 40.8116, -73.9465],
        ['nyc-ferry', 'The Staten Island Ferry at sunset', 'A balsa de Staten Island ao pôr do sol', 'sight', ['nature'], true, [0, 0], 40.7013, -74.0132],
        ['nyc-slices', 'A pizza slice crawl in Brooklyn', 'Um roteiro de pizza no Brooklyn', 'food', ['food'], true, [10, 20], 40.715, -73.957],
        ['nyc-kayak', 'Free kayaking on the Hudson (summer)', 'Caiaque grátis no Hudson (verão)', 'sight', ['adrenaline', 'nature'], true, [0, 0], 40.7278, -74.0118],
      ]),
    },
  ],
  legs: [],
};

export const SUGGESTED_DESTINATIONS: readonly SuggestedDestination[] = [
  JAPAN,
  PORTUGAL,
  RIO_DE_LA_PLATA,
  ITALY,
  CHILE,
  MEXICO,
  PARIS,
  NEW_YORK,
];

export function suggestedDestination(id: string): SuggestedDestination | null {
  return SUGGESTED_DESTINATIONS.find((destination) => destination.id === id) ?? null;
}

/** The destination behind a public itinerary address, in either language. */
export function destinationBySlug(
  slug: string,
  language: 'en' | 'pt',
): SuggestedDestination | null {
  return (
    SUGGESTED_DESTINATIONS.find(
      (destination) => (language === 'pt' ? destination.slugPt : destination.slug) === slug,
    ) ?? null
  );
}
