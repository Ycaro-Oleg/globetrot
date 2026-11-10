# Playbook: from an issue to a merged PR

The procedure that has produced every merged PR so far, written down so the next agent does not have to rediscover it. [`AGENTS.md`](../../AGENTS.md) has the rules; this is the how. Read it once at the start of a session, then work from the issue.

## 0. Before you touch anything

1. Read `AGENTS.md`, [`current-state.md`](current-state.md) and the issue (its acceptance criteria are the contract). Use the [`context-map.md`](context-map.md) to pick the docs for your task, and the [`glossary.md`](../glossary.md) if a word is unfamiliar.
2. `git status` and `git branch --show-current`. Another agent may have left uncommitted work on a feature branch: **never reset, clean or discard it**. Ask first.
3. Check the issue is not already done or blocked: `gh issue view <n>`, and the dependency table in [`m3-foundation-breakdown.md`](../engineering/m3-foundation-breakdown.md) (or the current milestone's breakdown).
4. If the issue needs something only the owner can give (credentials, a decision, a review), say so now and propose the part that can be done without it. See "Owner-dependent items" in `current-state.md`.

## 1. Set up the environment

Follow [`local-development.md`](../engineering/local-development.md). The short version:

```bash
cp .env.example .env && corepack enable && pnpm install
pnpm services:up && pnpm services:check   # Postgres + PostGIS, S3 storage, Mailpit
pnpm --filter @globetrot/db migrate
```

- **Node 24 is required.** If the host has another version, run commands in the official image (see the note in `local-development.md`) and **always pass `-u "$(id -u):$(id -g)"`**. A container running as root leaves root-owned `node_modules`, `.next` and `.turbo` files that later runs cannot write.
- Integration tests need the services up: Postgres on port 5455 and Mailpit on 1025 and 8025 (`pnpm services:up`). They use throwaway databases, so your data is safe.
- A local, untracked `spikes/` folder may exist in a checkout. It is leftover experiment output: **never commit it** (stage files explicitly, or use `git add -A -- . ':!spikes'`).

## 2. Branch, implement, document

```bash
git checkout develop && git pull
git checkout -b feature/issue-<n>-<slug>
```

- One issue, one branch, one PR. Keep it reviewable (roughly under 400 changed lines, generated files excluded).
- Put rules in the right layer ([`coding-standards.md`](../engineering/coding-standards.md), [`overview.md`](../architecture/overview.md)): domain is pure, application owns authorization, idempotency and audit, apps are thin adapters, UI holds no rules.
- Every user-facing string goes in **both** catalogs (`en` and `pt-BR`); `pnpm lint` fails otherwise.
- **Update the owning docs in the same PR** (see the table below). A PR that changes behaviour without its doc is not done.
- A decision that would surprise the next agent gets an ADR ([`adr/README.md`](../architecture/adr/README.md)).

### Generated files: regenerate, never hand-edit

| You changed | Run | Files it rewrites |
|---|---|---|
| An API route, or a schema an operation exposes | `pnpm api:generate` | `packages/api-client/openapi.json`, `packages/api-client/src/generated/schema.ts`. Two tests fail while they are stale |
| A database table or column | `pnpm --filter @globetrot/db generate` (add `--custom --name=<what>` through `pnpm exec drizzle-kit` for hand-written SQL) | `packages/db/migrations/*.sql` and `migrations/meta/*`. Commit all of them |
| A design token | `pnpm --filter @globetrot/tokens build` | `packages/tokens/dist/*` and `src/generated.ts`. `dist` is not committed; `pnpm dev` and the web build make it |
| The pnpm dependency set | `pnpm install` | `pnpm-lock.yaml`. Commit it. CI installs with `--frozen-lockfile` |

### Which docs to update

| Change | Update |
|---|---|
| A business rule | `product/business-rules.md` (and `glossary.md` if a term changed) |
| An endpoint, error code, header or operation | `architecture/api-contracts.md` |
| A table, column, constraint or migration | `architecture/data-model.md` (the schema reference table) |
| Sign-in, sessions, email, redirects, rate limits | `architecture/authentication.md` |
| A setting or environment variable | `engineering/configuration.md` **and** `.env.example` |
| A message catalog namespace or the web i18n behaviour | `architecture/i18n.md` |
| A UI pattern used for the first time | `design/design-system.md` |
| A command, script, package, route or folder | `engineering/project-structure.md` |
| A test layer or CI check | `engineering/testing-strategy.md`, `engineering/git-workflow.md` (Required checks) |
| Progress on a feature or milestone | `product/progress.md`, `product/roadmap.md`, `agents/current-state.md` |
| A new doc | `docs/README.md` (the index) and `agents/context-map.md`. `pnpm docs:check` enforces both |

## 3. Verify before you open the PR

Run what CI runs. Do not claim a check you did not run.

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm turbo run lint typecheck test build
pnpm test:int                       # needs `pnpm services:up`
pnpm docs:check                     # links, anchors, the docs index, env var coverage
```

Also, when relevant:

| If your change touches… | Also run |
|---|---|
| An account screen, `proxy.ts`, or anything under `apps/web/app/(auth)` | `pnpm turbo run build --filter=@globetrot/web` then `pnpm --filter @globetrot/web test:a11y` (real Chromium against a stand-in API; install it once with `pnpm --filter @globetrot/ui exec playwright install chromium`) |
| A Dockerfile, a bundled dependency or `tsup.config.ts` | `docker build -f apps/<app>/Dockerfile -t globetrot-<app> .`, then start the image and call `/health`. Tests do not show bundling problems such as a CommonJS dependency in an ESM bundle |
| A flow that crosses web, API, database and email | Run the images against a fresh local database and drive it in a browser (sign up, read the email in Mailpit at <http://localhost:8025>, verify, log in). Unit tests have missed real bugs here (a 500 from `proxy.ts`, a dangling ARIA reference) |
| Storybook components | `pnpm --filter @globetrot/ui build` and `pnpm --filter @globetrot/ui test:a11y` |

Never put real secrets, tokens or personal data in a test, a doc or a handoff. Tests generate their secrets at runtime.

## 4. Open the PR

```bash
git add <files>                      # explicit paths; never `git add -A` without excluding spikes/
git commit -m "feat(scope): summary (#<n>)"   # Conventional Commits; the repo's commit trailer rules apply
git push -u origin <branch>
gh pr create --base develop --title "<same Conventional Commit title>" --body-file <file> \
  --milestone "<milestone>" --label type:feature --label area:<area>
```

The body follows [`pull_request_template.md`](../../.github/pull_request_template.md): `Closes #<n>`, what changed, **what you verified (commands and results)**, decisions worth a look, and **what you did not verify** (be explicit: screen readers, real devices, real third-party providers). Include the handoff section.

Then wait for CI: `gh pr checks <number> --watch`. Every active job must pass: `Lint · typecheck · test · build`, `Integration (Postgres)` and `Accessibility (axe)`. (`E2E (Playwright)` is a skipped placeholder until #63.) Fix a red check by finding the cause; never re-run until green and never merge past a failure.

## 5. Merge only when the owner says so

**The owner approves every merge, per PR, in chat** (for example "Sim, mergear"). Approval for one PR is not approval for the next. Report the PR, the CI result, what you did not verify and any decision you want confirmed, then ask.

After an explicit yes:

```bash
gh pr merge <n> --squash --delete-branch --subject "<Conventional Commit title> (#<n>)"
gh issue close <issue> --comment "Done in #<n>."     # GitHub does not auto-close on merges into develop
git checkout develop && git pull --ff-only
gh run watch <run-id> --exit-status                 # confirm CI on develop (every active job green)
```

`docs/agents/current-state.md` and the other progress docs must already have been updated **in the PR**, so `develop` is never out of date.

## 6. When you stop mid-way

Leave a handoff ([`handoff.md`](handoff.md)): a comment on the issue, or the PR's Handoff section. Commit nothing half-done to `develop`. If you found a gap that is out of scope, say so in the PR and, with the owner's agreement, open an issue instead of widening the PR.

## Working with the owner

- **Speed first.** The owner wants code and a working product, not planning. See [`AGENTS.md`](../../AGENTS.md#3b-speed-first-the-owners-standing-preference): start coding after a short read, run natively, keep PR text short, one question at a time.
- **Reply in Brazilian Portuguese; write every repository artifact in English** ([ADR-0001](../architecture/adr/0001-documentation-and-language-policy.md)).
- **Ask before:** changing a business rule, pricing, the stack or an ADR decision; adding a heavy or overlapping dependency; creating many issues, changing milestones, labels or any GitHub setting; anything that deploys, charges money, emails real people or publishes content.
- **Do not guess credentials, accounts or provider choices.** Say what is needed and where it will be configured (environment, never the repository).
- Be plain about state: what is done and verified, what is done but unverified, what is blocked on the owner.
- Offer the next step with a recommendation, and keep the fork small. When the owner has said to keep going, take the next item of [`current-state.md`](current-state.md) "Next" without asking which one.

## Pitfalls that already cost time

| Pitfall | What to do |
|---|---|
| `pnpm run <script> -- --flag` passes the literal `--` to the script | Call the tool directly: `pnpm exec drizzle-kit generate --name=x` |
| `exactOptionalPropertyTypes` rejects `{ a: undefined }` for `a?: string` | Type optional parameters as `string \| undefined`, or build objects with conditional spreads |
| Zod 4 objects with `.refine()` cannot be `.extend()`ed or `.omit()`ted | Keep a plain `z.object` for the fields and apply `.refine` at the edge (see `trips/schemas.ts`) |
| Hono runs middleware in registration order | Register public routes (`/v1/openapi.json`, `/v1/auth/providers`) **before** the session middleware in `app.ts` |
| Next.js rejects a relative `Location` from `proxy.ts` | Build the redirect from `request.nextUrl.clone()` |
| React Aria's pending `Button` announces itself in a live region that points back at the button | Keep the form mounted (hidden) after success instead of unmounting it; otherwise axe reports `role-img-alt` |
| A client click before hydration submits the form natively | In browser scripts, wait for `networkidle` after `goto` |
| CommonJS dependencies (`pg`, `nodemailer`) crash an ESM bundle with "Dynamic require" | `apps/*/tsup.config.ts` injects a `createRequire` banner. Test the built image, not only the source |
| An email send awaited in the request leaks whether an account exists, by timing | Send in the background; log only a code (`auth.ts`, `deliver`) |
| `window.location.assign('/path')` trips a Next lint rule | Use `useRouter().replace()` and `refresh()` for same-site paths |
| ICU prefers old time-zone link names (`America/Buenos_Aires`) | Keep the name as the user chose it after fixing its case (`canonicalTimeZone`) |
| A package version published hours ago | Prefer a release that has been out at least a week for anything on an authentication or build path, and pin it exactly |
| `next typegen` (the web typecheck) and `next build` both write `apps/web/.next`, and the build empties it first. Run in parallel they fail with `ENOENT … routes.d.ts` | `apps/web/turbo.json` makes the web build wait for its typecheck. Keep it that way |
| `0` and `-0` differ under `toBe` | See [`testing-strategy.md`](../engineering/testing-strategy.md#writing-good-tests) |
