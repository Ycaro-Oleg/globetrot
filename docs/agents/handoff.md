# Handoff convention

Chat history is not a durable record. When a session ends with work in progress, or a PR is opened, leave a handoff where the next agent will look for it:

- **Work in progress:** a comment on the GitHub issue, titled `Handoff`.
- **PR opened:** the "Handoff" section of the PR description.
- **Project state changed** (milestone progress, new blocker, new decision): update [`current-state.md`](current-state.md) in the same PR.

## Template

```markdown
## Handoff
- **Issue:** #<n> <title>
- **Branch:** feature/issue-<n>-<slug> (pushed: yes/no)
- **Done:** what was completed
- **Relevant files:** paths, with a one-line role each
- **Decisions:** anything decided, plus links to ADRs or docs updated
- **Tests:** what ran and the result (commands)
- **Known issues:** bugs, shortcuts, TODOs
- **Remaining:** what is left, against the acceptance criteria
- **Next suggested action:** the single next step
```

## Rules

- Keep it short and current. Replace a stale handoff instead of appending to it.
- Never include secrets, tokens, credentials or real user data.
- A decision that affects other work belongs in the canonical doc or an ADR, not only in a handoff.
