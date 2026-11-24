# 0005. Authentication with Better Auth

- Status: Accepted
- Date: 2026-11-07

## Context
We need email/password, Google OAuth, secure sessions, recovery, a native mobile client later, and later still an OAuth 2.1 authorization server for MCP clients. We want to self-host on Hetzner, avoid per-MAU vendor costs, and keep users in our own Postgres.

## Decision
Use **Better Auth** (TypeScript, self-hosted, Drizzle adapter):
- **MVP:** email/password + Google.
- **Later:** Expo support, and the OAuth Provider / MCP plugin for scoped external-agent grants.

## Alternatives considered
- Auth.js: weaker for API-plus-mobile setups and provider scenarios.
- Clerk/Auth0: vendor lock-in and cost.
- Supabase Auth: see ADR-0002.
- Rolling our own: risky.

## Consequences
Auth tables live in our database. Better Auth's MCP/OAuth plugin is evolving (its docs mention a move toward the OAuth Provider plugin), so its API must be re-checked when M12 starts.
