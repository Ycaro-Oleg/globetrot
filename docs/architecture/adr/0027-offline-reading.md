# 0027. Offline reading of a paid trip

- Status: Accepted (part of the gap plan the owner approved on 2026-11-26)
- Date: 2026-11-27

## Context
Travellers lose their connection exactly when they need the plan: on a plane, abroad without data, underground. The pricing model (ADR-0023) lists offline as one of the paid tools, alongside planning with any number of people.

## Decision
- **A small service worker** (`apps/web/public/sw.js`, scope `/`) keeps the last version of the current trip's screens (Today, Map, Days, Money, Checklist) and the app's fingerprinted static files. Trip pages are fetched from the network first (6-second limit) and saved; when the network does not answer, the saved copy is shown. Static files come from the cache first. Nothing else is touched: the API, sign-in and every other page always go to the network.
- **Warm once:** after registering, the worker saves all five trip screens, so they work offline even if they were not opened.
- **Paid tool:** registered only when offline is allowed for the current trip: a paid plan, the free week, or a trip pass (`offlineAllowed`). Otherwise any registration is removed and the copies deleted.
- **Privacy:** the saved pages hold the person's trip, so signing out deletes the cache before the session ends. Nothing is shared with other accounts on the device.
- **Honesty:** without a connection a line says "this is the last version saved on this device"; changes made offline are not queued (saving needs the network).
- The map's tiles come from the tile provider and are not saved; the map screen shows the route and stops that were saved.

## Alternatives considered
- **A full offline-first app with a local database and sync:** right for real offline editing, much more than reading needs.
- **next-pwa or Workbox:** another dependency with build integration for what is about a hundred lines.

## Consequences
- A deployment changes the static files' names; old cached ones are left until the cache version (`globetrot-trip-v1`) is bumped, which deletes older caches on activation.
- Offline editing and saved map tiles are possible follow-ups.
