# Architecture Decision Records

An ADR records one significant decision: its context, the decision itself and its consequences. ADRs are immutable once accepted. To change a decision, write a new ADR that supersedes the old one and update the old ADR's status line.

**When to write one:** you are choosing or replacing a framework or library with wide impact, changing a cross-cutting convention, changing a data or contract strategy, or making anything that would surprise the next agent.

ADRs 0010 to 0012 were written after the work they describe (#53 to #61), which is allowed when a decision is made while building. Prefer writing the ADR in the same PR.

**Format:** `NNNN-short-title.md`, copied from [`template.md`](template.md). Keep it under about a page.

| # | Title | Status |
|---|---|---|
| [0001](0001-documentation-and-language-policy.md) | Documentation and language policy | Accepted |
| [0002](0002-monorepo-and-stack.md) | TypeScript monorepo and core stack | Accepted |
| [0003](0003-map-stack.md) | Map stack: MapLibre + OSM (Protomaps) + own places DB | Accepted (spikes #2 and #3 done, device FPS pending) |
| [0004](0004-money-and-currency.md) | Money as integer minor units with FX provenance | Accepted |
| [0005](0005-authentication.md) | Authentication with Better Auth | Accepted |
| [0006](0006-api-and-application-layer.md) | REST/OpenAPI API over a shared application layer | Accepted |
| [0007](0007-ai-provider-abstraction.md) | Provider-agnostic AI with structured, approvable proposals | Accepted |
| [0008](0008-internationalization.md) | ICU-based internationalization | Accepted |
| [0009](0009-git-workflow.md) | GitFlow-lite with convention-based protection | Accepted |
| [0010](0010-web-proxies-the-api.md) | The web app proxies the API so the session cookie is first-party | Accepted |
| [0011](0011-idempotency-audit-and-units-of-work.md) | Mutations are one transaction with their audit event and idempotency record | Accepted |
| [0012](0012-email-delivery-and-verified-sign-in.md) | Email through a port and SMTP, and a verified address for password sign-in | Accepted (the verified-email policy awaits the owner's confirmation) |
