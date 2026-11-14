# Current state

_Last updated: 2026-11-14, day ideas. Code state: `develop` includes #83 to #114; ideas on the Days screen are in an open PR. The [launch runbook](../engineering/launch-runbook.md) lists what the owner must provide._

Read this first. It says where the project is, what exists, what is open, what only the owner can unblock and what to do next. Procedure for working: [`playbook.md`](playbook.md). Feature-by-feature progress: [`../product/progress.md`](../product/progress.md). Milestones and exit criteria: [`../product/roadmap.md`](../product/roadmap.md).

## Snapshot

- **Design handoff v2 is the visual direction** (slate, blue and coral; Plus Jakarta Sans; one TopBar on every screen). The tokens, fonts and the shell are v2; every screen picks up the v2 palette, hairlines and pills through the tokens. **The Budget screen is rebuilt** (answer card with a live monthly slider and a six-month chart, totals by status, a trip ceiling, the expense drawer). **The Days screen is rebuilt** (a stored day plan: places on days, drag and drop and "Move to", undo). **The Lists screen is rebuilt** (stamp celebration, passport tab). **The Landing and the account screens are v2.** **The Onboarding is built** (`/onboarding`, first trip in seven steps). **The Profile and My Pip are built** (`/app/profile`: the stored Pip look and name, worn by every Pip; visas by year and continent). **The Community is built** (`/app/community`: feed, composer, comments, likes, follows, mute and report, person and post pages; ADR-0013). Every screen of the handoff now exists. **Photos work** (uploads to S3-compatible storage with metadata removed, on posts and the pin card; ADR-0014).
- **Active milestone: M3 App Foundation.** 13 of 13 issues are done in code; #55 stays open for the owner's real-provider smoke run. M2 (engineering foundation) is complete. M0 (product foundation) is complete. **M1 (design system and spikes) is partly open**: the owner reviewed and approved the remaining screen studies (#7 closed on 2026-11-13); the other open items need the owner.
- **What works end to end today** (checked against the real API, Postgres and Mailpit): a person can see the landing page, create an account in English or Portuguese, confirm the email through Mailpit, log in, create a trip, see it in the list and switcher, archive it and undo, open the world-map board, search places, pin a route, change language, currency, country, nationality, time zone, units, theme (day, red-eye or follow the device) and motion, recover a password and log out.
- **The map board follows the design handoff v2** (#75, map board v2): a full-bleed map with Atlas, Terrain and Slate styles and country fills, teardrop pins with petals and a pin card (spots, notes, to-dos), arcs with a comet, a slate route panel (reorder, undo, nights, dates, distances), a stop detail (nearby places, leg, mark visited, remove), place search on the server, a phone bottom sheet with "Pin here". Marking the first stop in a country visited stamps a **commemorative visa** (`GET /v1/visas`). Still to do: photos on the pin card (uploads), state outlines (own boundaries), the v2 tokens, type and TopBar shell (a separate change), costs per stop.
- **The landing page is complete in code** (#74): every section, mock pricing labelled as placeholder, example trips a visitor can copy into an account, metadata, social image, `robots.txt` and sitemap. Real prices, legal text and the owner's review remain.
- **Checklists and the visa page work** (`/app/lists`): four lists per trip (add, check, remove, a suggested starter list) and the nine readiness stamps as they stand now. The budget (costs, conversion, savings answer) and the Days page work too.
- **The passport screen works** (`/app/passport`): the account's commemorative visas, newest first, with country, city and date, an empty state that leads to the board, and the "not an official document" note.
- **Pip v1 works behind `FEATURE_PIP`** on DeepSeek (ADR-0016): ask, review a change list, apply, undo.
- **Plans and credits are built** (ADR-0019): a 7-day trial from sign-up, Explorer (US$4.99/US$39.99) and Voyager (US$9.99/US$79.99), Pip credits per request with top-ups, read-only after the trial, `/app/plan`, the free-week line on every signed-in page, and two trial emails from the worker. **Stripe is built** (Checkout, Portal, webhooks) and off until the `STRIPE_*` settings are set (**owner:** the [steps](../integrations/stripe.md#switching-it-on-the-owner-in-the-stripe-dashboard-test-mode-first), test mode first).
- **Days suggests places** near each stop (Geoapify when the key is set, a built-in list for popular cities otherwise), one tap each.
- **Trips can be shared** by a private link (`/t/{slug}`) with a social image for X and chats; month only, amounts only when chosen, stop for good.
- **First run, walked as a new user** (landing calculator → sign-up → email → onboarding → board → every tool): the sign-up repeats the saved landing plan and has no terms checkbox; the confirmed-email page has one clear call to action; onboarding offers popular destinations in one tap and place search falls back to built-in popular cities, so the first trip always has a stop; the new trip starts with the suggested checklist; an empty Days plan invites the first place. **Owner decision for conversion:** set `REQUIRE_VERIFIED_EMAIL=false` in production so people go straight in after sign-up (ADR-0012 leaves it to the owner).
- **What does not exist yet:** a staff review queue for community reports, blocking, visa privacy, deployment (billing is built and waits for the owner's Stripe settings: ADR-0019). The trip's page shows the nine stamps and the next steps; the start date can be set there and on Days.
- **Branches:** `main` has no release yet; `develop` is the integration branch. All work goes through `feature/*` or `docs/*` PRs into `develop`.

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
| M8 Landing & MVP RC | **Started** (landing done in code, #74) | #74 | Pricing mock, example trips, SEO, performance and legal pages are open |
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
| **Confirm the verified-email policy** ([ADR-0012](../architecture/adr/0012-email-delivery-and-verified-sign-in.md)) | Say whether a password sign-in must require a verified email (current default, Google counts as verified), or unverified accounts may enter with a banner | Nothing now; it is a one-line change if the answer is "banner" |
| **Google sign-in credentials (#55)** | A Google OAuth client for a test environment, with the callback URL, supplied through environment variables (never in the repo), and a real-provider smoke test | #55's real-provider verification. The code can be written and tested without them |
| **Component and screen-reader review (#6)** | Manual keyboard and screen-reader pass on the Storybook components | Closing #6 |
| **Usability test (#8)** | Five real participants (en and pt-BR) following [`usability-01.md`](../product/research/usability-01.md) | Closing M1; informs the board design |
| **Geocoding provider (#4)** | Provider accounts and keys for quality tests, then a decision | Address search; not needed for city search from GeoNames |
| **Pip brief (#9)** | Approve [`pip-character.md`](../design/pip-character.md) and choose an illustrator | The Pip assets (M7) |
| **Real-device MapLibre test** | Run the frame-rate test on a mid-range Android phone ([`spikes/maplibre.md`](../architecture/spikes/maplibre.md)) | Final go for the board (M4) |
| **Legal text** | Fill the `[bracketed]` facts in the drafted Terms and Privacy policy and have them reviewed; then remove the draft banner. Acceptance is not stored yet | A public release |
| **Production email provider** | Choose Resend or Postmark, then provide settings and a verified sending domain | Production (M11). SMTP settings are the only change |
| **Pricing, plan limits, regional pricing** | A business decision | M10 |
| **Imagery licensing source** | Choose where destination images come from | Imagery in the board and landing |
| **Production object storage** ([ADR-0014](../architecture/adr/0014-photos-and-storage.md)) | Choose an S3-compatible provider (or self-host on the Hetzner box) and provide `S3_*` settings as secrets | Photos in production (M11) |
| **DeepSeek key and privacy text** ([ADR-0016](../architecture/adr/0016-pip-on-deepseek.md)) | Rotate the key that was shared in chat and keep the new one only in local `.env` and the production secret store; say in the privacy policy that Pip sends trip plans to DeepSeek; decide when to switch `FEATURE_PIP` on | Pip in production |
| **Community before a public launch** ([ADR-0013](../architecture/adr/0013-community.md)) | Decide who reviews reported posts (and with what tool), whether to add blocking and private accounts, and the community rules text | A public release with the community on |
| **Launch infrastructure** ([launch runbook](../engineering/launch-runbook.md)) | Server, domain, database with backups, email provider, photo bucket, production secrets, Plausible site and Meta Pixel ID | The public launch |
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
- **No seed or demo data.** There are no example trips yet (M8) and no script that creates a test account; create one through `/signup` and Mailpit.
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

Suggested order, from the [M3 breakdown](../engineering/m3-foundation-breakdown.md):

1. **#55** Google sign-in; the real-provider smoke test still needs the owner's OAuth credentials.
2. **M4** (map board): the starter exists (#75). Next for M4: pins and `PinConnection`, the stop panel (nights, notes, costs), the mobile sheet, server-side geocoding, about 10 to 15 at a time. The roadmap's exit criteria and [`progress.md`](../product/progress.md) say what each milestone must deliver.
3. **M8**: finish the landing (#74) when M4 to M7 are further along.

In parallel, and owner-driven: the M1 items above. A docs-only PR may fix gaps at any time.

## Decisions taken (summary)

- Stack: TypeScript monorepo, Next.js, Hono, PostgreSQL + PostGIS, Drizzle ([ADR-0002](../architecture/adr/0002-monorepo-and-stack.md)).
- The MVP is a responsive web app/PWA; Expo apps come after the MVP.
- Pip v1 joins the MVP behind a flag (M7). AI is optional and only proposes.
- Protection of `main` and `develop` is by convention plus CI ([ADR-0009](../architecture/adr/0009-git-workflow.md)).
- The web app proxies the API so the session cookie is first-party ([ADR-0010](../architecture/adr/0010-web-proxies-the-api.md)).
- Mutations are one transaction with audit and idempotency ([ADR-0011](../architecture/adr/0011-idempotency-audit-and-units-of-work.md)).
- Email goes through a port and SMTP; a password sign-in needs a verified address ([ADR-0012](../architecture/adr/0012-email-delivery-and-verified-sign-in.md)).
- The Stripe account is in Brazil ([`stripe.md`](../integrations/stripe.md)). Pricing is mocked until approved.
- The passport belongs to the account, with a visa page per trip ([business rules](../product/business-rules.md#passport)).
- Language, currency, country, nationality and time zone are independent, and USD is the default currency.

## Open decisions

- Pricing and plan limits (before M10).
- Production email provider (Resend or Postmark).
- Managed geocoding provider (#4).
- Pip illustrator and asset timeline.
- Imagery licensing source.
- Legal review of the retention position: the audit log is kept after account deletion ([ADR-0015](../architecture/adr/0015-account-export-and-deletion.md)).
- Whether to keep `audit_event` metadata to field names only, or add values with a retention policy ([ADR-0011](../architecture/adr/0011-idempotency-audit-and-units-of-work.md)).

## Blockers

No technical blocker for #55's code; its real-provider test needs the owner's credentials.
