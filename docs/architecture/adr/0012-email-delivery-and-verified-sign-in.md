# 0012. Email through a port and SMTP, and a verified address for password sign-in

- Status: Accepted (the owner confirmed the verified-email policy on 2026-11-14)
- Date: 2026-11-08 (decided while building #54, recorded here)

## Context
Accounts must be tied to a real inbox and people forget passwords (#54). The production email provider (Resend or Postmark) is not chosen, and nothing may send real email before launch. [ADR-0005](0005-authentication.md) chose Better Auth, which calls our code to send the messages.

## Decision
- **`EmailPort`** in `packages/application`: `send({ to, template, locale, data })`. Templates (`verifyEmail`, `resetPassword`) are rendered by `renderEmail` into subject, plain text and simple HTML from the `email` catalog namespace, in the user's language. No remote images, no tracking, one link, everything interpolated is escaped, the link must be `http(s)`.
- **SMTP adapter** in `apps/api` (`nodemailer`, pinned). Locally it talks to Mailpit. A production provider is a change of `SMTP_*` settings, not of code. Production refuses to start without `SMTP_HOST` and `EMAIL_FROM`.
- **Sent in the background**, so response time does not reveal whether an address has an account. Delivery failures are logged as a template name and an error code only, never an address or a link, and never fail the request.
- **Policy: a password sign-in requires a verified email** (`403 EMAIL_NOT_VERIFIED`), and Google sign-in counts as verified. `REQUIRE_VERIFIED_EMAIL=false` turns it off. **The owner confirmed this default on 2026-11-14** (`REQUIRE_VERIFIED_EMAIL=true` in production).
- **Recovery is non-enumerating.** Resend and reset answer identically for known and unknown addresses. One email per kind per address every 30 s (`429 EMAIL_COOLDOWN` with `Retry-After`), applied to the address as typed, plus a per-client limit. The cooldown lives in the existing `rate_limit` table (a hash of the address).
- **Reset links** last one hour, work once (the token row is deleted on use) and revoke every session. **Verification links** last 24 hours; following one signs the person in, and following it again changes nothing.
- **Language of an email:** stored preference, then the language cookie sent with the request, then English. Never `Accept-Language`.

## Alternatives considered
- **A provider SDK (Resend, Postmark) now:** locks the choice before the owner decides and needs real credentials.
- **Awaiting the send in the request:** simpler, but leaks account existence through timing.
- **Unverified accounts with a banner:** friendlier at sign-up but weakens "tied to a real inbox"; kept as a setting.
- **A dedicated cooldown table:** more schema for the same guarantee.

## Consequences
Local development needs Mailpit (it is in `compose.yaml`, and CI runs it as a service). The integration tests read the mail the API really sent. When the provider is chosen, only configuration and a deliverability check (SPF, DKIM, DMARC) are left. If the owner rejects the policy, change one default and one sentence of the screens' copy.
