# Design system

Status: **direction approved; initial token foundations implemented, v1.1 pending (M1, #5)**. The visual values (colours, type scale, radii, shadows, motion timings) are specified in the handoff: [`design/reference/claude-design-v1/README.md`](../../design/reference/claude-design-v1/README.md), with `atlas/globetrot.css` authoritative for visuals. This doc defines how they become a production system. The adjustments come from [`design-audit.md`](design-audit.md).

## Tokens

- One source in `packages/tokens`, written as DTCG-format JSON. It generates:
  - CSS custom properties for web, for both themes: Day (`light`) and Red-eye (`dark`).
  - A typed TS object for React Native (post-MVP).
- Three layers: **primitive** (e.g. `color.marigold.500`) → **semantic** (e.g. `color.surface.card`, `color.status.confirmed.text`) → **component** (only when needed).
- Surfaces that are always light (map labels, the legend, tinted library cards) re-scope their text tokens to dark ink in both themes.
- **v1.1 changes:** fix the rail title contrast, add the trip-currency-neutral copy, and add focus and hit-area tokens.

### Using and extending tokens

- DTCG-style source files live in `packages/tokens/source`: primitive values, and semantic/component references for each theme. Values use the compact string representation supported by this repository's generator; this is not a general-purpose DTCG parser.
- Run `pnpm --filter @globetrot/tokens build` to resolve aliases into `src/generated.ts` and `dist/tokens.css`. Import CSS from `@globetrot/tokens/tokens.css`; use `data-theme="day"` or `data-theme="red-eye"`. CSS names are `--gt-` plus the dot-separated path with hyphens.
- Add a primitive to the source, then add a semantic or component alias in **both** themes as appropriate. Rebuild and commit the generated TypeScript; generated CSS is a build artifact. An unknown or circular alias fails the build.
- Use `data-always-light` on light surfaces nested inside either theme to re-scope text and secondary text. The rail title uses cream on blue rather than red.
- `pnpm --filter @globetrot/tokens lint` prints and checks the declared normal-text contrast pairs against 4.5:1 in both themes. New text/surface combinations must be added to `scripts/contrast.mjs`; a passing report only covers those declared pairs. Mint is a fill, not text.
- The standalone bilingual development demo is `packages/tokens/demo/index.html` (serve the package directory over HTTP after building); it shows both themes, keyboard focus, the rail and an always-light surface.


## Components

- **Primitives:** [React Aria Components](https://react-spectrum.adobe.com/react-aria/), unstyled and accessible, with built-in i18n: locale-aware NumberField with currency, DatePicker, RTL support and accessible drag-and-drop.
- **Styling:** Tailwind CSS v4, with `@theme` reading the token CSS variables. No third-party kit visuals may show through.
- **Custom components** that carry the identity: `MapPin`, `AirmailRoute`, `StatusMark`, `Stamp`, `Postcard`, `StickyNote`, `JourneyLine`, `AnswerSentence`, `ChangeList`, `BottomSheet`.
- **Living documentation:** Storybook with the a11y addon. Every component is shown in both themes and both languages.
- **Icons:** Lucide, 20×20, stroke 1.6.
- **Charts:** hand-rolled SVG (savings curve, status bar). No chart library in the MVP.

## Motion

- `motion/react` for UI transitions, CSS for the marching route stripes, Rive for Pip.
- Timings and easings follow the handoff's "Interactions & motion" table.
- Every animation has a reduced-motion equivalent, triggered by **both** `prefers-reduced-motion` and the in-app Motion setting.

## Responsive interaction models

| Size | Layout | Map interaction |
|---|---|---|
| Desktop ≥ 1100 | Left rail 248px, full-bleed map, right panel 408px | Click to pin. Tools V/P/T, W (world), Esc |
| Tablet 720–1099 | Icon rail 76px, panel 360px | Same as desktop, touch-friendly |
| Phone < 720 | No rail. Top bar, floating 5-tab bar, Pip FAB | Fixed crosshair + "Pin here". Bottom sheet with peek/half/full detents |

Phones get equivalent essential capabilities through patterns that suit the device, not shrunken desktop components.

## Accessibility

- WCAG 2.2 AA in both themes. Hit targets ≥ 44px. 3px focus rings (blue in light, marigold in dark).
- Pins are `<button>` elements with labels such as "Kyoto, stop 3".
- Pip status uses `aria-live="polite"`. Celebrations use `assertive`.
- Status is never colour-only. Mint is never used for text. White on stamp red only for bold text ≥ 17px.
- Test pt-BR text expansion in every component story.
