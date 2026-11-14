# 0018. Launch measurement: cookieless analytics, and the Meta Pixel only with consent

- Status: Accepted (the providers and IDs are the owner's to set)
- Date: 2026-11-13

## Context
The owner will launch on social media and with Meta ads, which need to know which ads lead to sign-ups. LGPD and GDPR require consent for marketing cookies, and the product's own rules keep personal data out of third parties unless needed. Nothing measured conversions before.

## Decision
- **Off unless configured** at build time (they are written into the browser bundle): `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` (and `NEXT_PUBLIC_PLAUSIBLE_SRC` for a self-hosted Plausible) and `NEXT_PUBLIC_META_PIXEL_ID`.
- **Plausible** is cookieless and aggregate, so it loads without a banner.
- **The Meta Pixel loads only after the visitor accepts** in a banner that offers Accept and Reject with the same weight. The choice is kept in the `globetrot.consent` cookie (180 days) and can be changed from "Cookie preferences" in the landing footer. Without a Pixel ID there is no banner.
- **Four conversion events, never with personal data** (no email, name, trip content or amounts, no advanced matching): `cta_click` (Start planning), `plan_saved` (the landing calculator's "Save this plan", Meta `Lead`), `sign_up` (account created, Meta `CompleteRegistration`), `first_trip` (onboarding finished).
- `lib/analytics.ts` is the only place that talks to these scripts; a failure there never breaks a page.

## Consequences
- The privacy policy names both and the cookies (drafted; owner review).
- Server-side conversions (Meta Conversions API) are not built; ad blockers and refusals mean the Pixel undercounts, Plausible gives the totals.
