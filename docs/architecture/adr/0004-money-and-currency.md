# 0004. Money as integer minor units with FX provenance

- Status: Accepted
- Date: 2026-11-07

## Context
The product is global, with USD as the default currency and user-selectable currencies. Expenses happen in many currencies. The prototype stored everything in BRL with fixed rates, which is unacceptable.

## Decision
- `Money = { amountMinor: bigint, currency: ISO4217 }`, with per-currency exponents and no floating point.
- Original amounts are always kept. Trip totals use converted amounts that reference an `ExchangeRate` record (rate, source, timestamp).
- Rates can be live, locked or manual. Paid expenses lock their rate by default.
- Formatting combines the user's locale with the data's currency, independently of each other.
- Details live in [`../money.md`](../money.md).

## Consequences
Every finance feature handles conversion explicitly. A small, well-tested `Money` module in `packages/domain` is an early M2 deliverable.
