# Design audit: Claude Design v1

Reference: [`design/reference/claude-design-v1/`](../../design/reference/claude-design-v1/). Its `README.md` is the original handoff spec, and `Globetrot - App.html` / `Globetrot - Landing.html` are the working prototypes (open them through a local static server).
Reviewed in Phase 0 at desktop (1440px) and phone (375px) sizes, across the board, itinerary, budget, checklists, home and landing.

**Verdict:** the identity is strong and distinctive, and the UX rules are thoughtful. Keep it as the foundation. The gaps are i18n and currency, scope (one trip only, no identity or social), and some contrast and layout details.

The handoff README stays authoritative for **visual specs** (tokens, components, motion), **except** where this audit says Refine or Replace.

## Preserve

- **Visual identity:** cream / airmail blue / stamp red / marigold, Bricolage Grotesque + Space Mono, 2–3px ink outlines, solid offset shadows (no blur), and the separately designed dark theme ("Red-eye").
- **Airmail route** (three stacked strokes on an arc, marching stripes) and the pin language (numbered, selected, pencilled draft, mint dream, home).
- **Status marks** `≈ estimate / ✓ confirmed / ● paid / ? unknown`, always glyph plus word.
- **The answer sentence** in the budget ("Yes, by April 2027, if you put aside X a month.").
- **Pip pattern:** change-list output with checkboxes, pencilled pins before approval, "Apply n changes", and an app that is fully usable without Pip.
- **Mobile map:** fixed crosshair + "Pin here", and a bottom sheet with 3 detents.
- **Resilience and accessibility:** a map error state that keeps every other view working, a reduced-motion equivalent for every animation, the stamp celebration, and keyboard alternatives for all drag-and-drop.

## Refine

| Area | Problem observed | Change |
|---|---|---|
| Currency | BRL default, amounts stored in BRL, fixed `AT.rates`, "First R$ 1,000 saved" milestone, default home airport GRU | USD default, trip currency, original currency per expense, FX provenance, `saved` milestone at 10%, no default airport. See [`../architecture/money.md`](../architecture/money.md) |
| i18n | All copy hardcoded in English templates | ICU message catalogs. Test pt-BR text expansion (+20–35%) on tool labels, the tab bar and the journey line |
| Home journey line | Labels collide in the compact card ("DREAMEXPLORECONNECT…") | Compact variant shows dots plus the current label only |
| Contrast | Trip title in stamp red on the airmail rail ≈ 2.3:1 (fails AA) | Use cream or marigold on the rail. Audit every token pair in both themes |
| Mobile tab bar | 6 items (Board, Days, Budget, Lists, More, Pip) | 5 tabs. Pip becomes a FAB or contextual action |
| Mobile map labels | Labels overlap pins (Kyoto's label covers Osaka's pin at 375px) | Tune label collision for small viewports, and fall back to number-only pins at low zoom |
| "Passport" meaning | The prototype's passport holds 9 per-trip readiness milestones, while the brief wants an account-level travel identity | **The account owns the passport. Each trip gets a visa page** carrying its readiness stamps. Place stamps are added when a trip happens. See [`../product/business-rules.md`](../product/business-rules.md#passport) |
| Thread tool | Only reorders stops | First-class `PinConnection` (sequence / alternate / custom), separate from route order |
| Status cycling | Tapping a mark cycles est → conf → paid → unk, which is hard to discover and easy to trigger by accident | Desktop: a small menu. Mobile: keep tap-to-cycle, with an undo toast |
| Dates | Ready date fixed to "the 5th of the month", no timezone model | Local dates for the itinerary, and locale-aware savings dates |
| Fonts | Loaded from the Google Fonts CDN | Self-host via `next/font` (performance and privacy). Define fallbacks for non-Latin scripts and use CSS logical properties for future RTL |

## Replace

- **Workspace map:** d3/SVG Natural Earth → **MapLibre GL** with a custom style. Keep d3 for static mini-maps, stamps and landing art. See [ADR-0003](../architecture/adr/0003-map-stack.md).
- **Pip art:** SVG stand-in → **Rive** state machine (`idle`, `research`, `draft`, `deliver`, `celebrate`, `unsure`) with a static SVG fallback.
- **Pip brain:** the keyword-routed `brain()` stub → an LLM with structured output in the **same change-list schema**. See [ADR-0007](../architecture/adr/0007-ai-provider-abstraction.md).
- **Routing and state:** hash routing and localStorage → real routes, an API and server persistence.
- **Imagery:** striped placeholders → a licensed imagery strategy (Wikimedia Commons / Unsplash per licence terms, plus user uploads).

## Add (missing screens and states)

- **Multiple trips:** a trip list, a trip switcher, and the lifecycle (traveling, completed with memories, archived).
- **Language & region settings and onboarding step:** language, currency, formats, home country, nationality, timezone, units.
- **Geographic hierarchy:** country → region → city → district/POI, with a navigable breadcrumb.
- **Expense details:** multi-currency entry (original amount, converted amount, rate, date), plus accommodation, transport, reservations, links and attachments.
- **Identity:** account passport, profile (private/public), achievements, ranks (later).
- **Social (later):** feed, composer, report/block, location privacy controls.
- **Commercial:** a pricing section on the landing (currently missing), plan and billing screens, limit prompts.
- **System states:** offline, syncing/conflict, per-view skeletons, notification centre, Pip proposal history with undo.
- **Legal:** terms, privacy, cookie consent, data export, and a "decorative, not an official document" note on the passport.

## Resolution status

Which audit items have been carried out, so the next agent knows what is already decided and built. "Pending" means not built yet, not rejected.

| Item | Status | Where |
|---|---|---|
| USD default, trip currency, original currency per expense, FX provenance | **Done in the domain** (`Money`, conversion with rate and source); screens pending (M6) | [money](../architecture/money.md) |
| `saved` milestone at 10% instead of a fixed amount | **Done** in `packages/domain` | [business rules](../product/business-rules.md#readiness-milestones-trip-visa-page-stamps) |
| Message catalogs instead of hardcoded copy, pt-BR expansion checked | **Done** for every screen built so far (account, settings, emails); each later feature must follow | [i18n](../architecture/i18n.md) |
| Contrast: rail title, tertiary text, both themes | **Done in the tokens** (declared pairs checked in CI); new pairs must be added to the contrast script | [design-system](design-system.md#tokens) |
| Self-hosted fonts and fallbacks | Pending (with #60). Today the system fallback is used | — |
| Home journey line compact variant | Pending (M3 shell and trip list) | — |
| Five-tab mobile bar, Pip as a separate action | Pending (#59) | — |
| Mobile map label collisions | Pending (M4) | — |
| Passport belongs to the account, visa page per trip | **Decided**, rules written; screens pending (M5, M9) | [business rules](../product/business-rules.md#passport) |
| `PinConnection` as a first-class entity | **Decided**; built in M4 | [domain model](../architecture/domain-model.md) |
| Status cycling menu on desktop | Pending (M6) | — |
| Local dates for the itinerary | **Done in the domain** (`LocalDate`); stored as `date` | [data model](../architecture/data-model.md) |
| MapLibre replaces the d3 workspace map | **Spike done**; build in M4 | [ADR-0003](../architecture/adr/0003-map-stack.md) |
| Rive Pip, LLM change lists, real routes and API | Pending (M7; routes and API done for accounts, preferences and trips) | [ADR-0007](../architecture/adr/0007-ai-provider-abstraction.md) |
| Multiple trips, lifecycle | **API done** (#61); list and switcher pending (#62) | [api contracts](../architecture/api-contracts.md) |
| Language and region settings | **Built** (provisional page); onboarding step pending | [missing screens](missing-screens.md) |
| Auth screens (log in, sign up, recover, reset, verify) | **Built** (#57) | [authentication](../architecture/authentication.md#screens-appsweb) |
| Legal pages | Draft placeholders; the owner writes the text | [current state](../agents/current-state.md) |
| Everything else under "Add" (identity, social, commercial, system states) | Pending, in later milestones | [progress](../product/progress.md) |
