# M3 app foundation: proposed work breakdown

**Status: issues created on 2026-11-07 with the owner's authorization.** This document keeps the slices and their reasoning. The **GitHub issues are now the contract**: the table in "Issues" maps each slice to its issue. M3 depends on M1 and M2; M1 still has open items that need the owner. The [roadmap](../product/roadmap.md) defines M3 as authentication, i18n, preferences, responsive shell, themes and trip CRUD.

## Boundaries and dependencies

- Use Better Auth with email/password and Google as decided in [ADR-0005](../architecture/adr/0005-authentication.md). Provider credentials and an agreed production email provider are external dependencies; local development can use Mailpit. Do not send real email or deploy.
- Application commands and queries own validation, actor authorization, idempotency and audit; Hono is a thin OpenAPI adapter ([ADR-0006](../architecture/adr/0006-api-and-application-layer.md)). No client directly writes domain tables.
- Language, currency, country, nationality and time zone are independent. USD is the preferred-currency default. All UI strings, validation and accessibility labels are in en and pt-BR; no inference from language ([i18n](../architecture/i18n.md), [business rules](../product/business-rules.md)).
- Trips are private by default; status is explicitly set. Derived stage and readiness are not persisted as independent truth. Use existing domain derivations rather than reimplementing them.
- #5 tokens are available; #6 UI controls are in progress. #7 visual studies and #9 Pip brief still require owner approval. #8 requires five real participants; the MapLibre phone FPS test and #4 geocoder selection remain open. Do not claim those are complete or silently block unrelated work that can be reviewed safely.

## Focused slices

Each slice became one issue (see "Issues"), worked on its own branch and PR. Ordering is a dependency graph, not a commitment that all work can be merged simultaneously. Slice 6 was finished first (#50), and one slice was added during reconciliation (see "Gaps found").

| # | Slice | Depends on | Reviewable outcome / tests |
|---|---|---|---|
| 1 | **Database migration foundation** | M2 services | Drizzle schema/migration tooling, reproducible fresh database and upgrade; local integration test applies migrations and verifies constraints. Do not add unrelated travel tables. |
| 2 | **Auth server and sessions** | 1 | Better Auth with email/password and secure session configuration. Integration tests for registration, login/logout, invalid credentials, expiry and unauthorized requests; rate/abuse controls appropriate to local/test mode. No secrets or real messages in tests. |
| 3 | **Email verification and recovery** | 2 | Abstract email delivery and exercise verification and reset using Mailpit; expired/used token paths, non-enumerating responses and session behavior tested. Production provider remains an explicit decision. |
| 4 | **Google sign-in** | 2 | Better Auth Google provider behind environment configuration; safe callback/session handling and account-linking tests. Local development must work without Google credentials; a real OAuth smoke test requires configured test credentials and consent. |
| 5 | **Authenticated API and actor context** | 2 | Hono derives actor from a trusted session and supplies it to application operations. OpenAPI contracts and tests for anonymous, owner and another user; never trust a client-supplied actor ID. |
| 6 | **Locale integration** | M2 i18n, #5 | Integrate next-intl and shared catalogs in web, negotiate supported languages and render en/pt-BR; tests cover fallback, catalog completeness and locale-independent currency. |
| 7 | **Preferences persistence** | 1, 5, 6 | Persist and edit language, preferred currency, home country, nationality, time zone and units independently. USD is the default, optional fields stay optional, and changing one setting never silently changes another. Tests cover validation and owner isolation. |
| 8 | **Responsive authenticated shell** | 2, 6, #6 components | Desktop rail, phone top bar and five-tab navigation, separate Pip action behind its flag, route guards, loading/error states and keyboard focus. No product functionality implied by placeholder links. Test both themes, both locales and phone/desktop widths. |
| 9 | **Theme and motion preferences** | 7, 8 | Day, Red-eye and system preference plus full/reduced motion; persist choices and respect OS reduced-motion requests. Test initialization and changes without unreadable flashes, and check always-light surfaces. |
| 10 | **Trip persistence and application operations** | 1, 5 | Minimal trip schema plus create/list/read/update/archive operations, owner isolation, explicit status, timestamps and audit/idempotency conventions. Integration and application tests cover other-user denial and duplicate retries. Specify deletion separately before implementing it. |
| 11 | **Trip list and switcher** | 6, 8, 10, #7 review | Create/list/open/switch trips and display explicit status; empty, loading and error states. Desktop/phone keyboard and en/pt-BR tests; no assumption that status equals derived stage. |
| 12 | **First end-to-end and accessibility gate** | 2, 6, 7, 8, 10, 11 | Playwright covers a local sign-in, preference change and trip creation for en and pt-BR at desktop and phone widths; axe and keyboard checks cover those paths. Use test accounts, Mailpit and local services; no real provider calls in CI. |

## Decisions and risks to resolve before dependent work

- **Email provider:** Resend vs Postmark is undecided; selection needs an owner decision before production integration. Mailpit is only a local test sink.
- **Google OAuth:** credentials, authorized callback URLs and a test account must be provisioned before a real-provider smoke test. Do not commit secrets or require them for ordinary CI.
- **Screen approval:** #7's studies need expanded states and owner review before they become final implementation direction. #6 still needs complete manual screen-reader and interaction review.
- **M1 experiments:** real-device MapLibre FPS, the managed geocoder quality/terms comparison, and five moderated usability sessions have distinct completion criteria. An M3 skeleton can be prototyped independently, but these remain visible milestone gates.
- **Trip lifecycle and deletion:** the existing explicit status rules are authoritative; retention and destructive deletion behavior must not be invented in a CRUD PR.

## Issues

All are in the milestone **M3 App Foundation**. "Depends on" lists issue numbers. A readiness label of `agent-ready` means the issue is fully specified and safe to pick up once its dependencies are merged.

| Slice | Issue | Depends on | Priority / readiness |
|---|---|---|---|
| 1. Database migrations | #52 | none (M2 done) | p0, **done** |
| 2. Auth server and sessions | #53 | #52 | p0, **done** |
| 3. Email verification and recovery | #54 | #53 | p1, **done** |
| 4. Google sign-in | #55 | #53 | p1, agent-ready (the real-provider smoke test is the owner's) |
| 5. Authenticated API, actor, typed client | #56 | #53 | p0, **done** |
| 6. Locale integration | #50 | M2 i18n | **done** (PR #51) |
| 6b. Sign-up, log-in and recovery screens (added) | #57 | #53, #54, #55 (optional), #6 | p1, agent-ready |
| 7. Preferences persistence | #58 | #52, #56, #50 | p1, **done** |
| 8. Responsive authenticated shell | #59 | #53, #57, #6 | p1, agent-ready |
| 9. Theme and motion preferences | #60 | #58, #59 | p2, agent-ready |
| 10. Trip persistence and operations | #61 | #52, #56 | p0, **done** |
| 11. Trip list and switcher | #62 | #58, #59, #61, owner review of #7 | p1, **needs:decision** (screen review) |
| 12. First end-to-end and accessibility gate | #63 | #53, #54, #57–#62 | p1 |

Suggested order: #52 → #53 → (#54, #55, #56 in parallel) → #57 → (#58, #61 in parallel) → #59 → (#60, #62) → #63.

## Gaps found while reconciling

- **Auth screens were missing.** No slice covered the sign-up, log-in and recovery pages that the prototype specifies, and the end-to-end gate needs them. Added as slice 6b (#57).
- **How the browser and the API share the session cookie** was undecided. Decided inside #53: the web app proxies `/api/auth/*` to the API from `proxy.ts`, reading the target at request time, so the cookie is first-party and one image serves every environment. `/v1/*` joins the proxy in #56. See [`authentication.md`](../architecture/authentication.md).
- **Typed API client generation** had no owner. It is part of #56.
- **Integration tests had no CI job.** A `postgis` service job comes with #52.
- **Terms and Privacy pages** are linked from the sign-up form. #57 uses pages marked as draft. The real legal text is an owner decision (open).
- **Not in M3, to schedule before a public release:** the onboarding flow after the first login, and account data export and deletion (required by [business rules](../product/business-rules.md#privacy-applies-from-day-one) for LGPD/GDPR).
