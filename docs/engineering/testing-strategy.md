# Testing strategy

Tests are part of every issue's definition of done, and each issue states its testing requirements. This doc says which kinds of test exist, when each is required and how to write them. CI checks: [`git-workflow.md`](git-workflow.md#required-checks).

## Test layers

| Layer | Tool | What it proves | Where | Status |
|---|---|---|---|---|
| **Unit** | Vitest | Pure rules and helpers: domain, application, i18n, formatters | Next to the code, `*.test.ts` | Active |
| **Property-based** | fast-check (in Vitest) | Invariants over many generated inputs: arithmetic, rounding, allocation, date math, savings | Same files | Active |
| **Integration** | Vitest + local services | Adapters against real Postgres/PostGIS, S3 and SMTP (`pnpm services:up`) | `*.int.test.ts` in the adapter package | From M3 |
| **Contract** | Vitest + OpenAPI/Zod | API responses match the published schema, and the generated client compiles against it | `apps/api` | From M3 |
| **Component** | Storybook + Testing Library + axe | UI states, interactions and accessibility, in both themes and both locales | `packages/ui`, `apps/web` | From #6 |
| **End-to-end** | Playwright | Critical journeys in a real browser, at desktop and phone viewports, in en and pt-BR | `apps/web/e2e` | From M3 |
| **Accessibility** | axe (Storybook + Playwright) + manual WCAG 2.2 AA review | No automated violations, plus keyboard and screen-reader paths | With component and E2E tests | From #6 / M8 |
| **Performance** | Lighthouse CI budgets | Landing and board load and interaction budgets | CI | M8 |

The domain is pure, so most confidence comes from fast unit and property tests. E2E tests stay few and cover journeys, not every edge case.

## What each change must test

| Change | Required tests |
|---|---|
| Domain rule (new or changed) | Unit tests for every branch and edge case listed in `business-rules.md`, plus a property test when an invariant exists ("parts sum to the whole", "saving the suggested amount is on time"). Update the owning doc |
| Behaviour that mirrors the prototype | Assert against the shared fixture (`__fixtures__/japan-demo.ts`) and document any deliberate difference |
| Application command/query | Unit tests with fake ports, covering authorization (another user's resource is **refused**), validation errors and idempotent retries |
| Adapter (DB, S3, email, AI, Stripe) | An integration test against the local service or the provider's test mode. No live third-party calls in CI |
| API endpoint | A contract test (request and response schemas) plus an auth test |
| UI component | A story per state (empty, loading, error, filled), an interaction test for behaviour, and axe. Check both locales for text expansion |
| User flow | Playwright on desktop and a phone viewport, with a keyboard-only pass where the flow involves the map or drag-and-drop |
| Copy | Covered by the i18n catalog check (`pnpm lint`). Add a formatting test for new plural or select messages |
| Bug fix | A regression test that fails before the fix |

## Writing good tests

- **Deterministic:**
  - Inject time (`today: LocalDate`) and never read the clock in rules.
  - No network in unit tests.
  - Seed or control randomness. fast-check prints the seed and path of a failing case, so reproduce it with `fc.assert(property, { seed, path })` and keep the case as a regression example.
- **Know the equality you assert:** `toBe` uses `Object.is`, so `0` and `-0` differ (this already bit us once, in PR #19). Compare bigints with `toBe` and objects with `toEqual`. Normalize ICU no-break spaces before comparing formatted strings.
- **Test behaviour through public APIs** (`src/index.ts` exports and HTTP), not private helpers. Exceptions: small pure helpers that carry real logic (`divideHalfEven`).
- **One reason to fail per test.** Name tests as behaviour: `'refuses expenses that were not converted to the trip currency'`.
- **Fixtures** are realistic and minimal, live in `__fixtures__/` (excluded from coverage) and never contain real personal data.
- **Property tests:**
  - State the invariant in the test name.
  - Keep generated values within realistic bounds so runs stay fast.
  - Use `fc.pre` sparingly. Prefer generators that only produce valid input.

## Coverage

- `@globetrot/domain` enforces **≥ 95%** statements, branches, functions and lines in CI (`vitest.config.ts`). It is at 100% today.
- Other packages have no hard gate yet. A coverage number is a smell detector, not a goal. A PR that lowers coverage of business logic must say why.

## Running tests

```bash
pnpm test                                  # all workspaces (Turborepo-cached)
pnpm --filter @globetrot/domain test       # one package (domain runs with coverage)
pnpm --filter @globetrot/domain exec vitest   # watch mode while developing
pnpm format:check && pnpm turbo run lint typecheck test build   # what CI runs
```

## Flaky tests

A flaky test is a bug. Fix it in the same PR if your change exposed it. Otherwise open an issue labelled `type:bug` and quarantine the test with `it.skip` plus a link to that issue. Never re-run CI until it goes green and merge.
