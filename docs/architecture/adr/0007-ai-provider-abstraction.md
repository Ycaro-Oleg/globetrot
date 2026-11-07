# 0007. Provider-agnostic AI with structured, approvable proposals

- Status: Accepted
- Date: 2026-11-07

## Context
Pip must help without taking control, must not invent facts, must control costs, and must not lock us into a single provider.

## Decision
- An `AiPort` is implemented with the **Vercel AI SDK** (provider-agnostic). Claude models are the default.
- The model only produces a **structured change list**, validated with Zod. The prototype schema (`keepStop`, `addStop`, `addPlace`, `addPlaceNew`, `addExp`, `reorder`, `setMonthly`, `trim`) is the starting point.
- Each change list is stored as an `AIProposal`. The user previews it, toggles items and applies it. Applying runs ordinary application commands and records undo data.
- The model gets read-only context tools (current trip, places DB, typical cost ranges). It never writes directly.
- Usage (tokens and cost) is recorded per user in `AIUsage`. Limits come from entitlements, and rate limiting is enforced in the API.
- Prices are labelled as estimates. Visa and entry rules link to official sources.

## Consequences
The same proposal mechanism serves MCP confirmations later. Prompt and schema changes need tests (golden examples).
