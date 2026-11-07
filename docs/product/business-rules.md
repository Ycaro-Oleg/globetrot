# Business rules

This is the authoritative list. The prototype's executable spec is `design/reference/claude-design-v1/atlas/app-core.js`. Where this doc differs from the prototype, **this doc wins**. The differences are deliberate and are listed in [`../design/design-audit.md`](../design/design-audit.md).

## Locale and currency

- The user's **language**, **home country**, **nationality**, **current location** and **preferred currency** are independent settings. None is inferred from another. Detected values are only suggestions the user confirms.
- The default preferred currency is **USD**.
- Each trip has a **trip currency** (budgeting currency). It defaults to the user's preferred currency and can be changed.
- Each expense keeps its **original currency and amount**. Totals are computed in the trip currency using a recorded exchange rate. See [`../architecture/money.md`](../architecture/money.md).
- No silent conversion: wherever a converted amount appears, its rate, source and date are available.
- The payment currency (what Stripe charges for a subscription) is unrelated to trip currencies.

## Trips

- A user can have many trips.
- **Status** is set explicitly: `active`, `traveling`, `completed`, `archived`.
- **Stage** is derived, never stored: the first unmet step of `dream → explore → connect → plan → save → prepare → ready`.
- **Stops (destinations)** are ordered and have `nights ≥ 0`. Day trips have 0 nights. A stop is `planned` or `draft` (a Pip proposal not yet applied).
- **Days:** consecutive local dates from `trip.start` across planned stops in order, one day per night.
- **Connections** between pins are first-class (`sequence`, `alternate`, `custom`). The route order is the sequence of stops. A drawn connection is conceptual, not a geographically accurate route.

## Budget

- Every expense has a status: `estimate` (≈), `confirmed` (✓), `paid` (●), `unknown` (?). It is always shown as a glyph plus a word.
- An expense belongs to the whole trip, a stop, a day or an activity.
- Categories: flights, stay, local transport, intercity transport, food, attractions/experiences, insurance, documents/visa, taxes, shopping, emergency buffer, other (custom later).
- Estimates carry the disclaimer "typical-range estimate, not a live quote".

## Savings plan

- `left = total − saved` (trip currency).
- If `monthly > 0`: `months = ceil(left / monthly)`, and the ready date is the end of that month counted from today (locale-aware formatting).
- `need` = `left ÷ full months remaining before departure`, rounded up to a friendly increment for the currency.
- `onTime` = ready date ≤ departure date.
- Edge cases that need explicit copy: no costs yet; already fully saved; monthly = 0; no departure date; departure in the past.
- Savings tracking is a record only. Globetrot never holds funds.

## Readiness milestones (trip "visa page" stamps)

Nine per trip, each recorded once with a date when it first becomes true:

1. `dest`: at least 1 planned stop.
2. `route`: at least 2 planned stops.
3. `budget`: at least 1 expense.
4. `saved`: saved at least 10% of the total. This replaces the prototype's fixed "R$ 1,000" and is currency-neutral.
5. `docs`: all document checklist items done.
6. `stays`: every planned stop with nights > 0 has a stay expense.
7. `itin`: every day has at least 1 planned place.
8. `check`: all checklist items done.
9. `ready`: all of the above, and `left = 0`.

Financial readiness never implies travel readiness. Documents, reservations and entry rules are separate items.

## Passport

- The passport belongs to the **account**. It is decorative and fictional, and must never look like or claim to be an official document.
- Each trip gets a **visa page**. Readiness stamps land there.
- **Place stamps** (country, city) are added when a trip is completed or when a user declares a past visit. They are labelled `self-declared` unless a real verification mechanism exists.

## AI (Pip)

- Output is a structured **change list**, never free prose that edits data.
- Proposals are previewed (pencilled pins, dotted routes) and can be partially applied. Applying them creates an undoable record.
- Pip never invents confirmed bookings, prices, availability or entry/visa rules. Entry rules always link to official sources.
- Usage is metered per user. Limits come from the plan's entitlements.

## Privacy (applies from day one)

- Trips are private by default.
- Future public content must support delayed location publication, and never shows live location.
- EXIF location data is stripped from uploaded media unless the user explicitly keeps it.
- Users can export and delete their data (LGPD/GDPR).

## Progression (planned, M12+)

- XP comes from an immutable event ledger, with diminishing returns and daily caps.
- Community value (helpful votes from distinct, established accounts) outweighs volume.
- Planning achievements count once per trip and require a minimum of real content.
- Meaningful progression must be available without frequent international travel.
- Rewards are cosmetic only.
