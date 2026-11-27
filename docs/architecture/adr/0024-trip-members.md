# 0024. Trip members: planning a trip together by invite link

- Status: Accepted (part of the gap plan the owner approved on 2026-11-26)
- Date: 2026-11-27

## Context
Most trips are planned by two or more people, and the gap review found that Globetrot could only be used alone: every trip had one owner and every check was "is this the owner". Couples and friends had to share a password or a screenshot. Group planning is also what makes the trip pass (ADR-0023) worth buying.

## Decision
- **Roles:** the owner stays in `trip.owner_id`; members are rows in `trip_member` with `editor` (changes the plan: route, days, money, checklist, Pip proposals, title and dates) or `viewer` (reads). Only the owner archives, restores, deletes, shares publicly, buys a pass, invites, revokes links and removes people.
- **One access check:** `loadTripFor(reader, actor, id, need)` with `need` = `view`, `edit` or `own` replaces the owner-only check in every trip operation. Someone who is neither owner nor member, and a missing trip, get the same "not found"; a member asking for more than their role gets `403 FORBIDDEN` (they already know the trip exists). The actor still comes only from the session.
- **Invite links, never emails to third parties:** the owner creates a link (`trip_invite`), copies it and sends it however they like. The token is 128 random bits shown once; only its SHA-256 is stored. A link works for 7 days for as many people as the plan allows, and can be revoked. `/app/invite/{token}` asks to sign in first, says whose trip it is and what the role allows, and joins in one tap.
- **Guest limit from the owner's plan:** the free plan lets 1 person join; the free week, a paid plan or the trip's pass lets anyone (`tripEntitlements`, ADR-0023). Checked when a link is made and when it is accepted (`402 GUEST_LIMIT_REACHED`).
- **Photos:** an editor may keep photos another member placed on the trip; new photos must still be their own uploads. A member may see the photos on the trip's stops.
- **Fresh data without live sync:** a shared trip's screens refresh every 30 seconds while the tab is visible, and every trip's screens refresh when the person comes back to the tab (`router.refresh`). Saves are whole-route replacements, so the last save wins.
- A member's trips appear in their list and switcher marked as shared; they do not count towards the member's own active-trip limit.

## Alternatives considered
- **Email invitations:** would send mail to people who never asked for it; the owner already has a chat with their travel companions.
- **Real-time collaboration (CRDT, websockets):** right later, too much before there are groups using it.
- **Sharing the public link with an edit switch:** mixes the anonymous public page with signed-in editing and its audit.

## Consequences
- Every new trip operation must choose `view`, `edit` or `own`.
- Two people editing the same route at the same moment can overwrite each other until live sync exists; the 30-second refresh keeps the window small.
- The money split between members ("your share", settling up) builds on `trip_member` (the next PR).
