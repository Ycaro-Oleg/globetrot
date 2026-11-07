# 0003. Map stack: MapLibre + OSM (Protomaps) + own places DB

- Status: Accepted. Spike #2 validated it visually and functionally (2026-11-07); a real-device frame-rate check is still pending. See [`../spikes/maplibre.md`](../spikes/maplibre.md).
- Date: 2026-11-07

## Context
The map is the flagship feature. It needs a custom "poster" style in light and dark, crisp accessible pins, airmail routes, smooth touch interaction, low cost, no lock-in, and compliance with OSM licensing. The public OSM tile servers and the public Nominatim service are not acceptable for a commercial SaaS.

## Decision
- **Rendering:** MapLibre GL JS on the web (v6). Later on native, `@maplibre/maplibre-react-native` v11 (v10 only supports the New Architecture through interop). Bundling note: import the worker with `maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url`, then call `setWorkerUrl()` with `worker.format: 'es'`.
- **Basemap:** an OpenStreetMap basemap from **Protomaps** (a single planet PMTiles file kept in object storage). Tiles are served to clients through a **z/x/y tile endpoint** (`pmtiles serve` or Martin, deployed as a Coolify service behind the CDN) rather than client-side range reads, so each tile costs one cacheable request. The style is built with `@protomaps/basemaps` and a custom flavor from the design tokens, plus a land-shadow fill and an ink coastline. POIs, buildings and landcover are dropped for the poster look. Glyphs and sprites are self-hosted. The attribution "© OpenStreetMap contributors" is mandatory.
- **World view:** globe projection at low zoom, morphing to mercator in the region view. At world zoom a trip is shown as a single pin.
- **Overlays:** trip pins and labels (up to about 100) go in a DOM/SVG overlay projected with `map.project` (crisp, `<button>` semantics). Label collision is arithmetic and runs on `moveend`. Dense layers (library POIs, community pins) are MapLibre symbol or circle layers with clustering. The spike measured them faster than DOM, with no per-frame JS.
- **Trip-country highlight:** needs a country-polygon source (Natural Earth 10m or OSM admin level 2) in our tile service, because the basemap's land layer has no country attribute. Decide the source in M4.
- **Routes:** airmail connections are conceptual arcs. Real routing (OSRM or Valhalla) comes later.
- **Places:** our own `Place` table in PostGIS, seeded from **GeoNames** (cities, CC-BY, with alternate names for en/pt), searched with `pg_trgm`. Fine-grained address and POI search goes through a `GeocodingPort` backed by a managed OSM-based provider chosen by its caching and storage terms. Self-hosted Photon is a later option.
- **Static art** (mini-maps, stamps, landing) can keep d3-geo + Natural Earth.

## Spike exit criteria (M1), results from #2
- ✅ The poster style matches the design in both themes.
- ⏳ 50 pins + routes at 60 fps on a mid-range Android phone. Not measurable headless (software WebGL). The overlay costs ≤ 5.6 ms per frame at a 4× CPU slowdown. Pending a device run.
- ❌ Time to first render under 2.5 s on 4G. Measured 3.4 s. Fixes: the z/x/y tile endpoint, a lazy-loaded board route, no bundled geodata.
- ✅ Touch targets ≥ 44 px.
- ✅ The crosshair "Pin here" flow works.
- ⏳ City search under 100 ms with en/pt names: spike #3.

## Consequences
We own the tile hosting: object storage, a small tile server and a CDN. We must maintain the style, refresh the planet build periodically, and keep a country-polygon layer for highlights. The map bundle must be code-split, so pages without the map don't pay for it.
