# Coding standards

These are the conventions every change follows. Linters, the compiler and CI enforce most of them. The rest are reviewed in PRs. Rationale lives in the linked ADRs. Layout and commands: [`project-structure.md`](project-structure.md).

## TypeScript

- **Strict compiler settings** (`packages/config/tsconfig/base.json`): `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`. Don't loosen them per package.
- **No `any`.** Use `unknown` and narrow it. Cast with `as` only where the type system can't follow, and explain why in a comment if it isn't obvious.
- **Type-only imports** use `import type` / `type X` specifiers (lint-enforced).
- **Model states as unions, not booleans:** `status: 'no-costs' | 'fully-saved' | 'saving'`. For enumerations, define an `as const` array as the single source and derive the type from it:

  ```ts
  export const EXPENSE_STATUSES = ['estimate', 'confirmed', 'paid', 'unknown'] as const;
  export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];
  ```

  Don't use the `enum` keyword.
- **Brand validated primitives**, so unvalidated strings can't flow in: `CurrencyCode`, `LocalDate`, `YearMonth`. Create them only through their constructor (`toCurrencyCode`, `toLocalDate`).
- **Immutable data:** use `readonly` properties and `readonly T[]` inputs. Value objects are frozen (`Object.freeze`). Return new values; never mutate arguments.
- `null` means "known to be absent" (`startDate: null`). Use optional properties only for truly optional input.

## Naming

- **English** for all identifiers, files, comments and commits (ADR-0001). Use the domain vocabulary from [`../architecture/domain-model.md`](../architecture/domain-model.md) (`Trip`, `Destination`/stop, `Pin`, `Expense`, `SavingsPlan`) and don't invent synonyms.
- **Files** are `kebab-case.ts`. Tests sit next to the code as `*.test.ts`. Test data goes in `__fixtures__/`.
- **Names by kind:**
  - types and classes: `PascalCase`;
  - functions and variables: `camelCase`;
  - module-level constant lists: `UPPER_SNAKE_CASE`;
  - booleans read as questions: `isZero`, `hasStay`, `onTime`.
- **Functions say what they return or do:** `tripTotals`, `savingsPlan`, `formatMoney`, `toLocalDate`.

## Architecture boundaries (ADR-0006)

```
apps/* (web, api, worker, mcp) → packages/application → packages/domain
                     adapters (db, storage, email, AI, Stripe) implement application ports
```

- **`packages/domain`** is pure TypeScript: no I/O, no frameworks, no Node APIs, no environment, no clock, and **relative imports only** (lint-enforced). The current date is a parameter (`savingsPlan(trip, today)`), never `new Date()` inside a rule.
- **`packages/application`** holds commands and queries with Zod schemas, actor-based authorization, idempotency and audit. It may not import React, Next, Hono, Drizzle or pg (lint-enforced).
- **Apps are thin adapters.** No business rule lives in a React component, route handler or job handler. If two clients would need the same logic, it belongs in domain or application.
- **Each package has one public surface:** `src/index.ts` with explicit named exports. Don't import another package's internal files.

## Money, dates and copy

- **Money** is `Money` (bigint minor units + ISO 4217). Never use `number` for amounts, never float math, and never mix currencies without `convert` and a recorded rate ([`../architecture/money.md`](../architecture/money.md)).
- **Calendar dates** (trip days, departure) are `LocalDate`. Instants are UTC timestamps. Formatting happens at the edge, with the user's locale.
- **User-facing text** never appears in code. Domain and application return **structured data** (`{ kind: 'find-stay', stopId }`), and the UI renders it through `@globetrot/i18n` catalogs, in `en` and `pt-BR` ([`../architecture/i18n.md`](../architecture/i18n.md)). Locale never implies currency.

## Errors and validation

- **Invariant or programming errors** throw typed errors from a family base class (`MoneyError` → `CurrencyMismatchError`, `InvalidTripError`, …). Throw early, with a message that names the bad value.
- **Expected business outcomes are return values, not exceptions.** A trip with no costs is `status: 'no-costs'`, and an unknown departure is `onTime: null`.
- **Validate at boundaries** with Zod: HTTP input, environment variables, external API responses and stored JSON. Inside the domain, constructors (`money`, `exchangeRate`, `toLocalDate`) guard invariants.
- Never swallow errors. Catch only to add context, translate the error at a boundary (e.g. into an HTTP problem response), or recover deliberately.

## Configuration, logging and security

- Read `process.env` only in app entrypoints or config modules, validate it once, and pass typed config inward. Local defaults live in `.env.example` ([`local-development.md`](local-development.md)).
- Use structured logs. **Never log** secrets, tokens, passwords, full emails, payment data or precise user locations. `console` is acceptable in entrypoints until the shared logger lands.
- **Security rules:**
  - Authorization happens in the application layer on every command and query, not only in the UI.
  - Database access goes through Drizzle (parameterized).
  - No secrets in the repository, in docs or in handoffs.

## React (apps/web, packages/ui)

- Server Components by default. Mark a component `'use client'` only when it needs state, effects or browser APIs.
- Components present data and raise intents. Rules come from domain/application, and data fetching goes through TanStack Query or server code.
- Build on React Aria Components and design tokens ([`../design/design-system.md`](../design/design-system.md)). No raw hex colours, no third-party kit styling.
- **Accessibility is part of done:**
  - every control has an accessible name and a 44px hit area;
  - status is never colour-only;
  - every map or drag action has a keyboard or list alternative;
  - motion respects reduced-motion settings.

## Dependencies and comments

- **Pin exact versions**, and for anything on an authentication, email or build path prefer a release that has been out for at least a week (a package published hours ago has had no time to be noticed if it is bad). Justify every new dependency in the PR: why it's needed, what it overlaps with, its size and licence. Prefer the platform (`Intl`, `fetch`) and libraries already chosen in the ADRs.
- Comment **why**, not what. Link the owning doc or ADR when a rule comes from there. Exported functions get a short JSDoc that states the contract, including edge cases.
