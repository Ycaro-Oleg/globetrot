# Business rules

This is the authoritative list. The prototype's executable spec is `design/reference/claude-design-v1/atlas/app-core.js`. Where this doc differs from the prototype, **this doc wins**. The differences are deliberate and are listed in [`../design/design-audit.md`](../design/design-audit.md).

## Locale and currency

- The user's **language**, **home country**, **nationality**, **current location** and **preferred currency** are independent settings. None is inferred from another. Detected values are only suggestions the user confirms.
- The default preferred currency is **USD**.
- Each trip has a **trip currency** (budgeting currency). It defaults to the user's preferred currency and can be changed.
- Each expense keeps its **original currency and amount**. Totals are computed in the trip currency using a recorded exchange rate. See [`../architecture/money.md`](../architecture/money.md).
- No silent conversion: wherever a converted amount appears, its rate, source and date are available.
- The payment currency (what Stripe charges for a subscription) is unrelated to trip currencies.

## Accounts and sign-in

Implemented in #53, #54, #57 and #58. Mechanics: [`../architecture/authentication.md`](../architecture/authentication.md); decisions: [ADR-0005](../architecture/adr/0005-authentication.md), [ADR-0012](../architecture/adr/0012-email-delivery-and-verified-sign-in.md).

- Sign-in is by email and password, and by Google (planned, #55). **One account per email address**, compared case-insensitively; addresses are stored in lower case.
- **Password:** 8 to 128 characters and no composition rules (they do not make passwords better; passphrases are welcome). The strength meter on the screens is guidance and never blocks submitting. There is **no account lockout** (it would let anyone lock a victim out); abuse is limited per client address by rate limits.
- **A password sign-in needs a verified email**, and Google sign-in counts as verified. This is the default chosen in #54 and **awaits the owner's confirmation**; it is a setting (`REQUIRE_VERIFIED_EMAIL`).
- **Verification link:** valid 24 hours; following it verifies the address and signs the person in. **Reset link:** valid 1 hour, works once, and a successful reset ends every session of the account.
- **Recovery never reveals whether an address has an account.** The answer is the same for both, and so is the wait: at most one email of each kind per address every 30 seconds.
- **Sessions** last 30 days and are renewed daily when used. The cookie is `HttpOnly`, `SameSite=Lax` and belongs to the web origin.
- **Language at sign-up:** the language the person was using is recorded as their language. Currency, country, nationality and time zone are not inferred from it.
- **Terms and privacy:** the sign-up form requires accepting them. Acceptance is not stored yet, and the legal text is a draft the owner has to write.
- **Email** is transactional only (verification and reset): plain, in the person's language, with no tracking and no remote images. Marketing email needs explicit consent and does not exist.
- **Every mutation is audited** with the names of the fields it changed, never their values. Another user's data is reported as not found.

## Trips

- A user can have many trips.
- **Status** is set explicitly: `active`, `traveling`, `completed`, `archived`. Archiving hides a trip from the default list; it does not delete it, and setting the status back to `active` restores it. Deleting trips is not specified yet.
- **Title:** trimmed, 1 to 120 characters. **Start date:** a real calendar date or none. **Currency:** an active ISO 4217 code, `USD` by default (the UI pre-fills the user's preferred currency). A trip is **private** and only its owner can read or change it; anyone else gets "not found".
- **Stage** is derived, never stored. Each station is met when its condition holds, and the trip sits at the first unmet station. When everything is met, the trip is at `ready`:
  - `dream`: a destination;
  - `explore`: any place added to a stop;
  - `connect`: a route (2+ stops);
  - `plan`: every day planned;
  - `save`: fully saved;
  - `prepare`: documents, stays and checklist done;
  - `ready`: all of the above.
- **Stops (destinations)** are ordered and have `nights ≥ 0`. Day trips have 0 nights. A stop is `planned` or `draft` (a Pip proposal not yet applied). Drafts never count towards days, milestones or next steps.
- **Days:** consecutive local dates from `trip.start` across planned stops in order, one day per night. Without a start date, days are still numbered but have no dates.
- **Next steps:** up to 4, in this priority order:
  1. place the first pin;
  2. the first stop (with nights) that has no stay expense;
  3. the number of empty days;
  4. the first unchecked document;
  5. the monthly saving needed. This one appears only when not on time, a departure date exists and departure is still ahead.

  The domain returns structured steps, and the UI localizes them.
- **Connections** between pins are first-class (`sequence`, `alternate`, `custom`). The route order is the sequence of stops. A drawn connection is conceptual, not a geographically accurate route.

## Budget

- Every expense has a status: `estimate` (≈), `confirmed` (✓), `paid` (●), `unknown` (?). It is always shown as a glyph plus a word.
- An expense belongs to the whole trip, a stop, a day or an activity.
- Categories (domain keys): `flights`, `stay`, `local_transport`, `intercity_transport`, `food`, `experiences`, `insurance`, `documents`, `taxes`, `shopping`, `buffer`, `other`. Custom categories come later.
- Totals are computed by category, by status, by stop and for the whole trip, always in the trip currency. Expenses must be converted before totals are derived.
- Estimates carry the disclaimer "typical-range estimate, not a live quote".

## Savings plan

- `left = max(0, total − saved)` (trip currency). Status: `no-costs` (total = 0), `fully-saved` (left = 0) or `saving`.
- If `monthly > 0`: `months = ceil(left / monthly)`. The **ready month** is today's month + `months` ("by April 2027").
- `monthsUntilDeparture` = whole calendar months from today to departure. A month counts once its day-of-month is reached, so 7 Nov 2026 → 3 Apr 2027 is 4.
- `need` = `ceil(left ÷ monthsUntilDeparture)`, rounded **up** to three significant digits and to at least one major unit (R$ 1,825 → R$ 1,830; ¥182,543 → ¥183,000). When departure is less than a month away, `need = left`.
- `onTime` = `months ≤ monthsUntilDeparture`. It is unknown (`null`) without a departure date and false when monthly = 0. Saving `need` per month is always on time.
- Progress is saved ÷ total in basis points, capped at 100%.
- Edge cases that need explicit copy: no costs yet; already fully saved; monthly = 0; no departure date; departure in the past or today (`departed`).
- Deliberate differences from the prototype: it used "the 5th of the month" for the ready date and fixed rounding to 10 BRL. Both are replaced by the month-based and currency-neutral rules above.
- Savings tracking is a record only. Globetrot never holds funds.

## Readiness milestones (trip "visa page" stamps)

Nine per trip, each recorded once with a date when it first becomes true:

1. `dest`: at least 1 planned stop.
2. `route`: at least 2 planned stops.
3. `budget`: at least 1 expense.
4. `saved`: saved at least 10% of the total, and total > 0. This replaces the prototype's fixed "R$ 1,000" and is currency-neutral.
5. `docs`: there is at least one document item, and all are done.
6. `stays`: at least one planned stop has nights > 0, and every such stop has a stay expense. Day trips never need a bed.
7. `itin`: the trip has at least one day, and every day has at least 1 scheduled place.
8. `check`: the checklist is not empty, and every item is done.
9. `ready`: all of the above, and `left = 0`.

Stamps are recorded once, with the date they were first earned, and are **never taken back** if a condition later becomes false. Newly earned stamps, in display order, drive the celebration queue.

Financial readiness never implies travel readiness. Documents, reservations and entry rules are separate items.

Implementation: `packages/domain/src/trip/` (`tripDays`, `emptyDays`, `tripTotals`, `savingsPlan`, `milestones`, `recordStamps`, `journeyStage`, `nextSteps`). It is tested against the prototype's Japan demo board in `__fixtures__/japan-demo.ts`.

## Passport

- The passport belongs to the **account**. It is decorative and fictional, and must never look like or claim to be an official document.
- Each trip gets a **visa page**. Readiness stamps land there.
- **Place stamps** (country, city) are added when a trip is completed or when a user declares a past visit. They are labelled `self-declared` unless a real verification mechanism exists.
- **Globetrot visas** (design handoff v2): marking a stop **visited** on the board is a self-declared visit. The first visited stop in a country stamps that country's commemorative visa, one per person and country, with the stop's name and the date. A visa is a souvenir: it is **never taken back**, even if the stop is un-visited, the stop is removed or the trip is archived. Wherever visas are shown, the UI says they are commemorative and not official documents.

## AI (Pip)

- Output is a structured **change list**, never free prose that edits data.
- Proposals are previewed (pencilled pins, dotted routes) and can be partially applied. Applying them creates an undoable record.
- Pip never invents confirmed bookings, prices, availability or entry/visa rules. Entry rules always link to official sources.
- Usage is metered per user. Limits come from the plan's entitlements.

## Privacy (applies from day one)

- Trips are private by default, and the API answers "not found" (never "forbidden") for another user's trip.
- The audit log records who changed what and when, with field names only, and cannot be edited. Account data export and deletion must be designed around that before a public release.
- Future public content must support delayed location publication, and never shows live location.
- EXIF location data is stripped from uploaded media unless the user explicitly keeps it.
- Users can export and delete their data (LGPD/GDPR).

## Progression (planned, M12+)

- XP comes from an immutable event ledger, with diminishing returns and daily caps.
- Community value (helpful votes from distinct, established accounts) outweighs volume.
- Planning achievements count once per trip and require a minimum of real content.
- Meaningful progression must be available without frequent international travel.
- Rewards are cosmetic only.
