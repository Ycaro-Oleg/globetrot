# Git workflow

Decision record: [ADR-0009](../architecture/adr/0009-git-workflow.md).

## Branches

| Branch | Purpose | Created from | Merges into |
|---|---|---|---|
| `main` | Stable, release-ready. Tagged releases | — | — |
| `develop` | Integration of approved work | `main` | `main` (release PR) |
| `feature/issue-<n>-<slug>` | New functionality | `develop` | `develop` |
| `fix/issue-<n>-<slug>` | Bug fix | `develop` | `develop` |
| `docs/<slug>` | Documentation only | `develop` | `develop` |
| `chore/<slug>` | Tooling and maintenance | `develop` | `develop` |
| `spike/issue-<n>-<slug>` | Time-boxed, throwaway experiment. Only the findings doc is merged | `develop` | `develop` (docs only) |
| `hotfix/<slug>` | Urgent production fix | `main` | `main`, then **back-merged into `develop`** |

Examples: `feature/issue-12-trip-creation`, `fix/issue-42-mobile-pin-selection`.

**Never push directly to `main` or `develop`.** On the GitHub Free private plan nothing technically stops it, so the rule depends on everyone following it.

## Lifecycle

1. The milestone exists, with focused issues and acceptance criteria.
2. Assign yourself the issue, then branch from an up-to-date `develop`.
3. Implement one focused change, with tests and doc updates.
4. Open a PR into `develop` using the template, and include the handoff section.
5. CI passes, review happens, the acceptance criteria are checked off.
6. **The owner approves the merge, in chat, for each PR.** Then squash-merge, with a PR title in Conventional Commit form. Delete the branch. **Close the issue manually** with a comment linking the PR. GitHub only honours `Closes #n` on merges into the default branch (`main`), so issues stay open after a merge into `develop`.
7. For a release, open a PR `develop → main`, tag `vX.Y.Z` and record the changes in the release notes.

## Issues

Use the templates in `.github/ISSUE_TEMPLATE/`. A good issue is small enough for one agent session or a few: one PR, roughly under 400 changed lines excluding generated files. It contains:

- Problem / user value, scope (and non-scope), dependencies.
- Technical notes and design references.
- **Acceptance criteria** (checkboxes).
- Testing requirements and documentation requirements.
- Milestone and labels.

Avoid epics disguised as issues ("Build the travel planner"). Split them.

### Labels

- `type:feature`, `type:bug`, `type:spike`, `type:docs`, `type:chore`
- `area:map`, `area:budget`, `area:itinerary`, `area:ai`, `area:auth`, `area:i18n`, `area:design-system`, `area:infra`, `area:docs`, `area:db`, `area:trips`, `area:app-shell`, `area:preferences`
- `priority:p0` to `priority:p2`
- `status:blocked`, `needs:decision`
- `agent-ready` (fully specified, safe for an agent to pick up)

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): summary`.
- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`.
- Scopes follow areas (`map`, `budget`, `i18n`, …).
- Breaking changes use `!` or a `BREAKING CHANGE:` footer.

## Pull requests

- Title in Conventional Commit form.
- The body follows the template: summary, linked issue (`Closes #n`), screenshots for UI (desktop + mobile, light + dark when relevant), tests, docs updated, and the **handoff** section.
- Keep PRs reviewable. Split them when they grow.

## Required checks

Workflow: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). It runs on every PR into `develop`/`main`, on pushes to those branches, and on demand.

| Check | Job | Status |
|---|---|---|
| Prettier format, then lint, typecheck, unit tests and build for all workspaces (Turborepo, cached) | `Lint · typecheck · test · build` | Active |
| i18n catalog consistency (keys, ICU syntax, placeholders) | same job: `@globetrot/i18n` `lint` runs `check-messages`, and its tests and `tsc` also catch missing keys | Active |
| Integration tests (`*.int.test.ts`) against a real PostgreSQL + PostGIS (each test in a throwaway database) and a real SMTP catcher | `Integration (Postgres)` | Active (service containers `postgis/postgis:17-3.7` and `axllent/mailpit:v1.33.0`) |
| Migration consistency (`drizzle-kit check`) | same job as lint: `@globetrot/db` `lint` | Active |
| E2E (Playwright) | `E2E (Playwright)` | Placeholder (skipped) until #63 |
| Accessibility (axe) | `Accessibility (axe)` | Active for Storybook stories in both themes and locales (with select, checkbox and switch keyboard checks), and for every account-screen state in a real browser (`apps/web/scripts/check-auth-pages.mjs`: keyboard path, redirects, axe in both themes and languages). Screen-reader and complete interaction reviews remain manual |
| Documentation (`pnpm docs:check`) | `Lint · typecheck · test · build` | Active: relative links and anchors, every doc reachable from the index, every ADR in the ADR index, every `.env.example` variable in the configuration reference |

- **Do not merge a PR with a failing or missing `Lint · typecheck · test · build` or `Integration (Postgres)` check.** On GitHub Free nothing blocks the merge button, so this is enforced by convention (ADR-0009).
- A newer push to the same PR cancels the older run.
- Run the same checks locally before pushing: `pnpm format:check && pnpm turbo run lint typecheck test build && pnpm docs:check`, and `pnpm test:int` when the database or email is involved.

## Hotfixes

Branch `hotfix/<slug>` from `main`, open a PR into `main`, tag a patch release, then immediately open a PR merging `main` back into `develop`. Document what happened in the PR.
