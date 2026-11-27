# 0022. A backup AI provider for Pip (Claude Haiku)

- Status: Accepted, dormant. On 2026-11-27 the owner decided to run Pip on DeepSeek only, for cost: `ANTHROPIC_API_KEY` stays unset, so the backup never runs. The adapter stays in the code so it can be switched on later with the key alone
- Date: 2026-11-26

## Context
Pip runs on DeepSeek ([ADR-0016](0016-pip-on-deepseek.md)) behind `AiPort` ([ADR-0007](0007-ai-provider-abstraction.md)). With a single provider an outage, a slow answer or a rotated key takes Pip down for everyone, and people pay credits for it. The owner had no preference for the second provider.

## Decision
- **Anthropic's Claude Haiku is the backup**, called through the Messages API (`/v1/messages`) by `createAnthropicAi` in `apps/api/src/ai.ts`. The JSON-only instruction goes in the system prompt and the answer's outer object is parsed, so the same validation of proposals applies.
- **`fallbackAi([deepseek, anthropic])`** asks each provider in order and returns the first answer. A provider that is not configured, fails, times out (30 seconds) or answers something that is not JSON counts as no answer.
- **Settings:** `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL` (default `https://api.anthropic.com`) and `ANTHROPIC_MODEL` (default `claude-haiku-5-5`). Without the key there is no backup; without either key asking Pip answers `503` as before.
- Credits are charged per request as in [ADR-0019](0019-plans-trial-and-pip-credits.md), whichever provider answered.

## Alternatives considered
- **A second DeepSeek region or key:** does not cover an outage of the provider itself.
- **OpenAI or Gemini:** equivalent in function; Haiku is cheap, fast and follows JSON instructions well.

## Consequences
- Two providers may phrase proposals differently; proposals are structured and validated, so the person still previews and applies the same kind of change list.
- The owner needs an Anthropic account and key; the DeepSeek key still needs rotating.
