# 0003. Map stack: MapLibre + OSM (Protomaps) + own places DB

- Status: Accepted (to be validated by the M1 spike)
- Date: 2026-11-07

## Context
The map is the flagship feature. It needs a custom "poster" style in light and dark, crisp accessible pins, airmail routes, smooth touch interaction, low cost, no lock-in, and compliance with OSM licensing. The public OSM tile servers and the public Nominatim service are not acceptable for a commercial SaaS.

## Decision
- **Rendering:** MapLibre GL JS on the web. Later on native, `@maplibre/maplibre-react-native` v11 (v10 only supports the New Architecture through interop).
- **Basemap:** an OpenStreetMap basemap as **Protomaps PMTiles** (a single file) served statically from object storage behind a CDN. The custom style follows the design tokens. The attribution "© OpenStreetMap contributors" is mandatory.
- **Overlays:** trip pins and labels (up to about 100) go in a DOM/SVG overlay projected with `map.project` (crisp, `<button>` semantics, label collision). Dense layers (library POIs, community pins) are MapLibre symbol layers with clustering.
- **Routes:** airmail connections are conceptual arcs. Real routing (OSRM or Valhalla) comes later.
- **Places:** our own `Place` table in PostGIS, seeded from **GeoNames** (cities, CC-BY, with alternate names for en/pt), searched with `pg_trgm`. Fine-grained address and POI search goes through a `GeocodingPort` backed by a managed OSM-based provider chosen by its caching and storage terms. Self-hosted Photon is a later option.
- **Static art** (mini-maps, stamps, landing) can keep d3-geo + Natural Earth.

## Spike exit criteria (M1)
- The poster style matches the design in both themes.
- 50 pins + routes at 60 fps on a mid-range Android phone.
- Time to first render under 2.5 s on 4G.
- Touch targets ≥ 44 px.
- The crosshair "Pin here" flow works.
- City search under 100 ms with en/pt names.

## Consequences
We own the tile hosting, which is cheap and needs only a static file plus a CDN. We must maintain the style and refresh PMTiles builds periodically.
