# 0010. The web app proxies the API so the session cookie is first-party

- Status: Accepted
- Date: 2026-11-08 (decided while building #53, recorded here)

## Context
The browser needs a session cookie that is sent with every page request and every API call, without CORS configuration and without third-party cookie rules. Server-rendered pages also need to ask the API who the visitor is. The API runs as its own container ([ADR-0002](0002-monorepo-and-stack.md), [ADR-0006](0006-api-and-application-layer.md)).

## Decision
- The browser only ever talks to the **web origin**. `apps/web/proxy.ts` (Next.js 16's proxy convention) rewrites `/api/auth/*` and `/v1/*` to the API. The cookie the API sets is therefore a cookie of the web origin: `HttpOnly`, `SameSite=Lax`, no `Domain`, `Secure` in production.
- The destination is read from `API_INTERNAL_URL` **per request**, not from `next.config` `rewrites()`. Rewrites are evaluated during `next build` and baked into the image, which would need one image per environment.
- Only those two prefixes are forwarded. Anything else is a 404, and dot segments (also percent-encoded) cannot walk out of a prefix (`apps/web/lib/api-proxy.ts`, tested).
- The API is **not** exposed to the internet. It trusts the leftmost `X-Forwarded-For` for rate limits, so a trusted edge (Traefik on Coolify) must set it and only the web container may call the API. See the trust model in [`authentication.md`](../authentication.md#which-client-address-counts-trust-model).
- Server-side web code (pages, `i18n/request.ts`, server actions) calls the API directly through `API_INTERNAL_URL`, forwarding **only** the session cookie.
- The same `proxy.ts` sends anonymous visitors of `/app` to `/login?next=…`.

## Alternatives considered
- **API on its own public origin with CORS and a shared cookie domain:** needs cookie `Domain`, CORS, third-party-cookie care for any other origin, and exposes the API to the internet.
- **`rewrites()` in `next.config`:** simpler, but bakes the target into the build.
- **Server actions only, no API proxy:** couples rules to the web app and cannot serve the native app or MCP ([ADR-0006](0006-api-and-application-layer.md)).

## Consequences
One image per app serves every environment. A cookie, an origin and an `Origin` check cover CSRF for both `/api/auth/*` and `/v1/*`. Every request to the API from a browser costs one extra hop through Next. The web app must forward the incoming `cookie` header itself when it calls the API from the server. A native client (Expo) will call the API directly with its own token flow; revisit then.
