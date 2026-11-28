# Configuration reference

Every environment variable the project reads, in one place. [`.env.example`](../../.env.example) holds the local defaults; this page says what each does, which part reads it, and what production requires. `pnpm docs:check` fails if a variable in `.env.example` is missing here.

## Rules

- **Only entry points and config modules read the environment** (`apps/api/src/config.ts`, `packages/db/src/config.ts`, `apps/web/lib/api-proxy.ts`, `apps/web/i18n/request.ts`). They validate once and pass typed settings inward ([`coding-standards.md`](coding-standards.md#configuration-logging-and-security)).
- **Errors name the setting, never its value.** A bad value stops the process at startup with `Invalid configuration: <NAME …>`.
- **An empty value counts as unset** (`KEY=` in a `.env` file does not override a default).
- **Secrets only live in the environment of the running service** (Railway's service variables in production). The values in `.env.example` are local defaults for local Docker services, not secrets. Never commit a real secret, in code, docs, tests or a handoff.
- **Local loading:** `apps/api` and `apps/worker` load the root `.env` in `pnpm dev` (`tsx --env-file-if-exists=../../.env`). `apps/web` (Next.js) reads `apps/web/.env*`, **not** the root `.env`.
- `NODE_ENV=production` switches on the production rules below. The Docker images set it, so run an image locally with `-e NODE_ENV=development` and the settings it would otherwise refuse.

## API (`apps/api`)

| Variable | Default | Production | What it does |
|---|---|---|---|
| `NODE_ENV` | `development` | `production` | `production` enables the strict rules in this table; `test` is used by the test suites |
| `PORT` (or `API_PORT`) | `4000` | set by the platform | HTTP port. `PORT` wins; `API_PORT` is the local `.env` name |
| `DATABASE_URL` | local compose database (`.env.example`) | **required** | `postgres://user:pass@host:port/db`. Shared with `@globetrot/db` |
| `BETTER_AUTH_SECRET` | the public development secret, with a warning | **required**, at least 32 characters, never the default | Signs and encrypts auth data. Generate with `openssl rand -base64 32`. Changing it signs everyone out |
| `BETTER_AUTH_URL` | `http://localhost:3000` | **required**, `https` | The public origin of the **web** app (not the API) |
| `TRUSTED_ORIGINS` | none | as needed | Extra comma-separated origins allowed to send state-changing browser requests. The `BETTER_AUTH_URL` origin is always trusted |
| `SESSION_EXPIRES_IN_SECONDS` | `2592000` (30 days) | optional | Session lifetime |
| `SESSION_UPDATE_AGE_SECONDS` | `86400` (1 day) | optional | A session older than this is renewed when used |
| `AUTH_SIGN_IN_ATTEMPTS_PER_MINUTE` | `5` | optional | Per client address |
| `AUTH_SIGN_UP_ATTEMPTS_PER_MINUTE` | `5` | optional | Per client address |
| `CLIENT_IP_HEADER` | `x-forwarded-for` | **required**, `x-real-ip` on Railway | The one request header the API reads the client address from, for rate limits and the stored session address. A lowercase header name. Production refuses to start without it, so the limits never fall back to a header the edge passes through: Railway says its edge overwrites `X-Real-IP` (the launch runbook's step 5 proves it), while its `X-Forwarded-For` keeps a client-sent value ([authentication](../architecture/authentication.md#which-client-address-counts-trust-model)) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | unset | set both, in Railway (secret) | Google sign-in. **Both or neither**: with one the API refuses to start (the message names the settings, never a value); with neither the provider is off, `GET /v1/auth/providers` is empty and the button is hidden. The redirect URI to allow in the Google console is `<BETTER_AUTH_URL>/api/auth/callback/google` and the authorized JavaScript origin is `<BETTER_AUTH_URL>` ([authentication](../architecture/authentication.md#google-sign-in-55)) |
| `DEEPSEEK_API_KEY` | unset | the owner's DeepSeek key, as a secret | Pip's model ([ADR-0016](../architecture/adr/0016-pip-on-deepseek.md)). Unset: asking Pip answers `503` and everything else works |
| `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL` | `https://api.deepseek.com`, `deepseek-flash` | optional | Where and which model Pip calls. DeepSeek's pricing page names `deepseek-flash` as the current model |
| `ANTHROPIC_API_KEY` | unset | **leave unset** (owner decision, 2026-11-27: DeepSeek only, for cost) | The backup model ([ADR-0022](../architecture/adr/0022-backup-ai-provider.md)): Pip asks it when DeepSeek fails, times out or is not set. Unset: no backup |
| `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL` | `https://api.anthropic.com`, `claude-haiku-5-5` | optional | Where and which backup model Pip calls |
| `INBOUND_EMAIL_SECRET`, `INBOUND_EMAIL_DOMAIN`, `INBOUND_EMAIL_LOCAL` | unset, unset, `trips` | a long secret shared with the email provider, the inbound domain | Bookings forwarded to `{local}+{token}@{domain}` become Pip proposals ([ADR-0032](../architecture/adr/0032-bookings-by-email.md)). The provider sends the secret in `x-inbound-secret`. Without the secret and domain the route is 404 and no address is shown |
| `INTEREST_LIST_DAILY_EMAILS` | `50` | a whole number from 0 to 10 000 | Confirmation emails the interest list may send in one UTC day, for everyone together ([ADR-0037](../architecture/adr/0037-interest-list.md)). Over it, joining still answers `202` and nothing is sent, so abuse of the public form cannot use up the provider's daily quota that sign-up emails need. Keep it well under the provider's limit (the free Resend plan sends 100 a day) |
| `ADMIN_EMAILS` | unset | the owner's address(es), comma-separated | Verified accounts that may see the internal dashboard (`/app/admin/metrics`, [ADR-0031](../architecture/adr/0031-partner-links-and-metrics.md)). Unset: nobody |
| `SENTRY_DSN` | unset | the Sentry project's DSN, as a secret | Unexpected API errors (the 500s) are sent to Sentry with the stack only, never the request body, headers or user ([ADR-0021](../architecture/adr/0021-error-monitoring-and-product-analytics.md)). Unset: errors stay in the logs |
| `STRIPE_SECRET_KEY` | unset | the owner's Stripe secret (or restricted) key, as a secret | Payments ([ADR-0019](../architecture/adr/0019-plans-trial-and-pip-credits.md)). All `STRIPE_*` settings go together or not at all. Unset: checkout answers `503`. A `sk_live_` key is refused outside production |
| `STRIPE_WEBHOOK_SECRET` | unset | the webhook endpoint's signing secret (`whsec_…`), as a secret | Verifies Stripe's calls to `/v1/webhooks/stripe` |
| `STRIPE_PRICE_EXPLORER_MONTHLY`, `STRIPE_PRICE_EXPLORER_YEARLY`, `STRIPE_PRICE_VOYAGER_MONTHLY`, `STRIPE_PRICE_VOYAGER_YEARLY`, `STRIPE_PRICE_TOP_UP`, `STRIPE_PRICE_TRIP_PASS` | unset | the USD Price ids from the Stripe dashboard | Which Stripe Price each plan, interval, the credit top-up and the trip pass charge in US dollars. The amounts live in Stripe and must match `PLAN_PRICES`, `TOP_UP_PRICES` and `TRIP_PASS` ([ADR-0023](../architecture/adr/0023-free-plan-trip-pass-and-prices-in-reais.md)) |
| `STRIPE_PRICE_EXPLORER_MONTHLY_BRL`, `STRIPE_PRICE_EXPLORER_YEARLY_BRL`, `STRIPE_PRICE_VOYAGER_MONTHLY_BRL`, `STRIPE_PRICE_VOYAGER_YEARLY_BRL`, `STRIPE_PRICE_TOP_UP_BRL`, `STRIPE_PRICE_TRIP_PASS_BRL` | unset (the USD Price) | the BRL Price ids, optional | The same in reais, for people whose chosen currency is BRL. Each one unset falls back to its USD Price |
| `STRIPE_PRICE_TOP_UP_SMALL`, `STRIPE_PRICE_TOP_UP_SMALL_BRL` | unset | the small pack's Price ids, optional | The 50-credit pack (`TOP_UP_SMALL`, [ADR-0033](../architecture/adr/0033-pricing-adjustments-before-launch.md)). Unset: that checkout answers "not switched on yet"; the BRL one falls back to the USD one |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET` | `http://localhost:8333`, `us-east-1`, `globetrot-media` | **required** (endpoint and bucket) | S3-compatible storage for uploaded photos (`StoragePort`, [ADR-0014](../architecture/adr/0014-photos-and-storage.md)) |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | the local development pair | **required**, never the local pair (secret) | Storage credentials, used to sign requests (SigV4) |
| `S3_FORCE_PATH_STYLE` | `true` | as the provider needs | `true` puts the bucket in the path (SeaweedFS, most self-hosted S3); `false` in the host name |
| `GEOAPIFY_API_KEY` | unset | a **server** Geoapify key, in Railway (secret) | Place search and reverse lookup for the board (`/v1/places/*`, `GeocodingPort`) and the Days screen's ideas (Places API, cached a day per area). Unset: search falls back to popular cities or answers `503`, and ideas come only from the built-in list and the board says search is unavailable; routes still work from the list and the map. Not the web's public tile key (`NEXT_PUBLIC_GEOAPIFY_API_KEY`), which can be restricted to tiles |
| `REQUIRE_VERIFIED_EMAIL` | `true` | `true` | A password sign-in needs a verified email ([ADR-0012](../architecture/adr/0012-email-delivery-and-verified-sign-in.md)). `false` lets unverified accounts in, and sign-up then opens a session |
| `VERIFICATION_EXPIRES_IN_SECONDS` | `86400` (24 hours) | optional | Lifetime of a verification link. Minimum 1 |
| `RESET_PASSWORD_EXPIRES_IN_SECONDS` | `3600` (1 hour) | optional | Lifetime of a reset link. Minimum 1 |
| `EMAIL_COOLDOWN_SECONDS` | `30` | optional | Between two emails of the same kind to the same address (`429` with `Retry-After`) |
| `AUTH_EMAIL_REQUESTS_PER_MINUTE` | `5` | optional | Resend and reset requests per client address |
| `SMTP_HOST` | `localhost` | **required** | Mail server. Mailpit locally |
| `SMTP_PORT` | `1025` | optional | Port 465 uses implicit TLS; others upgrade with STARTTLS when offered |
| `SMTP_USER`, `SMTP_PASSWORD` | none | if the provider asks | Both must be set to enable authentication |
| `EMAIL_FROM` | `Globetrot <hello@globetrot.local>` | **required** | `Name <address>` shown as the sender. The local default never reaches an inbox |

Semantics, error codes and the trust model for the client address: [`authentication.md`](../architecture/authentication.md).

## Web (`apps/web`)

| Variable | Default | Production | What it does |
|---|---|---|---|
| `API_INTERNAL_URL` | `http://localhost:4000` | **required** (the API's internal address) | Where the web server proxies `/api/auth/*` and `/v1/*`, and where it reads a signed-in user's data. Read per request, so one image serves every environment ([ADR-0010](../architecture/adr/0010-web-proxies-the-api.md)) |
| `FEATURE_PIP` | `false` | `false` until Pip is launched | Shows Pip's entry points and the `/app/pip` page (ask, review, apply, undo) when exactly `true`; with anything else the entry points are hidden and `/app/pip` is a 404. Read per request, so one image behaves differently in each environment (`lib/flags.ts`) |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `NEXT_PUBLIC_PLAUSIBLE_SRC` | unset, `https://plausible.io/js/script.js` | build arguments, optional | Cookieless, aggregate page and conversion counts ([ADR-0018](../architecture/adr/0018-launch-measurement-and-consent.md)). Unset: nothing loads |
| `GETYOURGUIDE_PARTNER_ID`, `BOOKING_AID` | unset | the owner's partner ids | Partner links on a stop's card (tours and stays, [ADR-0031](../architecture/adr/0031-partner-links-and-metrics.md)). Unset: no link. Read per request |
| `PARTNER_INSURANCE_URL`, `PARTNER_ESIM_URL` | unset | full https partner pages with their tracking | Partner links next to Today's insurance and eSIM suggestions. Unset or not https: no link |
| `FEATURE_COMMUNITY` | `false` | `false` until the community has enough people | Shows Discover's community section and the `/app/community` screens when exactly `true`; otherwise they are a 404. Read per request (`lib/flags.ts`). The API routes stay on, so turning it back on loses nothing |
| `SENTRY_DSN` | unset | the Sentry project's DSN, optional | Server-side errors of the web app (`instrumentation.ts`, [ADR-0021](../architecture/adr/0021-error-monitoring-and-product-analytics.md)). Unset: the Sentry SDK is never loaded |
| `NEXT_PUBLIC_SENTRY_DSN` | unset | build argument, optional | Browser errors, loaded on demand (`instrumentation-client.ts`). Unset: nothing loads |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | unset, `https://eu.i.posthog.com` | build arguments, optional | Product analytics: the named conversion events only, no autocapture and no session recording. In memory until the visitor accepts the consent banner, then a cookie. Unset: nothing loads |
| `NEXT_PUBLIC_META_PIXEL_ID` | unset | build argument, optional | The Meta Pixel for ad conversions, loaded **only after the visitor accepts** the consent banner. Unset: no banner, nothing loads |
| `NEXT_PUBLIC_GEOAPIFY_API_KEY` | unset | build argument of the web image | A **public** Geoapify key for the board's map tiles (place search goes through the API since #75). It is written into the browser bundle **at build time** (so it is a Docker build argument, not a runtime setting) and Next.js reads it from `apps/web/.env.local`, never from the root `.env`. Restrict it to the site's domains in the Geoapify dashboard. Unset: the board still opens and place search says it is unavailable. Never a secret: do not reuse it for a server key |
| `NODE_ENV` | — | `production` | Sets the `Secure` flag on the language cookie. `next dev` and `next start` set it themselves |
| `PORT` | `3000` | set by the platform | HTTP port of the standalone server (images default to 3000). For `next dev`, `PORT=3001 pnpm --filter @globetrot/web dev` |
| `HOSTNAME` | `0.0.0.0` in the image | — | Bind address of the standalone server |
| `NEXT_TELEMETRY_DISABLED` | `1` in the image | — | Disables Next.js telemetry |

## Worker (`apps/worker`)

| Variable | Default | Production | What it does |
|---|---|---|---|
| `DATABASE_URL` | local compose database | **required** | Same database as the API |
| `S3_*` | as for the API | **required**, as for the API | Where stored images are swept ([ADR-0017](../architecture/adr/0017-worker-housekeeping.md)) |
| `MAINTENANCE_INTERVAL_MINUTES` | `60` | optional | Minutes between rounds: housekeeping and the trial emails (1 to 1440) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | as for the API | **`SMTP_HOST` and `EMAIL_FROM` required**, as for the API | Sends the two trial emails ([ADR-0019](../architecture/adr/0019-plans-trial-and-pip-credits.md)) |
| `BETTER_AUTH_URL` | `http://localhost:3000` | **required**, `https` | The public web origin, for the plans link in those emails |
| `SENTRY_DSN` | unset | optional, as for the API | A failed round is reported to Sentry ([ADR-0021](../architecture/adr/0021-error-monitoring-and-product-analytics.md)) |

## Database tooling (`packages/db`)

| Variable | Default | What it does |
|---|---|---|
| `DATABASE_URL` | local compose database | Read by `migrate`, `reset` and the integration tests. `reset` **refuses** non-local hosts and `NODE_ENV=production`. Test databases are created and dropped on the server named by it (or the local default), only as `globetrot_test_*` |

## Local services (`compose.yaml`, `.env`)

Used by Docker Compose and the services check. The API also reads the `S3_*` settings (see the API table).

| Variable | Default | What it does |
|---|---|---|
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | `globetrot` | Credentials of the local Postgres. Keep `DATABASE_URL` in sync |
| `POSTGRES_PORT` | `5455` | Host port of Postgres (5455 avoids a Postgres already on 5432) |
| `S3_PORT`, `S3_ENDPOINT` | `8333`, `http://localhost:8333` | Local S3-compatible storage (SeaweedFS) |
| `S3_REGION`, `S3_BUCKET` | `us-east-1`, `globetrot-media` | Region and the bucket created at startup |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | `globetrot-dev`, `globetrot-dev-secret` | Local-only storage credentials |
| `S3_FORCE_PATH_STYLE` | `true` | SeaweedFS needs path-style URLs |
| `SMTP_PORT` | `1025` | Also the host port Mailpit listens on (the API reads the same variable to connect) |
| `MAILPIT_UI_PORT` | `8025` | Mailpit's web UI and HTTP API |

## Tests

| Variable | Default | What it does |
|---|---|---|
| `DATABASE_URL`, `SMTP_PORT` | as above | Passed through Turborepo to the integration tests |
| `MAILPIT_URL` | `http://localhost:8025` | Where the integration tests read the mail the API sent. `MAILPIT_UI_PORT` changes the port |

## Adding a variable

1. Read it in the right config module and validate it there (Zod). Add a test for the default, an override and a bad value, plus the production rule if there is one.
2. Add it to `.env.example` (commented out if it is an optional knob) with a one-line explanation.
3. Add it to the table above. `pnpm docs:check` verifies `.env.example` against this page.
4. If production must set it, say so in the Production column and in [`authentication.md`](../architecture/authentication.md) or the relevant doc.
