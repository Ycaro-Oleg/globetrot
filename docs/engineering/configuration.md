# Configuration reference

Every environment variable the project reads, in one place. [`.env.example`](../../.env.example) holds the local defaults; this page says what each does, which part reads it, and what production requires. `pnpm docs:check` fails if a variable in `.env.example` is missing here.

## Rules

- **Only entry points and config modules read the environment** (`apps/api/src/config.ts`, `packages/db/src/config.ts`, `apps/web/lib/api-proxy.ts`, `apps/web/i18n/request.ts`). They validate once and pass typed settings inward ([`coding-standards.md`](coding-standards.md#configuration-logging-and-security)).
- **Errors name the setting, never its value.** A bad value stops the process at startup with `Invalid configuration: <NAME …>`.
- **An empty value counts as unset** (`KEY=` in a `.env` file does not override a default).
- **Secrets only live in the environment of the running service** (Coolify in production). The values in `.env.example` are local defaults for local Docker services, not secrets. Never commit a real secret, in code, docs, tests or a handoff.
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
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | unset | set both, in Coolify (secret) | Google sign-in. **Both or neither**: with one the API refuses to start (the message names the settings, never a value); with neither the provider is off, `GET /v1/auth/providers` is empty and the button is hidden. The redirect URI to allow in the Google console is `<BETTER_AUTH_URL>/api/auth/callback/google` and the authorized JavaScript origin is `<BETTER_AUTH_URL>` ([authentication](../architecture/authentication.md#google-sign-in-55)) |
| `GEOAPIFY_API_KEY` | unset | a **server** Geoapify key, in Coolify (secret) | Place search and reverse lookup for the board (`/v1/places/*`, `GeocodingPort`). Unset: those answer `503` and the board says search is unavailable; routes still work from the list and the map. Not the web's public tile key (`NEXT_PUBLIC_GEOAPIFY_API_KEY`), which can be restricted to tiles |
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
| `FEATURE_PIP` | `false` | `false` until Pip exists | Shows Pip's entry points and the `/app/pip` placeholder when exactly `true`; with anything else the entry points are hidden and `/app/pip` is a 404. Read per request, so one image behaves differently in each environment (`lib/flags.ts`) |
| `NEXT_PUBLIC_GEOAPIFY_API_KEY` | unset | build argument of the web image | A **public** Geoapify key for the board's map tiles (place search goes through the API since #75). It is written into the browser bundle **at build time** (so it is a Docker build argument, not a runtime setting) and Next.js reads it from `apps/web/.env.local`, never from the root `.env`. Restrict it to the site's domains in the Geoapify dashboard. Unset: the board still opens and place search says it is unavailable. Never a secret: do not reuse it for a server key |
| `NODE_ENV` | — | `production` | Sets the `Secure` flag on the language cookie. `next dev` and `next start` set it themselves |
| `PORT` | `3000` | set by the platform | HTTP port of the standalone server (images default to 3000). For `next dev`, `PORT=3001 pnpm --filter @globetrot/web dev` |
| `HOSTNAME` | `0.0.0.0` in the image | — | Bind address of the standalone server |
| `NEXT_TELEMETRY_DISABLED` | `1` in the image | — | Disables Next.js telemetry |

## Database tooling (`packages/db`)

| Variable | Default | What it does |
|---|---|---|
| `DATABASE_URL` | local compose database | Read by `migrate`, `reset` and the integration tests. `reset` **refuses** non-local hosts and `NODE_ENV=production`. Test databases are created and dropped on the server named by it (or the local default), only as `globetrot_test_*` |

## Local services (`compose.yaml`, `.env`)

Used by Docker Compose and the services check, not by the apps (the S3 settings have no application reader yet).

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
