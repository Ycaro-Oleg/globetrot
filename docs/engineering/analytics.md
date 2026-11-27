# Analytics: events, the team's traffic and the PostHog dashboard

How Globetrot measures the product without personal data, how the team's own visits stay out of the numbers, and which dashboard answers "how is the business doing, and where do we act" in the pre-sales phase. Decisions: [ADR-0018](../architecture/adr/0018-launch-measurement-and-consent.md) (Plausible, the Meta Pixel, consent) and [ADR-0021](../architecture/adr/0021-error-monitoring-and-product-analytics.md) (PostHog). Settings: [`configuration.md`](configuration.md#web-appsweb). Code: `apps/web/lib/analytics.ts` (the only place that talks to the scripts) and `apps/web/app/analytics.tsx` (loading and the banner).

**The owner creates the PostHog project** (and Plausible and the Pixel, if wanted) and sets the keys in Railway; the team never creates accounts or handles keys. Nothing loads, and nothing is sent, until a key is set.

## What is sent

| Event | When | Counted once per |
|---|---|---|
| `cta_click` | "Start planning" on the landing | click |
| `plan_built` | the landing calculator shows a plan | plan shown |
| `plan_saved` | "Save this plan" on the landing | click |
| `sign_up` | an account is created | tab (a second submit does not count) |
| `first_trip` | onboarding finished, the trip exists | trip |
| `trip_created` | a trip exists: from the trips page, onboarding, or a landing plan after sign-up | trip |
| `savings_goal_set` | a monthly saving amount above zero is saved (onboarding, a landing plan, the budget) | trip |
| `savings_checkin` | a weekly check-in is saved on Today | check-in |
| `member_invited`, `member_joined` | an invite is sent; someone joins a trip | action |
| `trip_shared` | a public link is turned on or sent | action |
| `pass_bought` | the return from a paid trip pass checkout | trip |
| `lead_captured`, `lead_submitted` | the interest list form ([#192](https://github.com/Ycaro-Oleg/globetrot/issues/192)) | not built yet |

- **The only property is `locale`** (`en` or `pt-BR`, the page's language), on every event and every PostHog pageview. Plausible events carry it as a custom property; for Plausible pageviews the script needs Plausible's pageview-properties variant in `NEXT_PUBLIC_PLAUSIBLE_SRC` (the tag already carries `event-locale`).
- **Never sent:** email, name, account or trip id, trip content, amounts, the full referrer address. No autocapture, no session recording, no identified people (`person_profiles: 'identified_only'` and nothing calls `identify`).
- **Once per action.** `track(event, once)` remembers `event:once` in the tab's `sessionStorage`, so a re-render, a reload or a back button never counts the same action twice. Actions that finish on the server (a trip created, onboarding finished) leave the event in the short-lived `globetrot.events` cookie (two minutes, readable by the page, event names and the trip id only); the next page sends it and clears it.

## Keeping the team's traffic out

A browser that is the team's sends **nothing** to PostHog, Plausible or the Meta Pixel, on any page, and loads none of them.

- **`?interno=1` on any page** marks the browser (for example `https://globetrot.com.br/?interno=1`). No account needed. `?interno=0` clears the mark. The mark lives in the browser's `localStorage` (`globetrot.internal`), together with Plausible's own `plausible_ignore`. A marked browser shows a small note under the page: "This device is not counted in Globetrot's statistics." Clearing site data also clears the mark.
- **Admin accounts** (`ADMIN_EMAILS`): when a signed-in page opens, the browser asks the admin dashboard's endpoint (`GET /v1/admin/metrics`) once per visit. It answers only admins (everyone else gets "not found"), and an admin's browser is then marked as above, so it stays out **also after signing out**. Only the very first page of an admin's first sign-in on a new browser can slip through before the answer arrives: mark new devices with `?interno=1` first.
- **QA and bot test accounts** cannot be filtered by account in PostHog, because no event carries one. Their browsers open `/?interno=1` before testing, and their scripts do the same.
- Every phone, laptop and browser profile of the team needs the mark once.

## How visitors are counted

- **Before an answer to the banner, and after Reject**, PostHog runs in **cookieless mode** (`cookieless_mode: 'on_reject'`, `opt_out_capturing_by_default` until the visitor accepts): no cookie and no storage; PostHog makes a privacy-preserving hash on its servers to tell visitors apart. **After Accept** it keeps its id in a cookie and `localStorage` and recognises the visitor on later visits.
- **The PostHog project must have cookieless mode switched on**, or PostHog drops every cookieless event (`posthog-js` 1.451.2 documents this). That is a step for whoever has PostHog access, below.
- **What the number means:** "unique visitors" counts people who accepted once each; those who did not are counted by PostHog's hash, which can count one person more than once over a long period (a new device, a new network). Read weekly visitors as close to, and possibly a little above, the real number of people. **The CTO confirms this setting** before it ships (#190).
- Ad blockers stop all three tools: every number here is a floor for visits and a ceiling for nothing.

## Where a visit came from

On the first page of a visit the web keeps its origin in the tab's `sessionStorage` (`globetrot.origin`): `utm_source`, `utm_medium`, `utm_campaign`, the referring **domain** only (empty for a direct visit or from the site itself), and the landing path cut to two segments (so no token in a path is kept). Each value is cut to 100 characters. No cookie, no id, and it is gone when the tab closes. It is not sent to any analytics tool; the interest list and the sign-up send it with the lead and the account ([#191](https://github.com/Ycaro-Oleg/globetrot/issues/191), [#192](https://github.com/Ycaro-Oleg/globetrot/issues/192), #202), and `readVisitOrigin()` reads it.

## The pre-sales dashboard

Defined by the CEO for the phase before sales (issue [#190](https://github.com/Ycaro-Oleg/globetrot/issues/190)). Default period: **the last 7 days, compared with the 7 days before**. Every metric can be split by `locale`. "Database" means the owner's dashboard at `/app/admin/metrics`, which is the source of truth for people and accounts; PostHog is the source for visits and clicks.

| # | Metric | Question it answers | Exact definition | Source |
|---|---|---|---|---|
| 1 | Unique visitors per day and per week | How many real people reach the site | Unique users with at least one `$pageview` on `globetrot.com.br`, per day and per week, internal traffic excluded | PostHog |
| 2 | Traffic source | Which channel brings people who leave an email | Visits: metric 1 broken down by `utm_source`, then by referring domain, grouped as X (`x.com`, `t.co`, `twitter.com`), search (Google, Bing, DuckDuckGo), direct (no referrer), public itineraries (landing path `/itineraries` or `/roteiros`) and other. Emails and sign-ups: the first-visit origin stored on the lead (#191) and the account (#202) | PostHog; database |
| 3 | **Visitor → confirmed email** (main metric) | Does the landing convince anyone to raise a hand? | Leads confirmed in the period ÷ metric 1 (weekly) | Database (confirmed leads) ÷ PostHog. `lead_captured` (#192) is the PostHog side, for the funnel |
| 4 | Where people give up before the email | At the message or at the form? | `cta_click` ÷ visitors, `plan_saved` ÷ visitors, and `lead_submitted` ÷ visitors, each as unique users who sent the event ÷ metric 1 | PostHog |
| 5 | Sign-ups and % with a confirmed email | Who wants to use it now, and does email confirmation block entry? | Accounts created in the period, and the share of them with a verified email | Database |
| 6 | Activation | Does the product deliver value on the first visit? | % of confirmed accounts that create a first trip within 7 days of signing up | Database |
| 7 | Real planning intent | Who really wants to travel and save? | % of trips with a budget or a savings goal. PostHog side: `plan_built` and `savings_goal_set` | Database; PostHog |
| 8 | Week-1 return | Does it become a habit? | % of accounts that come back between day 2 and day 7 after signing up | Database |

Also on the dashboard:

- **Funnel** (PostHog, unique users, 14-day window): landing `$pageview` → `plan_built` → `sign_up` → `trip_created` → `pass_bought`.
- **Retention** (PostHog, weekly): `savings_checkin` as both the start and the return event.
- **The interest list:** `lead_captured` per week (PostHog) shown next to the confirmed count from the database (#191), which wins when they differ.

## Steps for whoever has PostHog access

Menu names below are PostHog's at the time of writing; they were not checked against a live project.

1. In the project settings, **switch on cookieless mode** (server-side hash). Without it, visitors who have not accepted are dropped.
2. In the project settings, set the **internal and test user filter** to keep only events whose `$host` is `globetrot.com.br`. That drops local, preview and staging traffic. Turn the filter on by default for new insights.
3. The team's devices, admin accounts and QA or bot browsers send nothing (see above), so they need no PostHog filter. Make sure each team device opened `?interno=1` once.
4. Build metrics 1 to 4 as insights with the filter from step 2 on: 1 as a Trends insight on `$pageview`, unique users, daily and weekly; 2 as the same insight broken down by `utm_source` and by `$referring_domain`; 3 and 4 as formulas over unique users of `lead_captured`, `cta_click`, `plan_saved` and `lead_submitted` against metric 1. Add the funnel and the retention above. Compare with the previous period, and add `locale` as a breakdown.
5. Put them on one dashboard named for the phase. Metrics 5 to 8 stay on `/app/admin/metrics`.
