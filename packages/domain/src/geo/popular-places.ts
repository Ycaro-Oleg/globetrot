/**
 * Popular travel destinations, built in: one-tap choices in onboarding, and the fallback for place search when the
 * provider is not configured or does not answer. City centres, rounded to about a kilometre; names in English and
 * Portuguese. Hand-curated, so it never pretends to be a full gazetteer.
 */

export interface PopularPlace {
  /** Stable key, used as the stop's `placeKey`. */
  readonly key: string;
  readonly en: string;
  readonly pt: string;
  readonly countryCode: string;
  readonly latitude: number;
  readonly longitude: number;
}

type Row = readonly [en: string, pt: string, cc: string, lat: number, lon: number];

const ROWS: readonly Row[] = [
  ['Lisbon', 'Lisboa', 'PT', 38.7223, -9.1393],
  ['Porto', 'Porto', 'PT', 41.1579, -8.6291],
  ['Madrid', 'Madri', 'ES', 40.4168, -3.7038],
  ['Barcelona', 'Barcelona', 'ES', 41.3874, 2.1686],
  ['Seville', 'Sevilha', 'ES', 37.3891, -5.9845],
  ['Paris', 'Paris', 'FR', 48.8566, 2.3522],
  ['Nice', 'Nice', 'FR', 43.7102, 7.262],
  ['London', 'Londres', 'GB', 51.5074, -0.1278],
  ['Edinburgh', 'Edimburgo', 'GB', 55.9533, -3.1883],
  ['Dublin', 'Dublin', 'IE', 53.3498, -6.2603],
  ['Amsterdam', 'Amsterdã', 'NL', 52.3676, 4.9041],
  ['Brussels', 'Bruxelas', 'BE', 50.8503, 4.3517],
  ['Berlin', 'Berlim', 'DE', 52.52, 13.405],
  ['Munich', 'Munique', 'DE', 48.1351, 11.582],
  ['Vienna', 'Viena', 'AT', 48.2082, 16.3738],
  ['Prague', 'Praga', 'CZ', 50.0755, 14.4378],
  ['Budapest', 'Budapeste', 'HU', 47.4979, 19.0402],
  ['Zurich', 'Zurique', 'CH', 47.3769, 8.5417],
  ['Rome', 'Roma', 'IT', 41.9028, 12.4964],
  ['Florence', 'Florença', 'IT', 43.7696, 11.2558],
  ['Venice', 'Veneza', 'IT', 45.4408, 12.3155],
  ['Milan', 'Milão', 'IT', 45.4642, 9.19],
  ['Naples', 'Nápoles', 'IT', 40.8518, 14.2681],
  ['Athens', 'Atenas', 'GR', 37.9838, 23.7275],
  ['Santorini', 'Santorini', 'GR', 36.3932, 25.4615],
  ['Istanbul', 'Istambul', 'TR', 41.0082, 28.9784],
  ['Copenhagen', 'Copenhague', 'DK', 55.6761, 12.5683],
  ['Stockholm', 'Estocolmo', 'SE', 59.3293, 18.0686],
  ['Oslo', 'Oslo', 'NO', 59.9139, 10.7522],
  ['Reykjavik', 'Reykjavík', 'IS', 64.1466, -21.9426],
  ['Dubrovnik', 'Dubrovnik', 'HR', 42.6507, 18.0944],
  ['Marrakech', 'Marrakech', 'MA', 31.6295, -7.9811],
  ['Cairo', 'Cairo', 'EG', 30.0444, 31.2357],
  ['Cape Town', 'Cidade do Cabo', 'ZA', -33.9249, 18.4241],
  ['Dubai', 'Dubai', 'AE', 25.2048, 55.2708],
  ['Tokyo', 'Tóquio', 'JP', 35.6762, 139.6503],
  ['Kyoto', 'Quioto', 'JP', 35.0116, 135.7681],
  ['Osaka', 'Osaka', 'JP', 34.6937, 135.5023],
  ['Seoul', 'Seul', 'KR', 37.5665, 126.978],
  ['Beijing', 'Pequim', 'CN', 39.9042, 116.4074],
  ['Shanghai', 'Xangai', 'CN', 31.2304, 121.4737],
  ['Hong Kong', 'Hong Kong', 'HK', 22.3193, 114.1694],
  ['Singapore', 'Singapura', 'SG', 1.3521, 103.8198],
  ['Bangkok', 'Bangkok', 'TH', 13.7563, 100.5018],
  ['Phuket', 'Phuket', 'TH', 7.8804, 98.3923],
  ['Bali', 'Bali', 'ID', -8.4095, 115.1889],
  ['Hanoi', 'Hanói', 'VN', 21.0278, 105.8342],
  ['Ho Chi Minh City', 'Cidade de Ho Chi Minh', 'VN', 10.8231, 106.6297],
  ['Delhi', 'Délhi', 'IN', 28.6139, 77.209],
  ['Mumbai', 'Mumbai', 'IN', 19.076, 72.8777],
  ['Maldives', 'Maldivas', 'MV', 4.1755, 73.5093],
  ['Sydney', 'Sydney', 'AU', -33.8688, 151.2093],
  ['Melbourne', 'Melbourne', 'AU', -37.8136, 144.9631],
  ['Auckland', 'Auckland', 'NZ', -36.8485, 174.7633],
  ['Queenstown', 'Queenstown', 'NZ', -45.0312, 168.6626],
  ['New York', 'Nova York', 'US', 40.7128, -74.006],
  ['Orlando', 'Orlando', 'US', 28.5383, -81.3792],
  ['Miami', 'Miami', 'US', 25.7617, -80.1918],
  ['Las Vegas', 'Las Vegas', 'US', 36.1699, -115.1398],
  ['Los Angeles', 'Los Angeles', 'US', 34.0522, -118.2437],
  ['San Francisco', 'São Francisco', 'US', 37.7749, -122.4194],
  ['Chicago', 'Chicago', 'US', 41.8781, -87.6298],
  ['Washington', 'Washington', 'US', 38.9072, -77.0369],
  ['Boston', 'Boston', 'US', 42.3601, -71.0589],
  ['New Orleans', 'Nova Orleans', 'US', 29.9511, -90.0715],
  ['Honolulu', 'Honolulu', 'US', 21.3069, -157.8583],
  ['Toronto', 'Toronto', 'CA', 43.6532, -79.3832],
  ['Vancouver', 'Vancouver', 'CA', 49.2827, -123.1207],
  ['Montreal', 'Montreal', 'CA', 45.5019, -73.5674],
  ['Mexico City', 'Cidade do México', 'MX', 19.4326, -99.1332],
  ['Cancún', 'Cancún', 'MX', 21.1619, -86.8515],
  ['Havana', 'Havana', 'CU', 23.1136, -82.3666],
  ['Punta Cana', 'Punta Cana', 'DO', 18.582, -68.4055],
  ['Cartagena', 'Cartagena', 'CO', 10.391, -75.4794],
  ['Bogotá', 'Bogotá', 'CO', 4.711, -74.0721],
  ['Lima', 'Lima', 'PE', -12.0464, -77.0428],
  ['Cusco', 'Cusco', 'PE', -13.5319, -71.9675],
  ['Quito', 'Quito', 'EC', -0.1807, -78.4678],
  ['Santiago', 'Santiago', 'CL', -33.4489, -70.6693],
  ['San Pedro de Atacama', 'San Pedro de Atacama', 'CL', -22.9087, -68.1997],
  ['Buenos Aires', 'Buenos Aires', 'AR', -34.6037, -58.3816],
  ['Bariloche', 'Bariloche', 'AR', -41.1335, -71.3103],
  ['Mendoza', 'Mendoza', 'AR', -32.8895, -68.8458],
  ['Ushuaia', 'Ushuaia', 'AR', -54.8019, -68.303],
  ['Montevideo', 'Montevidéu', 'UY', -34.9011, -56.1645],
  ['Punta del Este', 'Punta del Este', 'UY', -34.9667, -54.95],
  ['Colonia del Sacramento', 'Colonia del Sacramento', 'UY', -34.4626, -57.8398],
  ['Rio de Janeiro', 'Rio de Janeiro', 'BR', -22.9068, -43.1729],
  ['São Paulo', 'São Paulo', 'BR', -23.5505, -46.6333],
  ['Salvador', 'Salvador', 'BR', -12.9777, -38.5016],
  ['Florianópolis', 'Florianópolis', 'BR', -27.5954, -48.548],
  ['Foz do Iguaçu', 'Foz do Iguaçu', 'BR', -25.5163, -54.5854],
  ['Gramado', 'Gramado', 'BR', -29.3734, -50.8762],
  ['Fernando de Noronha', 'Fernando de Noronha', 'BR', -3.8547, -32.4247],
  ['Recife', 'Recife', 'BR', -8.0476, -34.877],
  ['Fortaleza', 'Fortaleza', 'BR', -3.7319, -38.5267],
  ['Natal', 'Natal', 'BR', -5.7945, -35.211],
  ['Maceió', 'Maceió', 'BR', -9.6498, -35.7089],
  ['Porto de Galinhas', 'Porto de Galinhas', 'BR', -8.5047, -35.0047],
  ['Jericoacoara', 'Jericoacoara', 'BR', -2.7956, -40.5137],
  ['Bonito', 'Bonito', 'BR', -21.1261, -56.4836],
  ['Manaus', 'Manaus', 'BR', -3.119, -60.0217],
  ['Belo Horizonte', 'Belo Horizonte', 'BR', -19.9167, -43.9345],
  ['Ouro Preto', 'Ouro Preto', 'BR', -20.3856, -43.5035],
  ['Curitiba', 'Curitiba', 'BR', -25.4284, -49.2733],
  ['Brasília', 'Brasília', 'BR', -15.7939, -47.8828],
  ['Paraty', 'Paraty', 'BR', -23.2178, -44.7131],
  ['Búzios', 'Búzios', 'BR', -22.7469, -41.8817],
];

const slug = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const POPULAR_PLACES: readonly PopularPlace[] = ROWS.map(([en, pt, cc, lat, lon]) => ({
  key: `gt:${slug(en)}`,
  en,
  pt,
  countryCode: cc,
  latitude: lat,
  longitude: lon,
}));

/** The one-tap choices onboarding offers first, by language. */
export const POPULAR_PICKS: Readonly<Record<'en' | 'pt-BR', readonly string[]>> = {
  en: [
    'gt:paris',
    'gt:tokyo',
    'gt:rome',
    'gt:lisbon',
    'gt:new-york',
    'gt:london',
    'gt:barcelona',
    'gt:bali',
  ],
  'pt-BR': [
    'gt:lisbon',
    'gt:paris',
    'gt:orlando',
    'gt:buenos-aires',
    'gt:rome',
    'gt:santiago',
    'gt:cancun',
    'gt:tokyo',
  ],
};

const fold = (text: string) => text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Places whose English or Portuguese name matches the query (accents and case ignored); prefix matches first. */
export function searchPopularPlaces(query: string, limit = 8): PopularPlace[] {
  const q = fold(query);
  if (q.length < 2) return [];
  const scored = POPULAR_PLACES.flatMap((place) => {
    const names = [fold(place.en), fold(place.pt)];
    if (names.some((name) => name.startsWith(q))) return [{ place, score: 0 }];
    if (names.some((name) => name.includes(q))) return [{ place, score: 1 }];
    return [];
  });
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((entry) => entry.place);
}

export const popularPlaceByKey = (key: string) => POPULAR_PLACES.find((place) => place.key === key);
