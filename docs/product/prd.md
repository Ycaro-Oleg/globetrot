# PRD: MVP scope

Status: **approved direction (Phase 0)**. Individual features are refined in their milestone issues.

Where each feature stands: [`progress.md`](progress.md).

## Goal of the MVP

Validate the core question: *does planning on a map, combined with an honest "can I afford it, and when?" answer, make a trip feel achievable for beginners?* Ship it as a closed beta on responsive web/PWA, in English and Brazilian Portuguese.

## Feature classification

| Feature | Class | User value | Complexity | Main dependency | Risk |
|---|---|---|---|---|---|
| Auth (email/password, Google, recovery) | Essential MVP | Access | M | — | Low |
| i18n en + pt-BR, locale formatting | Essential MVP | Global reach | M | — | Medium (text expansion) |
| Preferences (language, currency = USD default, home country, timezone, theme, motion) | Essential MVP | Personalization | S | Auth | Low |
| Multiple trips (list, create, switch, archive) | Essential MVP | Core | S | Auth | Low |
| Map board: world ⇄ region, stops, airmail route, stop panel, city search | Essential MVP | Differentiator | **L** | Places data, map spike | **High** |
| Mobile board (bottom sheet, crosshair "Pin here") | Essential MVP | Mobile parity | L | Map board | **High** |
| Itinerary by days (accessible drag-and-drop) | Essential MVP | Planning | M | Trips | Medium |
| Checklists (documents, money, bookings, packing) | Essential MVP | Readiness | S | Trips | Low |
| Multi-currency budget with FX provenance | Essential MVP | Differentiator | M | Money module | Medium |
| Savings plan + answer sentence | Essential MVP | Differentiator | M | Budget | Low |
| Trip readiness stamps (visa page) + celebration | Essential MVP | Motivation | S | Milestones | Low |
| Example trips (duplicable) | Essential MVP | First session value | S | Trips | Low |
| Light/dark themes | Essential MVP | Quality | S | Tokens | Low |
| Landing page with **mock** pricing | Essential MVP | Acquisition | M | Tokens, i18n | Low |
| Pip v1 (trip sketch + fill empty days) behind a feature flag | Essential MVP (last) | Differentiator | L | Budget, itinerary, AI port | Medium (cost, quality) |
| Account passport + self-declared country stamps, basic profile | Initial public release | Identity | M | Trips | Low |
| Stripe subscriptions + entitlements | Initial public release | Revenue | L | Approved pricing | Medium |
| PWA offline trip pack | Initial public release | Travel stage | L | Map tiles | Medium |
| Production deployment (Hetzner + Coolify) | Initial public release | Launch | M | MVP RC | Low |
| Social feed, posts, comments, reactions, moderation | Post-launch | Community | XL | Profiles | High |
| 100 ranks + achievements | Post-launch | Retention | L | XP ledger, anti-abuse | Medium |
| Native apps (Expo) | Post-launch | Mobile reach | XL | Shared packages | Medium |
| MCP server (Claude, ChatGPT, …) | Post-launch | Ecosystem | L | Application layer, OAuth | Medium |
| Real routing (OSRM/Valhalla), budget scenarios, collaborative trips | Post-launch | Depth | L | — | Medium |
| Verified visits, public community itineraries, AI visa research | Experimental | — | — | — | High (trust, legal) |

## Why social, ranks and MCP are excluded from the MVP

They need real users, moderation and a stable domain, and they don't answer the core validation question. The architecture prepares for them (application layer, XP ledger, scopes) without building them.

## MVP acceptance criteria (release candidate)

- A new user can sign up in either language and confirm their currency (USD by default), then create a trip with 3+ stops on desktop **and** on a phone.
- The same trip data appears consistently on the board, itinerary, budget and checklists.
- Expenses can be entered in any ISO 4217 currency. Converted amounts show their rate, source and date.
- The savings answer sentence is correct for the edge cases in [`business-rules.md`](business-rules.md#savings-plan).
- Every map action has a keyboard or non-map path. Automated axe checks pass and a manual WCAG 2.2 AA review is done.
- Pip proposals can be previewed, partially applied and undone. The app is fully usable with Pip disabled.
- The landing pricing is driven by config and visibly marked as placeholder.

## Validation questions (usability testing)

Does the map simplify planning? Do people understand pins and routes? Is the mobile map usable? Do beginners understand the budget? Is Pip helpful without taking over? Does savings progression motivate? Is the first session compelling?
