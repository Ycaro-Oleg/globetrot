# 0021. Error monitoring (Sentry) and product analytics (PostHog)

- Status: Accepted (the projects and keys are the owner's to set)
- Date: 2026-11-26

## Context
Before a paid launch the team needs to know two things it could not see: when the product breaks for someone (a 500, a failed worker round, a browser error), and where people drop between building a plan and coming back to save for it. Plausible ([ADR-0018](0018-launch-measurement-and-consent.md)) gives page and conversion totals, not funnels or retention per cohort. The product's rules keep personal data out of logs and third parties.

## Decision
- **Sentry for errors.** The web app uses `@sentry/nextjs`, loaded with a dynamic import only when `SENTRY_DSN` (server) or `NEXT_PUBLIC_SENTRY_DSN` (browser) is set, with tracing off. The API and the worker do not take the Node SDK (it pulled OpenTelemetry into the dependency graph); a small reporter in `packages/application/src/monitoring/report.ts` posts a Sentry envelope with the error's name, message and stack frames only. It never sends the request body, headers, cookies or the user.
- **PostHog for product analytics.** `posthog-js`, loaded only when `NEXT_PUBLIC_POSTHOG_KEY` is set, with autocapture and session recording off. It keeps its id **in memory until the visitor accepts** the consent banner (the same banner as the Meta Pixel), then in a cookie. It receives only the named events from `lib/analytics.ts`, never with personal data or amounts: the five of ADR-0018 plus `plan_built`, `trip_created`, `savings_goal_set`, `savings_checkin`, `member_invited`, `member_joined` and `pass_bought`.
- **Off unless configured.** Without the settings nothing loads and nothing is sent.

## Alternatives considered
- **The Sentry Node SDK in the API and worker:** it brought a second copy of OpenTelemetry and broke the database types; the envelope is a documented, stable format and a few dozen lines.
- **Plausible goals only:** no funnels, cohorts or retention.
- **Self-hosted PostHog or GlitchTip:** more to run before there are users; both remain possible later by changing the host or DSN.

## Consequences
- The privacy policy must name Sentry and PostHog (owner review).
- Errors handled as product answers (404, 409, 422) are not reported; only unexpected ones are.
- The admin metrics screen (planned) reads the database, so it does not depend on PostHog being configured.
