# Design system

Status: **direction approved; token v1.1 implemented (M1, #5)**. The visual values (colours, type scale, radii, shadows, motion timings) are specified in the handoff: [`design/reference/claude-design-v1/README.md`](../../design/reference/claude-design-v1/README.md), with `atlas/globetrot.css` authoritative for visuals. This doc defines how they become a production system. The adjustments come from [`design-audit.md`](design-audit.md).

## Tokens

- One source in `packages/tokens`, written as DTCG-format JSON. It generates:
  - CSS custom properties for web, for both themes: Day (`light`) and Red-eye (`dark`).
  - A typed TS object for React Native (post-MVP).
- Three layers: **primitive** (e.g. `color.marigold.500`) → **semantic** (e.g. `color.surface.card`, `color.status.confirmed.text`) → **component** (only when needed).
- Surfaces that are always light (map labels, the legend, tinted library cards) re-scope their text tokens to dark ink in both themes.
- **v1.1 changes:** fix the rail title contrast, add the trip-currency-neutral copy, and add focus and hit-area tokens. The Day tertiary text is darkened from the reference `#6E6985` to `#69647F` so it meets 4.5:1 on the alternate cream surface.

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

The brand fonts, Bricolage Grotesque (display and body) and Space Mono (labels), are **self-hosted** under `apps/web/public/fonts/` as `woff2` subsets (latin, latin-ext, vietnamese) with their OFL licences next to them, and declared with `@font-face` and `font-display: swap` in `apps/web/app/globals.css`. Nothing is loaded from a font CDN (LGPD/GDPR and performance). The token `primitive.font` still names the stack with system fallbacks, so text stays readable while a font loads.

## Surfaces that are light in both themes

Some surfaces are cream or white in the red-eye theme too (the account pages' paper, the board and landing cards, the trip cards, form fields). Inside them the themed text, error and focus tokens would turn light on light, so each such surface must override them with the `always-light` tokens (`--gt-semantic-color-always-light-text`, `-secondary`, `-tertiary`, and the day-theme danger and focus colours) or the `data-always-light` attribute. The axe check in both themes (`pnpm --filter @globetrot/web test:a11y`) fails on any miss.

## Responsive interaction models

| Size | Layout | Map interaction |
|---|---|---|
| Desktop ≥ 1100 | Left rail 248px, full-bleed map, right panel 408px | Click to pin. Tools V/P/T, W (world), Esc |
| Tablet 720–1099 | Icon rail 76px, panel 360px | Same as desktop, touch-friendly |
| Phone < 720 | No rail. Top bar, floating 5-tab bar, Pip FAB | Fixed crosshair + "Pin here". Bottom sheet with peek/half/full detents |

Phones get equivalent essential capabilities through patterns that suit the device, not shrunken desktop components.

### The shell as built (#59)

`apps/web/app/app/_components/` holds the frame of every signed-in page. One markup, three layouts switched by CSS at 720px and 1100px; the parts a layout does not show are `display: none`, so they are also out of the accessibility tree.

| Part | Desktop ≥ 1100 | Tablet 720–1099 | Phone < 720 |
|---|---|---|---|
| Navigation | 248px rail with labels: Home, Trips, Board, Days, Budget, Lists, Passport | 76px rail, icons only (labels stay in the link's accessible name) | Floating bar of five tabs: Board, Days, Budget, Lists, More |
| Rest of the app | In the rail | In the rail | **More** page: Home, Trips, Passport, Settings (and Pip when the flag is on) |
| Account | Name and avatar in the rail footer, opens upward | Avatar only | Avatar in the top bar, opens downward |
| Pip | "Ask Pip" button in the wide header | Same | Floating round button above the tab bar |

- **The trip switcher** (current trip's name, a list of trips and a link to manage them) sits at the top of the rail and in the phone top bar; the wide header shows the current trip's name and, with the flag on, the Pip button. The chosen trip is kept in an HTTP-only cookie.
- **Pip is behind `FEATURE_PIP`** ([configuration](../engineering/configuration.md#web-appsweb)), off by default. With it off there is no entry point and `/app/pip` answers 404 (decided in `proxy.ts`, because inside the app the loading boundary has already sent a 200 by the time a page could call `notFound()`). With it on, the entry points lead to a page that says Pip is not built yet.
- **Placeholders are honest.** A section that is not built yet says so plainly (no fake data, no disabled controls) and links to Home. Today every section of the navigation is built; the placeholder remains for future sections. `app/app/loading.tsx` and `error.tsx` give every page a loading and an error state inside the shell.
- **The current page** is a filled cream pill with dark text and `aria-current="page"`, so it is not marked by colour alone. On the More tab, the pages it holds (Trips, Passport, Pip) mark More as current.
- **Keyboard.** The skip link is the first Tab stop and moves focus to `<main id="main">`. Every control draws a 3px focus ring (`--gt-component-focus-width`); on the blue rail and tab bar the ring is marigold in both themes, because the day theme's blue ring would vanish against the rail.
- **The account menu** is a disclosure (a button with `aria-expanded`), not an ARIA menu: it holds a link to Settings and a Log out button, closes on Escape (focus returns to the button), on an outside click and when a link in it is followed. The avatar letter is drawn by CSS so the button's visible text is only the name its label contains (WCAG label-in-name).
- **Phone details.** Tabs are at least 44px, the tab bar respects the bottom safe area, the content has room under it, and labels such as "Orçamento" fit one line down to 320px wide.
- **Provisional.** The layout follows the prototype and stays provisional until the owner reviews the missing-screen studies (#7). Icons are [Lucide](https://lucide.dev) (`lucide-react`, ISC license) at stroke 1.6.

## Accessibility

- WCAG 2.2 AA in both themes. Hit targets ≥ 44px. 3px focus rings (blue in light, marigold in dark).
- Pins are `<button>` elements with labels such as "Kyoto, stop 3".
- Pip status uses `aria-live="polite"`. Celebrations use `assertive`.
- Status is never colour-only. Mint is never used for text. White on stamp red only for bold text ≥ 17px.
- Test pt-BR text expansion in every component story.
