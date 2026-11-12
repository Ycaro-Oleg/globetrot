import type { Map as MapLibreMap } from 'maplibre-gl';

/** Style expressions are built at runtime; MapLibre validates them, so they are passed loosely typed here. */
type Loose = (layer: string, key: string, value: unknown) => void;
const setPaint = (map: MapLibreMap): Loose => map.setPaintProperty.bind(map) as unknown as Loose;
const setLayout = (map: MapLibreMap): Loose => map.setLayoutProperty.bind(map) as unknown as Loose;

/**
 * The board's map styles (design handoff v2, "Map styles"). The base vector style is recoloured at runtime by
 * layer id, so one tile source serves every style. Atlas is the default.
 */
export const MAP_STYLES = ['atlas', 'terrain', 'slate'] as const;
export type MapStyleName = (typeof MAP_STYLES)[number];

type Palette = {
  sea: string;
  seaLine: string;
  land: string;
  landuse: string;
  park: string;
  building: string;
  road: string;
  roadMajor: string;
  casing: string;
  border: string;
  stateBorder: string;
  ink: string;
  countryInk: string;
  stateInk: string;
  waterLabel: string;
  ice: string;
};

export const PALETTES: Record<MapStyleName, Palette> = {
  atlas: {
    sea: '#9BD4EE',
    seaLine: '#79C2E2',
    land: '#FAF6EE',
    landuse: '#F4EEE2',
    park: '#CDEBC5',
    building: '#ECE4D6',
    road: '#FFFFFF',
    roadMajor: '#FFFFFF',
    casing: '#E3D9C6',
    border: '#FFFFFF',
    stateBorder: '#C9BFAE',
    ink: '#1E293B',
    countryInk: '#334155',
    stateInk: '#64748B',
    waterLabel: '#1E6A8C',
    ice: '#FFFFFF',
  },
  terrain: {
    sea: '#5BBCE4',
    seaLine: '#3FA3CF',
    land: '#F1E7D3',
    landuse: '#ECE0C8',
    park: '#9ED39A',
    building: '#E6D9C1',
    road: '#FFFDF8',
    roadMajor: '#FFF4D6',
    casing: '#D8C8A8',
    border: '#8B6F4E',
    stateBorder: '#BFA886',
    ink: '#3B2F24',
    countryInk: '#5B4632',
    stateInk: '#8B6F4E',
    waterLabel: '#0B5A7A',
    ice: '#FFFFFF',
  },
  slate: {
    sea: '#1E293B',
    seaLine: '#4C5768',
    land: '#F1F3F5',
    landuse: '#E8EBEE',
    park: '#D7DCE1',
    building: '#DADEE3',
    road: '#F8F9FA',
    roadMajor: '#FFFFFF',
    casing: '#C9CED5',
    border: '#253041',
    stateBorder: '#8A94A3',
    ink: '#0F172A',
    countryInk: '#1E293B',
    stateInk: '#5A6678',
    waterLabel: '#AEB8C6',
    ice: '#F8F9FA',
  },
};

/** Four swatches per style, for the legend's style picker. */
export const SWATCHES: Record<MapStyleName, [string, string, string, string]> = {
  atlas: ['#9BD4EE', '#FDE3C4', '#D3F0DE', '#D6E4FB'],
  terrain: ['#5BBCE4', '#F1E7D3', '#9ED39A', '#8B6F4E'],
  slate: ['#1E293B', '#F1F3F5', '#3B82F6', '#F59E0B'],
};

/** Natural Earth MAPCOLOR7 groups, filled with seven pastels on Atlas. */
export const ATLAS_FILLS = [
  '#FDE3C4',
  '#D3F0DE',
  '#D6E4FB',
  '#F7D9E8',
  '#E4DDFA',
  '#FFF0B8',
  '#CFEFF2',
];

export const PIN = {
  planned: '#F59E0B',
  selected: '#EF4444',
  visited: '#10B981',
  ink: '#0F172A',
  route: '#3B82F6',
  comet: [6, 182, 212] as const,
};

/** Layer ids whose features are points of interest (used for "Nearby"). Filled in by `restyle`. */
export function restyle(map: MapLibreMap, name: MapStyleName): string[] {
  const P = PALETTES[name];
  const poiLayers: string[] = [];
  for (const layer of map.getStyle().layers ?? []) {
    const id = layer.id;
    if (id.startsWith('gt-')) continue;
    const paint = (key: string, value: unknown) => {
      try {
        setPaint(map)(id, key, value);
      } catch {
        /* Not every layer accepts every property. */
      }
    };
    const layout = (key: string, value: unknown) => {
      try {
        setLayout(map)(id, key, value);
      } catch {
        /* Same. */
      }
    };
    if (layer.type === 'background') paint('background-color', P.land);
    else if (layer.type === 'fill') {
      if ((layer.paint as Record<string, unknown> | undefined)?.['fill-pattern'])
        paint('fill-pattern', undefined);
      if (/water|ocean|sea/.test(id)) paint('fill-color', P.sea);
      else if (/building/.test(id)) {
        paint('fill-color', P.building);
        paint('fill-outline-color', P.casing);
      } else if (/park|wood|forest|grass|wetland|landcover|green|cemetery|garden|pitch/.test(id))
        paint('fill-color', P.park);
      else if (/ice|glacier|sand/.test(id)) paint('fill-color', P.ice);
      else paint('fill-color', P.landuse);
    } else if (['fill-extrusion', 'raster', 'hillshade'].includes(layer.type)) {
      layout('visibility', 'none');
    } else if (layer.type === 'line') {
      if (/water|river|canal|stream|ditch|drain/.test(id)) paint('line-color', P.seaLine);
      else if (/boundary|admin/.test(id)) {
        const country = /_2|-2|country|disputed/.test(id) && !/_3|_4|-3|-4|state/.test(id);
        paint('line-color', country ? P.border : P.stateBorder);
        if (country) {
          paint('line-width', ['interpolate', ['linear'], ['zoom'], 1, 0.7, 4, 1.3, 10, 2.4]);
          paint('line-opacity', 0.85);
        }
      } else if (/casing/.test(id)) paint('line-color', P.casing);
      else if (/rail|transit|aeroway/.test(id)) paint('line-color', P.casing);
      else if (
        /road|highway|street|bridge|tunnel|path|motorway|trunk|primary|secondary|tertiary|minor|service|track|pier/.test(
          id,
        )
      )
        paint('line-color', /motorway|trunk|primary/.test(id) ? P.roadMajor : P.road);
    } else if (layer.type === 'symbol') {
      const water = /water|ocean|sea|lake|river|marine/.test(id);
      const country = /country/.test(id);
      const state = /state/.test(id);
      paint(
        'text-color',
        water ? P.waterLabel : country ? P.countryInk : state ? P.stateInk : P.ink,
      );
      paint('text-halo-color', water ? P.sea : P.land);
      paint('text-halo-width', 1.4);
      if (country || state) {
        layout('text-transform', 'uppercase');
        layout('text-letter-spacing', country ? 0.16 : 0.12);
      }
      if (/^poi/.test(id)) poiLayers.push(id);
    }
  }
  return poiLayers;
}

/** Labels in the reader's language, then a Latin spelling, then the local name. */
export function relabel(map: MapLibreMap, locale: string) {
  const lang = locale.split('-')[0]!;
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'symbol' || layer.id.startsWith('gt-')) continue;
    if (/shield|housenumber|ref|oneway/.test(layer.id)) continue;
    if (!(layer.layout as Record<string, unknown> | undefined)?.['text-field']) continue;
    try {
      setLayout(map)(layer.id, 'text-field', [
        'coalesce',
        ['get', `name:${lang}`],
        ['get', 'name:latin'],
        ['get', 'name'],
      ]);
    } catch {
      /* Keep the style's own label. */
    }
  }
}

/** Country fills: trip and visited countries tinted in every style; Atlas also colours the rest. */
export function styleCountries(
  map: MapLibreMap,
  name: MapStyleName,
  trip: readonly string[],
  visited: readonly string[],
) {
  if (!map.getLayer('gt-countries-fill')) return;
  const iso = ['get', 'iso'];
  const list = (codes: readonly string[]) => ['literal', codes.length ? [...codes] : ['__']];
  const F = ATLAS_FILLS;
  setPaint(map)('gt-countries-fill', 'fill-color', [
    'case',
    ['in', iso, list(visited)],
    '#B7F0CF',
    ['in', iso, list(trip)],
    '#B9CCFF',
    ['match', ['get', 'c'], 1, F[0], 2, F[1], 3, F[2], 4, F[3], 5, F[4], 6, F[5], 7, F[6], F[0]],
  ]);
  setPaint(map)(
    'gt-countries-fill',
    'fill-opacity',
    name === 'atlas'
      ? ['interpolate', ['linear'], ['zoom'], 2, 1, 4, 0.8, 5.5, 0]
      : [
          'case',
          ['in', iso, list([...trip, ...visited])],
          ['interpolate', ['linear'], ['zoom'], 2, 0.8, 4, 0.5, 5.5, 0],
          0,
        ],
  );
}
