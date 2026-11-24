# Spike #3: Places from GeoNames in PostGIS

- **Question:** can our own `Place` table, built from GeoNames cities, regions and countries with localized names, power fast city search and the geographic hierarchy without a paid geocoder? ([ADR-0003](../adr/0003-map-stack.md))
- **Date:** 2026-11-07
- **Code:** branch `spike/issue-3-places-geonames` (commit `8f5e070`), folder `spikes/places/`: `import.sh`, `import.sql`, `bench.sql`, `names-check.sql`. Throwaway; not merged.
- **Verdict: Go.** Search latency is ~15× below the target, the hierarchy works, and 28 of 30 pt-BR names are right out of the box. The two misses are pt-PT spellings, which a small curated override table will fix.

## What was built

- **Input** (GeoNames dump of 2026-11-07, CC-BY 4.0):
  - `cities15000` (34,205 cities with population > 15k);
  - `admin1CodesASCII` (3,865 regions);
  - `countryInfo` (252 countries);
  - `alternateNamesV2`, filtered to our 38,322 places and to real language codes (592k names). Pseudo-languages such as `link`, `post` and `iata` are dropped.
- **Model** (schema `spike_places` in the local PostGIS from `pnpm services:up`):
  - `place(id = GeoNames id, kind country|region|city, parent_id, country_code, admin1_code, name, names jsonb {en, pt}, population, location geography(Point))`.
  - Hierarchy: city → region → country. Only 104 cities have no region.
  - `place_name(place_id, lang, name, norm)` holds one row per searchable variant: the primary name, ASCII, and every non-colloquial, non-historic name **in any language**. `norm` is `lower(unaccent(name))`, giving 349,725 variants.
  - Indexes: btree `text_pattern_ops` for prefixes, GIN `gin_trgm_ops` for typos, GiST on `location`.
- **Display name per locale:**
  - `pt-BR` beats `pt`, then GeoNames "preferred", then "short", then the shortest name. Colloquial and historic names are skipped.
  - English falls back to the GeoNames primary name. Countries use `countryInfo` short names.
- **Search** (`spike_places.search(q, locale, limit)`):
  - Normalize the query.
  - Rank by **exact (3) > prefix (2)**. Run trigram fuzzy matching (1) only when there are fewer prefix hits than the limit and the query has at least 4 characters.
  - Ties go to cities before countries before regions, then to population.
  - The result is labelled in the user's locale as "city, region, country".

## Results

| Criterion | Target | Result | Status |
|---|---|---|---|
| Search latency | p95 < 100 ms for en/pt prefixes | **p95 7.0 ms**, p50 2.4 ms, max 21 ms. That covers 2,200 runs: 44 queries (`tok`, `são p`, `lisb`, `cidade do m`, `kioto`, `sa`, …) × 2 locales × 25, server-side, warm cache, local Docker on WSL2 | ✅ |
| Localized display names | 30 sample cities correct | pt-BR **28/30** (misses: Copenhague → "Copenhaga", Nova York → "Nova Iorque", both pt-PT forms). en **28/30** (acceptable variants: "New York", "St Petersburg") | ✅ with overrides |
| Finds the city by its local name in either language | — | **30/30** top-1 for the full pt-BR name and **30/30** for the English name | ✅ |
| Typo tolerance | — | `kioto` → Quioto (via the Spanish "Kioto" in the all-language index), `londres` and `munique` exact. Fuzzy hits rank below real prefixes | ✅ |
| Hierarchy | country → region → city | Works. 104 of 34,205 cities fall back to their country | ✅ |
| Size and import time | Document | **96 MB** (`place_name` 83 MB, `place` 13 MB). Import takes **10 s**. With an en/pt-only index it was 21 MB, but recall was worse | ✅ |

Raw outputs: [`places/search-bench.txt`](places/search-bench.txt) (sample results and latency) and [`places/names-check.txt`](places/names-check.txt).

### Measured along the way: v1 → v2

- The v1 index held only en/pt names. "kioto" ranked Kyoto third, and "nova y" found nothing useful.
- Indexing every language's names (v2) fixed recall. Size went up 4.5× and p95 went from 3.9 to 7.0 ms.
- v1 also exposed a bug: GeoNames flags load as NULL, and **NULLs sort first under `DESC`**, so non-preferred names won ("São Paulo capital"). Fixed with `IS TRUE`. Keep that pattern in the real import.

## Decisions for production (M3/M4)

1. **Own the city dataset.** Use GeoNames `cities15000` plus admin1 regions and countries in our PostGIS, imported by a worker job (pg-boss) that refreshes monthly. This covers city search and the hierarchy with no third-party calls. Addresses and fine-grained POIs still go through the managed geocoder (#4).
2. **Index names in every language; display in the user's locale.** It's cheap (≈ 100 MB, single-digit-ms queries) and is what makes "München", "Kioto" or "Moskva" work for international travellers.
3. **Curated pt-BR overrides.** GeoNames' `pt` names mix in European Portuguese. Add a small `place_name_override(place_id, locale, name)` table (Copenhague, Nova York, Moscou-style cases) that takes precedence. Start with the 300 most-visited cities and review it with a native speaker.
4. **Country names come from CLDR**, through `Intl.DisplayNames(locale, { type: 'region' })` keyed by ISO code. Don't use GeoNames for them. This keeps them consistent with the rest of the UI and covers future locales for free. GeoNames still supplies city and region names.
5. **De-duplicate same-named city/region pairs** ("Lisboa" city and district). Collapse them into the city in results, keep the region reachable through the hierarchy or a "regions" filter, and show the region only when there's no city with that label in the same country.
6. **The search contract** belongs in `packages/application` (a `searchPlaces` query) with a Zod schema. The adapter runs the SQL above. Results carry the GeoNames id (stable), localized label, region, country code, coordinates and kind.
7. **Coverage:** `cities15000` lacks small towns and islands that travellers do visit (e.g. many Greek islands are under 15k). Revisit `cities5000` (~68k, roughly 2× the size) once usage data exists. Custom pins and the geocoder cover the gap meanwhile.
8. **Attribution:** GeoNames data is CC-BY 4.0, so credit "GeoNames" (geonames.org) on the about/credits page and in the map attribution, alongside OSM.

## Still open

- Choose the managed geocoder (#4) for addresses and POIs, with caching rules.
- Measure latency through the API (HTTP + JSON) once `apps/api` has a database adapter. Expect a few extra ms.
- Seed the pt-BR override list.
