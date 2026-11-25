import countries from '../public/geo/countries-110m.json';

/**
 * The landing's demo map, drawn on the server: Europe from the Natural Earth countries the board already ships
 * (public/geo), in Web Mercator, as plain SVG paths. No map tiles, so a visitor costs nothing and sees the map
 * before any script runs.
 */

export const DEMO_CITY_KEYS = [
  'lisbon',
  'porto',
  'seville',
  'madrid',
  'barcelona',
  'nice',
  'milan',
  'rome',
  'paris',
  'london',
  'amsterdam',
  'berlin',
  'prague',
] as const;
export type DemoCityKey = (typeof DEMO_CITY_KEYS)[number];

const COORDINATES: Record<DemoCityKey, readonly [lon: number, lat: number]> = {
  lisbon: [-9.14, 38.72],
  porto: [-8.61, 41.15],
  seville: [-5.98, 37.39],
  madrid: [-3.7, 40.42],
  barcelona: [2.17, 41.39],
  nice: [7.27, 43.7],
  milan: [9.19, 45.46],
  rome: [12.5, 41.9],
  paris: [2.35, 48.86],
  london: [-0.13, 51.51],
  amsterdam: [4.9, 52.37],
  berlin: [13.4, 52.52],
  prague: [14.42, 50.08],
};

const BOX = { west: -11.5, east: 17.5, south: 35.2, north: 55 } as const;
export const DEMO_MAP_WIDTH = 1000;

const mercator = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const spanX = ((BOX.east - BOX.west) * Math.PI) / 180;
const spanY = mercator(BOX.north) - mercator(BOX.south);
export const DEMO_MAP_HEIGHT = Math.round((DEMO_MAP_WIDTH * spanY) / spanX);

function project(lon: number, lat: number) {
  return {
    x: ((lon - BOX.west) / (BOX.east - BOX.west)) * DEMO_MAP_WIDTH,
    y: ((mercator(BOX.north) - mercator(lat)) / spanY) * DEMO_MAP_HEIGHT,
  };
}

type Ring = readonly (readonly [number, number])[];
type Feature = {
  properties: { iso: string };
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
};

const near = ([lon, lat]: readonly [number, number]) =>
  lon > BOX.west - 12 && lon < BOX.east + 12 && lat > BOX.south - 10 && lat < BOX.north + 10;

function ringPath(ring: Ring): string {
  const points = ring.map(([lon, lat]) => {
    const { x, y } = project(lon, Math.max(-85, Math.min(85, lat)));
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  return `M${points.join('L')}Z`;
}

export interface DemoCity {
  readonly key: DemoCityKey;
  readonly lon: number;
  readonly lat: number;
  /** Position on the map, in percent of its width and height. */
  readonly left: number;
  readonly top: number;
  readonly x: number;
  readonly y: number;
}

export interface DemoMap {
  readonly width: number;
  readonly height: number;
  readonly countries: readonly { readonly iso: string; readonly d: string }[];
  readonly cities: readonly DemoCity[];
}

let cached: DemoMap | null = null;

/** The map once per server process: about 40 countries and the 13 demo cities. */
export function demoMap(): DemoMap {
  if (cached) return cached;
  const features = (countries as unknown as { features: Feature[] }).features;
  const shapes = features.flatMap((feature) => {
    const polygons = (
      feature.geometry.type === 'Polygon'
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates
    ) as Ring[][];
    const rings = polygons.flatMap((polygon) =>
      polygon.some((ring) => ring.some(near)) ? polygon : [],
    );
    return rings.length ? [{ iso: feature.properties.iso, d: rings.map(ringPath).join('') }] : [];
  });
  const cities = DEMO_CITY_KEYS.map((key) => {
    const [lon, lat] = COORDINATES[key];
    const { x, y } = project(lon, lat);
    return {
      key,
      lon,
      lat,
      x: Math.round(x),
      y: Math.round(y),
      left: +((x / DEMO_MAP_WIDTH) * 100).toFixed(2),
      top: +((y / DEMO_MAP_HEIGHT) * 100).toFixed(2),
    };
  });
  cached = { width: DEMO_MAP_WIDTH, height: DEMO_MAP_HEIGHT, countries: shapes, cities };
  return cached;
}
