# Stripe (commercial architecture)

Status: **planned for M10.** No live payments, and no real prices, before pricing is approved.

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

## Landing pricing (before M10)

The pricing section renders mock tiers (provisional names: Free / Explorer / Voyager) from config, shown in USD and clearly labelled as placeholder pricing. Nothing on it is actually charged. The config is `apps/web/lib/plan-config.ts` (`MOCK_PLANS`: id, monthly and annual price in minor units, `placeholder: true`; the landing has a monthly / annual switch, annual being two months free, all placeholder); names, taglines and features are in the `landing.plans` catalog. Moving it to the real `PlanConfig` is part of M10.
