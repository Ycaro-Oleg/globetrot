# Architecture Decision Records

An ADR records one significant decision: its context, the decision itself and its consequences. ADRs are immutable once accepted. To change a decision, write a new ADR that supersedes the old one and update the old ADR's status line.

**When to write one:** you are choosing or replacing a framework or library with wide impact, changing a cross-cutting convention, changing a data or contract strategy, or making anything that would surprise the next agent.

ADRs 0010 to 0012 were written after the work they describe (#53 to #61), which is allowed when a decision is made while building. Prefer writing the ADR in the same PR.

**Format:** `NNNN-short-title.md`, copied from [`template.md`](template.md). Keep it under about a page.

| # | Title | Status |
|---|---|---|
| [0001](0001-documentation-and-language-policy.md) | Documentation and language policy | Accepted |
| [0002](0002-monorepo-and-stack.md) | TypeScript monorepo and core stack | Accepted |
| [0003](0003-map-stack.md) | Map stack: MapLibre + OSM (Protomaps) + own places DB | Accepted (spikes #2 and #3 done, device FPS pending) |
| [0004](0004-money-and-currency.md) | Money as integer minor units with FX provenance | Accepted |
| [0005](0005-authentication.md) | Authentication with Better Auth | Accepted |
| [0006](0006-api-and-application-layer.md) | REST/OpenAPI API over a shared application layer | Accepted |
| [0007](0007-ai-provider-abstraction.md) | Provider-agnostic AI with structured, approvable proposals | Accepted; provider and library superseded by 0016 |
| [0008](0008-internationalization.md) | ICU-based internationalization | Accepted |
| [0009](0009-git-workflow.md) | GitFlow-lite with convention-based protection | Accepted |
| [0010](0010-web-proxies-the-api.md) | The web app proxies the API so the session cookie is first-party | Accepted |
| [0011](0011-idempotency-audit-and-units-of-work.md) | Mutations are one transaction with their audit event and idempotency record | Accepted |
| [0012](0012-email-delivery-and-verified-sign-in.md) | Email through a port and SMTP, and a verified address for password sign-in | Accepted (verified-email policy confirmed by the owner) |
| [0013](0013-community.md) | The community: snapshots, a visibility rule shared by domain and SQL, and moderation by reports | Accepted |
| [0014](0014-photos-and-storage.md) | Photos: S3-compatible storage, metadata cut out without decoding, served behind the API | Accepted |
| [0015](0015-account-export-and-deletion.md) | Account export and deletion, and deleting archived trips | Accepted |
| [0016](0016-pip-on-deepseek.md) | Pip v1 on DeepSeek, through a small JSON port | Accepted (supersedes the provider choice in 0007) |
| [0017](0017-worker-housekeeping.md) | The worker: hourly housekeeping behind an advisory lock | Accepted |
| [0018](0018-launch-measurement-and-consent.md) | Launch measurement: cookieless analytics, and the Meta Pixel only with consent | Accepted |
| [0019](0019-plans-trial-and-pip-credits.md) | Plans, the free week and Pip credits: credits per request, payments behind a port (read-only after the trial superseded by 0023) | Partly superseded |
| [0020](0020-suggested-plans-and-curated-cost-ranges.md) | Suggested plans: curated destinations, experiences and typical cost ranges with a research date; the landing plans the trip | Accepted |
| [0021](0021-error-monitoring-and-product-analytics.md) | Error monitoring with Sentry and product analytics with PostHog, both off unless configured and without personal data | Accepted |
| [0022](0022-backup-ai-provider.md) | A backup AI provider for Pip: Claude Haiku, asked when DeepSeek does not answer | Accepted |
| [0023](0023-free-plan-trip-pass-and-prices-in-reais.md) | A free plan for one trip, the trip pass and prices in reais; no read-only wall after the free week | Accepted |
| [0024](0024-trip-members.md) | Trip members: editors and viewers by invite link (hash stored, 7 days), one access check, guest limit from the plan | Accepted |
| [0025](0025-money-between-members.md) | Money between members: equal or custom parts, each person's savings, who paid, settling up the paid costs | Accepted |
| [0026](0026-saving-habit-and-countdown.md) | The saving habit: weekly check-in with a streak, countdown phases, the Today screen and a weekly reminder email | Accepted |
| [0027](0027-offline-reading.md) | Offline reading of a paid trip: a small service worker keeps the trip's screens, cleared on sign-out | Accepted |
| [0028](0028-public-itineraries-and-story-card.md) | Public, indexable itinerary pages from the catalog in both languages, and a progress card for stories | Accepted |
| [0029](0029-referrals.md) | Referrals: one code per account, claimed within 7 days, a free trip pass when the friend first pays | Accepted |
| [0030](0030-miles-in-the-savings.md) | Miles in the savings answer: balances per Brazilian programme, researched value ranges, miles put towards a trip | Accepted |
| [0031](0031-partner-links-and-metrics.md) | Partner links (labelled, no prices, only when configured) and the internal metrics dashboard for admins | Accepted |
| [0032](0032-bookings-by-email.md) | Bookings forwarded to a private address become Pip proposals to review; the webhook is trusted by a shared secret | Accepted |
| [0033](0033-pricing-adjustments-before-launch.md) | Pricing before launch: a R$49 trip pass with 50 Pip credits, a 50-credit pack, coupons on one-time payments, the backup model fixed | Accepted |
| [0034](0034-hosting-on-railway.md) | Production on Railway: web, api and worker from `main`, PostGIS on a volume, a Railway Bucket; replaces the hosting part of 0002 | Accepted |
| [0035](0035-trip-workspace.md) | The trip workspace: a sidebar of the trip's sections, the trip's document with the itinerary day by day, the map on the right; the full map stays as "Expand map" | Accepted |
| [0037](0037-interest-list.md) | An interest list with double opt-in: email, language and visit origin only, 7 days unconfirmed, a keyed hash after unsubscribing | Proposed |
