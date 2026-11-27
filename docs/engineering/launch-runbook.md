# Launch runbook

How to put Globetrot in production on Railway ([ADR-0034](../architecture/adr/0034-hosting-on-railway.md)), and what must be true before the first visitor arrives. Every setting is described in [`configuration.md`](configuration.md); secrets live only in Railway's service variables, never in the repository, a document or a chat.

## 1. Decisions only the owner can make

Nothing below can be done by an agent; each blocks the public launch.

| Item | What is needed |
|---|---|
| Hosting and domain | A Railway account (Hobby to start), the domain with its DNS on a provider that allows a CNAME at the root (Cloudflare), TLS (Railway issues it) |
| Database | Railway PostgreSQL 17 with PostGIS on a volume, daily backups switched on and a restore tested |
| Email | Resend: a verified sending domain (SPF, DKIM, DMARC), an API key used as `SMTP_PASSWORD`, and `EMAIL_FROM` |
| Photo storage | A Railway Bucket, private, with its credentials in `S3_*` |
| Pip | A new DeepSeek key (rotate the one shared in chat). Pip runs on DeepSeek only; `ANTHROPIC_API_KEY` stays unset ([ADR-0022](../architecture/adr/0022-backup-ai-provider.md)) |
| Measurement | Sentry and PostHog projects ([ADR-0021](../architecture/adr/0021-error-monitoring-and-product-analytics.md)); for ads, Plausible and a Meta Pixel ID ([ADR-0018](../architecture/adr/0018-launch-measurement-and-consent.md)) |
| Legal | Fill the `[bracketed]` facts in the Terms and Privacy drafts (`legal.*` in the catalogs) and have them reviewed; then drop the draft banner |
| Payments | Stripe account (Brazil), test keys first; the Price ids, the webhook endpoint and the coupons; live keys only when ready to charge ([steps](../integrations/stripe.md#switching-it-on-the-owner-in-the-stripe-dashboard-test-mode-first)) |

## 2. Services on Railway

One project, region US East. The three app services are created from the GitHub repository, branch `main`, with an empty root directory (the Dockerfiles build from the repository root).

| Service | `RAILWAY_DOCKERFILE_PATH` | Port | Health check | Notes |
|---|---|---|---|---|
| `Postgres` | none (PostGIS template or `postgis/postgis:17-3.7` with a volume) | 5432 | — | Others read `${{Postgres.DATABASE_URL}}`. Backups: the volume's Backups tab, daily |
| Bucket | none (Railway Bucket) | — | — | Private. Its Credentials tab gives the `S3_*` values; `S3_FORCE_PATH_STYLE=false` (try `true` if uploads fail) |
| `api` | `apps/api/Dockerfile` | 4000 | `/ready` (checks the database) | **Pre-deploy command: `node dist/migrate.js`** (applies migrations, safe to repeat). No public domain. `CLIENT_IP_HEADER=x-real-ip` |
| `worker` | `apps/worker/Dockerfile` | — | none | Hourly housekeeping and the weekly reminders ([ADR-0017](../architecture/adr/0017-worker-housekeeping.md)); one instance |
| `web` | `apps/web/Dockerfile` | 3000 | `/` | The only public service, on the custom domain. `API_INTERNAL_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:4000`. `NEXT_PUBLIC_*` values are **build arguments**: change one, redeploy |

The browser reaches `/api/auth/*` and `/v1/*` through the web service ([ADR-0010](../architecture/adr/0010-web-proxies-the-api.md)). The worker can reuse the API's values with references such as `${{api.SMTP_PASSWORD}}`.

## 3. Settings that production refuses to start without

- **API:** `DATABASE_URL`, `BETTER_AUTH_SECRET` (32+ characters, not the dev one), `BETTER_AUTH_URL` (https, the public web origin), `SMTP_HOST`, `EMAIL_FROM`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (not the dev pair), `CLIENT_IP_HEADER` (`x-real-ip` on Railway).
- **Worker:** `DATABASE_URL`, the same `S3_*`, `SMTP_HOST`, `EMAIL_FROM` and an https `BETTER_AUTH_URL` (the trial emails).
- **Web:** `API_INTERNAL_URL`.
- Optional: `GEOAPIFY_API_KEY` (place search; without it search says it is unavailable) and `NEXT_PUBLIC_GEOAPIFY_API_KEY` (map tiles, restricted to the domain), `DEEPSEEK_API_KEY` with `DEEPSEEK_MODEL=deepseek-flash`, the `STRIPE_*` group, `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS`, `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `NEXT_PUBLIC_META_PIXEL_ID`.
- Resend over SMTP: `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_USER=resend`, `SMTP_PASSWORD=<the re_ key>`. The free plan sends 100 emails a day; move to a paid plan before the weekly reminders reach about 80 people, since they go out on the same day.

## 4. First deploy, in order

1. Create the database and the bucket; deploy the API (its pre-deploy command runs the migrations first).
2. Check the API's deploy logs show the migrations and that `/ready` passed the health check.
3. Deploy the worker, then the web with its build arguments; add the custom domain to the web service and its CNAME in DNS (proxy off, "DNS only").
4. Smoke test on the real domain: sign up with a real inbox, confirm the email, create a trip from the landing calculator, add a stop, a cost and a photo, ask Pip (if on), invite a second account, export your data, delete a test account.
5. **Client address check:** send six wrong sign-ins to `https://<domain>/api/auth/sign-in/email` with a made-up account, each with a different made-up `X-Real-IP` **and** a different made-up `X-Forwarded-For` header in the same request (for example `X-Real-IP: 203.0.113.1N` and `X-Forwarded-For: 198.51.100.1N` for N = 1 to 6). The sixth must answer `429`, and the API logs must not contain "Rate limiting could not determine a client IP" (a `429` with that warning comes from one bucket shared by every visitor, not from your address). If either fails, Railway's edge is passing the client's header through and the rate limits can be bypassed: stop and fix the trust model ([authentication](../architecture/authentication.md#which-client-address-counts-trust-model)) before opening.
6. Check that responses are compressed (`content-encoding: br` or `gzip` on `/` and `/world-halftone-blue.svg`) and that the landing loads under 2.5 s on a phone.
7. Point ads and posts aimed at Portuguese speakers to `https://<domain>/?lang=pt-BR`; an ad for one example can go straight to `https://<domain>/signup?next=%2Fapp%2Ftrips%3Fexample%3Dportugal&lang=pt-BR` (and English ones to `?lang=en`): the page opens in that language with no extra click ([`i18n.md`](../architecture/i18n.md)).
8. Check response headers on `/` (`Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`) and that the consent banner appears only with a Pixel ID.

## 5. After launch

- Watch the API and worker logs in Railway: they carry kinds and counts only, never personal data. Errors also reach Sentry when `SENTRY_DSN` is set.
- Backups: confirm the first daily backup of the database volume and a restore into a scratch database. Buckets have no backup on Railway; add a second copy when photos grow.
- Reports in the community have no staff queue yet; three distinct reports hide a post ([ADR-0013](../architecture/adr/0013-community.md)). The community stays off (`FEATURE_COMMUNITY` unset) until it has enough people.
