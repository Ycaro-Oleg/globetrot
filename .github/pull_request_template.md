## Summary
<!-- What changes and why, in 1–3 sentences. -->

Closes #

## Type
- [ ] feat  - [ ] fix  - [ ] docs  - [ ] refactor  - [ ] test  - [ ] chore  - [ ] spike findings

## Screenshots (UI changes)
<!-- Desktop + mobile; light + dark when relevant; en + pt-BR if copy changed. -->

## Checklist
- [ ] Acceptance criteria of the issue are met
- [ ] Tests added/updated, and lint, typecheck and tests pass (`pnpm turbo run lint typecheck test build`, `pnpm test:int` if the database or email is involved)
- [ ] User-facing strings exist in `en` **and** `pt-BR` (no hardcoded copy)
- [ ] Money uses `Money` (minor units + ISO 4217), and no currency is inferred from locale
- [ ] Accessibility: keyboard path, labels, contrast, reduced motion
- [ ] Canonical docs / ADR updated if a rule, contract, setting or convention changed, and `pnpm docs:check` passes
- [ ] `pnpm api:generate` run if an API route or schema changed
- [ ] `docs/agents/current-state.md` and `docs/product/progress.md` updated if project state changed
- [ ] No secrets, credentials or real user data

## Handoff
- **Issue:** #
- **Branch:**
- **Done:**
- **Relevant files:**
- **Decisions:**
- **Tests:**
- **Not verified:** <!-- screen readers, real devices, real providers, anything you did not run -->
- **Known issues:**
- **Remaining:**
- **Owner needed:** <!-- credentials, a decision, a review: or none -->
- **Next suggested action:**
