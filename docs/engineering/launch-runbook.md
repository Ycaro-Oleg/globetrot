# Launch runbook

How to put Globetrot in production on Hetzner + Coolify ([ADR-0002](../architecture/adr/0002-monorepo-and-stack.md)), and what must be true before the first visitor arrives. Every setting is described in [`configuration.md`](configuration.md); secrets live only in Coolify, never in the repository, a document or a chat.

## 1. Decisions only the owner can make

Nothing below can be done by an agent; each blocks the public launch.

| Item | What is needed |
|---|---|
| Server and domain | A Hetzner server with Coolify, the domain, DNS pointing to it, TLS (Coolify issues it) |
| Database | Managed or Coolify-run PostgreSQL 17 with PostGIS, with daily backups and a tested restore |
| Email | A provider account (Resend or Postmark), a verified sending domain (SPF, DKIM), `SMTP_*` and `EMAIL_FROM` |
| Photo storage | An S3-compatible bucket (Hetzner Object Storage or other), private, with its keys |
| Pip | A new DeepSeek key (rotate the one shared in chat) as a Coolify secret; decide whether `FEATURE_PIP=true` at launch |
| Measurement | A Plausible site and, for ads, a Meta Pixel ID ([ADR-0018](../architecture/adr/0018-launch-measurement-and-consent.md)) |
| Legal | Fill the `[bracketed]` facts in the Terms and Privacy drafts (`legal.*` in the catalogs) and have them reviewed; then drop the draft banner |
| Payments | Stripe account (Brazil), test keys first; the Price IDs for Explorer and Voyager (monthly and yearly) and the top-up; the webhook endpoint; live keys only when ready to charge ([steps](../integrations/stripe.md#switching-it-on-the-owner-in-the-stripe-dashboard-test-mode-first)) |

## 2. Services in Coolify

Three images, built from the repository root (`docker build -f apps/<app>/Dockerfile .`):

| Service | Image | Port | Health | Notes |
|---|---|---|---|---|
| web | `apps/web/Dockerfile` | 3000 | `GET /` | `API_INTERNAL_URL` points at the API's internal address. `NEXT_PUBLIC_*` values are **build arguments** |
| api | `apps/api/Dockerfile` | 4000 | `GET /ready` (checks the database; the image declares it) | **Pre-deployment command: `node dist/migrate.js`** (applies migrations, safe to repeat) |
| worker | `apps/worker/Dockerfile` | — | process alive | Hourly housekeeping ([ADR-0017](../architecture/adr/0017-worker-housekeeping.md)); one instance is enough |

Only the web service is public. The browser reaches `/api/auth/*` and `/v1/*` through it ([ADR-0010](../architecture/adr/0010-web-proxies-the-api.md)).

## 3. Settings that production refuses to start without

- **API:** `DATABASE_URL`, `BETTER_AUTH_SECRET` (32+ characters, not the dev one), `BETTER_AUTH_URL` (https, the public web origin), `SMTP_HOST`, `EMAIL_FROM`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (not the dev pair).
- **Worker:** `DATABASE_URL`, the same `S3_*`, `SMTP_HOST`, `EMAIL_FROM` and an https `BETTER_AUTH_URL` (the trial emails).
- **Web:** `API_INTERNAL_URL`.
- Optional: `GEOAPIFY_API_KEY` (place search; without it search says it is unavailable) and `NEXT_PUBLIC_GEOAPIFY_API_KEY` (map tiles, restricted to the domain), `DEEPSEEK_API_KEY`, the `STRIPE_*` group, `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `NEXT_PUBLIC_META_PIXEL_ID`.

## 4. First deploy, in order

1. Create the database; deploy the API with its pre-deployment command (migrations run first).
2. Check `GET /ready` answers `{"status":"ready"}`.
3. Deploy the worker, then the web with its build arguments.
4. Smoke test on the real domain: sign up with a real inbox, confirm the email, create a trip from the landing calculator, add a stop, a cost and a photo, ask Pip (if on), post in the community, export your data, delete a test account.
5. Check that responses are compressed (`content-encoding: br` or `gzip` on `/` and `/world-halftone-blue.svg`; turn on Coolify's compression if not) and that the landing loads under 2.5 s on a phone.
6. Point ads and posts aimed at Portuguese speakers to `https://<domain>/?lang=pt-BR`; an ad for one example can go straight to `https://<domain>/signup?next=%2Fapp%2Ftrips%3Fexample%3Dportugal&lang=pt-BR` (and English ones to `?lang=en`): the page opens in that language with no extra click ([`i18n.md`](../architecture/i18n.md)).
7. Check response headers on `/` (`Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`) and that the consent banner appears only with a Pixel ID.

## 5. After launch

- Watch the API and worker logs: they carry kinds and counts only, never personal data.
- Backups: confirm the first nightly backup and a restore into a scratch database.
- Reports in the community have no staff queue yet; three distinct reports hide a post ([ADR-0013](../architecture/adr/0013-community.md)). Decide who reads `post_report`.
