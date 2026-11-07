# M3 app foundation: proposed work breakdown

**Status: planning draft, not a set of created GitHub issues.** M3 depends on M1 and M2; M1 still has open work. This draft makes the next work reviewable without declaring the milestone ready or changing product decisions. The [roadmap](../product/roadmap.md) defines M3 as authentication, i18n, preferences, responsive shell, themes and trip CRUD.

## Boundaries and dependencies

- Use Better Auth with email/password and Google as decided in [ADR-0005](../architecture/adr/0005-authentication.md). Provider credentials and an agreed production email provider are external dependencies; local development can use Mailpit. Do not send real email or deploy.
- Application commands and queries own validation, actor authorization, idempotency and audit; Hono is a thin OpenAPI adapter ([ADR-0006](../architecture/adr/0006-api-and-application-layer.md)). No client directly writes domain tables.
- Language, currency, country, nationality and time zone are independent. USD is the preferred-currency default. All UI strings, validation and accessibility labels are in en and pt-BR; no inference from language ([i18n](../architecture/i18n.md), [business rules](../product/business-rules.md)).
- Trips are private by default; status is explicitly set. Derived stage and readiness are not persisted as independent truth. Use existing domain derivations rather than reimplementing them.
- #5 tokens are available; #6 UI controls are in progress. #7 visual studies and #9 Pip brief still require owner approval. #8 requires five real participants; the MapLibre phone FPS test and #4 geocoder selection remain open. Do not claim those are complete or silently block unrelated work that can be reviewed safely.

## Proposed focused slices

These are candidate issues, each intended to become a separate branch and PR once the milestone breakdown is approved and created. Ordering is a dependency graph, not a commitment that all work can be merged simultaneously.

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

## Ready-to-create checklist

Before creating GitHub issues, reconcile these slices against current M1 status, assign milestones and labels, and give each issue precise acceptance criteria, tests, documentation and dependencies. The repository workflow asks the owner before creating many issues; this draft creates none. Once authorized, split further if a slice is too large for one reviewable PR and keep the issue and PR handoff conventions.
