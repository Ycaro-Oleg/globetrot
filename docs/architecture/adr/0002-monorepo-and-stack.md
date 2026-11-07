# 0002. TypeScript monorepo and core stack

- Status: Accepted
- Date: 2026-11-07

## Context
Priorities, in order: performance, UX quality, mobile support, development speed, maintainability, agent-friendliness, operating cost, scalability. The product also needs a strong web experience (an SEO landing page and a CSS-heavy design), a map-centric app, native mobile later, AI integration, a future MCP server, and deployment on Hetzner + Coolify.

## Decision
A **pnpm + Turborepo TypeScript monorepo**:
- **Web:** Next.js (App Router) for the landing (SSG/SSR) and the app under `/app`.
- **API:** Hono with Zod/OpenAPI, as its own container.
- **Worker:** pg-boss.
- **Data:** PostgreSQL + PostGIS with Drizzle.
- **Shared packages:** domain, application, db, api-client, tokens, ui, i18n.
- **Mobile:** an Expo app is added **after the MVP**. It reuses domain, api-client, tokens and i18n. The MVP is a responsive web app/PWA.

Weighted decision matrix (weights: performance 15, UX 18, mobile 15, velocity 14, maintainability 10, agent DX 8, cost 6, AI 6, MCP 8). Scores out of 5:
- A. this option: **4.55**
- B. Expo universal / RN Web: 3.96
- C. Next.js + Capacitor monolith: 3.86
- D. Flutter: 3.54

## Alternatives considered
- **Expo universal (B):** the design depends heavily on CSS, SEO is weak on RN Web, and maplibre-react-native has no web target, so the map would be implemented twice anyway.
- **Capacitor (C):** WebView map performance on low-end Android, plus a monolith that couples rules to the UI.
- **Flutter (D):** weaker web/SEO and agent ecosystem.
- **Supabase as the backend:** fast to start, but it pushes rules into RLS and edge functions, which conflicts with a shared application layer for Pip and MCP.

## Consequences
Two UI layers later (web and RN), with shared logic. One language end to end. Three deployable containers (web, api, worker) plus Postgres, all Coolify-friendly.
