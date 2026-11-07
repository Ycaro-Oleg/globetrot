// Poster-style MapLibre style from the Globetrot tokens (design/reference/claude-design-v1/README.md).
import { layers, namedFlavor, type Flavor } from '@protomaps/basemaps';
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';

export type Theme = 'day' | 'night';

interface Palette {
  sea: string;
  sea2: string; // land shadow
  land: string; // non-trip land
  landhi: string; // trip country land
  ink: string; // coastline
  label: string;
  halo: string;
  road: string;
  park: string;
}

export const PALETTES: Record<Theme, Palette> = {
  day: { sea: '#2B45C4', sea2: '#1E3196', land: '#C9D3F4', landhi: '#FFF5E1', ink: '#1D1A35', label: '#1D1A35', halo: '#FFF5E1', road: '#FFFFFF', park: '#E8EEC9' },
  night: { sea: '#22359F', sea2: '#16226E', land: '#3B3A7A', landhi: '#FFF5E1', ink: '#0C0A1A', label: '#1D1A35', halo: '#FFF5E1', road: '#FFFFFF', park: '#E6E9C2' },
};

function flavor(p: Palette, earth: string): Flavor {
  const base = namedFlavor('light');
  const muted = earth;
  return {
    ...base,
    background: p.sea,
    earth,
    water: p.sea,
    park_a: p.park, park_b: p.park, wood_a: p.park, wood_b: p.park, scrub_a: muted, scrub_b: muted,
    glacier: '#FFFFFF', sand: muted, beach: muted, aerodrome: muted, runway: muted, zoo: muted, military: muted,
    hospital: muted, industrial: muted, school: muted, pedestrian: muted, pier: muted, buildings: muted,
    other: p.road, minor_service: p.road, minor_a: p.road, minor_b: p.road, link: p.road, major: p.road, highway: p.road,
    railway: '#B9B4CC', boundaries: p.ink,
    city_label: p.label, city_label_halo: p.halo, state_label: '#58536F', state_label_halo: p.halo,
    country_label: p.label, ocean_label: '#FFF5E1', subplace_label: '#58536F', subplace_label_halo: p.halo,
    roads_label_minor: '#58536F', roads_label_minor_halo: p.halo, roads_label_major: '#58536F', roads_label_major_halo: p.halo,
    address_label: '#58536F', address_label_halo: p.halo,
  };
}

/** Basemap layers for one source, filtered to keep the poster look (no POIs, no buildings, no landcover noise). */
function basemap(source: string, f: Flavor, zoom: { min?: number; max?: number }, withLabels: boolean): LayerSpecification[] {
  const drop = /pois|buildings|landcover|address|roads_labels|landuse_(hospital|industrial|school|pedestrian)/;
  return layers(source, f, { lang: 'en' })
    .filter((l) => !drop.test(l.id))
    .filter((l) => withLabels || l.type !== 'symbol')
    .map((l) => ({
      ...l,
      id: `${source}-${l.id}`,
      ...(zoom.min !== undefined ? { minzoom: Math.max(zoom.min, l.minzoom ?? 0) } : {}),
      ...(zoom.max !== undefined ? { maxzoom: Math.min(zoom.max, l.maxzoom ?? 24) } : {}),
    })) as LayerSpecification[];
}

/** Land shadow (offset fill in sea2) + ink coastline, inserted around the earth fill. */
function poster(source: string, p: Palette, zoom: { min?: number; max?: number }): { under: LayerSpecification[]; over: LayerSpecification[] } {
  const z = { ...(zoom.min !== undefined ? { minzoom: zoom.min } : {}), ...(zoom.max !== undefined ? { maxzoom: zoom.max } : {}) };
  return {
    under: [
      {
        id: `${source}-land-shadow`, type: 'fill', source, 'source-layer': 'earth', ...z,
        paint: { 'fill-color': p.sea2, 'fill-translate': ['interpolate', ['linear'], ['zoom'], 1, ['literal', [1.5, 2]], 6, ['literal', [4, 5]]], 'fill-antialias': false },
      },
    ],
    over: [
      {
        id: `${source}-coast-ink`, type: 'line', source, 'source-layer': 'earth', ...z,
        paint: { 'line-color': p.ink, 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.8, 5, 1.6, 8, 2.2] },
        layout: { 'line-join': 'round' },
      },
    ],
  };
}

export const TILE_URLS = { world: 'pmtiles:///tiles/world-z5.pmtiles', region: 'pmtiles:///tiles/japan-z10.pmtiles' };

/**
 * Two PMTiles sources stand in for the single planet file used in production:
 * `world` (z0–5) draws everywhere up to z6; `region` (Japan, z0–10) draws from z4.
 * Trip-country highlight: Natural Earth 50m polygon at low zoom; region land is cream.
 */
export function buildStyle(theme: Theme, tripCountries: GeoJSON.FeatureCollection): StyleSpecification {
  const p = PALETTES[theme];
  const worldF = flavor(p, p.land);
  const regionF = flavor(p, p.landhi);

  const world = basemap('world', worldF, { max: 6 }, false);
  const region = basemap('region', regionF, { min: 4 }, true);
  const wp = poster('world', p, { max: 6 });
  const rp = poster('region', p, { min: 4 });

  const insertAround = (ls: LayerSpecification[], extra: { under: LayerSpecification[]; over: LayerSpecification[] }) => {
    const i = ls.findIndex((l) => l.id.endsWith('-earth'));
    if (i < 0) return [...extra.under, ...ls, ...extra.over];
    // Coast ink goes right after the first water layer so roads and labels stay on top.
    const water = ls.findIndex((l, j) => j > i && l.id.endsWith('-water'));
    const after = water > 0 ? water : i;
    return [...ls.slice(0, i), ...extra.under, ...ls.slice(i, after + 1), ...extra.over, ...ls.slice(after + 1)];
  };

  return {
    version: 8,
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/light',
    projection: { type: 'globe' },
    sources: {
      world: { type: 'vector', url: TILE_URLS.world, attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors · <a href="https://protomaps.com">Protomaps</a>' },
      region: { type: 'vector', url: TILE_URLS.region },
      trip: { type: 'geojson', data: tripCountries },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': p.sea } },
      ...insertAround(world, wp),
      {
        id: 'trip-country', type: 'fill', source: 'trip', maxzoom: 5.5,
        paint: { 'fill-color': p.landhi, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 4.5, 1, 5.5, 0] },
      },
      ...insertAround(region, rp),
    ],
  };
}
