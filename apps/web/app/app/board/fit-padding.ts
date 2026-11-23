export interface Padding {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/**
 * Shrinks the camera padding so the route always has room on the map. Panels and the phone sheet can cover more
 * than the map's height while the page settles; MapLibre then refuses to fit ("Map cannot fit within canvas") and
 * the map stays wherever it was. Each pair (top and bottom, left and right) is scaled down together, so the
 * route still sits clear of the panels, leaving at least `keep` of the size (and `min` pixels) for the route.
 */
export function fitPadding(
  padding: Padding,
  width: number,
  height: number,
  { keep = 0.2, min = 80 } = {},
): Padding {
  const pair = (a: number, b: number, size: number): [number, number] => {
    if (size <= 0) return [a, b];
    const room = Math.max(0, size - Math.max(min, size * keep));
    const total = a + b;
    if (total <= room) return [a, b];
    const scale = total > 0 ? room / total : 0;
    return [Math.floor(a * scale), Math.floor(b * scale)];
  };
  const [top, bottom] = pair(padding.top, padding.bottom, height);
  const [left, right] = pair(padding.left, padding.right, width);
  return { top, right, bottom, left };
}
