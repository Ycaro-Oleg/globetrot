# Authentication (as built)

Decision and rationale: [ADR-0005](adr/0005-authentication.md). This page describes what is implemented (issue #53): email and password with server-side sessions. The authenticated API and the actor built from this session are in [`api-contracts.md`](api-contracts.md) (#56). Email verification and recovery (#54), Google (#55) and the screens (#57) build on it.

## Shape

```text
Browser ──► apps/web (Next.js, public origin) ──proxy.ts──► apps/api (Hono + Better Auth, private)
   cookie: globetrot.session_token (first-party)                    └──► PostgreSQL (user, session, account, verification, rate_limit)
```

- **Better Auth runs inside `apps/api`**, mounted at `/api/auth/*` (`src/auth.ts`, `src/app.ts`). It uses the Drizzle adapter over the shared `@globetrot/db` client.
- **The browser only talks to the web origin.** `apps/web/proxy.ts` rewrites `/api/auth/*` and `/v1/*` ([`api-contracts.md`](api-contracts.md)) to the API, so the session cookie is a first-party cookie of the web app: no CORS and no third-party cookie rules. Nothing else is forwarded (other paths get 404, and `..` / `%2e%2e` cannot walk out of the prefixes; see `lib/api-proxy.ts`).
- **The proxy target is read per request** from `API_INTERNAL_URL`, not at build time. A `rewrites()` entry in `next.config` is evaluated during `next build` and baked into the image, which would force one image per environment. `proxy.ts` keeps one image for every environment.
- Sessions are database rows. The cookie holds only the opaque session token (`httpOnly`, `SameSite=Lax`, `Path=/`, no `Domain`, `Secure` in production). Cookie name: `globetrot.session_token` (`__Secure-globetrot.session_token` in production).

## Configuration (`apps/api/src/config.ts`)

`loadApiConfig` is the only place in the API that reads `process.env`. An empty value counts as unset. A bad value stops the process at startup with a message that names the setting, never its value.

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | local compose database | Shared with `@globetrot/db` |
| `PORT` (or `API_PORT`) | `4000` | `PORT` is what the container platform sets |
| `BETTER_AUTH_SECRET` | the public dev secret outside production | **Required in production**, at least 32 characters, never the public dev secret. Generate with `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `http://localhost:3000` | The public origin of the **web** app (not the API). Must be `https` in production |
| `TRUSTED_ORIGINS` | none | Extra comma-separated origins allowed to call `/api/auth/*`. The `BETTER_AUTH_URL` origin is always trusted |
| `SESSION_EXPIRES_IN_SECONDS` | 30 days | |
| `SESSION_UPDATE_AGE_SECONDS` | 1 day | A session older than this is renewed when used |
| `AUTH_SIGN_IN_ATTEMPTS_PER_MINUTE` | `5` | Per client address, see rate limits |
| `AUTH_SIGN_UP_ATTEMPTS_PER_MINUTE` | `5` | Per client address |

Web side: `API_INTERNAL_URL` (default `http://localhost:4000`), read by Next from `apps/web/.env*` or the container environment, **not** from the root `.env`.

Starting in development without a secret prints a warning and uses the public development secret. `NODE_ENV=production` refuses to start with a missing, short or default secret.

## Passwords

- Email and password only (`emailAndPassword`). Length 8–128 characters; no composition rules (they do not improve passwords). Hashing is Better Auth's default (scrypt, salted).
- Sign-up signs the user in (`autoSignIn`). #54 decides whether a verified email is required before password sign-in.
- Email addresses are trimmed and stored lowercase (a `before` hook plus the `user_email_lowercase` CHECK constraint), so `Ana@Example.com` and `ana@example.com` are the same account.
- There is **no account lockout**. Locking an account after N failures lets anyone lock a victim out. Abuse is limited per client address by the rate limits below.

## Request protection

- **Origin check on every state-changing call.** Better Auth only verifies `Origin` when the request carries cookies, so a login-CSRF (signing a victim into the attacker's account) would pass. `app.ts` therefore rejects any non-safe request (`POST`, …) to `/api/auth/*` whose `Origin` is present and not trusted, with `403 INVALID_ORIGIN`. Requests without `Origin` (curl, server to server) are not browser CSRF vectors.
- **Rate limits live in PostgreSQL** (`rate_limit` table), so they are shared by every API instance and survive restarts. General limit: 100 requests per 60 s per address and path. `/sign-in/email` and `/sign-up/email` use the two settings above (default 5 per minute); the sixth wrong sign-in gets `429`.
- Logging is `warn` and above and contains no tokens, passwords or email addresses (checked in the end-to-end run).

## Which client address counts (trust model)

The rate limits and the stored `ip_address` use the **leftmost** `X-Forwarded-For` value. Next's proxy appends the address of the connection it received, so the header the API sees is `<what the client or edge sent>, <peer>`.

- **In production** the entry point is Traefik (Coolify), which does not trust a client-supplied `X-Forwarded-For` by default and replaces it with the real client address. Keep it that way: do not configure `forwardedHeaders.trustedIPs` for the public entry point.
- **The API must not be reachable from the internet.** Only the web container may call it (internal network, `API_INTERNAL_URL`). If the API were public, any caller could choose its own address and bypass the limits.
- **Without a trusted edge** (for example `pnpm dev`, or the built web served directly) a client can send its own `X-Forwarded-For` and be counted under that address. This was observed in the end-to-end run. It is acceptable on a developer machine and is the reason for the two rules above.

## Error codes

Responses use Better Auth's stable `code` values; the UI (#57) maps each to a translated message and never shows `message`.

| Code | When |
|---|---|
| `INVALID_EMAIL_OR_PASSWORD` | Wrong email or password. The same answer for an unknown email and a wrong password |
| `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` | Sign-up with a taken email |
| `PASSWORD_TOO_SHORT` / `PASSWORD_TOO_LONG` | Outside 8–128 characters |
| `INVALID_ORIGIN` | Untrusted `Origin` on a state-changing request (ours, from `app.ts`) |
| HTTP `429` | Rate limit hit |

## Tables

`user`, `session`, `account`, `verification` and `rate_limit` (`packages/db/src/schema/auth.ts`, migration `0001_auth_tables`). They follow Better Auth's shape, including its text ids, and the rest of [`data-model.md`](data-model.md) otherwise. `account` holds the password hash (and later OAuth links), never `user`.

## Tests

- Unit: configuration rules, the Origin check and the proxy path guard (`config.test.ts`, `app.test.ts`, `apps/web/lib/api-proxy.test.ts`).
- Integration against a real PostgreSQL (`auth.int.test.ts`, `pnpm test:int`): sign-up, case-insensitive email, duplicate and weak password, sign-in/out, sessions and expiry, rate limits per address, hostile origin, no password or token in responses.
- The built images were also driven end to end with `curl` through the web origin: first-party cookie, proxy path guard, hostile origin `403`, rate limit `429`, clean logs.
