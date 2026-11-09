# Missing MVP screens: interaction specification

**Status: the trip list and switcher study was reviewed and approved by the product owner on 2026-11-08 for issue #62.** Other #7 screens remain draft. This specifies behavior and layout for the missing MVP screens. Initial desktop/mobile frames in both themes and languages are in [the screen studies](../../design/prototypes/missing-screens.html). They are visual-only examples, not a functional application. The other screen studies remain under review. Existing visual language comes from [the design system](design-system.md) and [prototype](../../design/reference/claude-design-v1/README.md). Business rules take precedence over the prototype.

## Shared layout and states

- Desktop at 1440 px: persistent 248 px left rail, content column and optional contextual panel. Phone at 375 px: top bar, scrollable content and five-tab floating navigation with a separate Pip action. At intermediate sizes adapt without horizontal scrolling. Test long labels rather than assuming they fit.
- Use Day and Red-eye tokens; surfaces that remain light re-scope text. 44 px minimum interactive targets, visible focus, logical focus order, semantic form labels, keyboard alternatives and status text plus glyph. Do not depend on color alone.
- Every asynchronous view needs loading, empty, error/retry and populated states. Preserve edits on recoverable errors. A phone bottom sheet has an accessible name, close action, focus management and an equivalent keyboard path; no gesture is the only way to act.
- Copy below is illustrative design copy, not a production catalog. All shipped strings and accessible names need en and pt-BR catalog entries and locale-aware formatting.

## 1. Trip list and switcher

**Desktop frame:** heading “Your trips”, primary “Create trip” action, filters for All / Active / Traveling / Completed / Archived, and a responsive card grid. Each card presents trip name, destination summary, optional dates, explicit status and “Open trip”; an overflow menu provides appropriate status actions. The current trip appears in the rail switcher with its name, not just an icon.

**Phone frame:** the same heading and primary action above a horizontally scrollable or wrapping filter control, then a single column of cards. The switcher opens a full-width sheet with the trip names, statuses, current selection and a create action; the current trip is announced.

**Behavior:** status is explicitly set to active, traveling, completed or archived; stage is derived separately and must not be confused with status. Switching only changes the selected trip. Archiving does not delete the trip; archived trips remain reachable through the filter. Confirm destructive actions only when a corresponding delete operation is designed. An empty account gets a create action; a filter with no matches offers “Clear filters”. Error copy offers retry without implying data was deleted.

**Copy expansion:** “Traveling” → “Em viagem”; “Completed” → “Concluída”; “Archived” → “Arquivada”; “Create trip” → “Criar viagem”. Verify these and longer trip names at both widths.

## 2. Language and region: onboarding and settings

**Desktop frame:** onboarding step in a centered form with a progress indicator, Back and Continue; settings presents the same fields as a labeled section with Save and Cancel. Fields: display language, preferred currency, home country, nationality, time zone and units. Show USD as the default currency. Country and nationality may be left unset; avoid implying either is required to use the app.

**Phone frame:** one-column form with full-width controls, explanatory text under the relevant field and a persistent or naturally reachable primary action that does not obscure content above the keyboard. Settings presents the same values, not a reduced set.

**Behavior:** language, country, nationality, location, currency and time zone are independent. Detected values are suggestions requiring confirmation; changing language never silently changes currency, country or nationality. Show a preview for dates/numbers without using it to change financial values. Existing trip currency and historical original amounts do not silently change when the preferred currency is changed. Explain any choice to apply changes to future trips; changing a trip's own currency needs its own explicit flow and recalculation confirmation.

**Copy expansion:** “Language & region” → “Idioma e região”; “Preferred currency” → “Moeda preferida”; “Home country” → “País de residência”; “Time zone” → “Fuso horário”. Check long names and ISO currency codes without clipping.

## 3. Expense entry and conversion

**Desktop frame:** accessible modal or contextual panel with expense name, category, scope (trip / stop / day / activity), original amount and original currency, status, and a conversion section. The section shows trip currency, converted amount, rate direction, source, timestamp and rate mode. Buttons: Save and Cancel; validation appears next to its field and in an error summary after submission.

**Phone frame:** full-height sheet or page with the same fields in the same logical order. The currency selector is searchable with currency code and localized name; use appropriate input modes but allow the precision of the selected ISO currency.

**Behavior:** amount and original currency remain explicit. When currencies differ, preview the conversion with its rate, source and timestamp; label rates indicative, not a live bank quote. Provide live, locked and manual modes; paid expenses default to locked. Manual mode asks for the rate and shows its direction and provenance as user-entered. Missing or stale rate is visible and prevents presenting an invented converted total; let the user correct or retry. Never silently convert, infer a currency from locale, or add amounts in unlike currencies. Rounding follows the [money contract](../architecture/money.md), not UI float arithmetic.

**Copy expansion:** “Original amount” → “Valor original”; “Exchange rate” → “Taxa de câmbio”; “Locked rate” → “Taxa fixada”; “Indicative rate, not a bank quote” → “Taxa indicativa, não é uma cotação bancária”. Check errors and long currency names at 320–375 px.

## 4. Account passport and trip visa pages

**Desktop frame:** account passport header with a prominent “Decorative — not an official document” notice, place stamps and a list/grid of trip visa pages. Selecting a trip shows its nine readiness stamps with labels and earned dates or clear empty states. A place stamp carries “Self-declared” unless an actual verification mechanism exists.

**Phone frame:** same disclaimer before the stamps, single-column trip list and a full-page visa detail with back navigation. Labels and dates wrap without shrinking below the readable type scale.

**Behavior:** the account owns the passport; each trip has its own visa page. Readiness stamps are earned by the recorded domain rules and are not revoked when conditions change. Place stamps arise from completed trips or user-declared past visits; do not display a verification claim without a real mechanism. Never present the decorative passport as proof of identity or travel authorization. Empty state explains what can appear without promising an official credential.

**Copy expansion:** “Decorative — not an official document” → “Decorativo — não é um documento oficial”; “Self-declared” → “Declarado por você”; “Trip visa page” → “Página da viagem”. The Portuguese disclaimer must remain fully visible.

## 5. Mobile navigation and Pip

**Phone frame:** floating bar with exactly five destinations: Board, Days, Budget, Lists and More. The selected destination has an explicit label and selected state. Pip is a separate floating action, not a sixth tab; it must not cover the bar, content, map controls or system gestures. The More view provides discoverable access to trips, passport and settings.

**Desktop frame:** equivalent destinations are in the rail, with a separate Ask Pip action and an accessible drawer. Mobile Pip opens a labeled bottom sheet with a close button; the flow stays available without Pip.

**Behavior:** navigation preserves the current trip and uses standard links where navigation occurs. Pip output is a previewable, selectively applicable and undoable change list; it never silently edits the trip or claims confirmed prices, bookings or entry rules. No interaction depends on swipe or drag alone.

**Copy expansion:** “Board” → “Mapa”; “Days” → “Dias”; “Budget” → “Orçamento”; “Lists” → “Listas”; “More” → “Mais”; “Ask Pip” → “Perguntar ao Pip”. Check navigation at large text sizes and screen-reader labels.

## Open work before #7 is done

1. Extend the initial frames with long names, validation, empty and error states. The current examples are not a complete interaction prototype.
2. Automated geometry checks covered the initial pt-BR examples in both themes at 375 px and 1100 px without horizontal frame overflow. Review text wrapping, focus order, 44 px targets, contrast and navigation manually; the current static-frame controls are illustrative.
3. The product owner approved the trip list and switcher study on 2026-11-08; this unblocks #62. Review the remaining frames and copy before closing #7.


## As built in #62

The trip list screen implements the approved card grid / single-column layout, explicit status and date/currency, status filters, create form, archive with undo, and a current-trip switcher in the app rail and phone header. It keeps the trip overview intentionally small until M4 builds the map board. The layout remains easy to adjust while the rest of #7 is reviewed.

## Viewing the studies

Build the tokens (`pnpm --filter @globetrot/tokens build`), serve the repository root over HTTP, and open `design/prototypes/missing-screens.html`. The selectors switch screen, language, theme and desktop/phone frame. The controls inside the frames do not save or modify data. Money and rates are illustrative. The study uses system font fallbacks until the production fonts are installed.
