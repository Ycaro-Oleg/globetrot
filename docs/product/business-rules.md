# Business rules

This is the authoritative list. The prototype's executable spec is `design/reference/claude-design-v1/atlas/app-core.js`. Where this doc differs from the prototype, **this doc wins**. The differences are deliberate and are listed in [`../design/design-audit.md`](../design/design-audit.md).

## Locale and currency

- The user's **language**, **home country**, **nationality**, **current location** and **preferred currency** are independent settings. None is inferred from another. Detected values are only suggestions the user confirms. A visitor whose browser prefers another supported language is offered it once, in that language; a link may also name its language (`?lang=pt-BR`), which counts as the visitor's choice. The language switch on the public pages changes the language of someone signed in too: it saves their stored language, which otherwise wins over the browser's choice.
- The default preferred currency is **USD**.
- Each trip has a **trip currency** (budgeting currency). It defaults to the user's preferred currency and can be changed. **In the onboarding** it is suggested from the destination: the currency of the destination's country (Paris → EUR), shown with a selector to pick another. This reads the destination, never the person's own language, country or nationality.
- Each expense keeps its **original currency and amount**. Totals are computed in the trip currency using a recorded exchange rate. See [`../architecture/money.md`](../architecture/money.md).
- No silent conversion: wherever a converted amount appears, its rate, source and date are available.
- The payment currency (what Stripe charges for a subscription) is unrelated to trip currencies.
- **Home city** is an optional setting: the city the person usually leaves from. In the onboarding it is picked from the city list (with its point), so the map shows it as the trip's starting point (a house and a dashed leg to the first stop; a one-stop trip is framed with both). Typed in settings it is a name only, and its point is cleared. Nothing else is derived from it.

## Onboarding (the first trip)

- **From the landing page:** the “Can I go?” calculator works for anyone, with the same savings rule as the app; “Save this plan” keeps the three numbers (cost, saved, monthly, plain amounts only) and the currency picked there (one of the main currencies, USD first) in the `globetrot.plan_draft` cookie for 30 days so the money step starts with them after sign-up. Finishing onboarding clears it.

- Seven steps (welcome, home city, destination, dates, money, Pip, the answer). Home city and destination are picked from a list of every city of 15 000 people or more (GeoNames), as on airline sites. The dates are a calendar: the day the person leaves and the day they come back give the nights. Before the Pip question, Pip introduces itself and shows one example suggestion for the destination (approve or dismiss, on that screen only). Every step can be changed later, and nothing is charged.
- **The cost is the person's own rough guess**, never ours: it is stored as one cost with status `estimate` ("Whole-trip estimate"), marked as the trip's guess, in the trip's currency (the preferred currency). Globetrot does not show invented typical ranges.
  - **The guess stands for the rest of the trip.** Real costs added later come out of it instead of adding on top: the budget counts the guess minus every other cost, never below zero. So a 2,500 guess with 800 of flights still totals 2,500, and once real costs pass the guess the total follows them.
  - The guess row says how much of it still counts, and that it can be removed once the real costs cover it. A trip keeps at most one guess.
- The answer uses the savings plan rule (below) on that guess, the amount saved, the monthly amount and the day the trip starts.
- "Open my map" creates the trip through the same API as everything else: the trip (titled with the destination, starting on the chosen day, in the chosen currency), its first stop with the nights between the two dates when the place was found, the estimate cost and the savings; then the board opens. The place step also offers eight popular destinations as one-tap choices (built in, so they always give a real stop), and the city list is built in, so it never depends on a provider (the map's place search falls back to it too when the provider is not configured or not answering). Only a name that matches neither can be continued as typed, and that trip starts without a stop. The new trip's checklist starts with the suggested items in the person's language (documents, money, bookings, packing), which they can tick or remove.
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
- **Terms and privacy:** creating the account is the acceptance, stated next to the submit button with links to both (no checkbox to tick). Acceptance is not stored yet, and the legal text is a draft the owner has to write.
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
- **A stop's spots (the pin card's "Spots", the map's mini-pins):** up to 30 per stop, each with a name (1 to 120 characters), a **kind** (stay, food, sight, shop, transport or other; `sight` when none is given, and for spots saved before kinds existed), an optional place on the map and a done mark. A spot with a place shows on the map as a mini-pin with the mark of its kind, from city zoom on; one without a place is listed and says so. A place comes only from a real point of interest on the map near the stop or from the person marking it on the map: nothing is invented. **The spot route:** once a stop has two spots with a place, the person may draw its route: the placed spots get letters A, B, C… in their list order and are joined by straight lines, each leg and the total shown **as the crow flies (an estimate)**, never as directions. ↑/↓ reorder; "Shortest order" suggests one (start where the person sleeps, then always the nearest spot), which Undo takes back.
- **Days:** consecutive local dates from `trip.start` across planned stops in order, one day per night. Without a start date, days are still numbered but have no dates.
- **The trip's days:** one day per night, in route order from the start date, then the **departure day** (the day after the last night), spent at the last stop slept in. Day trips (0 nights) add no day of their own; a route of day trips only is one day. The departure day can hold places (the card says "you leave today, so plan the morning"), but it is not needed for "Every day has a plan".
- **Places on days (the day plan):** a trip keeps up to 200 places to see, each with a name (1 to 120 characters), an estimated time (15 minutes to 12 hours), an optional stop and a day or "No day". A new place goes to "No day". Places move to a day (at its end or before another place of that day) by drag and drop or the "Move to" select, and every move can be undone. A day's load is the sum of its places' times: **more than 9 hours is a "full day"**, under 3 is "light". A place on a day spent at another stop shows a warning ("Outside the stop"), never a block. When the route changes, nothing is lost: a day the route no longer reaches reads as "No day", and a place whose stop was removed reads with no stop. "Every day has a plan" (readiness) is earned when each day has at least one place.
- **Calendar file:** once the trip has a start date, "Add to calendar" downloads an iCalendar (`.ics`) file made in the browser: one all-day event per day ("Day 1 · Lisbon — Portugal") with that day's places and times. Event ids are stable, so importing again updates the same days. Nothing is sent anywhere.
- **Ideas to fill the days:** the Days screen suggests up to 6 places worth a visit near each of the first 6 stops, with a kind of visit and a typical time (45 minutes for a viewpoint up to 3 hours for a beach), leaving out places already on the plan. They come from the places provider (Geoapify, with its credit) when it is configured, otherwise from Globetrot's own short list for the 12 most chosen cities (labelled as such, with "check opening times"). One tap puts an idea in "No day" with its typical time; nothing else is assumed (no prices, hours or bookings).
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

Stamps are recorded once, with the date they were first earned, and are **never taken back** if a condition later becomes false. Newly earned stamps, in display order, drive the celebration queue. A stamp is celebrated **only the first time** the trip earns it: unticking and ticking an item again shows no second celebration.

Financial readiness never implies travel readiness. Documents, reservations and entry rules are separate items.

Implementation: `packages/domain/src/trip/` (`tripDays`, `emptyDays`, `tripTotals`, `savingsPlan`, `milestones`, `recordStamps`, `journeyStage`, `nextSteps`). It is tested against the prototype's Japan demo board in `__fixtures__/japan-demo.ts`.

## Passport

- The passport belongs to the **account**. It is decorative and fictional, and must never look like or claim to be an official document.
- Each trip gets a **visa page**. Readiness stamps land there.
- **Place stamps** (country, city) are added when a trip is completed or when a user declares a past visit. They are labelled `self-declared` unless a real verification mechanism exists.
- **Globetrot visas** (design handoff v2): marking a stop **visited** on the board is a self-declared visit. The first visited stop in a country stamps that country's commemorative visa, one per person and country, with the stop's name and the date. A visa is a souvenir: it is **never taken back**, even if the stop is un-visited, the stop is removed or the trip is archived. Wherever visas are shown, the UI says they are commemorative and not official documents.

## Profile and My Pip

- **The profile** (`/app/profile`) is the person's own page: their name, home city, Pip, a few numbers (countries and continents with a visa, trips) and their visas grouped by year, newest first, with a continent filter. Continents follow the UN M49 grouping (`continentOf` in `@globetrot/domain`): Africa, the Americas split into North and South (Central America and the Caribbean count as North), Asia, Europe, Oceania; Antarctica has its own entry. Following, sharing and visa privacy arrive with the community.
- **My Pip.** Pip is drawn as the globe itself (dotted continents and a grid on its body). Each person may name their Pip (1 to 16 characters; empty brings back "Pip"); nothing changes until **Save**. **The wardrobe (hat, outfit, bag, bag colour) is switched off for now** (November 2026, the owner's call: it did not sit right on the body in every pose): it is not offered and not drawn, but a stored look is kept for when it returns. Cosmetic only: nothing is paid or locked.

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
- **Copying a route** makes a new private trip in USD with the stops and nights, which is the person's own from then on. **One copy per person:** once they have it (not archived), the post offers "Open on my map" instead, and copying again hands back the same trip. "+ Save to my trip" puts a tip's or moment's place into the current trip's "No day".
- Never share someone else's live location; there is no live location in Globetrot.

## AI (Pip)

- Output is a structured **change list**, never free prose that edits data.
- Proposals are previewed (pencilled pins, dotted routes) and can be partially applied. Applying them creates an undoable record.
- Pip never invents confirmed bookings, prices, availability or entry/visa rules. Entry rules always link to official sources.
- Usage is metered per user: one credit per answered request, from the plan's monthly credits first, then bought ones, and at most **40 requests a day** on any plan (see [Plans, trial and Pip credits](#plans-trial-and-pip-credits)).
- **Pip v1** ([ADR-0016](../architecture/adr/0016-pip-on-deepseek.md)): the person asks in their own words; Pip (DeepSeek) answers up to 12 changes of these kinds: add, remove or reorder stops, change nights, add a place to "No day", add a checklist item, add a cost (always `≈ estimate`, in the trip's currency) and set the monthly savings amount. Every change is ticked by default and can be unticked; **Apply** runs the ticked ones together, **Discard** changes nothing, **Undo** (24 hours) puts the trip back as it was before applying. While a proposal waits, its new stops are pencilled on the map (dashed, not real stops) and the route panel says so; “Ask Pip” on each trip tool only writes an idea into the box, nothing is sent until the person asks.
- **Pip fills a pin** (the pin card's "Pip, suggest places in …"): the card sends the real places the person's map shows near that stop (at most 40; any farther than 40 km from the stop is ignored) and Pip may only pick among them, by reference: the server fills in each spot's name, place and kind (read from the map's own category), so a spot Pip suggests always exists on the map and nothing is invented. That request answers spots for that stop and nothing else. They are offered in the card and drawn dashed on the map; each is ticked by default, **Add** keeps the ticked ones as the stop's spots, **Discard** changes nothing, **Undo** takes them back. It costs one credit like any request, and the card says so.
- **What leaves Globetrot:** only the trip's plan (title, dates, stops, nights, places, checklist labels, cost totals, savings amounts) and, when a pin is being filled, the names and categories of the map places offered, never the person's name, email, home city or other trips. The Pip screen says so.

## Sharing a trip

- The owner can turn on **one public link per trip** (from the trip's page). The address is 128 random bits; anyone who has it can open the page, and search engines are told not to list it.
- The page shows the trip's title, the route (stops in order, their countries and nights, drawn as a sketch), the **month** of departure (never the day, so nobody learns when a house is empty), and the savings answer as a percentage and a ready month.
- **Amounts** (cost, saved, monthly) show only if the owner ticks "Show the amounts". The person's name, email, notes, places, photos and checklist never show.
- **Stopping** deletes the link: the old address answers "not found" for good, and a new link gets a new address. Stopping works even when the account is read-only; turning sharing on needs the trial or a plan.
- When a change earns a stamp, the celebration offers **Share my trip**: it turns the link on if needed and opens the phone's share sheet (or copies the link).
- **Language:** the social card and link preview speak the owner's language, like the title they wrote. A link shared from a non-default language names it (`?lang=pt-BR`), so friends open the page in that language; the page otherwise follows the visitor's own choice.
- An archived trip's link answers "not found" too. The page invites visitors to plan their own trip (the free week).

## Plans, trial and Pip credits

Decided in [ADR-0019](../architecture/adr/0019-plans-trial-and-pip-credits.md). Prices are in USD and come from `PLAN_TERMS` in the domain.

| | Free trial | Explorer | Voyager |
|---|---|---|---|
| Price | 7 days from sign-up, no card | US$4.99 a month or US$39.99 a year | US$9.99 a month or US$79.99 a year |
| Pip credits | 15 for the week | 100 a month | 400 a month |
| Active trips | 10 | 10 | Unlimited |

- **One credit is one answered Pip request.** Monthly credits reset each month from the plan's start (yearly plans too) and do not roll over.
- **Top-up:** 200 credits for US$2.99. They never expire and are spent after the monthly ones.
- **Daily cap:** 40 Pip requests a day on any plan.
- **Active trips** are trips that are not archived. Archiving frees a place; restoring a trip takes one.
- **After the trial without a plan the account is read-only.**
  - Everything can be seen and exported, and trips or the whole account deleted.
  - Settings, the community handle, deleting own posts and comments, reporting and muting stay open.
  - Creating or changing anything else is refused, with the way to the plans. In the web app a refused change opens the plan page, which says the change was not saved and why, with the plans right below; "Create trip" leads there directly instead of opening a form that could not be saved.
  - Data is never deleted for lack of a plan.
- **Canceling** keeps the plan until the end of the paid period.
- **A failed renewal** keeps it 3 more days, then the account is read-only.
- The app shows the days left in the trial on every signed-in page, and the plan, credits and active trips on **Plan & credits** (`/app/plan`).
- **Emails about the trial:** two days before it ends ("ends in 2 days"), and once after it ended ("your trips are safe"), in the person's language, only to a verified address without a paid plan. Each is sent at most once.
- Payment is by Stripe's hosted checkout. Until it is switched on, choosing a plan says so and charges nothing.

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
