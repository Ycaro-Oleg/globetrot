# 0020. Suggested plans and curated cost ranges

- Status: Accepted (owner decision, 2026-11-26)
- Date: 2026-11-26

## Context
The landing's "Can I go?" asked visitors for three numbers and did the arithmetic. It showed nothing of what the app does, and its answer was only as good as a stranger's guess. The owner wants the landing to plan a trip on the spot: stops, experiences worth it (including the ones few people talk about), how to move between stops, a cost estimate the app gives from what it recommends, and how much to save each month. Until now the rule was that the cost is always the person's own guess and Globetrot never shows typical ranges.

## Decision
- **Suggested plans are curated data in the domain** (`packages/domain/src/suggest/`): a few destinations, each with stops (reference nights, minimum nights, a priority), experiences tagged by what people enjoy (adrenaline, food, culture, nature, nightlife) and marked when few people know them, typical daily costs per city (stay, food, local transport) at two comfort levels, and the leg between consecutive stops.
- **Ranges are typical, per person and in whole US dollars**, researched from public listings on one date (`SUGGEST_RESEARCHED_ON`). The sources are in `docs/product/research/suggested-plans.md`. International flights are never included, and the plan says so.
- **`suggestPlan`** is pure. It keeps the stops that fit the days by priority, spreads the nights, picks the liked experiences (the ones few people talk about first), joins the legs around a dropped stop and sums a low–high range with a middle.
- **Experiences are only suggestions**: a name, why it is worth it and a typical cost. No booking, no contact, no availability, no live price.
- **Another currency** uses reference rates recorded with their source and date (ECB, via Frankfurter), as every conversion must. They only change how an estimate reads.
- **The rule changes** only for suggested plans: there, Globetrot shows its curated range as an estimate with the research date. Everywhere else the cost is still the person's own figure, and the person can replace the suggested one at any time.

## Alternatives considered
- **Pip estimates live for any destination.** It would cost money for every landing visitor and break the rule that the AI never invents prices. Rejected.
- **Keep the visitor's own numbers.** It shows nothing of the product. Rejected by the owner.

## Consequences
- The catalog must be kept fresh. Each review updates `SUGGEST_RESEARCHED_ON` and the research note, and the owner reviews new content before it ships.
- Only a few destinations exist at first. More are data, not code.
- "Save this plan" carries the estimate, the monthly amount, the currency and the chosen plan into sign-up through the existing plan-draft cookie. Creating the trip with its stops, places and estimated costs from the plan is the next step.
