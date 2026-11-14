# Stripe (commercial architecture)

Status: **prices approved (2026-11-13), plans and credits built ([ADR-0019](../architecture/adr/0019-plans-trial-and-pip-credits.md)); the Stripe adapter and webhooks come next.** No live payments until the owner sets the live keys.

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

## What is built, and what the adapter has to do

- Plans, prices and credits are data in the domain (`PLAN_TERMS`, `TRIAL_TERMS`, `TOP_UP`). The landing and `/app/plan` read them through `apps/web/lib/plan-config.ts`, and copy lives in the `plans` catalog.
- `PaymentsPort` (`checkoutUrl`, `portalUrl`) answers `null` today, so checkout says payments are being switched on.
- The Stripe adapter implements the port:
  - Checkout Sessions in `subscription` mode for Explorer and Voyager (monthly and yearly Prices), and `payment` mode for the top-up.
  - The Customer Portal.
- The webhook handler writes through `BillingWriter`:
  - `saveSubscription` keeps plan, interval, status, start and period end, and the provider ids.
  - `addCredits` gets the payment id as `ref`, so a redelivered event adds nothing.
