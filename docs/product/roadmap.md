# Roadmap

Each milestone maps to a GitHub milestone. Issues for a milestone are created when the previous one nears completion, roughly 10–15 at a time, never dozens in advance. Live status: [`../agents/current-state.md`](../agents/current-state.md). Per-feature progress: [`progress.md`](progress.md).

| # | Milestone | Status | Exit criteria | Depends on |
|---|---|---|---|---|
| M0 | Product Foundation | **Complete** | Vision, PRD, business rules, design audit, ADRs 0001–0009, agent docs merged | — |
| M1 | Design System & Spikes | **Partly open** (owner-dependent) | Tokens v1.1 (USD, fixed contrast). Storybook with primitives. **MapLibre spike** meets its metrics. Places spike meets its metrics. Usability test of the prototype run (5 beginners, en + pt-BR) | M0 |
| M2 | Engineering Foundation | **Complete** | pnpm/Turborepo monorepo, CI (lint, typecheck, unit, integration; E2E arrives in M3), local Docker Compose, `packages/domain` with Money/FX and savings rules ported and tested | M0 |
| M3 | App Foundation | **Active** (12 of 13 issues done) | Auth, i18n, preferences, responsive shell, themes, trip CRUD | M1, M2 |
| M4 | Travel Workspace & Map | **Started** (starter board, #75) | Full board, stop panel, mobile sheet, city search | M3 |
| M5 | Itinerary & Checklists | **Started** (days page, checklists) | Days, accessible drag-and-drop, checklists, readiness stamps | M4 |
| M6 | Budget & Savings | **Started** (budget page, savings answer) | Expenses, FX, savings plan, answer sentence | M3 (in parallel with M5) |
| M7 | Pip v1 | Not started | AIProposal, change list, apply/undo, cost limits, feature flag | M4–M6 |
| M8 | Landing & MVP RC | **Started** (landing done in code, example trips, #74) | Landing (i18n, mock pricing), example trips, accessibility and performance QA, closed beta | M3–M7 |
| M9 | Passport & Identity | Not started | Account passport, place stamps, profile | M8 |
| M10 | Commercial | Not started | Approved pricing, Stripe sandbox, entitlements, customer portal, NFS-e integration | Pricing decision |
| M11 | Production Readiness | Not started | Hetzner + Coolify, backups and restore test, monitoring, security review, account data export and deletion | M8 |
| M12+ | Social → Ranks → Native apps (Expo) → MCP | Not started | Each scoped when started | M9–M11 |

## What each active milestone contains

### M1: Design System & Spikes (GitHub issues #2 to #9)

| Issue | What | State |
|---|---|---|
| #2 | MapLibre spike | Done: go, with conditions. Real-device frame rate pending (owner) |
| #3 | Places spike (GeoNames + PostGIS) | Done: go |
| #4 | Managed geocoding evaluation | Open: initial research only; provider keys and a decision are the owner's |
| #5 | Tokens v1.1 | Done |
| #6 | Storybook and core primitives | Open: primitives built; remaining components, manual screen-reader and interaction review pending |
| #7 | Missing-screen specs (trip list, language and region, multi-currency expense) | Trip list/switcher approved for #62; other screen and copy reviews remain |
| #8 | Usability test of the prototype | Open: protocol ready; five real sessions needed |
| #9 | Pip character brief | Open: draft ready; owner approval pending |

### M3: App Foundation (issues #50 and #52 to #63)

Breakdown, dependency table and reasoning: [`../engineering/m3-foundation-breakdown.md`](../engineering/m3-foundation-breakdown.md).

| Issue | What | State |
|---|---|---|
| #50 | Locale integration in the web app | Done |
| #52 | Database migration foundation | Done |
| #53 | Auth server and sessions | Done |
| #54 | Email verification and recovery | Done |
| #55 | Google sign-in | Open (real-provider test is the owner's) |
| #56 | Authenticated API, actor, typed client | Done |
| #57 | Sign-up, log-in and recovery screens | Done |
| #58 | Preferences persistence | Done |
| #59 | Responsive authenticated shell | Done |
| #60 | Theme and motion preferences | Done |
| #61 | Trip persistence and operations | Done |
| #62 | Trip list and switcher | Done |
| #63 | First end-to-end and accessibility gate | Done |

### Before M4 (the map board) starts

What is already decided, what is built, and what must be settled first, so planning M4 starts from facts. Plan M4 with the owner the way M3 was planned ([`../engineering/m3-foundation-breakdown.md`](../engineering/m3-foundation-breakdown.md) is the model): propose slices, reconcile with this table, create 10 to 15 issues only after approval.

| Topic | State |
|---|---|
| Map stack | Decided in [ADR-0003](../architecture/adr/0003-map-stack.md): MapLibre GL JS, Protomaps PMTiles served as z/x/y tiles, a DOM overlay for trip pins, our own places table seeded from GeoNames |
| Spike code | Throwaway, **not merged**. It lives on the branches `spike/issue-2-maplibre-poster-style` (poster style, overlay, crosshair) and `spike/issue-3-places-geonames` (import and benchmark SQL). Read the findings first: [`maplibre.md`](../architecture/spikes/maplibre.md), [`places.md`](../architecture/spikes/places.md) |
| Needs the owner | Real-device frame-rate test; the geocoder choice (#4); remaining #7 screen/copy reviews; the imagery licensing source |
| Open technical decisions | Country-polygon source for the trip highlight (Natural Earth 10m or OSM admin level 2, decided in M4); where the tile server runs (a Coolify service behind the CDN); first render must get under 2.5 s on 4G (3.4 s measured; fixes listed in the spike) |
| Needed from M3 first | The authenticated shell (#59) and the trip list (#62): the board lives inside a trip. The preferences and trips API exist |
| Data to add | A `place` table (PostGIS) with the GeoNames import as a worker job (so the worker gets its first real job and `pg-boss`), then stops, pins and connections (domain model: Trip Planning) |
| Rules already written | Stops, days, connections, stage and next steps in [`business-rules.md`](business-rules.md#trips); derivations built in `packages/domain/src/trip` |

## Notes

- A lightweight **preview environment** on Coolify can be set up from M4, only for usability testing. It is not production.
- M5 and M6 can run in parallel.
- Pricing, regional pricing and plan limits are decided in a dedicated business decision before M10.
- Account data export and deletion (LGPD/GDPR) must be designed and built before any public release. It is listed under M11 but its design should start earlier, because the append-only audit log and the owner foreign keys constrain it ([ADR-0011](../architecture/adr/0011-idempotency-audit-and-units-of-work.md)).
- The M2 milestone listed E2E in its exit criteria; the E2E job is a skipped placeholder until #63.
