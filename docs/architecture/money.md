# Money and currencies

Status: **approved** ([ADR-0004](adr/0004-money-and-currency.md)). Business rules: [`../product/business-rules.md`](../product/business-rules.md#locale-and-currency).

## Value object

```ts
type CurrencyCode = string & { readonly __brand: 'CurrencyCode' }; // validated ISO 4217, e.g. "USD"
interface Money { readonly amountMinor: bigint; readonly currency: CurrencyCode }
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

Use `formatMoney(money, locale)`, a wrapper over `Intl.NumberFormat`. The **locale** comes from the user's language and region, and the **currency** comes from the data. They are independent: a pt-BR user can see `US$ 1.250,00`, and an en user can see `R$1,250.00`.

## Implementation: `@globetrot/domain` (`packages/domain/src/money/`)

| Function | Behaviour |
|---|---|
| `toCurrencyCode(s)`, `isCurrencyCode(s)`, `minorUnitExponent(c)`, `listCurrencyCodes()`, `DEFAULT_CURRENCY` | Registry of **active ISO 4217 codes** with minor-unit exponents (0, 2 or 3). Fund, metal, testing and withdrawn codes are excluded. Codes are case-sensitive uppercase. Localized currency names come from `Intl.DisplayNames` at the UI edge |
| `money(minor, code)`, `zero(code)` | Construct a frozen `Money` and validate the code |
| `fromDecimal('12.5', 'USD', { rounding? })` | Parse a plain decimal string (no exponents or separators). Extra precision is **rejected** by default, or rounded half-even with `{ rounding: 'half-even' }` |
| `toDecimalString(m)` | Exact major-unit string at full precision (`"12.50"`, `"1250"`, `"1.234"`) |
| `add`, `subtract`, `negate`, `sum(list, code)`, `compare`, `equals`, `isZero`, `isNegative` | Same-currency arithmetic. Mixing currencies throws `CurrencyMismatchError` |
| `multiply(m, 4n \| '1.1')` | Exact factor (bigint or decimal string), rounded half-even |
| `allocate(m, ratios)`, `split(m, n)` | Distribute without losing a minor unit. Parts always sum exactly to the input. Leftover units go to the largest remainders, earliest first |
| `exchangeRate(input)` | Validate and freeze a rate record: known codes, base ≠ quote, positive decimal rate, source, valid `asOf` |
| `convert(m, rate)` → `{ original, converted, rateId, inverted }` | Base → quote multiplies, quote → base divides. **One** half-even rounding to the target minor unit |
| `formatMoney(m, locale, { display?, precision? })` | Passes the exact decimal string to `Intl` (no float). `precision: 'whole'` rounds half-even for coarse estimates |

- **Errors** extend `MoneyError`: `UnknownCurrencyError`, `CurrencyMismatchError`, `InvalidAmountError`, `InvalidRateError`.
- **Registry maintenance:** when ISO 4217 adds or withdraws a code, update the table in `currency.ts` and its tests. Withdrawn codes on historical data need a migration decision first, so don't remove a code that stored rows still use without one.
- **Tests:** unit plus property-based tests (fast-check), with coverage gated at ≥ 95% for `src/money/**` (`packages/domain/vitest.config.ts`).

## In the product today (M6 v1)

- A cost is stored as the amount typed (minor units and currency) **and** the same cost in the trip's currency, with the provenance of the conversion: the rate, its source and the day. Today the only source is `manual` (the person types the rate); a rates source arrives later and only adds another `source`. See [data-model](data-model.md#budget-expenses-and-savings).
- The conversion is computed on the server with `convert` (half-even rounding); the client never sends a converted amount.
- Totals add up the trip-currency amounts only, so a total never mixes currencies. The trip's currency is locked once it has costs or savings.
