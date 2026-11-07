# MCP integration (external AI clients)

Status: **planned for M12+.** The architecture prepares for it now, through [ADR-0006](../architecture/adr/0006-api-and-application-layer.md) and [ADR-0007](../architecture/adr/0007-ai-provider-abstraction.md).

## Goal

Let users manage Globetrot from MCP-compatible clients such as Claude and ChatGPT (via the Apps SDK). Each client has its own integration and authorization flow, so don't assume they all behave the same.

## Preparation that starts now

- Every operation is an application command or query with Zod schemas. Each MCP tool is a thin wrapper over one of them.
- Actor-based authorization, idempotency keys and audit logging are built in from M3.
- `AIProposal` already models "pending approval".

## Planned design

- `apps/mcp`: a remote MCP server (Streamable HTTP) that calls only `packages/application`.
- **Auth:**
  - OAuth 2.1 through Better Auth's OAuth Provider/MCP plugin, with protected-resource metadata.
  - Per-user grants (`AgentGrant`), revocable under Settings → Integrations.
- **Scopes:** `trips:read`, `trips:write`, `finance:read`, `finance:write`, `social:draft`, `social:publish`, `passport:read`.
- **Rate limits** per grant, and every call is audited.
- **Tool versioning:** tool names are stable, and versioned schemas evolve without breaking changes.

## Initial tool classification

| Class | Tools |
|---|---|
| Read | `list_trips`, `get_trip`, `list_destinations`, `get_itinerary`, `get_trip_budget`, `list_my_posts`, `get_my_passport`, `get_my_achievements` |
| Write | `create_trip`, `update_trip`, `add_destination`, `update_destination`, `add_activity`, `update_activity`, `add_expense`, `create_post_draft` |
| Explicit confirmation | `publish_approved_post`, `update_savings_goal` and budget changes above a threshold, any delete |

**Portable confirmation:** a sensitive tool creates a pending `AIProposal` that the user approves inside Globetrot. MCP elicitation is used where the client supports it.
