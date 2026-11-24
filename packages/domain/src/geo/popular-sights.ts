/**
 * A few well-known sights for the cities people pick most in onboarding, so the Days screen can offer ideas even
 * when the places provider is not configured. Names only (no coordinates or opening facts to go stale), in English
 * and Portuguese, with the kind of visit and a typical time. Hand-curated; never presented as a complete list.
 */

export const SIGHT_KINDS = [
  'landmark',
  'museum',
  'park',
  'viewpoint',
  'neighbourhood',
  'market',
  'beach',
] as const;
export type SightKind = (typeof SIGHT_KINDS)[number];

/** Typical time a visit of each kind takes, in minutes: a starting point the person can change. */
export const SIGHT_MINUTES: Readonly<Record<SightKind, number>> = {
  landmark: 60,
  museum: 150,
  park: 90,
  viewpoint: 45,
  neighbourhood: 120,
  market: 75,
  beach: 180,
};

export interface PopularSight {
  readonly en: string;
  readonly pt: string;
  readonly kind: SightKind;
}

type Row = readonly [en: string, pt: string, kind: SightKind];

const BY_CITY: Readonly<Record<string, readonly Row[]>> = {
  'gt:paris': [
    ['Eiffel Tower', 'Torre Eiffel', 'landmark'],
    ['Louvre Museum', 'Museu do Louvre', 'museum'],
    ['Musée d’Orsay', 'Museu d’Orsay', 'museum'],
    ['Montmartre and Sacré-Cœur', 'Montmartre e Sacré-Cœur', 'neighbourhood'],
    ['Seine river walk', 'Passeio às margens do Sena', 'viewpoint'],
    ['Luxembourg Gardens', 'Jardim de Luxemburgo', 'park'],
  ],
  'gt:tokyo': [
    ['Senso-ji Temple', 'Templo Senso-ji', 'landmark'],
    ['Shibuya Crossing', 'Cruzamento de Shibuya', 'neighbourhood'],
    ['Meiji Shrine', 'Santuário Meiji', 'park'],
    ['Tsukiji Outer Market', 'Mercado Externo de Tsukiji', 'market'],
    ['Shinjuku Gyoen', 'Jardim Shinjuku Gyoen', 'park'],
    ['Tokyo Skytree', 'Tokyo Skytree', 'viewpoint'],
  ],
  'gt:rome': [
    ['Colosseum', 'Coliseu', 'landmark'],
    ['Roman Forum', 'Fórum Romano', 'landmark'],
    ['Vatican Museums', 'Museus do Vaticano', 'museum'],
    ['Pantheon', 'Panteão', 'landmark'],
    ['Trevi Fountain', 'Fontana di Trevi', 'landmark'],
    ['Trastevere', 'Trastevere', 'neighbourhood'],
  ],
  'gt:lisbon': [
    ['Belém Tower', 'Torre de Belém', 'landmark'],
    ['Jerónimos Monastery', 'Mosteiro dos Jerónimos', 'landmark'],
    ['Alfama', 'Alfama', 'neighbourhood'],
    ['São Jorge Castle', 'Castelo de São Jorge', 'viewpoint'],
    ['Time Out Market', 'Time Out Market', 'market'],
    ['Day trip to Sintra', 'Bate-volta a Sintra', 'landmark'],
  ],
  'gt:new-york': [
    ['Central Park', 'Central Park', 'park'],
    ['Statue of Liberty', 'Estátua da Liberdade', 'landmark'],
    ['The Metropolitan Museum of Art', 'Metropolitan Museum of Art', 'museum'],
    ['Brooklyn Bridge', 'Ponte do Brooklyn', 'landmark'],
    ['Top of the Rock', 'Top of the Rock', 'viewpoint'],
    ['The High Line', 'High Line', 'park'],
  ],
  'gt:london': [
    ['British Museum', 'Museu Britânico', 'museum'],
    ['Tower of London', 'Torre de Londres', 'landmark'],
    ['Westminster and Big Ben', 'Westminster e Big Ben', 'landmark'],
    ['Borough Market', 'Borough Market', 'market'],
    ['Hyde Park', 'Hyde Park', 'park'],
    ['Camden Town', 'Camden Town', 'neighbourhood'],
  ],
  'gt:barcelona': [
    ['Sagrada Família', 'Sagrada Família', 'landmark'],
    ['Park Güell', 'Park Güell', 'park'],
    ['Gothic Quarter', 'Bairro Gótico', 'neighbourhood'],
    ['La Boqueria', 'Mercado La Boqueria', 'market'],
    ['Casa Batlló', 'Casa Batlló', 'landmark'],
    ['Barceloneta Beach', 'Praia da Barceloneta', 'beach'],
  ],
  'gt:bali': [
    ['Ubud Monkey Forest', 'Floresta dos Macacos de Ubud', 'park'],
    ['Tegallalang Rice Terraces', 'Terraços de arroz de Tegallalang', 'viewpoint'],
    ['Uluwatu Temple', 'Templo de Uluwatu', 'landmark'],
    ['Tanah Lot', 'Tanah Lot', 'landmark'],
    ['Seminyak Beach', 'Praia de Seminyak', 'beach'],
    ['Ubud Art Market', 'Mercado de Arte de Ubud', 'market'],
  ],
  'gt:orlando': [
    ['Magic Kingdom', 'Magic Kingdom', 'landmark'],
    ['EPCOT', 'EPCOT', 'landmark'],
    ['Universal Studios', 'Universal Studios', 'landmark'],
    ['Kennedy Space Center', 'Kennedy Space Center', 'museum'],
    ['Disney Springs', 'Disney Springs', 'neighbourhood'],
    ['Lake Eola Park', 'Parque Lake Eola', 'park'],
  ],
  'gt:buenos-aires': [
    ['La Boca and Caminito', 'La Boca e Caminito', 'neighbourhood'],
    ['Recoleta Cemetery', 'Cemitério da Recoleta', 'landmark'],
    ['San Telmo Market', 'Mercado de San Telmo', 'market'],
    ['Teatro Colón', 'Teatro Colón', 'landmark'],
    ['Puerto Madero', 'Puerto Madero', 'neighbourhood'],
    ['A tango show', 'Um show de tango', 'landmark'],
  ],
  'gt:santiago': [
    ['Cerro San Cristóbal', 'Cerro San Cristóbal', 'viewpoint'],
    ['Plaza de Armas', 'Plaza de Armas', 'landmark'],
    ['Barrio Lastarria', 'Bairro Lastarria', 'neighbourhood'],
    ['Mercado Central', 'Mercado Central', 'market'],
    ['Sky Costanera', 'Sky Costanera', 'viewpoint'],
    ['Day trip to a Maipo Valley winery', 'Bate-volta a uma vinícola no Vale do Maipo', 'landmark'],
  ],
  'gt:cancun': [
    ['Playa Delfines', 'Playa Delfines', 'beach'],
    ['Isla Mujeres', 'Isla Mujeres', 'beach'],
    ['Chichén Itzá', 'Chichén Itzá', 'landmark'],
    ['A cenote swim', 'Um mergulho num cenote', 'park'],
    ['Underwater Museum of Art (MUSA)', 'Museu Subaquático de Arte (MUSA)', 'museum'],
    ['Tulum ruins', 'Ruínas de Tulum', 'landmark'],
  ],
};

/** The built-in sights for a stop made from a popular city (`gt:` key), or an empty list. */
export function popularSightsFor(placeKey: string): readonly PopularSight[] {
  return (BY_CITY[placeKey] ?? []).map(([en, pt, kind]) => ({ en, pt, kind }));
}

/** Every city that has built-in sights. */
export const CITIES_WITH_SIGHTS: readonly string[] = Object.keys(BY_CITY);
