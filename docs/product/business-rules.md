# Business rules

This is the authoritative list. The prototype's executable spec is `design/reference/claude-design-v1/atlas/app-core.js`. Where this doc differs from the prototype, **this doc wins**. The differences are deliberate and are listed in [`../design/design-audit.md`](../design/design-audit.md).

## Locale and currency

- The user's **language**, **home country**, **nationality**, **current location** and **preferred currency** are independent settings. None is inferred from another. Detected values are only suggestions the user confirms.
- The default preferred currency is **USD**.
- Each trip has a **trip currency** (budgeting currency). It defaults to the user's preferred currency and can be changed.
- Each expense keeps its **original currency and amount**. Totals are computed in the trip currency using a recorded exchange rate. See [`../architecture/money.md`](../architecture/money.md).
- No silent conversion: wherever a converted amount appears, its rate, source and date are available.
- The payment currency (what Stripe charges for a subscription) is unrelated to trip currencies.
- **Home city** is an optional setting: the city the person usually leaves from, as they wrote it. It is asked in the onboarding and editable in settings; nothing is derived from it.

## Onboarding (the first trip)

- **From the landing page:** the “Can I go?” calculator works for anyone, with the same savings rule as the app; “Save this plan” keeps the three numbers (cost, saved, monthly, plain amounts only) in the `globetrot.plan_draft` cookie for 30 days so the money step starts with them after sign-up. Finishing onboarding clears it.

- Seven steps (welcome, home city, destination, month and length, money, Pip, the answer). Every step can be changed later, and nothing is charged.
- **The cost is the person's own rough guess**, never ours: it is stored as one cost with status `estimate` ("Rough trip estimate") in the trip's currency (the preferred currency), and replaced by real costs later. Globetrot does not show invented typical ranges.
- The answer uses the savings plan rule (below) on that guess, the amount saved, the monthly amount and the first day of the chosen month.
- "Open my map" creates the trip through the same API as everything else: the trip (titled with the destination, starting on the first of the chosen month), its first stop with the nights when the place was found by the search, the estimate cost and the savings; then the board opens. When place search is unavailable the person can continue with the typed name, and the trip starts without a stop.
- A signed-in person with no trip who opens the app lands on the onboarding.

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
- **Status** is set explicitly: `active`, `traveling`, `completed`, `archived`. Archiving hides a trip from the default list; it does not delete it, and setting the status back to `active` restores it. **Deleting** is only for an archived trip, after a confirmation, and takes everything in the trip with it.
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
- **Places on days (the day plan):** a trip keeps up to 200 places to see, each with a name (1 to 120 characters), an estimated time (15 minutes to 12 hours), an optional stop and a day or "No day". A new place goes to "No day". Places move to a day (at its end or before another place of that day) by drag and drop or the "Move to" select, and every move can be undone. A day's load is the sum of its places' times: **more than 9 hours is a "full day"**, under 3 is "light". A place on a day spent at another stop shows a warning ("Outside the stop"), never a block. When the route changes, nothing is lost: a day the route no longer reaches reads as "No day", and a place whose stop was removed reads with no stop. "Every day has a plan" (readiness) is earned when each day has at least one place.
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
- **Trip ceiling** (optional, design handoff v2): the most the person wants the trip to cost, in the trip's currency. `ceilingSlack = ceiling − total`: positive is slack ("$1,078 of slack under your ceiling"), negative is over it ("$200 over your ceiling"). Without a ceiling nothing is compared. The ceiling never changes the savings answer.
- **Live answer.** While the monthly amount moves, the Budget screen recomputes the answer with this same rule (`savingsPlan`) and saves the new amount; the sentence never comes from a guess in the screen.
- Savings tracking is a record only. Globetrot never holds funds, and the screen says so next to the savings inputs.

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

## Profile and My Pip

- **The profile** (`/app/profile`) is the person's own page: their name, home city, Pip, a few numbers (countries and continents with a visa, trips) and their visas grouped by year, newest first, with a continent filter. Continents follow the UN M49 grouping (`continentOf` in `@globetrot/domain`): Africa, the Americas split into North and South (Central America and the Caribbean count as North), Asia, Europe, Oceania; Antarctica has its own entry. Following, sharing and visa privacy arrive with the community.
- **My Pip.** Each person dresses their own Pip (hat, outfit, bag, bag colour) and may name it (1 to 16 characters; empty brings back "Pip"). Nothing changes until **Save**; Undo returns to the saved look and Shuffle picks a random one. The saved look is drawn on **every** Pip the person sees in the app. It is cosmetic only: no option is paid or locked today.

## Photos

Decision record: [ADR-0014](../architecture/adr/0014-photos-and-storage.md).

- Photos can be added to **moments and tips** (up to 4) and to **a stop's pin card** (up to 12). JPEG, PNG or WebP, up to 8 MB; the web app resizes them to at most 2048 px first. At most 100 uploads a day.
- **Location and camera data are always removed** before a photo is stored, and the screens say so.
- Every photo has a description for people who cannot see it (optional; a post photo without one reads "Photo by {name}").
- A photo is private to its owner until it is placed on a post; then whoever may see the post may see the photo. Stop photos stay private with the trip, and a shared route never carries them.
- Only one's own uploads can be placed.

## Community

Decision record: [ADR-0013](../architecture/adr/0013-community.md).

- **Posts** are a moment, a tip, a route, a visa or a goal. Moments and tips need words (up to 500 characters) or photos; the others may add words. A place can be tagged by name (the current trip's stops are suggested). See "Photos" above.
- **Shared data is a snapshot, made from the author's own data when they post.** A route shows the stops and nights as they were, never a link to the private trip, and its planned total only if the author unticks "Hide budget amounts" (labelled an estimate). A goal shows the trip and the month the savings plan says it is ready, **never amounts**. A visa shows the country, the city and which country it was in the passport, and says it is commemorative.
- **Who sees a post:** its author always; everyone else when it is public (or they follow the author for "Followers only"), it is not deleted, they did not mute the author or report it, and reports did not hide it. Anything else answers "not found".
- **People appear only when they act.** The first post, comment, like or follow gives the person a handle made from their name (with a number when taken; they can change it). Until then nobody sees them. "Who to follow" lists only people with public posts in the last 30 days; "Trending destinations" counts countries tagged on public posts in that time.
- **Following is open**, muting and saving are private. Comments can be removed by their author or by the post's author; deleting a post or a comment can be undone.
- **Reports:** once per person and post; the post disappears for the reporter at once and for everyone but its author after **3** distinct reports, until it is reviewed. Limits: **30 posts and 200 comments a day**.
- **Copying a route** makes a new private trip in USD with the stops and nights, which is the person's own from then on. "+ Save to my trip" puts a tip's or moment's place into the current trip's "No day".
- Never share someone else's live location; there is no live location in Globetrot.

## AI (Pip)

- Output is a structured **change list**, never free prose that edits data.
- Proposals are previewed (pencilled pins, dotted routes) and can be partially applied. Applying them creates an undoable record.
- Pip never invents confirmed bookings, prices, availability or entry/visa rules. Entry rules always link to official sources.
- Usage is metered per user. Limits come from the plan's entitlements; until then, **20 requests a day**.
- **Pip v1** ([ADR-0016](../architecture/adr/0016-pip-on-deepseek.md)): the person asks in their own words; Pip (DeepSeek) answers up to 12 changes of these kinds: add, remove or reorder stops, change nights, add a place to "No day", add a checklist item, add a cost (always `≈ estimate`, in the trip's currency) and set the monthly savings amount. Every change is ticked by default and can be unticked; **Apply** runs the ticked ones together, **Discard** changes nothing, **Undo** (24 hours) puts the trip back as it was before applying.
- **What leaves Globetrot:** only the trip's plan (title, dates, stops, nights, places, checklist labels, cost totals, savings amounts), never the person's name, email, home city or other trips. The Pip screen says so.

## Privacy (applies from day one)

- Trips are private by default, and the API answers "not found" (never "forbidden") for another user's trip.
- The audit log records who changed what and when, with field names only, and cannot be edited. It is kept when an account is deleted: it holds no personal values and its actor id then belongs to nobody ([ADR-0015](../architecture/adr/0015-account-export-and-deletion.md)).
- Future public content must support delayed location publication, and never shows live location.
- EXIF location data is stripped from uploaded media unless the user explicitly keeps it.
- **Export:** Settings → "Your data" downloads everything the account holds as JSON (never passwords or tokens).
- **Account deletion:** after typing their email again, the person's account and everything in it go for good: trips, visas, community profile, posts and comments (also on others' posts), likes, follows, photos (with their stored files), settings and sessions. It cannot be undone.

- **Measurement:** cookieless counts (Plausible) when configured; the Meta Pixel only after the visitor accepts marketing cookies, with Accept and Reject equally easy and the choice changeable; conversion events never carry personal data ([ADR-0018](../architecture/adr/0018-launch-measurement-and-consent.md)).

## Progression (planned, M12+)

- XP comes from an immutable event ledger, with diminishing returns and daily caps.
- Community value (helpful votes from distinct, established accounts) outweighs volume.
- Planning achievements count once per trip and require a minimum of real content.
- Meaningful progression must be available without frequent international travel.
- Rewards are cosmetic only.
