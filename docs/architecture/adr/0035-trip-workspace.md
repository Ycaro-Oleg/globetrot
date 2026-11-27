# 0035. The trip workspace: sections on the left, the trip's document, the map on the right

- Status: Accepted (the owner asked for it on 2026-11-27)
- Date: 2026-11-27

## Context
The trip was spread over separate screens switched by tabs in the TopBar: the map (`/app/board`), the days (`/app/days`), the money (`/app/budget`), the checklists (`/app/lists`) and the trip's own page (`/app/trips/{id}`). The map sat alone on its screen and the days and the budget never showed it, so people lost the thread of the trip. The owner found it confusing and pointed at the layout of Wanderlog, where one sidebar is the trip's table of contents, the trip reads as one document and the map stays beside it.

## Decision
- A **trip workspace** wraps the trip's document (`/app/trip`, the new home of the app), its budget and its checklists in one layout (`app/app/(trip)/layout.tsx`, a route group, so the URLs do not change).
- **Sidebar** (from 720px), in a drawer that folds to a rail and resizes between 200 and 360px (by drag or the arrow keys on its edge): Overview and Places, Itinerary with a link to every day ("Mon 30/11" with a start date, "Day 1" without one: the start date stays optional), Budget, Checklist, Expand map. Below 720px it becomes a sticky jump bar.
- **The trip's document**: name and dates, the budget total, the places in order, then the itinerary day by day (the Days board, stacked). `/app/days` redirects to its itinerary.
- **The map on the right** (from 1100px): stops and routes, following the day being read; a pin leads to its row in the places. It only looks and points. Below 1100px a floating "Map" button opens the full map.
- **The full map stays** at `/app/board`, outside the workspace, as "Expand map": adding stops, nights and legs happens there.
- The bar's trip tabs (Trip · Map · Budget · Checklist) step aside inside the workspace.
- **A white palette** (the owner's choice after comparing seven): light grey page, white cards and drawer, near-black text and selected states, one coral action (`#D63F24`, white text); the night theme is neutral charcoal instead of navy. The map and the photos bring the colour.

## Alternatives considered
- **Move all the map editing into the workspace's map:** one map for everything, but it rewrites the board (about 1,500 lines) before launch. Kept for later, if people miss it.
- **Make the trip's dates required at creation:** the itinerary would always have weekdays, but it changes a business rule and onboarding; the sidebar says "Day 1" until a start date is set, with the prompt right there.
- **Map on top, document below on a phone:** the map would take half of a small screen at all times; the jump bar plus a "Map" button keeps the phone's full sheet map one tap away.

## Consequences
- One place for the trip; the map is beside the plan on a computer, and every action still has its list path.
- The workspace map adds MapLibre to `/app/trip` on wide screens only (loaded on demand, ADR-0003's code split holds).
- The offline worker (ADR-0027) keeps `/app/trip` instead of `/app/days` (cache `globetrot-trip-v2`).
- Follow-ups: per-day colours and the day's places as pins on the workspace map; reservations and attachments in the document.
