# Stripe (commercial architecture)

Status: **built** ([ADR-0019](../architecture/adr/0019-plans-trial-and-pip-credits.md), [ADR-0023](../architecture/adr/0023-free-plan-trip-pass-and-prices-in-reais.md)): plans, credits, trip passes, prices in USD and BRL, Checkout, the Customer Portal and webhooks. It is off until the `STRIPE_*` settings are set. No live payments until the owner sets live keys.

## Facts and decisions

- Provider: **Stripe**. The account is **registered in Brazil**.
- What that means:
  - Brazilian payment methods are available: cards, Boleto, Pix.
  - Payouts are settled in BRL.
  - **NFS-e (Brazilian service invoices) is not issued by Stripe.** It needs an integrator (e.g. NFE.io or eNotas), triggered by the `invoice.paid` webhook.
  - The tax regime for SaaS sold abroad must be confirmed with an accountant.
- **Pix recurring payments:** Stripe's changelog of 2026-04-22 adds Pix as a subscription payment method, but one line in the Pix docs contradicts it. Verify for our account before relying on it.
- **To verify in M10:** whether a Brazilian Stripe account can charge international customers in USD and other presentment currencies. If it can't, evaluate Stripe Managed Payments (merchant of record) or a separate entity.
- Evaluate Stripe Tax for international tax collection.

## Architecture

- **Stripe Checkout** for subscriptions, plus the **Customer Portal** for upgrades, downgrades, cancellation and payment methods.
- Plans and prices live in `PlanConfig` (data), mapped to Stripe Price IDs. Components never hardcode prices.
- **Webhooks:**
  - Verified signatures.
  - Idempotent processing (a processed-events table).
  - Events handled: `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`.
- **Entitlements** are derived from the subscription state and checked by the application layer: AI quota, trip limits, cosmetic perks.
- **Failed payments:** Stripe Smart Retries, a grace period, then a downgrade to the free entitlements. User data is never deleted.
- Test mode only until the commercial milestone is approved.

## How it is built

- **Prices:** plans, prices and credits are data in the domain (`PLAN_PRICES`, `PLAN_TERMS`, `FREE_TERMS`, `TRIAL_TERMS`, `TOP_UP_PRICES`, `TOP_UP_SMALL`, `TRIP_PASS`), in USD and BRL. The landing and `/app/plan` read them through `apps/web/lib/plan-config.ts`; copy lives in the `plans` catalog. The Stripe Prices must charge the same amounts. The checkout uses the person's price currency (BRL when their chosen currency is BRL, else USD); a BRL Price that is not set falls back to the USD one.
- **The adapter (`apps/api/src/stripe.ts`)** uses Stripe's HTTP API with `fetch`, with no SDK and a pinned `Stripe-Version`. It implements `PaymentsPort`:
  - **Checkout** in `subscription` mode for Explorer and Voyager (monthly or yearly Price) and in `payment` mode for the two top-ups and the trip pass (with `metadata.tripId`; the application checks the trip is the buyer's). The small pack (`top-up-small`) is offered only when its Price is set. One-time payments leave the payment methods to the dashboard, so Pix shows for reais once it is switched on there.
  - It sends `client_reference_id` and `metadata.userId`, and reuses the customer once there is one. Otherwise it sends the account's email, which Stripe needs for receipts.
  - Promotion codes are allowed on every checkout, one-time payments included ([ADR-0033](../architecture/adr/0033-pricing-adjustments-before-launch.md)).
  - Success returns to `/app/plan?paid=…` (a pass returns to the trip's page), which thanks the person while the webhook arrives.
  - **Customer Portal** to change the card, switch or cancel.
  - **Canceling when the account is deleted** (#201): before `DELETE /v1/me` removes anything, a subscription that still renews (`active` or `past_due` in our table) is canceled at once with `DELETE /v1/subscriptions/{id}`, Stripe's defaults: no proration and **no refund of the unused period** (refunds wait for the owner's decision). If Stripe does not confirm, nothing is deleted and the person sees "we could not cancel your plan, try again" (`503`). A subscription Stripe already shows as canceled counts as done, so a retry works. One-time payments (passes, credits) do not renew and are untouched. The Stripe customer and its payment history stay at Stripe.
- **The webhook:** `POST /v1/webhooks/stripe`, through the web origin like every `/v1` route, with no session.
  - It checks the `Stripe-Signature` HMAC over the raw body, with a 5-minute tolerance against replays.
  - For any subscription event it **reads the subscription from Stripe** and stores its current state, so events can repeat or arrive out of order.
  - Events handled:
    - `checkout.session.completed` and `checkout.session.async_payment_succeeded` (Pix clears later): a subscription, a paid top-up (200 or 50 credits) added once per payment intent, or a trip pass granted once per payment intent with its 50 Pip credits.
    - `customer.subscription.*`
    - `invoice.paid` and `invoice.payment_failed`
  - Everything else answers 200 and is ignored. A failure answers 500, so Stripe retries.
  - An event for an account that no longer exists (deleted, its subscription canceled first) answers 200 and records nothing (`unknown-account`).
- **Status mapping:**
  - `active` and `trialing` grant the plan.
  - `past_due` and `unpaid` keep it for 3 days.
  - `canceled`, `incomplete_expired` and `paused` end it at the period end.
  - `incomplete` grants nothing yet.

## Switching it on (the owner, in the Stripe dashboard, test mode first)

1. **Products and Prices** (USD required, BRL optional):
   - Explorer: US$4.99 a month and US$39.99 a year; R$14,90 a month and R$119 a year.
   - Voyager: US$9.99 a month and US$79.99 a year; R$29,90 a month and R$239 a year.
   - "200 Pip credits": a one-time US$2.99; R$14,90.
   - "50 Pip credits" (optional): a one-time US$0.99; R$4,90, in `STRIPE_PRICE_TOP_UP_SMALL` and `STRIPE_PRICE_TOP_UP_SMALL_BRL`.
   - "Trip pass": a one-time US$9.99; R$49.
   - Put the six USD Price ids in `STRIPE_PRICE_*` and the BRL ones in `STRIPE_PRICE_*_BRL`.
   - To offer Pix on one-time payments in reais, switch Pix on under Payment methods (Pix on Stripe Brazil is by invitation: ask for it early).
   - **Launch coupons** (Products → Coupons, then a promotion code each): `LANCAMENTO`, R$10 off the trip pass until a date you choose; `FUNDADOR`, R$20 off, limited to 100 redemptions.
2. **Customer Portal:** allow cancel, card updates and switching between the plan Prices (four per currency).
3. **Webhook endpoint:**
   - The URL is `https://<web domain>/v1/webhooks/stripe`.
   - Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` and `invoice.payment_failed`.
   - Its signing secret goes in `STRIPE_WEBHOOK_SECRET`.
4. **Secret key:** `STRIPE_SECRET_KEY` (`sk_test_…`). Production accepts `sk_live_…` once you decide to charge.
5. **Test a purchase:** buy with the test card `4242 4242 4242 4242`, check `/app/plan` shows the plan, then cancel from the portal.

Locally, `stripe listen --forward-to localhost:3000/v1/webhooks/stripe` prints a `whsec_` to use as the webhook secret.
