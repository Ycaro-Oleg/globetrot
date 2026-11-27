# 0037. An interest list with double opt-in

- Status: Proposed (the CTO asked for it on 2026-11-27; the owner accepts it with the merge of #191)
- Date: 2026-11-27

## Context
The site is live, but a visitor who is not ready to sign up has no way to leave an email. The owner decided (2026-11-27) that email capture comes before posts and Stripe. Until now the product stored the email only of people with an account, so this is a new kind of personal data: the address of someone who has no account, given for one purpose, with its own consent and its own retention. Email goes through the existing port and SMTP ([ADR-0012](0012-email-delivery-and-verified-sign-in.md)); the free Resend plan sends 100 emails a day, and sign-up emails must not lose that room to abuse of a public form.

## Decision
- **What is stored** (`interest_list_entry`): the address (trimmed, lower case, nothing else changed), the language (`en` or `pt-BR`), the form's `source` (`landing` or `itinerary`), the first visit's origin (`utm_source`, `utm_medium`, `utm_campaign`, `referrer_domain`, `landing_path`: no query string, no full referrer URL), `internal`, the consent time and the consent text version (set by the server), when it was confirmed, the hash of the pending confirmation token and its expiry, and how many confirmation emails went out in the current 24 hours. **No IP address**: the client address is used only by the in-memory rate limit.
- **Double opt-in.** `POST /v1/leads` (no session) answers the same `202` in every case and sends the confirmation in the background, so neither the answer nor its timing says whether the address was already there. Only confirmed entries are on the list. The confirmation link works for 48 hours; the token is 128 random bits, stored only as a SHA-256 hash and compared in constant time.
- **Retention.** Unconfirmed entries are deleted by the worker's housekeeping 7 days after they were made. Confirmed entries are kept until the person unsubscribes or deletes their account.
- **Unsubscribing** is one click and needs no sign-in: every list email has the link and the `List-Unsubscribe` and `List-Unsubscribe-Post` headers (RFC 8058). The link opens a web page with a button, so link scanners unsubscribe nobody; the header is a `POST`. The unsubscribe token is the entry's id with an HMAC of it, so any later email can carry it without storing a secret. Unsubscribing deletes the entry and keeps **only an HMAC-SHA256 of the address** (`interest_list_suppression`), with the time.
- **A suppressed address is never emailed again by the list.** Signing up again answers the same `202` and sends nothing, because anyone can type someone else's address. Coming back is left to a later path where the person proves they own the address without us emailing it at a stranger's request, for example a verified account rejoining from Settings, which clears the hash. That path is out of scope here.
- **The key** for both HMACs is derived with HKDF-SHA256 from `BETTER_AUTH_SECRET` with its own label: no new secret. **Rotating `BETTER_AUTH_SECRET` empties the suppression list** (old hashes no longer match) and voids unsubscribe links in emails already sent.
- **Anti-flooding.** On top of the per-client-address limit: at most 3 confirmation emails per address in 24 hours, and a global daily ceiling on confirmation emails (`INTEREST_LIST_DAILY_EMAILS`, default 50). Over either, the answer is the same `202` and nothing is sent; the log says only that the ceiling was hit.
- **Internal entries** (sent with `internal: true`, or an address in `ADMIN_EMAILS` or on a reserved test domain) go through the whole flow and never count. The confirm result says `internal` as a boolean only.
- **Accounts.** When an account's email is verified and matches an entry, the account export includes the entry and deleting the account deletes it.
- **Nothing personal outside the table.** The address never goes to logs, audit metadata, analytics or tests (tests use made-up addresses on reserved domains).
- **No campaigns.** This only collects and confirms. Sending anything to the list is out of scope, and needs the owner's yes each time. The Privacy policy must name the list (owner).

## Alternatives considered
- **Delete on unsubscribe with no trace:** anyone could resubmit the form and start emailing the person again.
- **Store the unsubscribe token's hash:** later emails could not carry the link without storing the token; an HMAC of the id needs nothing stored.
- **A newsletter provider's hosted form:** another processor of personal data, chosen by nobody yet, and no tie to account export and deletion.
- **Re-subscribing a suppressed address by a new confirmation:** a stranger could make us email someone who asked us to stop.

## Consequences
- The web pages for confirming and unsubscribing, and the form, are #192. The counts for the owner come with #202.
- The Privacy policy and the owner-dependent items gain the list.
- A suppressed person cannot rejoin until the account path exists.
