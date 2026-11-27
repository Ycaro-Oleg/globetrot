# Globetrot logo

The brand mark: a cobalt globe with mint continents, an airmail route (red, blue and cream stripes) and a marigold stop pin, drawn in the prototype's ink-outline, hard-shadow style. Colours come from the design handoff tokens (`--sea`, `--sea2`, `--mint`, `--thread`, `--brass`, `--ink`, `--paper`). The wordmark is Bricolage Grotesque ExtraBold, converted to outlines so it renders the same without the font.

| File | Use |
|---|---|
| `globetrot-logo.svg` / `-dark.svg` | Horizontal lockup on light / dark backgrounds |
| `globetrot-logo-stacked.svg` | Stacked lockup |
| `globetrot-mark.svg` | The mark alone, full detail |
| `globetrot-wordmark.svg` | The name alone |
| `globetrot-icon.svg` / `-dark.svg` | App icon tile; compact mark without the globe's grid lines |
| `preview.png` | Every variant side by side |

In the web app the compact mark lives in `apps/web/app/brand-mark-svg.ts` (plus a cream-halo variant for dark backgrounds), rendered by `Logomark` in pages and by `BrandMark` / `BrandLockup` in generated images.
