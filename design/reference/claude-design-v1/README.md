# Handoff: Globetrot — travel planning app + marketing landing

## Overview
Globetrot is a consumer travel planner for first-time and experienced travellers. It turns a vague dream ("Japan, someday") into an actionable plan: a route on a world map, a realistic budget with clear estimate/confirmed/paid states, a savings plan that answers *"when can I afford this?"*, checklists, and an AI companion (Pip) whose suggestions are always reviewable drafts.

Core loop: **Dream → Explore → Connect → Plan → Save → Prepare → Travel.** Progress is shown as a trip **passport** that fills with **stamps** when real milestones are met. Nothing is ever locked.

This bundle covers:
1. **Web app** (desktop · tablet · phone): auth, onboarding, home, map board, itinerary, budget & savings, checklists + passport, destination library, Pip, settings, light + dark.
2. **Marketing landing page** (responsive).

## About the design files
The files in this bundle are **design references built in HTML/CSS/vanilla JS**. They are working prototypes that show the intended look, behaviour, states and data model. They are **not production code to copy directly.**

Your task is to **recreate these designs in the target codebase** using its established patterns. If there is no codebase yet, use the recommended stack below. Use the prototype JS (`atlas/app-core.js`) as an executable spec for business rules: derived dates, totals, savings projection, milestones and Pip change lists.

> The engine folder is named `atlas/` because the same prototype also powers an alternate brand skin ("Atlas & Thread"). **Globetrot is the chosen direction.** The brand is switched by `<html data-brand="globetrot">` + `atlas/globetrot.css` + `atlas/brand.js`. In production, implement Globetrot only. Brand indirection isn't needed.

## Fidelity
**High-fidelity.** Colours, typography, radii, borders, shadows, motion and copy are final. Recreate them faithfully. The exceptions are:
- **Photos** are striped placeholders (`.ph`). Real destination imagery is TBD.
- **Pip (mascot)** is built from simple SVG shapes as a stand-in. A commissioned illustrator will deliver the final character as a **Rive** file with the state machine described below. Keep the poses/states and the API; swap the artwork.
- **Prices and exchange rates** are illustrative. There are no live price or booking integrations.
- **Pip's "AI"** is a keyword-routed stub (`brain()` in `app-core.js`). Replace it with a real LLM call that returns the same **change-list schema**.

## Recommended stack (if starting fresh)
- **Next.js (App Router) + TypeScript**: marketing pages are SSR/SSG for SEO; the app runs under `/app`.
- **Styling:** CSS variables for tokens (below) + CSS Modules or Tailwind configured with these tokens. Do **not** let a UI kit's defaults show through.
- **Radix UI primitives** (Dialog, Tabs, Switch, Checkbox, RadioGroup, Select, Toast, Slider), fully restyled.
- **Motion** (`motion/react`) for transitions. Respect `prefers-reduced-motion` and the in-app Motion setting.
- **Map:** MapLibre GL JS with a custom vector style: sea `#2B45C4`, land `#C9D3F4`, trip countries `#FFF5E1`, 2px ink coast and a sea-shadow offset layer. Render pins, labels and routes as an **HTML/SVG overlay** projected from MapLibre (`map.project`) so they stay crisp, styleable and accessible. The prototype uses d3-geo + Natural Earth (1:110m world, 1:50m regions); that is fine for static mini-maps.
- **State:** Zustand (or Redux Toolkit) with the data model below. Persist locally first, then sync to the backend.
- **Drag & drop:** dnd-kit (route reorder, itinerary days), with keyboard alternatives (always present in the prototype).
- **Pip:** Rive (`@rive-app/react-canvas`) state machine, with an SVG fallback for reduced motion.
- **PWA first** (offline trip pack for the Travel stage); wrap natively later if needed.

---

## Design tokens

### Colour: Light ("Day")
| Token | Hex | Use |
|---|---|---|
| `--paper` | `#FFF5E1` | App/page background (cream) |
| `--paper2` | `#F8E9C9` | Alternate section background |
| `--card` | `#FFFFFF` | Sheets, panels, inputs |
| `--card2` | `#FFF9EE` | Nested surfaces |
| `--ink` / `--line` / `--hard` | `#1D1A35` | Text, all outlines, solid offset shadows |
| `--ink2` | `#58536F` | Secondary text |
| `--ink3` | `#6E6985` | Tertiary text / placeholders |
| `--rule` | `rgba(29,26,53,.14)` | Dashed dividers |
| `--rule2` | `rgba(29,26,53,.32)` | Empty-state dashed outlines |
| `--thread` (Stamp red) | `#E0401F` | Primary action, selected stop, route red stripe, emphasis |
| `--blue` / `--sea` (Airmail) | `#2B45C4` | Map sea, route blue stripe, Pip body |
| `--blue2` / `--sea2` | `#1E3196` | Sidebar/passport, map land shadow |
| `--brass` (Marigold) | `#F5B31C` | Stop pins, Pip button, "paid" badge, accents |
| `--mint` | `#9AD8BF` | "Done" fills (checkbox, journey), Pip continents. Fill only, never text |
| `--sky` / `--land` | `#C9D3F4` | Non-trip land on map |
| `--landhi` | `#FFF5E1` | Trip-country land on map |
| `--moss` | `#1D7A55` | ✓ Confirmed (text) |
| `--ochre` | `#8A5A00` | ≈ Estimate (text) |
| `--note` | `#FFE08A` | Sticky notes |
| `--danger` | `#C0301A` | Destructive, errors |
| `--focus` | `#2B45C4` | Focus ring |

### Colour: Dark ("Red-eye")
Designed separately, not inverted: `--paper #1D1A35`, `--paper2 #16142A`, `--card #2A2650`, `--card2 #322D5E`, `--sea #22359F`, `--sea2 #16226E`, `--land #3B3A7A`, `--landhi #FFF5E1`, `--ink #FFF5E1`, `--ink2 #CFCADF`, `--ink3 #A7A1C2`, `--rule rgba(255,245,225,.14)`, `--rule2 rgba(255,245,225,.3)`, `--thread #FF6A4D`, `--moss #7FD3AE`, `--ochre #F5C451`, `--line/--hard #0C0A1A`, `--danger #FF8A75`, `--focus #F5B31C`. Marigold, mint and note colours are unchanged.

**Rule:** surfaces that are always light (white map labels, legend, coloured library cards, the gold Pip header) must locally re-scope their text tokens to dark ink (see the `.legend` and `.libcard` overrides in `Globetrot - App.html`).

### Contrast notes
White on airmail = 7.6:1. Ink on marigold = 9.8:1. White on stamp red ≈ 3.7:1, so red backgrounds only carry **bold ≥17px** labels or large display type. Mint is never used for text.

### Typography
- **Bricolage Grotesque** (Google Fonts, variable `opsz 12–96`, `wdth 75–100`, `wght 300–800`). It is the only text family.
- **Space Mono** 400/700 for codes, dates, money labels, eyebrows and status marks.
- **No italics anywhere.** Emphasis uses colour (`em` → stamp red).

| Role | Spec |
|---|---|
| Hero display | 800 · `font-stretch: 80%` · clamp(56px, 8.6vw, 128px) · lh .88 · ls −5% |
| H2 section | 800 · 80% · clamp(44px, 6.4vw, 84px) · lh .92 · ls −4% |
| Page title (`.pg-h`) | 800 · 80% · clamp(36px, 5vw, 56px) · lh 1 · ls −3.5% |
| Stop title (`.pn-title`) | 800 · 80% · 56px (40px mobile) |
| "Answer" sentence | 700 · clamp(26px, 3vw, 36px) · lh 1.18 |
| Place / card title (`.serif`) | 700 · 88% · 19–30px · ls −1.5% |
| UI / body | 400–700 · 15–17px · lh 1.45–1.5 |
| Eyebrow | Space Mono 700 · 11.5px · uppercase · ls +4% |
| Status mark | Space Mono 700 · 11px · uppercase |
| Wordmark | `gl◉betrot`: 800, 85% width, −3% ls. The "o" is a blue disc with a 2px ink ring and a marigold dot (≈26% size) |

### Shape, borders, elevation
- **Outlines:** 2–3px solid `--line` on every interactive surface. 3px on sheets/panels/modals, 2.5px on inputs/buttons, 2px on small controls.
- **Radii:** buttons 14 (sm 11, lg 16) · inputs 12 · icon buttons 12 · segmented 14/9 · sheets 22 · postcards 20 · modals 26 · map container/landing cards 26–30 · chips 12 · status badge 7 · pins/stamps circular.
- **Solid offset shadows (no blur):** buttons `0 4px 0 var(--hard)` (hover `0 6px`, active `0 1px` + translateY 3px) · small `0 3px 0` · sheets `0 6px 0` · modals `0 8px 0`.
- **Spacing:** 4-pt base; scale 4 · 8 · 12 · 16 · 20 · 24 · 32 · 48 · 64 · 96. Page max-width 1180px; padding 32px desktop / 16px mobile.
- **Hit targets:** ≥44px everywhere. Map pins have an invisible 44×50px hit area.

---

## Core components (see `atlas/app.css` + `atlas/globetrot.css`)
- **Button** variants: `primary` (ink bg, cream text) · `thread` (red bg, white) · `ghost` (white bg, ink) · `quiet` (no border/shadow) · `danger` (white bg, red text/border/shadow). Sizes `sm` 36 / default 44 / `lg` 54. States: hover lifts 2px; active presses 3px; `loading` replaces the label with a spinner; `disabled` = .38 opacity, no shadow.
- **Input / Select / Textarea:** 48px, white, 2.5px ink border, radius 12; focus ring `0 0 0 4px` blue @30%; `.err` turns the border red with an error message below.
- **Segmented control, Switch** (checked = mint), **Checkbox** (24px, radius 7, checked = mint + ink ✓), **Range** (accent stamp red).
- **Status mark** `≈ estimate` (ochre) · `✓ confirmed` (moss) · `● paid` (ink on marigold) · `? unknown` (ink3, dashed border) · `pencilled · pip` (dashed). Always a **glyph + word**, never colour alone. Tapping a mark in the ledger cycles est → conf → paid → unk.
- **Sheet** (white, 3px ink, r22, 0 6px 0 shadow) · **Postcard** (r20) · **Sticky note** (`#FFE08A`, r14) · **Banner** (info/ok/err) · **Toast** (ink bg, cream text, optional **Undo**, 3.2s / 6s with undo) · **Modal** (Radix Dialog, r26).
- **Stamp:** circular 104–190px, 3px border + inner ring, mono caption "N° n" + 800 uppercase label + date. Rotated −8°…+8°. Passport cycles the colours red → blue (rounded-square) → moss → ink-on-marigold (rounded-square). Empty slot: dashed ring with the milestone name.
- **Map pin (stop):** 30px marigold disc, 3px ink border, `0 3px 0` shadow, with the stop number (800, 14px) centred. **Selected:** 42px, stamp red, white number, plus a 6px cream halo. **Pencilled (Pip draft):** translucent with a 2.5px dashed white border. **Dream:** mint. **Home:** 16px white. **Label:** white tag, 2.5px ink border, r10, 700 14px name plus Space Mono 10px sub ("4 nights · 3–7 Apr"). Labels auto-place in this order: right → left → below → left-below → above → left-above, then drop the sub-line. They avoid other labels, pin heads, the panel and the edges (`resolveLabels()` in `map.js`).
- **Route ("airmail"):** three stacked SVG paths on a gently **arcing** quadratic curve (control point lifted by ≈ 0.2 × segment length): white 8px base, red 4.5px dashes `12 12`, blue 4.5px dashes offset 12. Both march (`stroke-dashoffset`, 1.8s linear, infinite; static when reduced motion). Day-trip/proposed = dotted white 3px. Home → first stop = thin white dashed.
- **Journey line** (header): 7 stations. Done = mint dot; current = 20px marigold dot with a "you are here" label; connectors done = red/blue 8px stripe.

## Pip (AI companion)
- **Character:** cobalt globe (`#2B45C4`) with two mint continents, big white eyes with ink pupils (they look around and blink), a red bucket hat with a cream band, and a marigold suitcase with stickers.
- **Poses = states:** `idle` (bob, look, blink, hat tip) · `research` (unfolded map) · `draft` (fan of postcards) · `deliver` (rides a paper plane) · `celebrate` (raises a stamp, confetti) · `unsure` (map + "?", furrowed brows). Implement as a Rive state machine with these exact input names.
- **Drawer** (desktop: right, 420px; mobile: bottom sheet from 8vh). Gold header with Pip, a live-region status line, the "You asked" quote, a step list (Reading the map → Drafting on postcards → Inking onto your board), and skeletons.
- **Output = a change list**, never prose. Each item has a checkbox (default on), a label, a detail line and an optional status-marked amount. The footer has **Discard** and **Apply n changes**. Applying shows the deliver pose and a "n changes stamped onto your trip" message, then milestones are re-checked.
- **Proposed stops appear on the map as pencilled pins** with dotted routes before approval.
- **Change types** (schema): `keepStop{stop}` · `addStop{city,nights}` · `addPlace{stop,pid,day,existing?}` · `addPlaceNew{city,pid}` · `addExp{exp}` · `reorder{order[]}` · `setMonthly{v}` · `trim{eid,v}`.
- Always state "Prices are typical-range estimates, not live quotes. Visa and entry rules: always check the official site."
- **The app is fully usable without Pip.**

---

## Screens

Routes are hash-based in the prototype (`#/login`, …). Map them to real routes.

### Auth: `/login`, `/signup`, `/recover`
Two columns: left = poster world map (blue) with a white headline card, "Your first **stamp** is closer than you think."; right = 400px form column. On mobile, the art collapses to a 220px banner.
- **Login:** Google button (ghost, lg), "or with email" divider, email, password with a "Forgot it?" link, primary **Log in** (disabled until valid). The error banner reads *"That email and password don't match. Try again, or reset your password."* Link to sign up. A demo link opens the Japan sample board.
- **Signup:** first name, email, password with a 4-segment strength meter (Too short/Weak/Okay/Good/Strong), terms checkbox, **Create my account** (thread). A duplicate-email error offers "Log in".
- **Recover:** email → **Send reset link** → success state (Pip `deliver`), "Check your inbox", a resend button with a 30s cooldown countdown, and back to log in.
- Every submit shows a loading state.

### Onboarding
- **Welcome:** Pip (150px) with a speech bubble ("Olá, {name}! I'm Pip…"), the heading "Where shall we begin?", and two big choice cards: **Start from a dream** (marigold card) and **Start from inspiration** (white). Below them, "Or start with a blank board".
- **Dream form** ("three questions"): Where (select grouped by country) · How long (range 2–21, live output) · Budget BRL (number + live hint) · When (next 12 months + "Not sure yet") → **Sketch my board**.
- **Loading:** Pip research → draft with a 3-step list ("Finding the right cities", "Estimating costs — not live prices", "Pencilling it onto your board").
- After loading, the board opens with the stops as **pencilled drafts** and the Pip drawer open with a `keepStop` change list.
- **Example trips:** a postcard grid of 5 examples (mini route maps) plus a sticky preview panel (title, blurb, stop list, ≈ total) → **Start with this board**.
- Empty board state: a centred sheet with Pip, "Where would you go first?", **Place my first pin** and "Borrow an example trip".

### App shell
- **Desktop ≥1100:** left rail 248px, **airmail blue** (`#1E3196`), cream text, 3px ink right border. It holds the wordmark, the current trip (title, start date, nights), nav (Home, The board, Itinerary, Budget & savings, Checklists, Library; active = cream pill with ink text), the dream shelf, a **mini passport** (9 small stamp circles in a 5-col grid; filled ones coloured and rotated) and the user row (marigold avatar) linking to settings.
- **Top bar** (66px, cream, 3px ink bottom border): page/trip title (800, 26px), the journey line centred, and **Ask Pip** (marigold button with a mini Pip) on the right.
- **Tablet 720–1099:** rail collapses to 76px icons; the journey line shows dots with the current label only.
- **Mobile <720:** no rail. The top bar shows title + settings. A **floating tab bar** (inset 10px, 66px, r22, 2.5px border, solid shadow): Board, Days, Budget, Lists, More, Pip. The active tab is an ink pill.

### Board (map): `/board`
- Full-bleed poster map. **World view** (Natural Earth projection, rotated −20°) shows home, dream pins (mint) and the trip pin; clicking the trip pin dollies into the **region view** (Mercator fitted to the stops, leaving room for the panel). Transition: world layer scales/translates into the region bbox (900ms `cubic-bezier(.6,0,.2,1)`), and the regional layer cross-fades in.
- **Top-left:** breadcrumb `World › Japan`. **Top-right:** search ("Find a place to pin…", dropdown results → add stop) and the tool group **Select (V) · Pin (P) · Thread (T)**.
- **Pin tool:** desktop = click the map (snaps to the nearest known city within 46px, otherwise creates a custom "Pinned place" with an editable name). Mobile = a fixed centre **crosshair** plus a **Pin here** button (pan the map, not the pin). A hint toast with Cancel/Esc explains each tool.
- **Thread tool:** tap stop A, then stop B → B moves to follow A. A toast confirms.
- **Right panel 408px** (360 on tablet; on mobile a bottom sheet with 3 detents: peek 200px / half 58% / full).
  - **Route view:** title and dates, a draft banner if Pip pencilled stops, an ordered stop list (number disc, name, nights · cost, up/down buttons, draggable) with leg lines between stops ("Shinkansen from Odawara · ≈ 2 h 10"), + Add a stop, a mini ledger (trip estimate, saved), and **Next stamps** (smart next steps).
  - **Stop view:** stop "n of N" plus coordinates, the name, a nights stepper (±) with dates, a photo, and segmented tabs **Places · Costs · Notes**.
    - **Places:** checkbox (seen), name, category · duration, a day select, a status mark, remove; then "Nearby, from the library" suggestions (+ add).
    - **Costs:** expense rows with cycling status marks and remove, the pin total vs trip total, and + Add a cost.
    - **Notes:** sticky notes plus a textarea.
    - **Footer:** "Open in itinerary" and **Remove stop** (confirm dialog, then a toast with **Undo**).
- **Legend** (bottom-left, desktop): Route · Pencilled · keyboard hints. **Map error state:** Pip `unsure` + "The map didn't load. Your trip is safe — every view still works without it." + Try again.
- **Keyboard:** P / T / V / W (world toggle) / Esc closes things in order (modal → celebration → Pip → tool → panel).

### Itinerary: `/days`
A page header with the departure date picker and "Fill n empty days" (asks Pip). The main column lists **day cards** (number disc in marigold, weekday + date, city, "arrive" on the first day). Each card holds draggable place chips (drag handle, name, status mark, day select) or a dashed "A free day…" empty state. Travel legs between cities show as red dashed connectors with the transport line. The right column (320px, sticky) holds **Not scheduled yet**, grouped by stop. Drag between days, or use the selects (keyboard path).

### Budget & savings: `/budget`
- Header with a currency segmented control (BRL default, USD, EUR, JPY). Non-BRL shows the banner "illustrative rate — not live".
- **Answer card (left, wider):** one sentence first:
  - *"**Yes** — by April 2027, if you put aside R$ 1.500 a month."*
  - *"**Almost.** At R$ X a month you'll have it by {month} — after you leave on {date}."* plus "Put aside **R$ Y** a month to be ready in time" and **Ask Pip how**.
  - Edge cases: no costs / already saved / monthly = 0.
  - Then a savings progress curve (stripe-filled) with month ticks NOW … {month} · GO, and inputs: Already saved (numeric), Each month (range 0–4000 step 50, live), Departure (links to itinerary).
- **Estimate card (right):** total (800, 40px), a stacked status bar (paid = blue, confirmed = mint, estimate = marigold hatch, unknown = dashed) with a legend, a ledger by category with dotted leaders, and the disclaimer.
- **Show every expense (n)** reveals the full ledger, filterable by Everything / Whole trip / {stop}: label, scope · category · "Pip" source, cycling status mark, inline editable amount, remove (toast with Undo). **Add an expense** opens a modal with what, amount, category, belongs to (trip or stop) and a status radio. Validation: name required ("Give it a name, like 'Ramen tour'."), amount > 0.

### Checklists + passport: `/lists`
- A **passport** card (airmail-blue cover, cream inner page) with "n stamps to go" copy and 9 stamp slots (filled vs empty dashed).
- Four checklist sheets: **Documents · Money · Bookings · Packing**, each with an n/total mark, checkbox rows (strike-through when done), remove, and an add-item input. Defaults come from the trip type (international vs domestic).

### Library: `/library`
Scope segmented control (In {country} / Everywhere). City postcards in a grid; every 1st/3rd/4th of 5 is tinted marigold/mint/sky with forced dark text. Each card has a photo, country, name, blurb, **Add to trip** (or "✓ on your route") and **Dream shelf**. Then "Things to see", filterable by All/Food/Historic/Nature/Culture: rows with city · category · tip, a status mark, and Add / "✓ added".

### Home: `/home`
A greeting with the date. The trip card shows a mini route map, "n nights · n of 9 stamps", the title, dates → city list, the compact journey line, **Open the board** and Itinerary. A side column has a Money card (the answer sentence) and Next stamps. Below, the dream shelf: postcards with "Turn into a trip" and an add tile.

### Settings: `/settings`
Sections: Profile (name; email read-only, with a Google note if applicable) · Password (current/new, min 8) · Preferences (Appearance Day/Night/System, Motion Full/Reduced, Currency, Home airport disabled "coming soon") · Notifications (switches: Savings reminders, Pip's suggestions, Trip countdown) · This trip (rename) · Session (Sign out, Reset, **Delete account** with a confirm modal).

### Milestone celebration (global)
When a milestone flips to true for the first time: a dim backdrop plus a dark card containing a 190px marigold stamp that **slams** in (scale 1.9→1, rotate −14→−8°, 500ms `cubic-bezier(.2,.9,.3,1.15)`), Pip `celebrate`, "{Milestone}.", "n of 9 stamps on this trip." and a **Lovely** button. It auto-dismisses after 3.4s, multiple milestones queue, and Esc closes it.

---

## Landing page (`Globetrot - Landing.html`)
Sticky nav (wordmark; The board, Meet Pip, Budget, Example trips; Day/Night toggle; Log in; **Start a board**; a hamburger under 760px). Sections, in order:
1. **Hero:** "Your first **stamp** is closer than you think." plus a sub-line and CTAs **Plan my dream trip** (thread) / See example trips. Below is an inset, rounded poster world map. **Interaction:** tap a pin, then another, to draw an airmail route between them. A live cartouche counts the routes.
2. **Scroll-driven reveal:** a sticky Japan map on the left fills in as the four steps on the right scroll into view (i Dream → ii Explore → iii Connect → iv Plan & save, which adds a postcard, a note and an ≈ total bar). Step numbers are marigold discs. On mobile the map sticks to the top.
3. **"Five stamps from 'someday' to 'booked'":** a boarding-pass-style stacked card. The first stub is red, the last is marigold; dashed separators; each stub has mini art.
4. **Pip (dark section):** "Meet Pip. Pip has **opinions** about ramen." A big Pip plus 5 pose thumbnails. On the right, the example prompt and an **interactive change list** (toggle items; the total and the CTA update live) with a visa row marked "? verify".
5. **Money:** "Can I actually **afford** this?" with a live card: slider R$500–3,000/mo → answer sentence + progress curve, using the example of R$14,280 total, R$6,400 saved and departure 3 Apr 2027.
6. **Example trips:** 3 tilted postcards (marigold Portugal, red Japan, mint Río de la Plata) with route mini maps.
7. **Cross-platform:** a desktop crop and a phone crop (crosshair + "Pin here" + sheet), not a device wall.
8. **Final CTA** (stamp-red section): "Ready for your **first stamp?**" plus an input "A place you've always wanted to see…" and a marigold **Pin it** button.

Footer in ink with map attribution.

---

## Data model (single source of truth for all views)
```ts
type StatusState = 'est' | 'conf' | 'paid' | 'unk';
interface Trip { id; title; start: ISODate; stops: Stop[]; expenses: Expense[]; savings: { saved: number; monthly: number }; checklist: CheckItem[]; budget?: number }
interface Stop { id; city: PlaceId; nights: number; status: 'planned' | 'draft'; places: PlannedPlace[]; notes: { id; text }[] }
interface PlannedPlace { id; pid: SpotId; day: number | null; done: boolean }
interface Expense { id; label; cat: 'flights'|'stay'|'transit'|'food'|'exp'|'docs'|'buffer'|'other'; stop: StopId | null; amount: number /* BRL */; state: StatusState; src: 'user'|'pip'|'pip-draft' }
interface CheckItem { id; group: 'docs'|'money'|'book'|'pack'; label; done: boolean }
interface City { name; country; iso /* ISO 3166 numeric, matches Natural Earth ids */; ll: [lon, lat]; stay /* BRL/night est */; food /* BRL/day */; region; blurb }
interface Spot { name; city; cat: 'food'|'history'|'nature'|'culture'; cost; state; dur; tip }
User state: { user, theme: 'light'|'dark'|'system', motion: 'full'|'reduced', currency, notif: {save,pip,trip}, trip, dreams: {id, city, label}[], stamps: Record<MilestoneKey, ISODate> }
```
Store money in BRL (or the user's home currency) as integers; convert only for display.

### Derived rules (see `app-core.js`)
- **Days:** consecutive from `trip.start` across `planned` stops in order; each night = one day.
- **Totals:** by category, by status, by stop.
- **Plan:** `left = total − saved`; `months = ceil(left / monthly)`; ready date = the 5th of the month that many months ahead. `need` = left ÷ months remaining before departure, rounded up to 10. `onTime` = ready ≤ departure.
- **Milestones (9):** `dest` (≥1 planned stop) · `route` (≥2) · `budget` (≥1 expense) · `saved` (saved ≥ R$1,000) · `docs` (all docs items done) · `stays` (every planned stop has a `stay` expense) · `itin` (every day has ≥1 place) · `check` (all checklist done) · `ready` (all of the above + left = 0).
- **Journey stage:** the first false of [dest, any places, route, itin, fully saved, docs+stays+check, ready].
- **Next steps:** up to 4, in priority order: first pin, a stop without a bed, n empty days, the first unchecked doc, the monthly savings needed.

## Interactions & motion
| Moment | Spec | Reduced motion |
|---|---|---|
| Pin appears | drop/hop from −30px with overshoot, 700ms `cubic-bezier(.3,1.6,.5,1)` | appear |
| Airmail route | stripes march 1.8s linear ∞; new route fades in 600ms | static |
| World ⇄ region | 900ms `cubic-bezier(.6,0,.2,1)` dolly + cross-fade | cut |
| Panel / sheet | slide 30px + fade, 350–400ms spring | fade |
| Buttons | hover −2px; active +3px, shadow 6→1px, 120ms | same |
| Stamp | slam 500ms; card holds 3.4s | static card |
| Pip | idle hop 2.8s; poses swap per state | static pose |

Respect both `prefers-reduced-motion` and the in-app Motion setting.

## Accessibility
- WCAG AA in both themes.
- Every map action has a non-map path: search, the stop list with up/down, the itinerary selects, the ledger.
- Drag-and-drop always has a keyboard alternative.
- 3px focus rings (blue; marigold in dark).
- Pins are `<button>` elements with an `aria-label` such as "Kyoto, stop 3".
- Pip status uses `aria-live="polite"`; the celebration uses `assertive`.
- Status is never encoded by colour alone.

## Assets
- **Fonts:** Google Fonts: Bricolage Grotesque, Space Mono.
- **Map data:** Natural Earth via `world-atlas@2.0.2` (countries-110m / countries-50m TopoJSON, public domain). Production: MapLibre vector tiles with the custom style above. Attribution: "Map data: Natural Earth" (plus the tile provider's attribution).
- **Icons:** simple 20×20 stroke icons (1.6px) defined inline in `app-views.js` (`IC`). Replace with the team's icon set drawn to the same stroke weight.
- **Imagery:** placeholders only. Destination photography is TBD.
- **Pip:** placeholder SVG (`atlas/pip.js`). The final asset is Rive.

## Files in this bundle
- `Globetrot - App.html`: app shell, responsive layout CSS and Globetrot shell overrides (open it directly in a browser).
- `Globetrot - Landing.html`: marketing page.
- `atlas/app.css`: base tokens, components, motion. `atlas/globetrot.css`: Globetrot tokens and component skin (**authoritative for visuals**).
- `atlas/data.js`: sample places, spots, legs, example trips, trip builders.
- `atlas/app-core.js`: state, routing, derived rules, milestones, Pip change-list logic, map wiring (**authoritative for behaviour**).
- `atlas/app-views.js`: every screen's markup and copy.
- `atlas/map.js`: projection, world⇄region transition, overlays, label collision.
- `atlas/pip.js`: Pip poses. `atlas/brand.js`: brand copy and storage key.
- `reference/Concept C - Globetrot (round 1).html`: the original art-direction board (landing, workspace, mobile mocks).

Tip for Claude Code: open `Globetrot - App.html` → "Open the Japan demo board" to see a fully populated trip. Settings → "Reset the prototype" clears local state.
