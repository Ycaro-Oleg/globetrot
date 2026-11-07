# 0006. REST/OpenAPI API over a shared application layer

- Status: Accepted
- Date: 2026-11-07

## Context
Many clients will consume the same operations: web, mobile, Pip, the MCP server, jobs and admin. Business rules must not live in UI components or route handlers.

## Decision
- `packages/application` exposes **commands and queries** with Zod input/output schemas, actor-based authorization, idempotency keys and audit hooks.
- `apps/api` (Hono) is a thin HTTP adapter. It publishes an **OpenAPI** contract, and a typed client is generated into `packages/api-client`.
- The Pip companion and the future MCP server call the same application operations, never the HTTP layer of another app.
- Next.js server code doesn't access the database directly for domain operations. It goes through the API or the application package.

## Alternatives considered
- tRPC only: excellent inside TypeScript, but a weaker fit for external, mobile and MCP clients.
- GraphQL: more complexity than we need.
- Next.js server actions as the backend: couples rules to the web app.

## Consequences
There is a small amount of extra boilerplate per endpoint. In return, MCP tools become thin wrappers over existing schemas.
