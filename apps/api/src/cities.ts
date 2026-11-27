import type { CityIndexPort, PlaceResult } from '@globetrot/application';
import { POPULAR_PLACES } from '@globetrot/domain';
import data from './data/cities.json';

/** [id, name, ascii name or 0, country, region index or -1, latitude, longitude, population, other names?] */
type Row = [number, string, string | 0, string, number, number, number, number, string[]?];

const fold = (text: string) => text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

interface Entry {
  readonly row: Row;
  /** Folded names: the official one first, then the ASCII and other names. */
  readonly names: readonly string[];
}

/** Portuguese names Globetrot already knows for popular cities ("Nova York", "Tóquio"), by country and English name. */
const PT_NAMES = new Map(
  POPULAR_PLACES.map((place) => [`${place.countryCode}:${fold(place.en)}`, place.pt]),
);

/**
 * The built-in city index behind `CityIndexPort`: GeoNames' cities of 15 000 people or more (CC BY 4.0), loaded
 * once per process. A query matches the start of a name, accents and case ignored; exact names first, then the
 * most populous.
 */
export function createCityIndex(): CityIndexPort {
  const { regions, cities } = data as unknown as { regions: string[]; cities: Row[] };
  const entries: Entry[] = cities.map((row) => {
    const pt = PT_NAMES.get(`${row[3]}:${fold(row[1])}`);
    return {
      row,
      // Official and ASCII names first (index 0 and 1), then the Portuguese name Globetrot knows, then others.
      names: [row[1], row[2] || row[1], pt ?? row[1], ...(row[8] ?? [])].map(fold),
    };
  });

  return {
    search(query, { language, limit }) {
      const q = fold(query.split(',')[0] ?? '');
      if (q.length < 2) return [];
      const found: { entry: Entry; score: number }[] = [];
      for (const entry of entries) {
        const matched = entry.names.findIndex((name) => name.startsWith(q));
        if (matched === -1) continue;
        // Size matters most ("Pari", a district, must not beat Paris); an exact name helps a little. A nickname
        // only counts when typed in full ("Londres"), so "Pari" does not bring Warsaw ("Paris of the North").
        const exact = entry.names[matched] === q;
        const nickname = matched > 2;
        if (nickname && !exact) continue;
        const score =
          -Math.log10(Math.max(entry.row[7], 1000)) - (exact ? 0.7 : 0) + (nickname ? 0.4 : 0);
        found.push({ entry, score });
        if (found.length > 400) break;
      }
      return found
        .sort((a, b) => a.score - b.score)
        .slice(0, limit)
        .map(({ entry }) => toPlace(entry.row, regions, language));
    },
  };
}

function toPlace(row: Row, regions: string[], language: 'en' | 'pt-BR'): PlaceResult {
  const [id, name, , country, region, latitude, longitude] = row;
  // In Portuguese when Globetrot knows the city's Portuguese name ("Londres", "Tóquio"), else its own name.
  const pt = language === 'pt-BR' ? PT_NAMES.get(`${country}:${fold(name)}`) : undefined;
  return {
    key: `gn:${id}`,
    name: (pt ?? name).slice(0, 200),
    countryCode: country,
    region: region >= 0 ? (regions[region] ?? null) : null,
    latitude,
    longitude,
    attribution: 'GeoNames',
  };
}
