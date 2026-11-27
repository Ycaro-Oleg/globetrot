# 0032. Bookings forwarded by email become Pip proposals

- Status: Accepted (part of the gap plan the owner approved on 2026-11-26; the inbound email provider is the owner's)
- Date: 2026-11-27

## Context
Travellers already have their bookings: confirmation emails from airlines, hotels and tour sites. Typing them into a trip again is the kind of chore that makes people stop using a planner. Pip (ADR-0016) already turns a request into a reviewable change list.

## Decision
- **A private forwarding address per account** (`inbound_address`): `{local}+{token}@{domain}`, the token 128 random bits, made the first time the person opens Pip. Shown on the Pip page with a copy button.
- **The provider's webhook** `POST /v1/inbound/email` (Postmark-compatible: `MailboxHash`, `To`, `Subject`, `TextBody`) has no session; it is trusted only through a shared secret header (`x-inbound-secret`, compared in constant time). The address's token says whose email it is. Logs record only the outcome.
- **The email becomes a Pip request** on the person's most recent active trip: "Add this booking from my email; use only what it says", with the subject and the start of the text (Pip's request limit). Pip proposes stops, places and costs (as estimates, for the person to mark paid); nothing is changed until the person reviews and applies. Credits and the daily cap apply as for any request. When there is no trip, the address is unknown, or Pip does not answer, nothing is stored.
- Settings: `INBOUND_EMAIL_SECRET` (24+ characters), `INBOUND_EMAIL_DOMAIN`, `INBOUND_EMAIL_LOCAL` (default `trips`). Without them the route is 404 and no address is offered.

## Alternatives considered
- **Parsing booking emails with templates per provider:** brittle across hundreds of senders; the model reads them and the person reviews.
- **Connecting the person's mailbox (Gmail API):** a much larger privacy surface; forwarding is explicit, one email at a time.

## Consequences
- The owner sets up inbound email on the provider (an MX record for the domain and the webhook with the secret).
- Long emails are read only from the start; the proposal says what Pip understood, and the person corrects it.
