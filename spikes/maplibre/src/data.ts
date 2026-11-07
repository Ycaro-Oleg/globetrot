// Japan demo stops (from the prototype) + extra pins to reach the 50-pin target, + 500 POIs for the cluster test.
export interface PinData {
  id: string;
  name: string;
  sub?: string;
  ll: [number, number];
  kind: 'stop' | 'dream' | 'place';
  order?: number;
}

export const STOPS: PinData[] = [
  { id: 'tokyo', name: 'Tokyo', sub: '4 nights · 3–7 Apr', ll: [139.69, 35.69], kind: 'stop', order: 1 },
  { id: 'hakone', name: 'Hakone', sub: '1 night · 7–8 Apr', ll: [139.1, 35.23], kind: 'stop', order: 2 },
  { id: 'kyoto', name: 'Kyoto', sub: '3 nights · 8–11 Apr', ll: [135.77, 35.01], kind: 'stop', order: 3 },
  { id: 'osaka', name: 'Osaka', sub: '2 nights · 11–13 Apr', ll: [135.5, 34.69], kind: 'stop', order: 4 },
];

const PLACES: [string, number, number][] = [
  ['Sapporo', 141.35, 43.06], ['Hakodate', 140.73, 41.77], ['Aomori', 140.74, 40.82], ['Sendai', 140.87, 38.27],
  ['Nikko', 139.6, 36.75], ['Kamakura', 139.55, 35.32], ['Yokohama', 139.64, 35.44], ['Nagano', 138.19, 36.65],
  ['Kanazawa', 136.66, 36.56], ['Takayama', 137.25, 36.14], ['Shirakawa-go', 136.9, 36.26], ['Nagoya', 136.91, 35.18],
  ['Ise', 136.73, 34.49], ['Nara', 135.8, 34.68], ['Kobe', 135.19, 34.69], ['Himeji', 134.69, 34.82],
  ['Koyasan', 135.59, 34.21], ['Okayama', 133.93, 34.66], ['Naoshima', 133.99, 34.46], ['Kurashiki', 133.77, 34.6],
  ['Hiroshima', 132.46, 34.39], ['Miyajima', 132.32, 34.3], ['Matsuyama', 132.77, 33.84], ['Kochi', 133.53, 33.56],
  ['Takamatsu', 134.05, 34.34], ['Tottori', 134.24, 35.5], ['Izumo', 132.75, 35.37], ['Fukuoka', 130.4, 33.59],
  ['Nagasaki', 129.87, 32.75], ['Kumamoto', 130.71, 32.8], ['Beppu', 131.49, 33.28], ['Kagoshima', 130.56, 31.6],
  ['Yakushima', 130.53, 30.35], ['Mount Fuji', 138.73, 35.36], ['Kawaguchiko', 138.76, 35.5], ['Atami', 139.07, 35.1],
  ['Kusatsu', 138.6, 36.62], ['Matsumoto', 137.97, 36.24], ['Toyama', 137.21, 36.7], ['Niigata', 139.02, 37.92],
  ['Yamagata', 140.36, 38.25], ['Akita', 140.1, 39.72], ['Morioka', 141.15, 39.7], ['Otaru', 141.0, 43.19],
  ['Furano', 142.38, 43.34], ['Kushiro', 144.38, 42.98],
];

export const PINS: PinData[] = [
  ...STOPS,
  ...PLACES.map(([name, lon, lat], i): PinData => ({
    id: `p${i}`,
    name,
    ll: [lon, lat],
    kind: i % 5 === 0 ? 'dream' : 'place',
  })),
];

/** Deterministic pseudo-random POIs over Japan's main islands (some fall in the sea; fine for a load test). */
export function generatePois(count: number): GeoJSON.FeatureCollection<GeoJSON.Point> {
  let seed = 42;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const centers = PLACES.map(([, lon, lat]) => [lon, lat] as const);
  return {
    type: 'FeatureCollection',
    features: Array.from({ length: count }, (_, i) => {
      const [lon, lat] = centers[i % centers.length]!;
      return {
        type: 'Feature',
        properties: { id: `poi${i}`, name: `Spot ${i + 1}` },
        geometry: { type: 'Point', coordinates: [lon + (rand() - 0.5) * 0.6, lat + (rand() - 0.5) * 0.45] },
      };
    }),
  };
}
