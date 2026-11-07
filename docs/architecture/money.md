# Money and currencies

Status: **approved** ([ADR-0004](adr/0004-money-and-currency.md)). Business rules: [`../product/business-rules.md`](../product/business-rules.md#locale-and-currency).

## Value object

```ts
type CurrencyCode = string;            // ISO 4217, e.g. "USD", "BRL", "JPY"
interface Money { amountMinor: bigint; currency: CurrencyCode }
```

- Store amounts as **integer minor units**. The minor-unit exponent comes from ISO 4217 (USD 2, JPY 0, KWD 3), never hardcoded to 2.
- Never use floating point for stored or summed amounts.
- In the database, use `amount_minor BIGINT` + `currency CHAR(3)`.
- Arithmetic between two `Money` values requires the same currency. Anything else must go through an explicit conversion.

## Three different currencies

| Concept | Where | Example |
|---|---|---|
| **Original (transaction) currency** | Each Expense | A ¥3,000 ramen tour |
| **Budgeting (trip) currency** | Each Trip, defaulting to the user's preferred currency (USD) | Trip totals in USD |
| **Payment currency** | Stripe subscription | Unrelated to trips |

## Conversion and provenance

```ts
interface ExchangeRate { id; base: CurrencyCode; quote: CurrencyCode; rate: string /* decimal */; source: string; asOf: Date }
interface Expense { original: Money; converted: Money /* trip currency */; fxRateId: string | null; fxMode: 'live' | 'locked' | 'manual'; ... }
```

- Store rates as decimal strings (Postgres `NUMERIC(20,10)`), with their source and timestamp.
- **Live** means it follows the latest rate. **Locked** means it was frozen at entry or payment time, which is the default for `paid` expenses. **Manual** means the user entered the rate.
- The UI can always show "converted at 1 USD = 151.20 JPY · source · date". Rates are labelled indicative, not a bank quote.
- Rounding is half-even, applied once, at conversion.
- A worker fetches rates on a schedule. The first provider is the ECB reference rates (via Frankfurter, self-hostable), with a fallback provider behind an `FxRatePort` for currencies the ECB doesn't cover.

## Formatting

Use `Intl.NumberFormat(locale, { style: 'currency', currency })`. The **locale** comes from the user's language and region, and the **currency** comes from the data. They are independent: a pt-BR user can see `US$ 1.250,00`, and an en user can see `R$1,250.00`.
