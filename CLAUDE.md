@AGENTS.md

# Claude Code notes

`AGENTS.md` (imported above) holds the canonical instructions. This file only adds Claude-specific notes and must never contradict it.

- **Reply to the product owner in Brazilian Portuguese.** Write repository artifacts (docs, code, commits, issues, PRs) in English.
- **Keep context small.** Start from `docs/agents/current-state.md` and `docs/agents/context-map.md`, and read only the docs your task needs. Prefer targeted reads (search, then read the relevant section) over whole files.
- **Plan before large changes.** For anything that spans several packages or touches an ADR-level decision, propose the plan first.
- **GitHub:** use `gh` for issues, PRs and milestones. Open PRs against `develop`. Don't change repository settings.
- **Handoff:** before ending a session with unfinished work, write the handoff described in `docs/agents/handoff.md` on the issue or PR.
- **Restricted:** `.claude/settings.json` denies reading env files and pushing to `main` or `develop`. Don't work around it.
