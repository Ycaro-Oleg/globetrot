# 0016. Pip v1 on DeepSeek, through a small JSON port

- Status: Accepted (supersedes the provider and library choice in [ADR-0007](0007-ai-provider-abstraction.md); its proposal model stands)
- Date: 2026-11-13

## Context
ADR-0007 chose structured, approvable proposals behind a provider-agnostic port, with the Vercel AI SDK and Claude as the default. On 2026-11-13 the owner chose **DeepSeek** as the provider and supplied a key. Pip must stay optional, never write data itself, never invent bookings, prices or entry rules, and send no more personal data than it needs.

## Decision
- **`AiPort.completeJson({ system, user, maxTokens })`** in the application; one adapter, `createDeepSeekAi`, calls DeepSeek's OpenAI-compatible chat completions in JSON mode with `fetch` (no SDK). The key (`DEEPSEEK_API_KEY`) stays on the server; without it asking answers `503`. Failures are logged by kind only, never the prompt, the answer or the key. Swapping providers is a new adapter.
- **The prompt lives in the application** (`assistant/prompt.ts`) and is pinned by tests. The model answers `{ summary, changes[] }`; each change is parsed with Zod (`pipChangeSchema`) and invalid ones are dropped. Kinds: `addStop`, `removeStop`, `setNights`, `reorder`, `addPlace`, `addChecklistItem`, `addExpense` (always status `estimate`, trip currency), `setMonthly`. At most 12.
- **Stops are named `s1`, `s2`…** in the prompt and mapped back to ids on the server, so the model never sees or invents ids.
- **What the model sees:** the trip's title, currency, start date, stops (name, country, nights, places), checklist labels, cost totals by category and the savings amounts. Never the person's name, email, home city or other trips.
- **Proposals are stored** (`ai_proposal`) and move only forward (`canDecide`): proposed → applied → undone, or proposed → discarded. Applying runs in one transaction and keeps undo data (the route before, the monthly amount before, the ids it created). Undo works for 24 hours and puts the route back as it was then.
- **Usage** (`ai_usage`: provider, model, input and output tokens) is recorded per request; **20 requests a day** per person until plans set limits.
- Pip stays behind `FEATURE_PIP`.

## Alternatives considered
- **Vercel AI SDK with the DeepSeek provider:** more dependencies for one JSON call; DeepSeek does not offer strict schema outputs, so validation would still be ours.
- **Letting the model call tools that write:** against ADR-0007 and the business rules.

## Consequences
- Trip plans leave our infrastructure for DeepSeek when someone asks Pip; the screen says so, and the privacy policy must say so before launch (owner item).
- Undo restores the route as it was when the proposal was applied, so route edits made after it are lost by an undo; the window is short and the screen offers undo right after applying.
- Proposed stops are not drawn on the map before applying yet (pencilled pins remain a follow-up).
