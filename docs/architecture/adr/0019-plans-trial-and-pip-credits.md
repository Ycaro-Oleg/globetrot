# 0019. Plans, the free week and Pip credits

- Status: Accepted, partly superseded by [0023](0023-free-plan-trip-pass-and-prices-in-reais.md) (the free plan replaces read-only after the trial; prices in reais and the trip pass are added)
- Date: 2026-11-14

## Context
The product is sold, not given away: at most a time-limited trial. Each Pip request costs about US$0.001 on DeepSeek, capped near US$0.003 by `max_tokens`, so unlimited Pip on a flat price is an open-ended cost. The owner approved the plans and asked for a strategy that cannot lose money on AI.

## Decision
- **A 7-day free trial from sign-up, with no card:** every tool, 15 Pip credits and up to 10 active trips. There is no trial table: it runs from `user.created_at`.
- **Plans** (USD, `PLAN_TERMS` in the domain):
  - **Explorer:** US$4.99 a month or US$39.99 a year; 100 Pip credits a month; 10 active trips.
  - **Voyager:** US$9.99 a month or US$79.99 a year; 400 credits a month; unlimited trips.
  - Yearly plans get their credits monthly too.
- **Credits:**
  - One credit is one answered Pip request (a failed call costs nothing).
  - Monthly credits reset each month from the subscription's start and do not roll over.
  - **Top-ups** (200 credits for US$2.99) never expire and are spent only after the monthly ones. They are a ledger (`credit_ledger`) with a unique `ref`, so a payment webhook delivered twice adds nothing twice.
  - On any plan, a **daily cap of 40** requests guards against runaway use.
  - Worst case at the cap: Voyager costs about US$1.20 a month in AI against US$9.99.
- **After the trial without a plan, the account is read-only.**
  - Everything can still be seen and exported, and the account or its trips deleted.
  - Settings, the community handle, reporting, muting and checkout stay open.
  - Every other command answers `402 PLAN_REQUIRED`. Data is never deleted for lack of a plan.
- **The rule lives in one place:** `createApplication` wraps every command with a read-only guard, except the short `OPEN_WHEN_READ_ONLY` list. New commands are guarded by default.
- Trip limits are checked where trips are created or restored (`TRIP_LIMIT_REACHED`). Pip checks credits (`OUT_OF_CREDITS`). All three answer `402`.
- **A canceled plan** runs to the end of what was paid. **A failed renewal** (`past_due`) keeps the plan for 3 more days.
- **Payments sit behind `PaymentsPort`**: a hosted checkout and the provider's portal.
  - Until Stripe is configured the API answers `503`, and the plan page says payments are being switched on.
  - The subscription row mirrors the provider: `provider_customer_id` and `provider_subscription_id` match webhooks.
  - The Stripe adapter uses `fetch` with no SDK. Its webhook re-reads the subscription from Stripe on every event and applies the current state, so retries and reordering are harmless ([stripe](../../integrations/stripe.md)).

- **Two trial emails** are sent by the worker's hourly round, to verified addresses without a paid plan:
  - "ends in 2 days", 48 hours before the end;
  - "your trips are safe", once, within 3 days after the end, so older accounts are never written to.
  - Each email is claimed in `account_notice` before sending and released if sending fails, so it goes at most once per account.
  - Both name the person's trip changed most recently (not archived) in the subject and the first line, when there is one. The title is user text: it is escaped in the HTML and kept on one line in the subject.

## Consequences
- The landing shows the real prices; nothing is labelled placeholder any more. No real charge happens until Stripe's live keys are set by the owner.
- Each command does one more small read (the account's plan) before it runs.
- An account created before this change starts its trial from its own sign-up date, so older test accounts are read-only at once. Production has no accounts yet.
