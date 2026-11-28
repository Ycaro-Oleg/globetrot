# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: beginner travellers.** They want to travel but don't know where to start, what things cost, how to build a route or how to save for it. They need guidance and encouragement.
- **Secondary: experienced travellers.** They plan multi-destination trips, track expenses in detail, prefer manual control, and enjoy recording and sharing trips. Depth is never sacrificed for approachability.

Both use phones and computers equally; each device gets the interaction patterns that suit it.

## Product Purpose

Globetrot turns travel dreams into organized, achievable trips: a personal travel universe, not a booking site, a spreadsheet or an admin dashboard. Lifecycle: Dream → Discover → Plan → Save → Unlock → Explore → Remember → Share. Success is a person who knows their route, what it costs, and the month they can go.

## Positioning

1. **The map board is the workspace:** pins, routes between stops, typed spots inside each city with an A→B→C order, a pin card per place.
2. **"Can I go, and when?"** answered in one sentence from the trip's costs (estimate / confirmed / paid) and a savings plan.
3. **Pip, the optional AI companion,** only proposes reviewable change lists, choosing among real places; it never takes control.
4. A decorative passport with stamps, and a social layer.

## Operating Context

Main screens: the map board (`/app/board`), trips and the trip hub (`/app/trips`), the day plan (`/app/days`), the budget and savings (`/app/budget`); also lists/passport, community, profile, onboarding and the public landing. Next.js web app (responsive, PWA later), MapLibre map with Geoapify tiles.

## Capabilities and Constraints

- `en` and `pt-BR` from day one; every user-facing string lives in message catalogs.
- Money is integer minor units plus an ISO 4217 code; USD is the default and currency is never inferred from language or country.
- AI is optional; every feature works by hand. Every map action has a non-map path; every drag has a keyboard alternative.
- Prices come from the domain's `PLAN_TERMS`; no live prices, bookings or availability are ever invented.

## Brand Commitments

- The name and logo **Globetrot** stay as they are.
- **Pip is the globe**: the mascot is a globe with dotted continents. This stays.
- Everything else visual (colours, type, layout, components) is open for the v2 redesign (owner decision, 2026-11-26).

## Evidence on Hand

Real product data only from the person's own trips; demo content in prototypes must be labelled as an example. No testimonials, customer counts or press exist; none may be invented.

## Product Principles

1. The map is the workspace, but never the only way.
2. Answer first, numbers second.
3. Draft before commitment: AI and destructive actions are previewable and undoable.
4. Honesty: an estimate is not a price; the passport is decorative; a visit is never "verified" without a real mechanism.
5. Progressive disclosure: approachable first, deep when needed.

## Accessibility & Inclusion

WCAG 2.2 AA in light and dark themes; status is never encoded by colour alone; reduced motion is respected.
