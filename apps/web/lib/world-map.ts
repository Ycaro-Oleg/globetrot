import countries from '../public/geo/countries-110m.json';
import { projectWorld } from './projection';

type Ring = readonly (readonly [number, number])[];
type Feature = { geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown } };

let cached: string | null = null;

/**
 * Every country as one SVG path in the onboarding's world projection, simplified (points closer than a unit are
 * dropped), without Antarctica. Drawn on the server once per process.
 */
export function worldLandPath(): string {
  if (cached) return cached;
  const parts: string[] = [];
  for (const feature of (countries as unknown as { features: Feature[] }).features) {
    const polygons = (
      feature.geometry.type === 'Polygon'
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates
    ) as Ring[][];
    for (const polygon of polygons) {
      for (const ring of polygon) {
        // Antarctica sits below the map's southern edge: skip it rather than flatten it into a strip.
        if (ring.every(([, lat]) => lat < -55)) continue;
        let last: { x: number; y: number } | null = null;
        const points: string[] = [];
        for (const [lon, lat] of ring) {
          const point = projectWorld(lon, lat);
          if (last && Math.abs(point.x - last.x) < 1 && Math.abs(point.y - last.y) < 1) continue;
          last = point;
          points.push(`${Math.round(point.x)} ${Math.round(point.y)}`);
        }
        if (points.length > 2) parts.push(`M${points.join('L')}Z`);
      }
    }
  }
  cached = parts.join('');
  return cached;
}
