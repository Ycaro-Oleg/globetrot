/**
 * A route as points in a box, for small drawings (the shared trip page and its social image): an equirectangular
 * projection fitted to the stops with a margin, so one city sits in the middle and a world tour fills the box.
 */
export interface SketchStop {
  readonly latitude: number;
  readonly longitude: number;
}

export function routeSketch(
  stops: readonly SketchStop[],
  width: number,
  height: number,
  margin = 40,
): { x: number; y: number }[] {
  if (stops.length === 0) return [];
  const xs = stops.map((stop) => stop.longitude);
  const ys = stops.map((stop) => -stop.latitude);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  const scale = Math.min((width - 2 * margin) / spanX, (height - 2 * margin) / spanY);
  const single = maxX - minX < 1e-6 && maxY - minY < 1e-6;
  const offsetX = (width - (single ? 0 : spanX * scale)) / 2;
  const offsetY = (height - (single ? 0 : spanY * scale)) / 2;
  return stops.map((stop) => ({
    x: Math.round((single ? 0 : (stop.longitude - minX) * scale) + offsetX),
    y: Math.round((single ? 0 : (-stop.latitude - minY) * scale) + offsetY),
  }));
}

/** A gentle arc between two points (an airmail route), as an SVG path. */
export function arcPath(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2 - Math.max(20, Math.hypot(b.x - a.x, b.y - a.y) * 0.18);
  return `M${a.x} ${a.y} Q${Math.round(midX)} ${Math.round(midY)} ${b.x} ${b.y}`;
}
