# 0009. GitFlow-lite with convention-based protection

- Status: Accepted
- Date: 2026-11-07

## Context
Multiple agents work in parallel and need small, reviewable changes. The repository is private on GitHub Free, where branch protection rules and rulesets are **not enforced**.

## Decision
- Branches: `main` (release-ready), `develop` (integration), `feature/*`, `fix/*`, `docs/*`, `chore/*`, `spike/*`, `hotfix/*`.
- PRs go into `develop`. Release PRs go `develop → main`, tagged with SemVer.
- Commits follow Conventional Commits.
- **Protection is by convention plus CI:** `AGENTS.md` forbids direct pushes, `.claude/settings.json` denies pushes to `main`/`develop`, and CI runs and reports checks on every PR.
- Details live in [`../../engineering/git-workflow.md`](../../engineering/git-workflow.md).

## Consequences
Mistakes are possible, so humans and agents must follow the convention. If the plan is upgraded or the repository becomes public, enable rulesets that mirror these rules.
