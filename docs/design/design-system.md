# Design system

Status: **design handoff v2 implemented in the tokens and the shell** (slate, blue and coral, 60·30·10; Plus Jakarta Sans; the TopBar). The v2 handoff supersedes `design/reference/claude-design-v1` and the v1.1 tokens; its values (colours, type, radii, spacing, shadows, copy and behaviour) are final unless the handoff lists them as open decisions. The handoff lives outside the repository (the owner's `design_handoff_globetrot_v2` folder: `README.md` plus one `.dc.html` per screen); this doc defines how it becomes a production system.

## Tokens

- One source in `packages/tokens`, written as DTCG-format JSON. It generates:
  - CSS custom properties for web, for both themes: Day (`light`) and Red-eye (`dark`).
  - A typed TS object for React Native (post-MVP).
- Three layers: **primitive** (e.g. `primitive.color.primary`) → **semantic** (e.g. `semantic.color.surface-card`, `semantic.color.cta`) → **component** (only when needed).
- **v2 roles** (semantic, both themes): `surface-page` `#EEF1F4`, `surface-card` `#F8F9FA`, `input-surface` `#FFFFFF`, `hairline` `#DDE2E8`, `input-border` `#CBD2DA`, text `#1E293B` / `#475569` / tertiary; `primary` `#2563EB` (active tabs, selected state, links, secondary buttons) with `primary-tint`, `primary-soft` and `on-primary`; **`cta`** coral `#F97316` with `on-cta` `#0F172A`, for **exactly one** primary action per view; `savings` green, `expense` red, `warning` amber with their tints; `deep` slate `#0F172A` for dark surfaces. The v1 role names (`marigold`, `thread`, `airmail`, `rail-*`, `confirmed`, `danger`…) remain as aliases onto the v2 palette so older screens keep working.
- **Shape:** borders are 1px hairlines (`primitive.border.1`); flat cards have no shadow; overlays and menus use `shadow.modal` (`0 20px 50px -12px rgba(15,23,42,.35)`); the coral CTA may use `shadow.cta`. Radii: pills `radius.pill` (buttons, segmented controls, chips, `component.button-radius`), cards `component.card-radius` (24), inputs 12.
- **Contrast adjustments:** the handoff's tertiary `#64748B` is 4.2:1 on the page background, so the token is `#5F6C80` (4.7:1). Small green and red text use the strong shades (`#047857`, `#B91C1C`), which meet 4.5:1; the lighter handoff shades are for fills and large marks. The **red-eye** theme is a slate night derived from the handoff's deep surfaces (the handoff itself only specifies the light theme).

### Handoff token inventory

| Handoff area | Source groups / notes |
|---|---|
| Day and Red-eye colors | `primitive.color` and `semantic.color`, including paper, cards, ink, rules, ripple, route, blue, land, marigold, mint, status, note, danger, focus and pin aliases |
| Typography | `primitive.font` and `primitive.type`: body/mono families, documented roles, scale endpoints, fluid sizing, weights, line heights, tracking and widths |
| Shape and elevation | `primitive.radius`, `primitive.border`, `primitive.shadow`, plus component radius aliases |
| Spacing, hit areas and layout | `primitive.space`, `primitive.size`, including 44 px controls and the 44 × 50 px map-pin area |
| Motion | `primitive.duration` carries the handoff timings; component implementations must still apply easing and reduced-motion behavior |

The inventory covers the handoff's token-level values, not every one-off prototype illustration dimension. Add a contrast pair whenever a new component uses a text/surface combination not already declared.

### Using and extending tokens

- DTCG-style source files live in `packages/tokens/source`: primitive values, and semantic/component references for each theme. The build emits combined `dist/day.tokens.json` and `dist/red-eye.tokens.json` in DTCG 2025.10 format so aliases resolve within each theme. Colors, font families, pixel dimensions and shadows use structured values. Relative tracking and stretch use numeric ratios; fluid sizes are groups containing minimum, viewport percentage and maximum, composed into CSS by the build. The generator supports this project's subset, not every DTCG feature.
- Run `pnpm --filter @globetrot/tokens build` to resolve aliases into `src/generated.ts` and `dist/tokens.css`. Import CSS from `@globetrot/tokens/tokens.css`; use `data-theme="day"` or `data-theme="red-eye"`. CSS names are `--gt-` plus the dot-separated path with hyphens.
- Add a primitive to the source, then add a semantic or component alias in **both** themes as appropriate. Rebuild and commit the generated TypeScript; generated CSS is a build artifact. An unknown or circular alias fails the build.
- Use `data-always-light` on light surfaces nested inside either theme to re-scope primary, secondary and tertiary text. The rail title uses cream on blue rather than red.
- The reference white-on-stamp-red pair is below 4.5:1. Restrict it to text at least 18.67 CSS px and bold (or 24 px regular), and check its 3:1 large-text contrast; ordinary-size controls use the darker accessible red instead.
- `pnpm --filter @globetrot/tokens lint` prints and checks the declared normal-text contrast pairs against 4.5:1 in both themes. New text/surface combinations must be added to `scripts/contrast.mjs`; a passing report only covers those declared pairs. Mint is a fill, not text.
- The standalone bilingual development demo is `packages/tokens/demo/index.html` (serve the package directory over HTTP after building); it shows both themes, keyboard focus, the rail and an always-light surface.


## Components

- **Primitives:** [React Aria Components](https://react-spectrum.adobe.com/react-aria/), unstyled and accessible, with built-in i18n: locale-aware NumberField with currency, DatePicker, RTL support and accessible drag-and-drop.
- **Styling:** Tailwind CSS v4, with `@theme` reading the token CSS variables. Storybook uses `@globetrot/ui/tailwind.css` with the Tailwind Vite plugin; it loads theme and utilities without Preflight. Consumers build token CSS first and configure Tailwind scanning for their own source. Existing component styles use the same generated variables. No third-party kit visuals may show through.
- **Custom components** that carry the identity: `MapPin`, `AirmailRoute`, `StatusMark`, `Stamp`, `Postcard`, `StickyNote`, `JourneyLine`, `AnswerSentence`, `ChangeList`, `BottomSheet`. Built so far: `StatusMark`; the others arrive with the feature that needs them. The generic primitives built so far are Button, TextField, Checkbox, Switch, SelectField, Range, Banner, Modal, SegmentedControl and Toast (`packages/ui/src/index.ts` is the list).
- **Living documentation:** Storybook with the a11y addon. Every component is shown in both themes and both languages.
  - Initial setup: `pnpm --filter @globetrot/ui storybook`, with theme and locale toolbar controls. Button stories cover variants, sizes and pending state; other components and complete interaction testing are still pending #6. CI runs axe for every story in both themes and locales, with keyboard checks for select, checkbox and switch. The thread button uses the darker danger red in Day so ordinary-size white labels meet 4.5:1; Red-eye uses the light danger red with dark ink. Use the locale toolbar to switch the example label. The a11y panel runs on demand; CI runs its own axe checks to avoid concurrent scans. Neither replaces keyboard and screen-reader checks.
- **Icons:** Lucide, 20×20, stroke 1.6 (not installed yet; the account screens use text and a few characters only).
- **Charts:** hand-rolled SVG (savings curve, status bar). No chart library in the MVP.

### Patterns first used by the account screens (#57)

- **Auth shell.** Two columns from 56rem: poster art (sea blue with land shapes and a white headline card, no text on the map itself, so contrast never depends on what is behind it) and a form column of 26 to 30rem. Below that the art is a 220 px banner. The wordmark sits in the form column.
- **Password strength meter.** Four segments (danger, estimate, marigold, confirmed colors) plus the word, inside the field's description so a screen reader reads it with the field. The word is a polite live region that changes only when the level changes. It never blocks submitting; the only rule is length.
- **Form errors.** Per-field error under the field, a summary banner with `role="alert"`, and focus moved to the first invalid field. Server errors map from stable codes, never from server text.
- **Pending submit.** The button's pending state plus an `aria-live` status line; keep the pending button mounted (hidden) when the screen changes after success, because the React Aria pending announcement points back at it.
- **Countdown button.** A disabled ghost button whose label counts down ("Send again in 12s"), enabled when it reaches zero.

## Motion

- `motion/react` for UI transitions, CSS for the marching route stripes. Pip is drawn today by `open-bot-avatar` (`PipAvatar`, see [the Pip brief](pip-character.md#the-avatar-in-the-app-today)); Rive remains the plan for the commissioned poses.
- Timings and easings follow the handoff's "Interactions & motion" table.
- Every animation has a reduced-motion equivalent, triggered by **both** `prefers-reduced-motion` and the in-app Motion setting.

### Theme and motion: how they are initialised (#60)

- **The choice.** `theme` is `day`, `red-eye` or `system`; `motion` is `full` or `reduced`. A signed-in person's choice is stored with their settings (`user_preference`); the same values are kept in the `globetrot_theme` and `globetrot_motion` cookies on the device, which is all an anonymous visitor has. The stored choice wins over the cookie ([`chooseAppearance`](../../apps/web/lib/appearance.ts)); unknown values fall back to `system` and `full`.
- **No flash.** The root layout renders `<html data-theme data-theme-choice data-motion>` on the server. An explicit theme is therefore already right in the first HTML, with no script. For `system` the server cannot know the OS, so it renders `day` and a tiny script in `<head>` (`THEME_SCRIPT`) switches to `red-eye` before anything is painted and follows the OS if it changes. `<html>` has `suppressHydrationWarning` for that reason.
- **Resolution rules** (pure, in `@globetrot/domain`): `resolveTheme(choice, systemPrefersDark)` and `resolveMotion(choice, systemPrefersReduced)`: an explicit theme beats the OS; the OS asking for reduced motion **always** wins over `full`.
- **Reduced motion in CSS.** One rule in `apps/web/app/globals.css` removes animation and transition durations under both `@media (prefers-reduced-motion: reduce)` and `[data-motion='reduced']`. Because the media query applies whatever the setting says, the OS always wins.
- **The control** is the "Appearance" part of `/settings`: two segmented controls (radio groups, arrow keys), saved with the rest of the form.
- **The landing page has its own day/night switch** and does not follow this setting yet (its night palette was never wired to the global theme); unifying them is part of #74.

## Typography and fonts

The v2 fonts, **Plus Jakarta Sans** (400 to 800, everything) and **JetBrains Mono** (400 to 600, codes, dates, coordinates and small labels), are **self-hosted** under `apps/web/public/fonts/` as `woff2` subsets (latin, latin-ext, vietnamese) with their OFL licences next to them, and declared with `@font-face` and `font-display: swap` in `apps/web/app/globals.css`. Nothing is loaded from a font CDN (LGPD/GDPR and performance). The token `primitive.font` still names the stack with system fallbacks, so text stays readable while a font loads.

## Surfaces that are light in both themes

Some surfaces are cream or white in the red-eye theme too (the account pages' paper, the board and landing cards, the trip cards, form fields). Inside them the themed text, error and focus tokens would turn light on light, so each such surface must override them with the `always-light` tokens (`--gt-semantic-color-always-light-text`, `-secondary`, `-tertiary`, and the day-theme danger and focus colours) or the `data-always-light` attribute. The axe check in both themes (`pnpm --filter @globetrot/web test:a11y`) fails on any miss.

## Responsive interaction models

| Size | Shell | Map interaction |
|---|---|---|
| Desktop ≥ 720 | One sticky TopBar (60px): logo, trip switcher, trip tabs, account places, avatar | Click to pin. Tools V/P, Esc; route panel on the right |
| Phone < 720 | TopBar, trip tabs as a second sticky row, bottom bar (hidden on the map) | Fixed crosshair + "Pin here". Bottom sheet with peek/half/full detents |

Phones get equivalent essential capabilities through patterns that suit the device, not shrunken desktop components.

### The shell as built (design handoff v2, the TopBar)

`apps/web/app/app/_components/` holds the frame of every signed-in page: everything under `/app` and `/settings` renders inside `SignedInFrame`, which reads the person and their trips once and sends a visitor without a session to log in.

| Part | Desktop ≥ 720 | Phone < 720 |
|---|---|---|
| Logo | Coral ring + "globetrot" wordmark (the wordmark is hidden from 720 to 899px) | Same |
| Trip switcher | Pill with the trip's two-letter disc, its name (drawn from 1100px; always in the accessible name) and ⌄; the menu lists the trips with ✓ on the current one, then "Manage trips" | Same, without the name |
| Trip tools | Segmented control in the bar: Map · Days · Budget · Lists; the active one blue with white text | A second sticky row of four equal 44px pills, only on trip pages |
| Account places | Trips · Passport (and "Ask Pip" with the flag on), the current one with a 3px blue underline | Bottom bar (64px): Trip · Trips · Passport · Settings (and Pip with the flag on); hidden on the map so it does not clash with the route sheet |
| Avatar | The person's Pip; opens the account panel: name, Trips, Passport, Settings, Log out | Same |

- **Community and Profile** (the handoff's "Comunidade" and "Perfil e Meu Pip") are not built yet, so they are not in the bar; they join it when they exist. Settings stands in for the profile on the phone's bottom bar.
- **Pip is behind `FEATURE_PIP`** ([configuration](../engineering/configuration.md#web-appsweb)), off by default. With it off there is no entry point and `/app/pip` answers 404 (decided in `proxy.ts`, because inside the app the loading boundary has already sent a 200 by the time a page could call `notFound()`). With it on, the entry points lead to a page that says Pip is not built yet.
- **Placeholders are honest.** A section that is not built yet says so plainly (no fake data, no disabled controls) and links to Home. `app/app/loading.tsx` and `error.tsx` give every page a loading and an error state inside the shell.
- **The current page** carries `aria-current="page"` and a non-colour cue: a filled pill for the trip tools, an underline for the account places, a bar above the label in the bottom bar.
- **Keyboard.** The skip link is the first Tab stop and moves focus to `<main id="main">`. Every control draws a 3px focus ring (`--gt-component-focus-width`) in the primary blue.
- **The account panel and the trip switcher** are disclosures, not ARIA menus: the account panel closes on Escape (focus returns to the button), on an outside click and when a link in it is followed; the trip switcher is a native `<details>` and each trip is a small form, so it works without a script.
- **Phone details.** Every link is at least 44px, the bottom bar respects the safe area, the content has room under it, and labels fit one line down to 320px wide.

## Accessibility

- WCAG 2.2 AA in both themes. Hit targets ≥ 44px. 3px focus rings in the primary blue (light blue in the red-eye theme).
- Pins are `<button>` elements with labels such as "Kyoto, stop 3".
- Pip status uses `aria-live="polite"`. Celebrations use `assertive`.
- Status is never colour-only. Mint is never used for text. White on stamp red only for bold text ≥ 17px.
- Test pt-BR text expansion in every component story.
