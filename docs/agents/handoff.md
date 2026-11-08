# Handoff convention

Chat history is not a durable record. When a session ends with work in progress, or a PR is opened, leave a handoff where the next agent will look for it:

- **Work in progress:** a comment on the GitHub issue, titled `Handoff`.
- **PR opened:** the "Handoff" section of the PR description.
- **Project state changed** (milestone progress, new blocker, new decision, a feature finished): update [`current-state.md`](current-state.md), [`../product/progress.md`](../product/progress.md) and, if a milestone moved, [`../product/roadmap.md`](../product/roadmap.md), **in the same PR**.

## Template

```markdown
## Handoff
- **Issue:** #<n> <title>
- **Branch:** feature/issue-<n>-<slug> (pushed: yes/no)
- **Done:** what was completed
- **Relevant files:** paths, with a one-line role each
- **Decisions:** anything decided, plus links to ADRs or docs updated
- **Tests:** what ran and the result (commands)
- **Not verified:** what you did not or could not check (screen readers, real devices, real providers)
- **Known issues:** bugs, shortcuts, TODOs
- **Remaining:** what is left, against the acceptance criteria
- **Owner needed:** anything only the owner can supply (credentials, a decision, a review)
- **Next suggested action:** the single next step
```

## End-of-session checklist

Before you stop, in this order:

1. Everything you want to keep is committed on a branch and pushed, or clearly marked as not.
2. The verification you claim was actually run (see the table in [`playbook.md`](playbook.md#3-verify-before-you-open-the-pr)).
3. The canonical docs are updated for what you changed ([`playbook.md`](playbook.md#which-docs-to-update)), and `pnpm docs:check` passes.
4. `current-state.md` and `progress.md` say what is now true. Replace the stale line; do not append next to it.
5. The handoff is written (issue comment or PR section), including what you did **not** verify and what needs the owner.
6. You told the owner, in Brazilian Portuguese, what is done, what is not, and the one decision you need.

## Rules

- Keep it short and current. Replace a stale handoff instead of appending to it.
- Never include secrets, tokens, credentials or real user data.
- A decision that affects other work belongs in the canonical doc or an ADR, not only in a handoff.
- Do not mark an owner-dependent item done because you wrote the code for it. Say what remains.
