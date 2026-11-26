/** Two places on Earth, in degrees. */
export interface LatLng {
  readonly latitude: number;
  readonly longitude: number;
}

/** The great-circle distance in kilometres ("as the crow flies"), on a sphere of 6,371 km. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
