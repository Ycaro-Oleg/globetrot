/**
 * The world as the onboarding draws it: Web Mercator from 56°S to 78°N, 1000 units wide. Pure maths, safe on the
 * client: the server draws the countries with the same projection (lib/world-map.ts), the client places pins.
 */
export const WORLD = { west: -180, east: 180, south: -56, north: 78, width: 1000 } as const;

const mercator = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const spanY = mercator(WORLD.north) - mercator(WORLD.south);
export const WORLD_HEIGHT = Math.round((WORLD.width * spanY) / ((360 * Math.PI) / 180));

export function projectWorld(lon: number, lat: number) {
  const clamped = Math.max(WORLD.south, Math.min(WORLD.north, lat));
  return {
    x: ((lon - WORLD.west) / (WORLD.east - WORLD.west)) * WORLD.width,
    y: ((mercator(WORLD.north) - mercator(clamped)) / spanY) * WORLD_HEIGHT,
  };
}
