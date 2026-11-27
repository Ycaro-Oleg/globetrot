# 0031. Partner links and the internal metrics dashboard

- Status: Accepted (part of the gap plan the owner approved on 2026-11-26; partner accounts are the owner's)
- Date: 2026-11-27

## Context
Two gaps from the review: revenue beyond subscriptions (people leave Globetrot to book tours and stays anyway), and no way for the owner to see whether the product works (activation, retention, sharing) without a third-party tool being configured.

## Decision
- **Partner links:** on a stop's card, "Tours in {place}" (GetYourGuide search with `partner_id`) and "Stays in {place}" (Booking.com search with `aid`); on Today, the insurance and eSIM suggestions link to the partner pages the owner configures. Every link is labelled as a partner link that may earn a commission, opens the partner's own page and carries `rel="sponsored"`. No price is shown: prices are the partner's. Without the setting a link does not appear. Settings (web, read per request): `GETYOURGUIDE_PARTNER_ID`, `BOOKING_AID`, `PARTNER_INSURANCE_URL`, `PARTNER_ESIM_URL` (https only).
- **The internal dashboard** (`/app/admin/metrics`, `GET /v1/admin/metrics`): counts straight from the database: accounts (total, verified, new), trips (active, created by source: the landing's plan, an example, by hand), trips saving monthly, check-ins per week, the retention of accounts that signed up 8 to 16 weeks ago (active in weeks 1, 4 and 8, from the audit log), invites and joins with joins per inviter, referrals, paying accounts and passes. Only verified accounts listed in `ADMIN_EMAILS` see it; everyone else gets "not found". Nothing returns a person, an email or a trip's content.

## Alternatives considered
- **A partners API with live prices:** needs approved partner accounts and keys; links work from day one.
- **Only PostHog for metrics:** depends on consent and configuration; the database is the source of truth for these counts.

## Consequences
- The owner applies to the partner programmes and sets the ids.
- The dashboard queries are aggregate scans; fine at launch scale, to be moved to a reporting view if they slow down.
