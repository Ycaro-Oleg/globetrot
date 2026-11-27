# 0023. A free plan for one trip, the trip pass and prices in reais

- Status: Accepted (the owner chose the "new model" on 2026-11-26); supersedes parts of [ADR-0019](0019-plans-trial-and-pip-credits.md)
- Date: 2026-11-27

## Context
ADR-0019 made the account read-only after a 7-day trial. The gap review found three problems with it: planning a trip takes months, so most people meet the wall before they have a reason to pay; a person planning a single trip does not want a subscription; and US dollar prices read as expensive to the Brazilian audience the launch targets (R$ 25 a month for Explorer at the reference rate). The owner chose a new model.

## Decision
- **Free for good after the free week:** one active trip with every tool (map, days, money, checklist), 5 Pip credits a month, and one person to plan with. The first 7 days keep everything open (15 credits, 10 active trips).
- **No read-only wall.** When an account holds more counted trips than its plan keeps (after the free week, or when a plan lapses), changes wait until trips are archived, a pass is added or a plan is chosen. Reading, export, archive, delete, settings and paying stay open; nothing is ever deleted. The same `PLAN_REQUIRED` answer is used.
- **The trip pass:** one payment (US$9.99 or R$39) that opens everything paid on one trip: it does not count towards the active-trip limit, takes any number of people, and (later) works offline. It lasts until 30 days after the trip's last day, or 12 months from the purchase without dates, and never less than 30 days. It is a `trip_pass` row granted from the payment webhook, unique per payment.
- **Prices in reais:** Explorer R$14,90 a month or R$119 a year; Voyager R$29,90 or R$239; top-up R$14,90. The price currency is BRL when the person's chosen currency is BRL and USD otherwise, never inferred from language, country or nationality. The landing shows USD until the visitor picks BRL. Stripe has a Price per currency; an unset BRL Price falls back to the USD one.
- **Pix** for one-time payments (passes, top-ups) comes from the Stripe dashboard's payment methods; `checkout.session.async_payment_succeeded` already grants a payment that clears later.
- Credits per request, top-ups, the daily cap of 40 and the payment grace stay as in ADR-0019.

## Alternatives considered
- **Keep read-only after the trial:** simplest, but it cuts people off months before their trip, when the product is most useful and the decision to pay has not formed.
- **A longer trial (30 days):** moves the wall without removing it.
- **Purchasing-power prices by country:** would need inferring a country, which the product never does.

## Consequences
- More people stay active for free; revenue depends on the second trip, groups and offline (the pass) rather than on a wall.
- The trial emails change meaning: "one trip stays free" instead of "read-only".
- Offline and group limits must read `tripEntitlements` when they are built (PR 4 and PR 6 of the gap plan).
- The owner creates the new Stripe Prices (trip pass, the BRL set) and switches Pix on before charging.
