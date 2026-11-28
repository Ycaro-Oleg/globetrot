# 0036. Money charts with Recharts, styled like shadcn/ui charts

- Status: Accepted (the owner asked for shadcn-style charts on 2026-11-27)
- Date: 2026-11-27

## Context
The owner wants the trip's money to read as a professional dashboard: the total, what is saved, and a chart of the savings growing towards the trip, later perhaps fed by open finance. The budget had one hand-drawn chart (the month jars) and no time series; the API kept the weekly check-ins (ADR-0026) but only answered the current week.

## Decision
- **Recharts 3.10.1** in `apps/web`, the library under shadcn/ui's charts. We copy shadcn's look (soft gradient areas, light grid, compact tooltip, legend above) into a CSS module on the theme tokens instead of adding shadcn's Tailwind components: the app's screens use CSS modules.
- **A money panel** (`app/app/_components/money/`): headline figures in the display face with tabular digits, the savings chart (real check-ins, then the monthly plan, against the trip total), and on the Budget screen the costs per category and per status. The overview shows the summary; Budget shows all of it.
- **A savings history query** (`getSavingsHistory`, `GET /v1/trips/{id}/savings/history`): everyone's weekly check-ins added up per week, with the running total that ends at today's savings.
- Charts load only where the panel is shown, every chart carries a screen-reader table, statuses keep their glyph and word, and nothing is drawn without costs.

## Alternatives considered
- **shadcn/ui's chart components as they are:** they need Tailwind and Radix in the app's screens, which use CSS modules; the look is easy to reproduce on Recharts directly.
- **Hand-drawn SVG like the month jars:** fine for one fixed chart, costly for axes, tooltips and responsive sizing across several charts.
- **A heavier chart kit (ECharts, Nivo):** more than three chart types need, and a bigger bundle.

## Consequences
- Recharts adds weight to the overview and Budget pages only.
- Open finance can feed the same series later: the history query is the seam.
