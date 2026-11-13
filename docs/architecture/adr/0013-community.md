# 0013. The community: snapshots, a visibility rule shared by domain and SQL, and moderation by reports

- Status: Accepted
- Date: 2026-11-13

## Context
The owner asked to build the design handoff v2 "Community" now, in one slice, ahead of the PRD's post-launch placement for social features. It has a timeline ("For you", "Following"), a composer (moment, tip, route), visa and goal posts, comments, likes, saves, follows, mute and report. Trips are private by default and another person's data must answer "not found" ([business rules](../../product/business-rules.md#privacy-applies-from-day-one)). Nothing is deployed yet, and moderation tools for staff do not exist.

## Decision
- **Shared things are snapshots.** A route, visa or goal post copies what it shows from the author's own data when it is published (stops and nights; the visa; the trip title and ready month). It never links to a live, private trip. Route amounts are left out unless the author asks; goal posts never carry amounts. "Copy to my trips" makes a new private USD trip from the snapshot.
- **One visibility rule, `canSeePost` in `@globetrot/domain`**, applied by the application to single posts and repeated in SQL for feeds (`createCommunityRepository`); the API integration tests hold the two together. A post is visible to its author, and to others when it is not deleted or hidden by reports, the viewer has not muted the author or reported it, and it is public or the viewer follows the author. Anything else is `404`.
- **People appear only when they act.** A handle (`community_profile`) is created from the name the first time someone posts, comments, likes or follows; before that nobody sees them. Suggestions list only people with recent public posts.
- **Moderation by reports until there is a staff tool.** One report per person and post, kept in `post_report`. A report hides the post from the reporter at once and from everyone but its author after three distinct reports (`hidden_at`). Daily limits: 30 posts, 200 comments.
- **Follows are open** (no approval), mutes are private, saves are private. Deleting a post or a comment is soft (`deleted_at`) so "Undo" works.
- **Photos are left out** of this slice: uploads need the storage pipeline and EXIF stripping (business rules, "Privacy"). The composer says so.

## Alternatives considered
- **Linking posts to live trips:** always fresh, but leaks later private edits and couples privacy of trips to posts.
- **Visibility only in SQL:** faster to write, but the rule would live in an adapter, untestable without a database and invisible to other clients (ADR-0006).
- **Private accounts and follow requests:** more control, more screens and states; deferred until people ask for it.

## Consequences
- The feed query carries the rule; any change to `canSeePost` must change the SQL and its tests in the same PR.
- Before a public launch the community needs a staff review queue for `post_report`, blocking, and visa privacy settings. They are listed in `current-state.md`.
- Community counts (followers, posts) are visible to signed-in people; visa counts are not shown outside the person's own profile.
