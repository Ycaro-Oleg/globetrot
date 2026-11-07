import * as maplibregl from 'maplibre-gl';
import type { LngLatBoundsLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// maplibre-gl v6 runs its worker as an ES module that imports a shared chunk; let Vite bundle it.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { Protocol } from 'pmtiles';
import { feature } from 'topojson-client';
import countries50m from 'world-atlas/countries-50m.json';
import { generatePois, PINS, STOPS, type PinData } from './data';
import { DomPoiLayer, PinOverlay } from './overlay';
import { buildStyle, PALETTES, type Theme } from './style';
import './styles.css';

const t0 = performance.now();
maplibregl.setWorkerUrl(maplibreWorkerUrl);
const protocol = new Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

// Natural Earth 50m countries (public domain) for the low-zoom trip-country highlight.
const topo = countries50m as unknown as Parameters<typeof feature>[0];
const allCountries = feature(topo, (topo as unknown as { objects: { countries: never } }).objects.countries) as unknown as GeoJSON.FeatureCollection;
const tripCountries: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: allCountries.features.filter((f) => f.id === '392') };

const params = new URLSearchParams(location.search);
let theme: Theme = params.get('theme') === 'night' ? 'night' : 'day';
const reducedMotion = () => params.has('reduced') || matchMedia('(prefers-reduced-motion: reduce)').matches;
const isNarrow = () => window.innerWidth < 720;

document.documentElement.dataset.theme = theme;
const mapEl = document.getElementById('map')!;
const overlayEl = document.getElementById('overlay')!;
const panelEl = document.getElementById('panel')!;
const statsEl = document.getElementById('stats')!;

const REGION_BOUNDS: LngLatBoundsLike = [
  [Math.min(...STOPS.map((s) => s.ll[0])), Math.min(...STOPS.map((s) => s.ll[1]))],
  [Math.max(...STOPS.map((s) => s.ll[0])), Math.max(...STOPS.map((s) => s.ll[1]))],
];

const map = new maplibregl.Map({
  container: mapEl,
  style: buildStyle(theme, tripCountries),
  center: [135, 30],
  zoom: 1.4,
  attributionControl: { compact: true },
  dragRotate: false,
  pitchWithRotate: false,
  touchPitch: false,
  renderWorldCopies: false,
});
map.touchZoomRotate.disableRotation();
(window as unknown as { map: maplibregl.Map }).map = map;

const metrics = { firstIdleMs: 0, tileBytes: 0, tileRequests: 0 };
map.once('idle', () => {
  metrics.firstIdleMs = Math.round(performance.now() - t0);
  collectTileBytes();
  renderStats();
});

function collectTileBytes() {
  const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const tiles = entries.filter((e) => e.name.includes('.pmtiles'));
  metrics.tileRequests = tiles.length;
  metrics.tileBytes = tiles.reduce((sum, e) => sum + (e.transferSize || e.encodedBodySize || 0), 0);
}

// ---------- overlay ----------
const insetRight = () => (isNarrow() ? 0 : window.innerWidth < 1100 ? 360 : 408);
const insetBottom = () => (isNarrow() ? 200 : 0);
const overlay = new PinOverlay(map, overlayEl, STOPS, (pin) => selectPin(pin));
overlay.insetRight = insetRight();

function selectPin(pin: PinData) {
  overlay.selectedId = pin.id;
  overlay.update();
  overlay.resolveLabels();
  panelEl.querySelector('.sel-name')!.textContent = pin.name;
}

// ---------- world ⇄ region ----------
const EASE = (t: number) => {
  // cubic-bezier(.6,0,.2,1) approximated with a smoothstep-like curve.
  return t < 0.5 ? 4 * t * t * t * 0.9 + 0.1 * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
let view: 'world' | 'region' = 'world';
function goRegion() {
  view = 'region';
  const padding = { top: 90, left: 60, right: insetRight() + 60, bottom: insetBottom() + 60 };
  if (reducedMotion()) map.fitBounds(REGION_BOUNDS, { padding, animate: false });
  else map.fitBounds(REGION_BOUNDS, { padding, duration: 900, easing: EASE });
}
function goWorld() {
  view = 'world';
  const opts = { center: [135, 30] as [number, number], zoom: 1.4 };
  if (reducedMotion()) map.jumpTo(opts);
  else map.flyTo({ ...opts, duration: 900, easing: EASE });
}

// ---------- modes: 50 labelled pins / 500 POIs (DOM vs symbol layer) ----------
const pois = generatePois(500);
const domPois = new DomPoiLayer(map, overlayEl);
type Mode = 'stops' | 'pins50' | 'poi-symbol' | 'poi-dom';
let mode: Mode = 'stops';
function setMode(next: Mode) {
  mode = next;
  domPois.hide();
  for (const id of ['poi-clusters', 'poi-count', 'poi-points']) if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource('pois')) map.removeSource('pois');
  overlay.setPins(next === 'pins50' ? PINS : STOPS);
  if (next === 'poi-dom') domPois.show(pois);
  if (next === 'poi-symbol') addSymbolPois();
  renderStats();
}
function addSymbolPois() {
  const p = PALETTES[theme];
  map.addSource('pois', { type: 'geojson', data: pois, cluster: true, clusterRadius: 44, clusterMaxZoom: 11 });
  map.addLayer({
    id: 'poi-clusters', type: 'circle', source: 'pois', filter: ['has', 'point_count'],
    paint: { 'circle-color': '#F5B31C', 'circle-stroke-color': p.ink, 'circle-stroke-width': 2.5, 'circle-radius': ['step', ['get', 'point_count'], 14, 20, 18, 60, 24] },
  });
  map.addLayer({
    id: 'poi-count', type: 'symbol', source: 'pois', filter: ['has', 'point_count'],
    layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Medium'], 'text-size': 12, 'text-allow-overlap': true },
    paint: { 'text-color': p.ink },
  });
  map.addLayer({
    id: 'poi-points', type: 'circle', source: 'pois', filter: ['!', ['has', 'point_count']],
    paint: { 'circle-color': '#9AD8BF', 'circle-stroke-color': p.ink, 'circle-stroke-width': 2, 'circle-radius': 7 },
  });
}

// ---------- theme ----------
function setTheme(next: Theme) {
  theme = next;
  document.documentElement.dataset.theme = next;
  map.setStyle(buildStyle(next, tripCountries), { diff: false });
  map.once('styledata', () => {
    if (mode === 'poi-symbol') addSymbolPois();
  });
}

// ---------- mobile pin tool: fixed crosshair + "Pin here" ----------
let pinTool = false;
const crosshair = document.getElementById('crosshair')!;
function togglePinTool(on = !pinTool) {
  pinTool = on;
  crosshair.hidden = !on;
}
function pinHere() {
  // The crosshair sits at the centre of the *visible* map (above the bottom sheet), not the viewport centre.
  const r = crosshair.getBoundingClientRect();
  const centerPx = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  const c = map.unproject([centerPx.x, centerPx.y]);
  // Snap to a known place within 46px, like the prototype; otherwise create a custom pin.
  const near = PINS.map((p) => ({ p, d: Math.hypot(map.project(p.ll).x - centerPx.x, map.project(p.ll).y - centerPx.y) }))
    .filter((x) => x.d <= 46)
    .sort((a, b) => a.d - b.d)[0];
  const pin: PinData = near ? near.p : { id: `custom-${Date.now()}`, name: 'Pinned place', ll: [c.lng, c.lat], kind: 'place' };
  const current = mode === 'pins50' ? PINS : STOPS;
  if (!current.some((p) => p.id === pin.id)) overlay.setPins([...current, pin]);
  selectPin(pin);
  togglePinTool(false);
  document.getElementById('toast')!.textContent = near ? `Snapped to ${pin.name}` : 'Pinned a custom place';
}

// ---------- benchmark: programmatic pan, frame timing ----------
async function bench(seconds = 5) {
  const frames: number[] = [];
  let last = performance.now();
  let running = true;
  const tick = (now: number) => {
    frames.push(now - last);
    last = now;
    if (running) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const start = map.getCenter();
  const steps = Math.round(seconds * 2);
  for (let i = 0; i < steps; i++) {
    const dx = i % 2 === 0 ? 220 : -220;
    const dy = i % 4 < 2 ? 80 : -80;
    map.panBy([dx, dy], { duration: 500, easing: (t: number) => t });
    await new Promise((r) => setTimeout(r, 500));
  }
  running = false;
  map.jumpTo({ center: start });
  const sorted = frames.slice(5).sort((a, b) => a - b);
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  const result = { mode, view, zoom: +map.getZoom().toFixed(2), frames: sorted.length, avgFps: +(1000 / avg).toFixed(1), p95FrameMs: +p95.toFixed(1), longFrames: sorted.filter((f) => f > 33).length, overlayFrameMs: +overlay.stats.lastFrameMs.toFixed(2), labelResolveMs: +overlay.stats.lastLabelMs.toFixed(2) };
  document.getElementById('bench')!.textContent = JSON.stringify(result);
  return result;
}

function renderStats() {
  collectTileBytes();
  statsEl.textContent = `first idle ${metrics.firstIdleMs} ms · tiles ${(metrics.tileBytes / 1024).toFixed(0)} KB in ${metrics.tileRequests} range requests · mode ${mode} · labels ${overlay.stats.labelsShown} · label pass ${overlay.stats.lastLabelMs.toFixed(2)} ms`;
}
map.on('moveend', renderStats);

// ---------- wiring ----------
document.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((btn) =>
  btn.addEventListener('click', () => {
    const act = btn.dataset.act!;
    if (act === 'region') goRegion();
    if (act === 'world') goWorld();
    if (act === 'theme') setTheme(theme === 'day' ? 'night' : 'day');
    if (act === 'pin-tool') togglePinTool();
    if (act === 'pin-here') pinHere();
    if (act === 'bench') void bench();
    if (act.startsWith('mode:')) setMode(act.slice(5) as Mode);
  }),
);
window.addEventListener('keydown', (e) => {
  if (e.key === 'w' || e.key === 'W') (view === 'world' ? goRegion : goWorld)();
  if (e.key === 'Escape') togglePinTool(false);
});
window.addEventListener('resize', () => {
  overlay.insetRight = insetRight();
});
map.on('load', () => {
  if (params.has('region')) goRegion();
  if (params.get('mode')) setMode(params.get('mode') as Mode);
});

(window as unknown as Record<string, unknown>).__spike = { bench, setMode, goRegion, goWorld, setTheme, metrics, overlay };
