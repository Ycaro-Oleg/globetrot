# Current state

_Last updated: 2026-11-27, release v0.3.1. Code state: `main` is release **v0.3.1** (#178, `develop` at #177); `develop` includes #83 to #177. v0.3.1 adds the R$49 trip pass with Pip credits (#173), Pip on DeepSeek only with every public web setting passed to the image build (#176), and production on Railway (#177, [ADR-0034](../architecture/adr/0034-hosting-on-railway.md)). The first Railway deploy is in progress with the owner; what remains is the owner's (table below): provider keys, Stripe Prices, partner ids, inbound email, and reviewing the ranges marked approximate in [`suggested-plans.md`](../product/research/suggested-plans.md) and the miles values. The [launch runbook](../engineering/launch-runbook.md) lists what the owner must provide. The repository is public, so GitHub Actions runs every job (CI green on `develop` at #177)._

Read this first. It says where the project is, what exists, what is open, what only the owner can unblock and what to do next. Procedure for working: [`playbook.md`](playbook.md). Feature-by-feature progress: [`../product/progress.md`](../product/progress.md). Milestones and exit criteria: [`../product/roadmap.md`](../product/roadmap.md).

## Snapshot

- **Design handoff v2 is the visual direction** (slate, blue and coral; one TopBar on every screen; Bricolage Grotesque headings and Instrument Sans text since November 2026). The tokens, fonts and the shell are v2; every screen picks up the v2 palette, hairlines and pills through the tokens. **The Budget screen is rebuilt** (answer card with a live monthly slider and a six-month chart, totals by status, a trip ceiling, the expense drawer). **The Days screen is rebuilt** (a stored day plan: places on days, drag and drop and "Move to", undo). **The Lists screen is rebuilt** (stamp celebration, passport tab). **The Landing and the account screens are v2.** **The Onboarding is built** (`/onboarding`, first trip in seven steps). **The Profile and My Pip are built** (`/app/profile`: the stored Pip look and name, worn by every Pip; visas by year and continent). **The Community is built** (`/app/community`: feed, composer, comments, likes, follows, mute and report, person and post pages; ADR-0013). Every screen of the handoff now exists. **Photos work** (uploads to S3-compatible storage with metadata removed, on posts and the pin card; ADR-0014).
- **Active milestone: M3 App Foundation.** 13 of 13 issues are done in code; #55 stays open for the owner's real-provider smoke run. M2 (engineering foundation) is complete. M0 (product foundation) is complete. **M1 (design system and spikes) is partly open**: the owner reviewed and approved the remaining screen studies (#7 closed on 2026-11-13); the other open items need the owner.
- **What works end to end today** (checked against the real API, Postgres and Mailpit): a person can see the landing page, create an account in English or Portuguese, confirm the email through Mailpit, log in, create a trip, see it in the list and switcher, archive it and undo, open the world-map board, search places, pin a route, change language, currency, country, nationality, time zone, units, theme (day, red-eye or follow the device) and motion, recover a password and log out.
- **The map board follows the design handoff v2** (#75, map board v2): a full-bleed map with Atlas, Terrain and Slate styles and country fills, teardrop pins with a count badge and a pin card that can be dragged and expanded (spots, notes, to-dos, photos), arcs with a comet, a slate route panel (reorder, undo, nights, dates, distances), a stop detail (nearby places, leg, mark visited, remove), place search on the server, a phone bottom sheet with "Pin here". Marking the first stop in a country visited stamps a **commemorative visa** (`GET /v1/visas`). Still to do: photos on the pin card (uploads), state outlines (own boundaries), the v2 tokens, type and TopBar shell (a separate change), costs per stop.
- **The landing page is complete in code** (#74): every section, the approved prices (from `PLAN_TERMS`, never the copy; a catalog test enforces it), example trips that survive sign-up and land ready to copy, metadata, social image, `robots.txt` and sitemap. Legal text and the owner's review remain.
- **Launch polish (#118 to #124), walked in a real browser:** a one-time language offer from the browser's language and `?lang=` ad links; the shared trip, its preview and its social image speak the sharer's language; after the free week every refused change leads to the plan page with the reason, and "Create trip" goes there directly; dark theme and phone fixes from a full screen sweep.
- **Checklists and the visa page work** (`/app/lists`): four lists per trip (add, check, remove, a suggested starter list) and the nine readiness stamps as they stand now. The budget (costs, conversion, savings answer) and the Days page work too.
- **The passport screen works** (`/app/passport`): the account's commemorative visas, newest first, with country, city and date, an empty state that leads to the board, and the "not an official document" note.
- **Pip v1 works behind `FEATURE_PIP`** on DeepSeek (ADR-0016), with Claude Haiku as the backup when DeepSeek does not answer (ADR-0022): ask, review a change list, apply, undo. Pip is a floating button on every screen except the map and its own page.
- **Planning together works** (ADR-0024): the owner sends an invite link (editor or viewer, 7 days, revocable); members see the trip as "Shared", editors change the plan, only the owner manages it; the free plan lets one person join; shared trips refresh every 30 seconds. No live sync yet. **Money between them** (ADR-0025): each person's part (equal or custom), their own savings and when they will have it, who paid each cost, and the settling up of paid costs.
- **The saving habit works** (ADR-0026): a weekly check-in with a streak, countdown phases with checklist suggestions, the Today screen (`/app/today`) and a Sunday reminder email from the worker (off in Settings).
- **Offline reading works** on paid trips (ADR-0027): a service worker keeps the trip's five screens, warms them once, and is cleared on sign-out.
- **Growth pages** (ADR-0028): public, indexable itineraries for each suggested destination in both languages (in the sitemap, with social images) and a 1080×1920 progress card for stories from a trip's public link.
- **Referrals work** (ADR-0029): a link per account, kept 30 days, claimed within 7 days of signing up; a friend's first payment earns a free trip pass, used from the trip's page.
- **Miles count** (ADR-0030): balances in five Brazilian programmes with researched value ranges, miles put towards a trip, and the savings answer counting them.
- **Partner links and the dashboard** (ADR-0031): labelled partner links for tours, stays, insurance and eSIM when the ids are set; `/app/admin/metrics` for `ADMIN_EMAILS` with activation, retention, sharing and paying counts.
- **Bookings by email** (ADR-0032): a private forwarding address per account; a forwarded confirmation becomes a Pip proposal on the latest trip.
- **Eight suggested destinations** (Japan, Portugal, Argentina and Uruguay, Italy, Chile, Mexico, Paris, New York) and a curation script (`infra/scripts/draft-destination.mjs`) that drafts a stop from Wikivoyage for review.
- **The trip workspace** (ADR-0035): `/app/trip` is the home of the app. A sidebar of the trip's sections (overview, places, every day, budget, checklist, expand map), the trip's document with the itinerary day by day, and from 1100px the map on the right following the day being read; a jump bar and a "Map" button on a phone. `/app/days` redirects to the itinerary; the full map stays at `/app/board`.
- **Navigation in three areas** (November 2026): the trip (its workspace, and the full map), Discover (ready plans that become a trip in one tap, and the community when `FEATURE_COMMUNITY` is on; it is off by default) and you (the avatar menu). Place icons on the map are SVG. The app is installable (web manifest and icons).
- **Monitoring and product analytics are wired and off until configured** (ADR-0021): Sentry for errors in web, API and worker; PostHog for the named product events, cookieless until consent. **Clean metrics** (#190, [`analytics.md`](../engineering/analytics.md)): `?interno=1` and admin accounts keep the team's browsers out of PostHog, Plausible and the Pixel; each product event counts once per action and carries only `locale`; the first-visit origin is kept per tab for the interest list; the doc defines the pre-sales dashboard (8 metrics). The CTO confirms PostHog's cookieless setting; the owner creates the project and switches cookieless mode on.
- **Plans and credits are built** (ADR-0019, changed by ADR-0023 and ADR-0033): a 7-day free week, then **free for good with one active trip** (5 Pip credits a month, one guest); Explorer and Voyager; a **trip pass** (one payment per trip, not counted in the limit, with 50 Pip credits); **prices in reais** for people whose currency is BRL (Explorer R$14,90, Voyager R$29,90, pass R$49, credit packs R$14,90 and R$4,90); promotion codes on every checkout; no read-only wall, only "archive, add a pass or choose a plan" when more trips are active than the plan keeps. **Stripe is built** (Checkout, Portal, webhooks, Pix for one-time payments via the dashboard) and off until the `STRIPE_*` settings are set (**owner:** the [steps](../integrations/stripe.md#switching-it-on-the-owner-in-the-stripe-dashboard-test-mode-first), test mode first, including the new trip pass and BRL Prices).
- **Pip has its six states** drawn in code (idle, research, draft, deliver, celebrate, unsure) and used where they fit; commissioning final Rive art stays the owner's choice (#9).
- **Days suggests places** near each stop (Geoapify when the key is set, a built-in list for popular cities otherwise), one tap each, and exports the days to a calendar file.
- **Trips can be shared** by a private link (`/t/{slug}`) with a social image for X and chats; month only, amounts only when chosen, stop for good.
- **First run, walked as a new user** (landing calculator → sign-up → email → onboarding → board → every tool): the sign-up repeats the saved landing plan and has no terms checkbox; the confirmed-email page has one clear call to action; onboarding offers popular destinations in one tap and place search falls back to built-in popular cities, so the first trip always has a stop; the new trip starts with the suggested checklist; an empty Days plan invites the first place.  The owner confirmed `REQUIRE_VERIFIED_EMAIL=true` (2026-11-14): a password sign-in needs a confirmed email.
- **What does not exist yet:** a staff review queue for community reports, blocking, visa privacy, deployment (billing is built and waits for the owner's Stripe settings: ADR-0019). The trip's page shows the nine stamps and the next steps; the start date can be set there and in the trip's itinerary.
- **Branches:** `main` holds release **v0.3.1** (tagged, with release notes on GitHub; v0.1.0, v0.2.0 and v0.3.0 before it). Railway deploys from `main`; `develop` is the integration branch. All work goes through `feature/*` or `docs/*` PRs into `develop`.

## Milestone board

| Milestone | State | Open issues | Notes |
|---|---|---|---|
| M0 Product Foundation | **Complete** (the GitHub milestone is still open: the owner decides when to close it) | 0 | Vision, PRD, business rules, roadmap, design audit, ADRs 0001–0009, agent docs |
| M1 Design System & Spikes | **Partly open** | #4, #6, #8, #9 | #2 MapLibre and #3 places spikes and #5 tokens are done; #7 approved and closed (2026-11-13). The design handoff v2 now supersedes the v1 prototype. |
| M2 Engineering Foundation | **Complete** (closed) | 0 | Monorepo, CI, local services, domain rules (money, trips), i18n, standards |
| **M3 App Foundation** | **Active** | #55 | Done: #50, #52, #53, #54, #56, #57, #58, #59, #60, #61, #62, #63. Plan and dependency table: [`m3-foundation-breakdown.md`](../engineering/m3-foundation-breakdown.md) |
| M4 Travel Workspace & Map | **Started** (starter board, #75) | #75 | Needs M3 to finish. Map, search and a local route exist; persistence on the trip, mobile sheet and the rest are open. More issues are created when M3 nears its end |
| M5 Itinerary & Checklists | **Started** (Days page, checklists) | — | Open: activities per day and drag and drop, storing stamps, the celebration |
| M6 Budget & Savings | **Started** (budget v1, #83) | — | Open: a rates source, per-stop costs, editing a cost in place |
| M7 Pip v1 | Not started | — | |
| M8 Landing & MVP RC | **Started** (landing done in code, #74) | #74 | Prices are approved and wired; example trips work. Legal pages and the owner's review are open |
| M9 and later | Not started | — | See the roadmap |

## What exists (by area)

Details live in the owning docs; this is the map.

| Area | State | Owning doc |
|---|---|---|
| Monorepo, CI, Docker images, local services | Done. Dockerfiles for web, api and worker (the worker is a placeholder). CI runs format, lint, typecheck, unit tests, build, integration tests (Postgres + Mailpit) and axe | [`project-structure.md`](../engineering/project-structure.md), [`git-workflow.md`](../engineering/git-workflow.md) |
| Domain (`@globetrot/domain`) | Money (minor units, ISO 4217 registry, FX with provenance, formatting), local dates, trip days, totals, savings plan, nine readiness milestones, journey stage, next steps, trip status constants, ISO 3166 countries, IANA time zones, UUIDv7, password limits | [`money.md`](../architecture/money.md), [`business-rules.md`](../product/business-rules.md) |
| Application (`@globetrot/application`) | Actor, `defineOperation`, typed errors, `assertOwner`, ports, units of work; operations `getCurrentUser`, trips (create, list, get, update, archive), preferences (get, update); `EmailPort` and templates | [`api-contracts.md`](../architecture/api-contracts.md) |
| Database (`@globetrot/db`) | Drizzle; migrations 0000 to 0009; tables `user`, `session`, `account`, `verification`, `rate_limit`, `trip`, `idempotency_key`, `audit_event`, `user_preference`, `destination`, `expense`, `trip_savings`, `checklist_item`; repositories and the throwaway test database | [`data-model.md`](../architecture/data-model.md) |
| API (`apps/api`) | Hono + OpenAPI. Better Auth at `/api/auth/*`. `/v1`: `me`, `me/preferences`, `trips`, `trips/{id}/budget`, `expenses`, `savings` and `checklist`, `places/search` and `places/reverse`, `auth/providers`, `openapi.json`. Problem+json errors, Origin check, rate limits | [`api-contracts.md`](../architecture/api-contracts.md), [`authentication.md`](../architecture/authentication.md) |
| Web (`apps/web`) | next-intl (en, pt-BR); proxy to the API; public landing `/`; `/login`, `/signup`, `/recover`, `/reset-password`, `/email-verified`, draft `/terms` and `/privacy`; the `/app` shell (rail, tab bar, account menu, trip switcher); `/app/trips` and `/app/trips/[id]` (list, filters, create, archive and undo, overview); `/app/board` (starter map); `/app/days`, `/app/budget` and `/app/lists`; `/app/passport` (commemorative visas); `/app/pip` behind `FEATURE_PIP`; provisional `/settings`. Brand fonts are self-hosted | [`authentication.md`](../architecture/authentication.md#screens-appsweb), [`design-system.md`](../design/design-system.md), [`i18n.md`](../architecture/i18n.md) |
| UI (`@globetrot/ui`) and tokens | Tokens v1.1 (day and red-eye themes); eleven primitives (Button, TextField, Checkbox, Switch, StatusMark, SelectField, Range, Banner, Modal, SegmentedControl, Toast) with stories and axe in CI. More components are part of #6 | [`design-system.md`](../design/design-system.md) |
| i18n (`@globetrot/i18n`) | en and pt-BR catalogs with a CI consistency check; namespaces `status`, `journey`, `milestones`, `nextSteps`, `savings`, `trip`, `webScaffold`, `settings`, `email`, `auth`, `legal`, `app`, `shell`, `tripWorkspace`, `landing`, `mapBoard` | [`i18n.md`](../architecture/i18n.md) |
| Spikes | MapLibre (go, with conditions), places on GeoNames + PostGIS (go), geocoding (initial research only) | [`spikes/`](../architecture/spikes/) |

## Owner-dependent items

These cannot be finished by an agent. Do not work around them, and do not mark them done.

| Item | What is needed from the owner | Blocks |
|---|---|---|
| **Google sign-in credentials (#55)** | A Google OAuth client for a test environment, with the callback URL, supplied through environment variables (never in the repo), and a real-provider smoke test | #55's real-provider verification. The code can be written and tested without them |
| **Component and screen-reader review (#6)** | Manual keyboard and screen-reader pass on the Storybook components | Closing #6 |
| **Usability test (#8)** | Five real participants (en and pt-BR) following [`usability-01.md`](../product/research/usability-01.md) | Closing M1; informs the board design |
| **Geocoding provider (#4)** | Provider accounts and keys for quality tests, then a decision | Address search; not needed for city search from GeoNames |
| **Pip brief (#9)** | Approve [`pip-character.md`](../design/pip-character.md) and choose an illustrator | The Pip assets (M7) |
| **Real-device MapLibre test** | Run the frame-rate test on a mid-range Android phone ([`spikes/maplibre.md`](../architecture/spikes/maplibre.md)) | Final go for the board (M4) |
| **Legal text** | Fill the `[bracketed]` facts in the drafted Terms and Privacy policy and have them reviewed; then remove the draft banner. Acceptance is not stored yet | A public release |
| **Production email provider** | Resend is chosen: verify the sending domain (SPF, DKIM, DMARC), create a sending key and set `SMTP_*` and `EMAIL_FROM` ([launch runbook](../engineering/launch-runbook.md)) | Production. SMTP settings are the only change |
| **GitHub billing** | Only if the repository goes private again: fix the account's billing or raise the spending limit (Settings → Billing & plans) | CI on every PR while private |
| **Stripe Prices for ADR-0023 and ADR-0033** | Create the trip pass Price (US$9.99) and the BRL Prices (Explorer R$14,90/R$119, Voyager R$29,90/R$239, top-up R$14,90, pass R$49), the optional 50-credit pack (US$0.99, R$4,90), the `LANCAMENTO` and `FUNDADOR` coupons; set `STRIPE_PRICE_TRIP_PASS`, `STRIPE_PRICE_TOP_UP_SMALL*` and the `*_BRL` settings, switch Pix on for one-time payments | Charging for passes and in reais |
| **Imagery licensing source** | Choose where destination images come from | Imagery in the board and landing |
| **Production object storage** ([ADR-0014](../architecture/adr/0014-photos-and-storage.md), [ADR-0034](../architecture/adr/0034-hosting-on-railway.md)) | Create the Railway Bucket and set its credentials in `S3_*` as secrets | Photos in production |
| **Inbound email for bookings** ([ADR-0032](../architecture/adr/0032-bookings-by-email.md)) | Set up inbound email on the provider (MX for a subdomain, the webhook to `/v1/inbound/email` with the secret) and set `INBOUND_EMAIL_SECRET` and `INBOUND_EMAIL_DOMAIN` | Forwarding bookings |
| **Partner programmes and the dashboard** ([ADR-0031](../architecture/adr/0031-partner-links-and-metrics.md)) | Join GetYourGuide and Booking.com affiliate programmes and choose insurance and eSIM partners; set `GETYOURGUIDE_PARTNER_ID`, `BOOKING_AID`, `PARTNER_INSURANCE_URL`, `PARTNER_ESIM_URL`; set `ADMIN_EMAILS` | Partner revenue; seeing the dashboard |
| **Miles values review** ([ADR-0030](../architecture/adr/0030-miles-in-the-savings.md)) | Review the value ranges per thousand miles and refresh them from time to time | Confidence in the miles answer |
| **Suggested plans review** ([ADR-0020](../architecture/adr/0020-suggested-plans-and-curated-cost-ranges.md)) | Review the landing's suggested-plan texts and the cost ranges marked approximate in [`suggested-plans.md`](../product/research/suggested-plans.md); including the five destinations added on 2026-11-27 (New York first, then the tour prices of Chile and Mexico) | Confidence in the estimates shown on the landing |
| **DeepSeek key and privacy text** ([ADR-0016](../architecture/adr/0016-pip-on-deepseek.md)) | Rotate the key that was shared in chat and keep the new one only in local `.env` and the production secret store; say in the privacy policy that Pip sends trip plans to DeepSeek; decide when to switch `FEATURE_PIP` on | Pip in production |
| **Community before a public launch** ([ADR-0013](../architecture/adr/0013-community.md)) | Decide who reviews reported posts (and with what tool), whether to add blocking and private accounts, and the community rules text | A public release with the community on |
| **Launch infrastructure** ([launch runbook](../engineering/launch-runbook.md), [ADR-0034](../architecture/adr/0034-hosting-on-railway.md)) | The Railway project (PostGIS with daily backups, bucket, `api`, `worker`, `web` from `main`), the domain with DNS on Cloudflare, production secrets, then the client address check in the runbook | The public launch |
| **Monitoring, analytics and the backup model** ([ADR-0021](../architecture/adr/0021-error-monitoring-and-product-analytics.md), [ADR-0022](../architecture/adr/0022-backup-ai-provider.md)) | Create the Sentry and PostHog projects; set `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` and `NEXT_PUBLIC_POSTHOG_KEY`; name both in the privacy policy. In PostHog, switch on cookieless mode and the `globetrot.com.br` filter, build the dashboard ([steps](../engineering/analytics.md#steps-for-whoever-has-posthog-access)), and open `?interno=1` once on each of your devices. `ANTHROPIC_API_KEY` stays unset (DeepSeek only, owner decision of 2026-11-27) | Seeing errors and funnels in production |
| **Close the M0 milestone** | A GitHub setting, so it is the owner's call | Housekeeping only |

## Known gaps and debt

Honest list of what is missing or deliberately simple, so nobody assumes otherwise.

- **Account export and deletion** exist (ADR-0015). Open points: legal review of keeping the audit log, a fresh-session check before deleting.
- **Photos:** no thumbnails; no production storage provider chosen (owner). Unplaced uploads and stray objects are swept by the worker.
- **Community:** no staff review queue for `post_report` (three reports hide a post until then), no blocking, no notifications or unread badge, no search. Handles are created on first action; nobody is listed before that.
- **Terms acceptance is not stored** (needs the final legal text and a version).
- **Trips: no pagination** (a list returns at most 200), delete only after archiving, and visibility is always `private`.
- **The worker runs hourly housekeeping** (ADR-0017); there is no queue yet (pg-boss when queued work appears).
- **Migrations in production** run as the API image's release command (`node dist/migrate.js`).
- **Health:** `/health` (liveness) and `/ready` (database) on the API.
- **No seed script.** Three example trips can be copied from the landing or `/app/trips?example=…`, but no script creates a test account; create one through `/signup` and Mailpit (to test the read-only state, move the user's `created_at` back eight days in the local database).
- **The Geoapify tile key is a public browser key** written into the bundle at build time (`NEXT_PUBLIC_GEOAPIFY_API_KEY`); restrict it to the site's domains and to tiles in the Geoapify dashboard. Search uses the server key `GEOAPIFY_API_KEY` (#75). The place-lookup rate limit counts in memory, per API process.
- **An unknown or foreign trip id shows a "not found" page with status 200**, not a 404 (the loading boundary has already sent the status). Harmless; fix if it matters for monitoring.
- **The board keeps its own palette** (design handoff v2): the map is always light and its panels always slate, in both app themes; its colours still live in `world-map.module.css` rather than the v2 tokens.
- **Light surfaces inside the red-eye theme** (auth panel, landing sections, some trip-card controls) are hard-coded light and use the `always-light` token overrides; any new light surface must do the same or axe fails on contrast in the red-eye theme.
- **The end-to-end suite is one journey** (`apps/web/e2e/journey.mjs`, #63): sign-up to trip to theme and keyboard, two widths, two languages. The board, itinerary and budget have no journey yet (M4 onwards). The account screens, the shell and the trip screens also have the stand-in browser check (`pnpm --filter @globetrot/web test:a11y`).
- **Not verified by a person:** screen readers on any screen (including the shell's navigation and account menu); the shell on a real phone (safe-area, on-screen keyboard); the account screens at very large font sizes in pt-BR; MapLibre on a real phone.
- The client address used for rate limits is only trustworthy behind a trusted edge, and the API must not be reachable from the internet ([`authentication.md`](../architecture/authentication.md#which-client-address-counts-trust-model)).
- `NextIntlClientProvider` ships the whole catalog to the browser (fine for now; see [`i18n.md`](../architecture/i18n.md)).
- Nothing is deployed. There is no CD pipeline, monitoring or backup yet (M11).

## Next

The product is feature-complete for launch in code; what remains is mostly the owner's (table above). Agent work, in order:

1. Keep walking real flows in the browser (desktop and phone, en and pt-BR) and fix what hurts conversion; one focused PR each.
2. When the owner provides Stripe test keys: run the checkout, portal and webhook path end to end ([`stripe.md`](../integrations/stripe.md)).
3. When the owner provides the infrastructure: follow the [launch runbook](../engineering/launch-runbook.md).
4. **#55** Google sign-in's real-provider smoke test, with the owner's OAuth credentials.

## Decisions taken (summary)

- Stack: TypeScript monorepo, Next.js, Hono, PostgreSQL + PostGIS, Drizzle ([ADR-0002](../architecture/adr/0002-monorepo-and-stack.md)).
- The MVP is a responsive web app/PWA; Expo apps come after the MVP.
- Pip v1 joins the MVP behind a flag (M7). AI is optional and only proposes.
- Protection of `main` and `develop` is by convention plus CI ([ADR-0009](../architecture/adr/0009-git-workflow.md)).
- The web app proxies the API so the session cookie is first-party ([ADR-0010](../architecture/adr/0010-web-proxies-the-api.md)).
- Mutations are one transaction with audit and idempotency ([ADR-0011](../architecture/adr/0011-idempotency-audit-and-units-of-work.md)).
- Email goes through a port and SMTP; a password sign-in needs a verified address ([ADR-0012](../architecture/adr/0012-email-delivery-and-verified-sign-in.md)).
- The Stripe account is in Brazil ([`stripe.md`](../integrations/stripe.md)). Pricing is approved: 7-day trial, Explorer and Voyager, Pip credits ([ADR-0019](../architecture/adr/0019-plans-trial-and-pip-credits.md)).
- The passport belongs to the account, with a visa page per trip ([business rules](../product/business-rules.md#passport)).
- Language, currency, country, nationality and time zone are independent, and USD is the default currency.

## Open decisions

- Production email provider (Resend or Postmark).
- Managed geocoding provider (#4).
- Pip illustrator and asset timeline.
- Imagery licensing source.
- Legal review of the retention position: the audit log is kept after account deletion ([ADR-0015](../architecture/adr/0015-account-export-and-deletion.md)).
- Whether to keep `audit_event` metadata to field names only, or add values with a retention policy ([ADR-0011](../architecture/adr/0011-idempotency-audit-and-units-of-work.md)).

## Blockers

No technical blocker for #55's code; its real-provider test needs the owner's credentials.
