# Authentication (as built)

Decisions: [ADR-0005](adr/0005-authentication.md) (Better Auth), [ADR-0010](adr/0010-web-proxies-the-api.md) (the web app proxies the API, so the cookie is first-party) and [ADR-0012](adr/0012-email-delivery-and-verified-sign-in.md) (email and the verified-address policy). This page describes what is built: email and password with server-side sessions (#53), email verification and recovery (#54) and the account screens (#57). **Google sign-in (#55) is not built yet**; the screens already show its button when the API lists the provider. The authenticated API and the actor built from the session are in [`api-contracts.md`](api-contracts.md) (#56). Business rules: [`../product/business-rules.md`](../product/business-rules.md#accounts-and-sign-in).

## Shape

```text
Browser ──► apps/web (Next.js, public origin) ──proxy.ts──► apps/api (Hono + Better Auth, private)
   cookie: globetrot.session_token (first-party)      /api/auth/*, /v1/*      └──► PostgreSQL (user, session, account, verification, rate_limit, …)
                                                                         └──► SMTP (Mailpit locally): verification and reset emails
```

- **Better Auth runs inside `apps/api`**, mounted at `/api/auth/*` (`src/auth.ts`, `src/app.ts`). It uses the Drizzle adapter over the shared `@globetrot/db` client.
- **The browser only talks to the web origin.** `apps/web/proxy.ts` rewrites `/api/auth/*` and `/v1/*` ([`api-contracts.md`](api-contracts.md)) to the API, so the session cookie is a first-party cookie of the web app: no CORS and no third-party cookie rules. Nothing else is forwarded (other paths get 404, and `..` / `%2e%2e` cannot walk out of the prefixes; see `lib/api-proxy.ts`).
- **The proxy target is read per request** from `API_INTERNAL_URL`, not at build time. A `rewrites()` entry in `next.config` is evaluated during `next build` and baked into the image, which would force one image per environment. `proxy.ts` keeps one image for every environment.
- Sessions are database rows. The cookie holds only the opaque session token (`httpOnly`, `SameSite=Lax`, `Path=/`, no `Domain`, `Secure` in production). Cookie name: `globetrot.session_token` (`__Secure-globetrot.session_token` in production).

## Configuration

Every setting (names, defaults, what production requires) is in the reference: [`../engineering/configuration.md`](../engineering/configuration.md). Behaviour that depends on them is described in the sections below. `apps/api/src/config.ts` is the only reader of the environment. Starting in development without a secret prints a warning and uses the public development secret; `NODE_ENV=production` refuses to start with a missing, short or default secret, a non-`https` `BETTER_AUTH_URL`, or no `SMTP_HOST` and `EMAIL_FROM`. Web side: `API_INTERNAL_URL` (default `http://localhost:4000`), read by Next from `apps/web/.env*` or the container environment, **not** from the root `.env`.

## Passwords

- Email and password only (`emailAndPassword`). Length 8–128 characters; no composition rules (they do not improve passwords). Hashing is Better Auth's default (scrypt, salted).
- With `REQUIRE_VERIFIED_EMAIL` on (the default) sign-up **does not sign the person in**: the response has no session and a verification email is sent. With it off, sign-up signs in (`autoSignIn`).
- Email addresses are trimmed and stored lowercase (a `before` hook plus the `user_email_lowercase` CHECK constraint), so `Ana@Example.com` and `ana@example.com` are the same account.
- There is **no account lockout**. Locking an account after N failures lets anyone lock a victim out. Abuse is limited per client address by the rate limits below.

## Email verification and recovery

Policy (decided in #54, to be confirmed by the owner): **a password sign-in requires a verified email**, and Google sign-in counts as verified (#55). The alternative, letting unverified accounts in behind a banner, is the setting `REQUIRE_VERIFIED_EMAIL=false`. Changing the email address is not built yet.

| | Verification | Password reset |
|---|---|---|
| Sent | On sign-up, and on request (`POST /api/auth/send-verification-email`) | On request (`POST /api/auth/request-password-reset`, body `{ email, redirectTo }`) |
| Link | `/api/auth/verify-email?token=…&callbackURL=…` | `/api/auth/reset-password/<token>?callbackURL=<redirectTo>`, which checks the token and redirects to `redirectTo?token=…` (or `?error=INVALID_TOKEN`) |
| Lifetime | 24 hours | 1 hour |
| Token | A signed token that expires | A random token stored in `verification` |
| Used once | The first visit verifies the address and signs the person in. Opening the link again changes nothing and signs nobody in | **Deleted when used**: a second use is `400 INVALID_TOKEN` |
| After success | The person is signed in | The password changes and **every session of the account is revoked** |

- **Unverified sign-in** is refused with `403` and code `EMAIL_NOT_VERIFIED`. After the link is followed it works.
- **Same answer for known and unknown addresses.** A reset or resend request returns `200` with the same body whether or not an account exists, and only a known address receives mail. The cooldown below applies to the address as typed, so a second request is `429` for both. The mail is sent **in the background**: if the request waited for the mail server, a known address would answer more slowly and timing would reveal it.
- **Cooldown and limits.** One email of each kind per address every `EMAIL_COOLDOWN_SECONDS`, from any client: `429` with code `EMAIL_COOLDOWN` and a `Retry-After` header in seconds. The key holds a hash of the address, in the `rate_limit` table. On top of that, `AUTH_EMAIL_REQUESTS_PER_MINUTE` per client address (Better Auth's limiter; its `X-Retry-After` is also sent as `Retry-After`).
- **Language of the email.** The stored preference when there is one, otherwise the `globetrot_locale` cookie sent with the request (at sign-up), otherwise English. Never `Accept-Language`. Templates and strings: [`i18n.md`](i18n.md#email).
- **Sending.** `EmailPort` (application layer) with an SMTP adapter in `packages/mailer/src/index.ts` (nodemailer). Locally it is Mailpit (<http://localhost:8025>). The production provider is Resend, through the SMTP settings. Plain text plus simple HTML, no remote images and no tracking. A delivery failure never fails the request and the screen still says the email was sent, so the answer never reveals whether an account exists. The failure is:
  - logged as `could not send the <template> email (<code>)`, never with an address or a link. `<code>` is the error's code only when it looks like one (`^[A-Z0-9_]{1,32}$`, such as `ECONNREFUSED`); anything else becomes `unknown error`, so free text from a provider never reaches the logs, the audit table or monitoring;
  - reported to error monitoring (Sentry, when `SENTRY_DSN` is set) as `EmailDeliveryFailed` with the message `<template> email not sent (<code>)` and nothing else (#204);
  - counted as an `audit_event` (`action` `email.failed`, actor kind `system`, metadata `template` and `code` only), so `/app/admin/metrics` shows the failed confirmation and reset emails of the last 7 and 30 days. It is counted also when monitoring is off.
- **Logs** hold no tokens, passwords or addresses (checked in `email.int.test.ts`).

## Screens (`apps/web`)

| Route | What | Notes |
|---|---|---|
| `/login` | Email and password, the Google button, "Forgot it?" | `?next=` is where to go afterwards (default `/app`); the link to `/signup` keeps it |
| `/signup` | First name, email, password with a strength meter, required terms | After success: "Check your inbox" with a resend button. `?next=` (through `safeNext`) rides along: the verification link's `callbackURL` becomes `/email-verified?next=…`, so a visitor who started from a landing example lands on it after confirming. A visitor already signed in is sent straight to `next` |
| `/recover` | Email, then the same "Check your inbox" for any address | Resend with a countdown |
| `/reset-password` | The page the reset email leads to (`?token=…` or `?error=INVALID_TOKEN`) | A bad, used or expired token shows the problem and "Ask for a new link" |
| `/email-verified` | The page the verification email leads to | Success only when the visitor really is signed in with a verified address; its button goes to `?next=` (default `/app`). An expired, tampered or already used link shows the problem and a form to ask for a new one |
| `/terms`, `/privacy` | Placeholder pages marked **draft** | The real legal text is the owner's |
| `/app` and `/app/*` | The signed-in shell around its pages; `/app` itself sends a signed-in visitor to `/app/board` ([design-system](../design/design-system.md#the-shell-as-built-design-handoff-v2-the-topbar)). Log out is in the account menu | An anonymous visitor goes to `/login?next=<page>` (`proxy.ts`); a stale or revoked session is caught by the layout, which asks the API. Both checks cover every page under `/app`, including ones that do not exist yet |

- **How the screens talk to the server.** Client components call `/api/auth/*` with `fetch` from the browser (`lib/auth-client.ts`), so the session cookie the API sets is a first-party cookie. The result is a value, never a thrown error. Passwords only travel in the JSON body.
- **Errors.** `lib/auth-errors.ts` maps the stable `code` and HTTP status to catalog messages (`auth.errors.*`); the server's English `message` is never shown. Bad credentials are one generic banner, the same for an unknown address and a wrong password. A duplicate email appears under the email field with a link to log in. A `429` becomes "try again in N seconds" from `Retry-After`. Empty or malformed fields are caught before sending, with an error under each field, a summary announced as an alert (`role="alert"`) and focus moved to the first field with a problem.
- **Loading.** Every submit shows the button's pending state and an `aria-live` status; the button cannot be pressed twice.
- **Password strength.** `lib/password-strength.ts` computes four segments and a word (too short, weak, okay, good, strong) in the browser. It rewards length and variety, treats a long passphrase as strong, and caps common passwords and keyboard runs at weak. It is guidance only: the one rule is the server's length (`PASSWORD_MIN_LENGTH` 8 to `PASSWORD_MAX_LENGTH` 128, from `@globetrot/domain`). The word is announced politely when the level changes.
- **Resend countdown.** 30 s on the button after an email was sent; the server's own cooldown is authoritative (a `429` restarts the countdown with the wait it asks for).
- **Google.** See [Google sign-in (#55)](#google-sign-in-55). The button appears only when `GET /v1/auth/providers` lists `google`, which happens only when both credentials are configured.
- **Terms.** The checkbox is required by the screen. Acceptance is **not stored** yet: that needs the final legal text and a version to record.

### Redirect rules

- **`next` is a path on this site or nothing.** `lib/safe-next.ts` accepts only a value that starts with exactly one `/`: absolute URLs (`https://…`, `javascript:`), protocol-relative ones (`//host`), backslash tricks (`/\host`) and control characters (a tab or newline inside `//` is dropped by browsers) all fall back to `/app`. It is property-tested against arbitrary strings. Without it a log-in link could send a signed-in person to a look-alike site.
- **An anonymous visit to `/app`** goes to `/login?next=<page>`: first in `proxy.ts` (no session cookie at all, no rendering), then in the app's layout for a cookie that is stale or revoked, which only the API can tell (for example after a password reset ended the session).
- **After log-in or sign-up** (when the server opens a session) the browser goes to the safe `next`. **After sign-out** it goes to `/login`.

## Request protection

- **Origin check on every state-changing call.** Better Auth only verifies `Origin` when the request carries cookies, so a login-CSRF (signing a victim into the attacker's account) would pass. `app.ts` therefore rejects any non-safe request (`POST`, …) to `/api/auth/*` whose `Origin` is present and not trusted, with `403 INVALID_ORIGIN`. Requests without `Origin` (curl, server to server) are not browser CSRF vectors.
- **Rate limits live in PostgreSQL** (`rate_limit` table), so they are shared by every API instance and survive restarts. General limit: 100 requests per 60 s per address and path. `/sign-in/email` and `/sign-up/email` use the two settings above (default 5 per minute); the sixth wrong sign-in gets `429`.
- Logging is `warn` and above and contains no tokens, passwords or email addresses (checked in the end-to-end run).

## Which client address counts (trust model)

The rate limits and the stored `ip_address` use the **rightmost `X-Forwarded-For` entry that is not a private hop** (`TRUSTED_PROXY_RANGES` in `apps/api/src/auth.ts`: loopback, RFC 1918, `100.64.0.0/10`, `fc00::/7`, link-local). Next's proxy appends the address of the connection it received, so the header the API sees is `<what the client or edge sent>, <peer>`; skipping the private peer leaves the address the edge saw, and anything a client wrote further left is ignored. Without the list, Better Auth refuses any header with more than one entry and every client falls into one shared bucket, so five wrong passwords from anyone would lock sign-in for everybody (seen on the first production deploy: the API logs "Rate limiting could not determine a client IP").

- **In production** the entry point is Railway's edge ([ADR-0034](adr/0034-hosting-on-railway.md)). Measured on the first deploy, its `X-Forwarded-For` keeps a value the client sent (six forged headers were counted as six clients). Railway staff say its edge always overwrites `X-Real-IP` with the real client address (not yet measured here). So production sets `CLIENT_IP_HEADER=x-real-ip` and the API reads only that header; the web proxy forwards it unchanged. Production refuses to start without `CLIENT_IP_HEADER`, so a missing setting never falls back silently to `X-Forwarded-For`; if the named header is missing or holds only a private address, every client shares one bucket (stricter, never bypassable) and the API logs the warning below. Railway's own answers on this disagree, so the [launch runbook](../engineering/launch-runbook.md#4-first-deploy-in-order) proves it on the real domain before opening: six wrong sign-ins, each with a different made-up `X-Real-IP` and `X-Forwarded-For`, must still end in `429`, and the API logs must not say "Rate limiting could not determine a client IP" (that warning means every client shares one bucket). Do not put another proxy in front of the web service without repeating that check.
- **The API must not be reachable from the internet.** Only the web container may call it (internal network, `API_INTERNAL_URL`). If the API were public, any caller could choose its own address and bypass the limits.
- **Without a trusted edge** (for example `pnpm dev`, or the built web served directly) a client can send its own `X-Forwarded-For` and be counted under that address. This was observed in the end-to-end run. It is acceptable on a developer machine and is the reason for the two rules above.

## Error codes

Responses use Better Auth's stable `code` values; the UI (#57) maps each to a translated message and never shows `message`.

| Code | When |
|---|---|
| `INVALID_EMAIL_OR_PASSWORD` | Wrong email or password. The same answer for an unknown email and a wrong password |
| `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` | Sign-up with a taken email |
| `PASSWORD_TOO_SHORT` / `PASSWORD_TOO_LONG` | Outside 8–128 characters |
| `INVALID_ORIGIN` | Untrusted `Origin` on a state-changing request (ours, from `app.ts`) |
| `EMAIL_NOT_VERIFIED` | Password sign-in of an address that has not been verified (`403`) |
| `EMAIL_COOLDOWN` | A second verification or reset email for the same address inside the cooldown (`429`, with `Retry-After`) |
| `INVALID_TOKEN` | A reset token that is expired, used or unknown (`400`) |
| HTTP `429` | Rate limit hit |

## The sign-up language

When an account is created, a Better Auth database hook (`databaseHooks.user.create.after` in `apps/api/src/auth.ts`) stores the person's language. It reads the `globetrot_locale` cookie that the browser sent along (the web proxy forwards it), keeps it only if it is a supported language, and falls back to `en`. It records nothing else: the currency, country, nationality and time zone stay at their defaults, because none of them follows from the language. The hook never fails a sign-up: if the write fails, the account exists and `getPreferences` answers with the defaults (a line without personal data is logged). See [`data-model.md`](data-model.md#user-preferences).

## Tables

`user`, `session`, `account`, `verification` and `rate_limit` (`packages/db/src/schema/auth.ts`, migration `0001_auth_tables`). They follow Better Auth's shape, including its text ids, and the rest of [`data-model.md`](data-model.md) otherwise. `account` holds the password hash (and later OAuth links), never `user`.

## Tests

- The screens (`apps/web/scripts/check-auth-pages.mjs`, CI job `Accessibility (axe)`): the built web app in a real browser against a stand-in API. Every screen and state reachable, keyboard-only log-in, a failed submit announced and focused, redirects (`next` with hostile values, anonymous `/app`, sign-out), the language switcher, and **axe (WCAG 2.1 A/AA) on every state in both themes and both languages**. Unit tests cover the error mapper, `safeNext`, the strength scorer and the auth client; render tests cover each form in both languages.
- Integration with Mailpit (`email.int.test.ts`, reads the mail the API really sent): verification and reset flows, languages, expiry, single use, session revocation, cooldown and `Retry-After`, identical answers for unknown addresses, clean logs, and the mail server being down. Needs `pnpm services:up` (CI runs Mailpit as a service).
- Unit: configuration rules, the email templates (`packages/application/src/email`), the Origin check and the proxy path guard (`config.test.ts`, `app.test.ts`, `apps/web/lib/api-proxy.test.ts`).
- Integration against a real PostgreSQL (`auth.int.test.ts`, `pnpm test:int`): sign-up, case-insensitive email, duplicate and weak password, sign-in/out, sessions and expiry, rate limits per address, hostile origin, no password or token in responses.
- The built images were also driven end to end with `curl` through the web origin: first-party cookie, proxy path guard, hostile origin `403`, rate limit `429`, clean logs.

## Google sign-in (#55)

Better Auth's Google provider, on **only** when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are both set (`apps/api/src/config.ts`, `auth.ts`). Without them nothing else changes: password sign-in works, the providers query is empty, the button is hidden. CI and local development never need them.

- **Where Google sends the person back.** `<BETTER_AUTH_URL>/api/auth/callback/google`, on the **web** origin (the web app proxies `/api/auth/*`, so the session cookie stays first-party, [ADR-0010](adr/0010-web-proxies-the-api.md)). In the Google console allow exactly that redirect URI and the web origin as an authorized JavaScript origin. Locally that is `http://localhost:3000/api/auth/callback/google` and `http://localhost:3000` (`https` only when the app itself is served over https).
- **Linking rule.** A Google identity links to an existing account only when **both** sides have verified the same address: Google reports it verified, it equals the account's address, and the local account's address was verified too. Otherwise sign-in fails with an explicit code and nothing is linked. The last condition is deliberate: someone could register another person's address with a password they know, and the real owner arriving with Google must not land in that account. A Google address that differs from every account's is simply a new account (`allowDifferentEmails: false`, `trustedProviders: []`).
- **New accounts** start with the language cookie the visitor had (`globetrot_locale`); nothing is read from the Google profile besides name and address, and every other setting takes its default. Google addresses count as verified ([ADR-0012](adr/0012-email-delivery-and-verified-sign-in.md)).
- **Failures.** A denied consent, a wrong or expired state, a refused link or a Google outage send the browser to `/login?error=<code>` (`onAPIError.errorURL`), where one message says Google sign-in did not work and offers email and password. No stack, token or code is ever in the URL or the page.
- **Tests.** `apps/api/src/google.int.test.ts` runs the whole round trip against a real PostgreSQL with Google's token endpoint stubbed (no network, no credentials): the authorization URL, a new verified account with the cookie language, linking when both addresses are verified, refusing an unverified Google address and a never-verified local account, a different address, denied consent and a wrong state. `config.test.ts` covers both-or-neither.

### Manual smoke checklist (the owner's, with real credentials)

1. Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in your git-ignored `.env`, allow the redirect URI above in the Google console, and start the stack (`pnpm services:up`, `pnpm dev`).
2. `GET http://localhost:3000/v1/auth/providers` answers `{"providers":["google"]}` and `/login` shows "Continue with Google".
3. Click it: Google's consent screen opens for your client; accept. You land on `/app/board`, signed in, with your Google name in the account menu.
4. Settings: the language is the one you had before signing in; currency is USD; country, nationality and time zone are not set.
5. Log out, then sign in with Google again: same account, no duplicate (check `user` has one row for your address).
6. Deny consent on the Google screen: you return to `/login` with the Google error message and no session.
7. With an email-and-password account for the same address that you **have verified**, sign in with Google: it links to that account (one `user` row, two `account` rows).
