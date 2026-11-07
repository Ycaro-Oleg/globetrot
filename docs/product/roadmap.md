# Roadmap

Each milestone maps to a GitHub milestone. Issues for a milestone are created when the previous one nears completion, roughly 10–15 at a time.

| # | Milestone | Exit criteria | Depends on |
|---|---|---|---|
| M0 | Product Foundation | Vision, PRD, business rules, design audit, ADRs 0001–0009, agent docs merged | — |
| M1 | Design System & Spikes | Tokens v1.1 (USD, fixed contrast). Storybook with primitives. **MapLibre spike** meets its metrics. Places spike meets its metrics. Usability test of the prototype run (5 beginners, en + pt-BR) | M0 |
| M2 | Engineering Foundation | pnpm/Turborepo monorepo, CI (lint, typecheck, unit, e2e), local Docker Compose, `packages/domain` with Money/FX and savings rules ported and tested | M0 |
| M3 | App Foundation | Auth, i18n, preferences, responsive shell, themes, trip CRUD | M1, M2 |
| M4 | Travel Workspace & Map | Full board, stop panel, mobile sheet, city search | M3 |
| M5 | Itinerary & Checklists | Days, accessible drag-and-drop, checklists, readiness stamps | M4 |
| M6 | Budget & Savings | Expenses, FX, savings plan, answer sentence | M3 (in parallel with M5) |
| M7 | Pip v1 | AIProposal, change list, apply/undo, cost limits, feature flag | M4–M6 |
| M8 | Landing & MVP RC | Landing (i18n, mock pricing), example trips, accessibility and performance QA, closed beta | M3–M7 |
| M9 | Passport & Identity | Account passport, place stamps, profile | M8 |
| M10 | Commercial | Approved pricing, Stripe sandbox, entitlements, customer portal, NFS-e integration | Pricing decision |
| M11 | Production Readiness | Hetzner + Coolify, backups and restore test, monitoring, security review | M8 |
| M12+ | Social → Ranks → Native apps (Expo) → MCP | Each scoped when started | M9–M11 |

## Notes

- A lightweight **preview environment** on Coolify can be set up from M4, only for usability testing. It is not production.
- M5 and M6 can run in parallel.
- Pricing, regional pricing and plan limits are decided in a dedicated business decision before M10.
