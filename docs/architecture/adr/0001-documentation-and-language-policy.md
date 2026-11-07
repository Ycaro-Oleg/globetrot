# 0001. Documentation and language policy

- Status: Accepted
- Date: 2026-11-07

## Context
Several AI agents (Codex, Claude Code, others) and humans will work on Globetrot over a long period. No single agent or chat history may be the only holder of project knowledge. The product owner works in Brazilian Portuguese, while the product is global.

## Decision
- `docs/` is the canonical source of truth. Each topic has one owning document. Other documents link to it instead of copying it.
- `AGENTS.md` is the canonical agent entry point. `CLAUDE.md` imports it and adds only Claude-specific notes.
- Repository artifacts (docs, code, identifiers, commits, issues, PRs) are written in **English**.
- User-facing copy lives in message catalogs (`en`, `pt-BR`, …), never in docs or components.
- Agents talk to the product owner in **pt-BR**.
- Docs are created only when they have real content. Updating the owning doc is part of the definition of done.

## Alternatives considered
- All-Portuguese repository: excludes international contributors and makes agent prompts inconsistent.
- Separate rule sets for each agent: they drift and contradict each other.

## Consequences
Agents rehydrate context from `AGENTS.md` → `docs/agents/current-state.md` → `docs/agents/context-map.md`. Doc maintenance is a cost carried by every PR.
