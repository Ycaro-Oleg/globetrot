# 0026. The saving habit: weekly check-in, countdown and the weekly reminder

- Status: Accepted (part of the gap plan the owner approved on 2026-11-26)
- Date: 2026-11-27

## Context
A trip is planned and saved for over months, but the product gave no reason to come back between planning sessions. The gap review called it the retention gap: people build a plan, then forget it until the trip is close. Saving is a habit, and habits need a small, regular action and a visible streak.

## Decision
- **Weekly check-in:** "I set this aside this week" records one amount per person, trip and ISO week (`savings_checkin`) and adds it to their savings: their own part on a shared trip (ADR-0025), the trip's savings otherwise. Checking in again the same week changes the amount instead of adding to it. The week follows the person's own time zone (`localDateIn`), falling back to UTC.
- **Streak:** weeks in a row with a check-in, counted up to this week, or up to last week while this week's is still to come (`checkinStreak`).
- **Suggested amount:** a week's share of the person's monthly amount (monthly ÷ 4.35, whole units), so the default is one tap.
- **Countdown phases:** from the trip's start date and length, the phase is more than three months, one to three months, under a month, the last week, travelling or back (`tripCountdown`). Each phase lists suggestions the person can add to their checklist (passport validity, official entry rules, insurance, eSIM…). They are reminders, never claims about rules, prices or deadlines.
- **Today screen** (`/app/today`): the countdown, the check-in with the streak, the phase's suggestions and, while travelling, the way to today's plan and costs. Reached from the trip switcher and the weekly email.
- **Weekly reminder email:** on the person's Sunday, when they save monthly for an active trip and the week has no check-in, one short email linking to Today. At most one per person and week (`weekly_notice`, claimed before sending, released if sending fails). It is on by default and turned off in Settings (`weekly_reminder`). It goes only to verified addresses of people who planned a saving.

## Alternatives considered
- **Push notifications:** need a native app or a web push setup and permission prompts; email reaches everyone now.
- **Daily reminders:** too often for a months-long goal; weekly matches how people are paid and save.
- **Streak rewards and badges:** possible later with the ranks system; the streak number is enough to start.

## Consequences
- The worker sends a new kind of email; the production email provider must be set before it reaches anyone.
- Offline reading of the trip (the paid "offline" tool) is a separate change.
