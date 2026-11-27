# 0033. Pricing adjustments before launch: a R$49 trip pass with Pip credits, a small credit pack, coupons on one-time payments

- Status: Accepted (the owner approved the pricing review on 2026-11-27); amends [ADR-0023](0023-free-plan-trip-pass-and-prices-in-reais.md)
- Date: 2026-11-27

## Context
A pricing review before the launch in Brazil measured what Pip costs and how the products relate:

- Pip requests on `deepseek-flash` used about 950 input and 240 output tokens on average (at most 1,023 and 394 seen locally); with the 1,800-token output cap and about 3,000 input tokens for "suggest places", one credit costs at most about US$0.003 at peak prices. No plan can lose money on AI.
- At R$39, three trip passes (R$117) cost less than Explorer yearly (R$119), so the yearly plan never paid off for someone planning several trips.
- The only top-up (200 credits for R$14,90) costs as much as a month of Explorer, so a free-plan person who wants a few more Pip requests has nothing to buy.
- Promotion codes worked only on subscriptions, but the launch offers (a launch price and a founder price for the first 100 buyers) are for the trip pass.
- The backup model (ADR-0022) sent `temperature`, which current Claude models refuse with a 400, so the backup failed every time it was needed.

## Decision
- **Trip pass in reais: R$49** (was R$39). The US dollar price stays US$9.99 until a launch outside Brazil.
- **A trip pass adds 50 Pip credits** to the buyer's account, as bought credits that never expire. They are a `grant` row in `credit_ledger` with the reference `trip-pass:<payment id>`, so a webhook delivered twice adds nothing twice.
- **A small credit pack: 50 credits for R$4,90 or US$0.99** (`TOP_UP_SMALL`, checkout item `top-up-small`), with the same rules as the large pack. Its Stripe Price (`STRIPE_PRICE_TOP_UP_SMALL`, `STRIPE_PRICE_TOP_UP_SMALL_BRL`) is optional: without it, that checkout answers "not switched on yet" and nothing else changes.
- **One-time payments take promotion codes** (`allow_promotion_codes`), so the launch and founder coupons work on the pass and the packs. The coupons themselves live in the Stripe dashboard.
- **The backup model sends no sampling settings** and asks for low effort (`output_config.effort`), so thinking stays short inside the same `max_tokens`.
- Explorer, Voyager, the large pack, the free plan and the free week stay as ADR-0023 set them.

## Alternatives considered
- **Keep the pass at R$39 and raise Explorer yearly:** a higher subscription price before any paying user makes the first sale harder; the pass is the product most people buy.
- **Credits that expire with the pass:** fairer on paper, but a second balance with its own end date for 50 requests that cost under R$1 adds code and support for nothing.
- **A 100-credit small pack:** too close to the large one to be an impulse buy.

## Consequences
- The owner creates the new Stripe Prices (the R$49 pass, the small pack in both currencies) and the coupons before charging.
- Referral passes (ADR-0029) still bring no credits; they are a reward, not a purchase.
- The landing, the plan page and the trip's pass card read the new values from the domain; the copy names the credits the pass brings.
