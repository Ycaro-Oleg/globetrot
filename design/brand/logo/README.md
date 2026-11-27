# Globetrot logo

The brand mark: a blue globe with mint continents, an airmail route (coral, blue and white stripes) and an amber stop pin, drawn in an ink-outline, hard-shadow style. Colours follow the app's white palette (ADR-0035): ink `#111111`, white `#FFFFFF`, the map's blue `#2563EB` (darker `#1D4ED8` for the dark icon tile), the coral `#D63F24`, the map pins' amber `#F59E0B`, mint `#9AD8BF` continents and `#121212` for dark backgrounds. The wordmark is Bricolage Grotesque ExtraBold, converted to outlines so it renders the same without the font.

| File | Use |
|---|---|
| `globetrot-logo.svg` / `-dark.svg` | Horizontal lockup on light / dark backgrounds |
| `globetrot-logo-stacked.svg` | Stacked lockup |
| `globetrot-mark.svg` | The mark alone, full detail |
| `globetrot-wordmark.svg` | The name alone |
| `globetrot-icon.svg` / `-dark.svg` | App icon tile; compact mark without the globe's grid lines |
| `preview.png` | Every variant side by side |

In the web app the compact mark lives in `apps/web/app/brand-mark-svg.ts` (plus a white-halo variant for dark backgrounds), rendered by `Logomark` in pages and by `BrandMark` / `BrandLockup` in generated images.
