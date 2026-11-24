/**
 * GENERATED from openapi.json by scripts/generate-schema.mjs. Do not edit by hand.
 * Regenerate with `pnpm api:generate` from the repository root.
 */

export interface paths {
    "/v1/auth/providers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Which social sign-in buttons to show
         * @description Public. A provider is listed only when the server has it configured, so a screen never offers a button that cannot work. Email and password is always available and is not listed.
         */
        get: operations["listAuthProviders"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/shared/{slug}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * A shared trip, for anyone with the link
         * @description No session. An unknown, malformed or stopped link and an archived trip all answer 404 the same way.
         */
        get: operations["getSharedTrip"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The signed-in user
         * @description Only the caller’s own id, email, name and whether the email is verified.
         */
        get: operations["getCurrentUser"];
        put?: never;
        post?: never;
        /**
         * Delete the account for good
         * @description Type the account’s email again in `confirmEmail`. Deletes trips and everything in them, visas, the community profile and posts, uploads (and their stored bytes), sessions and sign-in methods. The audit log keeps its rows, which hold no personal data. Cannot be undone.
         */
        delete: operations["deleteAccount"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/preferences": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The caller’s settings
         * @description Language, preferred currency, home country, nationality, time zone and units. They are independent: none is derived from another. A user who saved nothing gets USD, the default language and no country, nationality or time zone.
         */
        get: operations["getPreferences"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Change the caller’s settings
         * @description Only the fields sent change; every other setting keeps its value. `null` clears the home country, nationality or time zone. The language and the currency cannot be cleared.
         */
        patch: operations["updatePreferences"];
        trace?: never;
    };
    "/v1/trips": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The caller’s trips, newest first
         * @description Archived trips are left out unless `includeArchived=true`.
         */
        get: operations["listTrips"];
        put?: never;
        /**
         * Create a trip
         * @description The trip is private and active, in USD unless a currency is given. Send an `Idempotency-Key` to make a retry safe: the same key and body return the original trip, the same key with another body is a 409.
         */
        post: operations["createTrip"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/trips/from-example": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Copy an example trip
         * @description Creates a private trip in USD with the example’s route and nights. The copy is the person’s own. `Idempotency-Key` works as for `createTrip`.
         */
        post: operations["createTripFromExample"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/trips/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** One trip */
        get: operations["getTrip"];
        put?: never;
        post?: never;
        /**
         * Delete an archived trip for good
         * @description With its stops, costs, savings, lists and day plan. An active trip is refused (archive it first).
         */
        delete: operations["deleteTrip"];
        options?: never;
        head?: never;
        /**
         * Change a trip
         * @description Only the fields sent are changed. `startDate: null` clears the date. Setting `status` back to `active` restores an archived trip.
         */
        patch: operations["updateTrip"];
        trace?: never;
    };
    "/v1/trips/{id}/archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Archive a trip
         * @description Hides the trip from the default list. It is not deleted. Archiving an archived trip changes nothing.
         */
        post: operations["archiveTrip"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/trips/{id}/destinations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** The stops of a trip’s route, in order */
        get: operations["listDestinations"];
        /**
         * Replace a trip’s whole route
         * @description Sends the route as it should be, in order. The server assigns ids and positions, so sending the same route twice changes nothing. At most 100 stops. An empty list clears the route. The first stop marked visited in a country stamps a commemorative visa (never an official document); the stamps this change gave are in `stampedVisas`.
         */
        put: operations["replaceDestinations"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/visas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The session user’s commemorative visas
         * @description One per country, stamped by the first stop marked visited there. Decorative: never an official document.
         */
        get: operations["listVisas"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/trips/{id}/budget": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Totals and the savings answer of a trip
         * @description Everything in the trip’s currency: the total, by category and by status, and the savings plan (how much is left, the month the goal is reached at the current monthly amount, and what to put aside to be ready by departure).
         */
        get: operations["getBudget"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/trips/{id}/expenses": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** The costs of a trip, newest first */
        get: operations["listExpenses"];
        put?: never;
        /**
         * Add a cost
         * @description The amount is in `currency`. When that is not the trip’s currency, send `fxRate` (how much of the trip’s currency 1 unit is worth); the server converts, and keeps the rate, its source (`manual`) and its date with the cost. The converted amount is never taken from the client.
         */
        post: operations["createExpense"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/trips/{id}/expenses/{expenseId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Replace a cost */
        put: operations["updateExpense"];
        post?: never;
        /** Remove a cost */
        delete: operations["deleteExpense"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/trips/{id}/savings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Set what is saved and the monthly amount
         * @description In the trip’s currency. Only the fields sent change. Answers with the new budget.
         */
        put: operations["updateSavings"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/trips/{id}/checklist": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The checklists of a trip and its readiness stamps
         * @description Four groups (documents, money, bookings, packing) in the order the items were added, and the nine readiness stamps as they stand now. Stamps are computed, not stored: they come and go with what the trip has today.
         */
        get: operations["getChecklist"];
        put?: never;
        /**
         * Add one or several items
         * @description A trip keeps at most 100 items. Answers with the new lists.
         */
        post: operations["addChecklistItems"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/trips/{id}/checklist/{itemId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Remove an item */
        delete: operations["deleteChecklistItem"];
        options?: never;
        head?: never;
        /** Check, uncheck or rename an item */
        patch: operations["updateChecklistItem"];
        trace?: never;
    };
    "/v1/trips/{id}/day-ideas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Places worth a visit near each stop
         * @description Up to 6 ideas for each of the first 6 stops, with a kind of visit and a typical time, without places already on the plan. From the places provider when configured (with its `attribution`), otherwise a built-in list for popular cities. `429` after 20 a minute.
         */
        get: operations["suggestDayPlaces"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/trips/{id}/day-places": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The places to see of a trip and their days
         * @description A place on a day that the route no longer reaches reads as "No day"; a place whose stop was removed reads with no stop. Neither is lost.
         */
        get: operations["listDayPlaces"];
        put?: never;
        /**
         * Save a place to "No day"
         * @description A trip keeps at most 200 places. Answers with the new plan.
         */
        post: operations["addDayPlace"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/trips/{id}/day-places/{placeId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Remove a place */
        delete: operations["removeDayPlace"];
        options?: never;
        head?: never;
        /**
         * Move a place to a day or to "No day"
         * @description To the end of the day, or just before `beforeId` (a place on that same day). A day the route does not have is refused.
         */
        patch: operations["moveDayPlace"];
        trace?: never;
    };
    "/v1/places/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Search places by name
         * @description Cities, regions and addresses from the geocoding provider, in the language asked for. The provider key stays on the server. Show each result’s `attribution`. At most 60 lookups a minute per person.
         */
        get: operations["searchPlaces"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/places/reverse": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The place at a point
         * @description For a pin dropped on the map. `place` is null when nothing named is there (the sea).
         */
        get: operations["reversePlace"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/community/feed": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The community feed, newest first
         * @description `all` is everything the session may see (public posts, followers-only posts of people it follows, its own); `following` keeps the people it follows and itself. Muted people, reported posts and posts hidden by reports are left out. Page with `before` (the `nextBefore` of the previous page).
         */
        get: operations["listFeed"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/community/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The session’s own handle and counts
         * @description The handle is null until the person first posts, comments, likes or follows.
         */
        get: operations["getCommunityMe"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Change the session’s handle */
        patch: operations["updateHandle"];
        trace?: never;
    };
    "/v1/community/discover": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Who to follow and trending destinations
         * @description People with public posts in the last 30 days whom the session neither follows nor muted, and the countries most tagged on public posts in that time.
         */
        get: operations["getDiscover"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/community/posts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Publish a post
         * @description Moments and tips need words. A route or goal post names one of the session’s trips (`tripId`) and a visa post one of its visas (`visaCountry`): the post carries a copy made now, never a live link to the trip. Route amounts are left out unless `showAmounts`; goal posts never carry amounts. At most 30 posts a day.
         */
        post: operations["createPost"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/community/posts/{postId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** One post */
        get: operations["getPost"];
        put?: never;
        post?: never;
        /**
         * Delete one’s own post
         * @description It disappears at once; `restore` brings it back.
         */
        delete: operations["deletePost"];
        options?: never;
        head?: never;
        /** Edit the words of one’s own post */
        patch: operations["updatePost"];
        trace?: never;
    };
    "/v1/community/posts/{postId}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Undo deleting one’s own post */
        post: operations["restorePost"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/community/posts/{postId}/like": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Like a post */
        put: operations["addLike"];
        post?: never;
        /** Unlike a post */
        delete: operations["removeLike"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/community/posts/{postId}/save": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Save a post
         * @description Saves are private: only the session knows.
         */
        put: operations["addSave"];
        post?: never;
        /**
         * Unsave a post
         * @description Saves are private: only the session knows.
         */
        delete: operations["removeSave"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/community/posts/{postId}/comments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * A post’s comments, oldest first
         * @description Without deleted comments or comments by people the session muted. At most 200.
         */
        get: operations["listComments"];
        put?: never;
        /**
         * Comment on a post
         * @description At most 200 comments a day.
         */
        post: operations["addComment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/community/posts/{postId}/report": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Report a post
         * @description Kept for review, once per person. The post is hidden from the reporter at once, and from everyone but its author after 3 distinct reports.
         */
        post: operations["reportPost"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/community/posts/{postId}/copy-route": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Copy a shared route into a new trip
         * @description A new private trip in USD with the route’s stops and nights. `Idempotency-Key` works as for `createTrip`.
         */
        post: operations["copyRoute"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/community/comments/{commentId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Remove a comment
         * @description Its author or the post’s author may remove it; `restore` brings it back.
         */
        delete: operations["deleteComment"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/community/comments/{commentId}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Undo removing a comment */
        post: operations["restoreComment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/community/comments/{commentId}/like": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Like a comment */
        put: operations["addCommentLike"];
        post?: never;
        /** Unlike a comment */
        delete: operations["removeCommentLike"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/community/people/{handle}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** A person’s community page */
        get: operations["getPerson"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/community/people/{handle}/posts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** A person’s posts the session may see */
        get: operations["listPersonPosts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/community/people/{handle}/follow": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Follow a person
         * @description Following is open: no request to accept. Following oneself is refused (422).
         */
        put: operations["followPerson"];
        post?: never;
        /**
         * Unfollow a person
         * @description Following is open: no request to accept. Following oneself is refused (422).
         */
        delete: operations["unfollowPerson"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/community/people/{handle}/mute": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Mute a person
         * @description Muting is private: the muted person is not told, and their posts and comments disappear for the session.
         */
        put: operations["mutePerson"];
        post?: never;
        /**
         * Unmute a person
         * @description Muting is private: the muted person is not told, and their posts and comments disappear for the session.
         */
        delete: operations["unmutePerson"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/media": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Upload an image
         * @description The raw bytes of a JPEG, PNG or WebP (up to 8 MB and 8192 px a side) as the body. The type is read from the bytes, not from `Content-Type`. EXIF (including GPS), XMP, IPTC, comments and text chunks are removed before the image is stored. The image is private until it is placed on a post or a stop. At most 100 uploads a day.
         */
        post: operations["uploadMedia"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/media/{mediaId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * An image
         * @description For its owner, or for someone who may see a post that shows it. Stop photos stay with the trip’s owner. Anything else is `404`.
         */
        get: operations["getMedia"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Download all of the account’s data
         * @description Account, preferences, trips with their stops, costs, savings, lists and day plans, visas, community posts, comments, likes, saves, follows, mutes and reports, uploads (ids; each image at `GET /v1/media/{id}`) and the person’s own history. Never password hashes, tokens or other people’s data. Sent as an attachment.
         */
        get: operations["exportAccount"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/trips/{id}/pip/proposals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** A trip’s last ten proposals, newest first */
        get: operations["listProposals"];
        put?: never;
        /**
         * Ask Pip for a change list
         * @description Pip (an AI model, DeepSeek today) sees this trip’s plan only, never the person’s name, email, home or other trips, and answers a change list that is validated here. Nothing changes until the person applies it. Amounts are estimates in the trip’s currency. At most 20 requests a day.
         */
        post: operations["askPip"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/pip/proposals/{proposalId}/apply": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Apply the chosen changes
         * @description In one transaction, with what "Undo" needs kept. Costs are added as estimates.
         */
        post: operations["applyProposal"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/pip/proposals/{proposalId}/discard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Discard a proposal
         * @description Nothing on the trip changes.
         */
        post: operations["discardProposal"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/pip/proposals/{proposalId}/undo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Undo an applied proposal
         * @description Within 24 hours: puts the route and the monthly amount back as they were and removes what applying added.
         */
        post: operations["undoProposal"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/billing": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The caller’s plan, trial and Pip credits
         * @description Whether the account is in its 7-day trial, on Explorer or Voyager, or read-only after the trial; the active-trip limit; and Pip credits left this period (monthly first, then bought ones). Commands refused by the plan answer `402` with `PLAN_REQUIRED`, `TRIP_LIMIT_REACHED` or `OUT_OF_CREDITS` (ADR-0019).
         */
        get: operations["getBilling"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/billing/checkout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * A hosted checkout for a plan or extra Pip credits
         * @description Answers the payment provider’s checkout URL for Explorer or Voyager (monthly or yearly) or a top-up of Pip credits. Works when the account is read-only. `503` while payments are not switched on.
         */
        post: operations["startCheckout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/billing/portal": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * The payment provider’s page to manage the plan
         * @description Change the card, switch or cancel. `404` before the first payment, `503` while payments are off.
         */
        post: operations["openBillingPortal"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/trips/{id}/share": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Whether the trip has a public link */
        get: operations["getTripShare"];
        /**
         * Turn the public link on, or change whether amounts show
         * @description Keeps the same address when the link is already on. The page shows the route, the month and the savings answer, and amounts only with `showAmounts`; never the person’s name or the exact dates.
         */
        put: operations["shareTrip"];
        post?: never;
        /**
         * Turn the public link off for good
         * @description The old address answers 404 from now on. Works even when the account is read-only.
         */
        delete: operations["unshareTrip"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: never;
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    listAuthProviders: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The enabled providers (possibly none). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description The social sign-in providers that are configured and can be offered. */
                        providers: "google"[];
                    };
                };
            };
        };
    };
    getSharedTrip: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                slug: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The public view. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        title: string;
                        /** @enum {string} */
                        locale: "en" | "pt-BR";
                        startMonth: string | null;
                        totalNights: number;
                        stops: {
                            name: string;
                            countryCode: string | null;
                            nights: number;
                            latitude: number;
                            longitude: number;
                        }[];
                        savings: {
                            /** @enum {string} */
                            status: "no-costs" | "saving" | "fully-saved";
                            progressBasisPoints: number;
                            readyMonth: string | null;
                        };
                        amounts: {
                            total: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            };
                            saved: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            };
                            monthly: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            };
                        } | null;
                    };
                };
            };
            /** @description No such link. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    getCurrentUser: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The caller’s account. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        email: string;
                        name: string;
                        emailVerified: boolean;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The session’s account no longer exists. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    deleteAccount: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description The account’s email, typed again to confirm. */
                    confirmEmail: string;
                };
            };
        };
        responses: {
            /** @description Done. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {boolean} */
                        ok: true;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The email does not match (`confirmation_mismatch`). */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    getPreferences: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The settings. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        locale: string;
                        currency: string;
                        homeCountry: string | null;
                        nationality: string | null;
                        timeZone: string | null;
                        /** @enum {string} */
                        units: "metric" | "imperial";
                        /**
                         * @description Look of the app: a designed theme, or `system` to follow the OS.
                         * @example system
                         * @enum {string}
                         */
                        theme: "day" | "red-eye" | "system";
                        /**
                         * @description Amount of animation. The OS reduced-motion setting wins over `full`.
                         * @example full
                         * @enum {string}
                         */
                        motion: "full" | "reduced";
                        homeCity: string | null;
                        pipOptIn: boolean;
                        pipLook: {
                            /** @enum {string} */
                            hat: "straw" | "helmet" | "cap" | "none";
                            /** @enum {string} */
                            outfit: "none" | "scarf" | "aloha" | "vest";
                            /** @enum {string} */
                            bag: "trolley" | "backpack" | "vintage";
                            /** @enum {string} */
                            bagColor: "amber" | "cyan" | "pink";
                        };
                        pipName: string | null;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    updatePreferences: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /**
                     * @description Interface language.
                     * @example pt-BR
                     */
                    locale?: string;
                    /**
                     * @description Default currency for new trips (ISO 4217).
                     * @example USD
                     */
                    currency?: string;
                    /**
                     * @description ISO 3166-1 alpha-2 country code.
                     * @example BR
                     */
                    homeCountry?: string | null;
                    /**
                     * @description ISO 3166-1 alpha-2 country code.
                     * @example BR
                     */
                    nationality?: string | null;
                    /**
                     * @description IANA time zone name.
                     * @example America/Sao_Paulo
                     */
                    timeZone?: string | null;
                    /** @enum {string} */
                    units?: "metric" | "imperial";
                    /**
                     * @description Look of the app: a designed theme, or `system` to follow the OS.
                     * @example system
                     * @enum {string}
                     */
                    theme?: "day" | "red-eye" | "system";
                    /**
                     * @description Amount of animation. The OS reduced-motion setting wins over `full`.
                     * @example full
                     * @enum {string}
                     */
                    motion?: "full" | "reduced";
                    /**
                     * @description The city the person usually leaves from; null clears it.
                     * @example São Paulo
                     */
                    homeCity?: string | null;
                    /** @description Whether the person wants Pip’s suggestions. */
                    pipOptIn?: boolean;
                    /** @description The person’s Pip: hat, outfit, bag and bag colour. */
                    pipLook?: {
                        /** @enum {string} */
                        hat: "straw" | "helmet" | "cap" | "none";
                        /** @enum {string} */
                        outfit: "none" | "scarf" | "aloha" | "vest";
                        /** @enum {string} */
                        bag: "trolley" | "backpack" | "vintage";
                        /** @enum {string} */
                        bagColor: "amber" | "cyan" | "pink";
                    };
                    /**
                     * @description Pip’s name, 1 to 16 characters; null brings back “Pip”.
                     * @example Pipoca
                     */
                    pipName?: string | null;
                };
            };
        };
        responses: {
            /** @description The settings after the change. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        locale: string;
                        currency: string;
                        homeCountry: string | null;
                        nationality: string | null;
                        timeZone: string | null;
                        /** @enum {string} */
                        units: "metric" | "imperial";
                        /**
                         * @description Look of the app: a designed theme, or `system` to follow the OS.
                         * @example system
                         * @enum {string}
                         */
                        theme: "day" | "red-eye" | "system";
                        /**
                         * @description Amount of animation. The OS reduced-motion setting wins over `full`.
                         * @example full
                         * @enum {string}
                         */
                        motion: "full" | "reduced";
                        homeCity: string | null;
                        pipOptIn: boolean;
                        pipLook: {
                            /** @enum {string} */
                            hat: "straw" | "helmet" | "cap" | "none";
                            /** @enum {string} */
                            outfit: "none" | "scarf" | "aloha" | "vest";
                            /** @enum {string} */
                            bag: "trolley" | "backpack" | "vintage";
                            /** @enum {string} */
                            bagColor: "amber" | "cyan" | "pink";
                        };
                        pipName: string | null;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description A value is not valid, or nothing was sent. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    listTrips: {
        parameters: {
            query?: {
                /** @description Include archived trips. */
                includeArchived?: "true" | "false";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The trips. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        trips: {
                            /**
                             * Format: uuid
                             * @description Trip id (UUID).
                             */
                            id: string;
                            title: string;
                            /**
                             * Format: date
                             * @description Calendar date, no time zone.
                             * @example 2027-04-03
                             */
                            startDate: string | null;
                            currency: string;
                            /** @enum {string} */
                            status: "active" | "traveling" | "completed" | "archived";
                            /** @enum {string} */
                            visibility: "private";
                            /** Format: date-time */
                            createdAt: string;
                            /** Format: date-time */
                            updatedAt: string;
                        }[];
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The query is not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    createTrip: {
        parameters: {
            query?: never;
            header?: {
                /** @description Client-chosen key that makes a retry safe. */
                "idempotency-key"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /**
                     * @description Trimmed, 1 to 120 characters.
                     * @example Japan 2027
                     */
                    title: string;
                    /**
                     * Format: date
                     * @description Calendar date, no time zone.
                     * @example 2027-04-03
                     */
                    startDate?: string | null;
                    /**
                     * @description ISO 4217 currency code. Defaults to USD.
                     * @example USD
                     */
                    currency?: string;
                };
            };
        };
        responses: {
            /** @description The trip. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * Format: uuid
                         * @description Trip id (UUID).
                         */
                        id: string;
                        title: string;
                        /**
                         * Format: date
                         * @description Calendar date, no time zone.
                         * @example 2027-04-03
                         */
                        startDate: string | null;
                        currency: string;
                        /** @enum {string} */
                        status: "active" | "traveling" | "completed" | "archived";
                        /** @enum {string} */
                        visibility: "private";
                        /** Format: date-time */
                        createdAt: string;
                        /** Format: date-time */
                        updatedAt: string;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The plan’s active trips are used (`TRIP_LIMIT_REACHED`) or the trial is over (`PLAN_REQUIRED`). */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The Idempotency-Key was already used with a different request. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The body or the header is not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    createTripFromExample: {
        parameters: {
            query?: never;
            header?: {
                /** @description Client-chosen key that makes a retry safe. */
                "idempotency-key"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /**
                     * @description Which example to copy.
                     * @enum {string}
                     */
                    exampleId: "japan" | "portugal" | "rio-de-la-plata";
                    /**
                     * @description The trip’s title in the person’s language. Defaults to the example’s English title.
                     * @example Japan 2027
                     */
                    title?: string;
                    /**
                     * @description The language for the stops’ names (`pt-BR` uses Portuguese names). Defaults to English.
                     * @enum {string}
                     */
                    locale?: "en" | "pt-BR";
                };
            };
        };
        responses: {
            /** @description The new trip. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * Format: uuid
                         * @description Trip id (UUID).
                         */
                        id: string;
                        title: string;
                        /**
                         * Format: date
                         * @description Calendar date, no time zone.
                         * @example 2027-04-03
                         */
                        startDate: string | null;
                        currency: string;
                        /** @enum {string} */
                        status: "active" | "traveling" | "completed" | "archived";
                        /** @enum {string} */
                        visibility: "private";
                        /** Format: date-time */
                        createdAt: string;
                        /** Format: date-time */
                        updatedAt: string;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The plan’s active trips are used (`TRIP_LIMIT_REACHED`) or the trial is over (`PLAN_REQUIRED`). */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The Idempotency-Key was already used with a different request. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The body or the header is not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    getTrip: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Trip id (UUID). */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The trip. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * Format: uuid
                         * @description Trip id (UUID).
                         */
                        id: string;
                        title: string;
                        /**
                         * Format: date
                         * @description Calendar date, no time zone.
                         * @example 2027-04-03
                         */
                        startDate: string | null;
                        currency: string;
                        /** @enum {string} */
                        status: "active" | "traveling" | "completed" | "archived";
                        /** @enum {string} */
                        visibility: "private";
                        /** Format: date-time */
                        createdAt: string;
                        /** Format: date-time */
                        updatedAt: string;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip, or it belongs to someone else. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The id is not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    deleteTrip: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Trip id (UUID). */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Done. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {boolean} */
                        ok: true;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip, or it belongs to someone else. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The trip is not archived (`not_archived`), or the id is not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    updateTrip: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Trip id (UUID). */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /**
                     * @description Trimmed, 1 to 120 characters.
                     * @example Japan 2027
                     */
                    title?: string;
                    /**
                     * Format: date
                     * @description Calendar date, no time zone.
                     * @example 2027-04-03
                     */
                    startDate?: string | null;
                    /**
                     * @description ISO 4217 currency code. Defaults to USD.
                     * @example USD
                     */
                    currency?: string;
                    /** @enum {string} */
                    status?: "active" | "traveling" | "completed" | "archived";
                };
            };
        };
        responses: {
            /** @description The trip. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * Format: uuid
                         * @description Trip id (UUID).
                         */
                        id: string;
                        title: string;
                        /**
                         * Format: date
                         * @description Calendar date, no time zone.
                         * @example 2027-04-03
                         */
                        startDate: string | null;
                        currency: string;
                        /** @enum {string} */
                        status: "active" | "traveling" | "completed" | "archived";
                        /** @enum {string} */
                        visibility: "private";
                        /** Format: date-time */
                        createdAt: string;
                        /** Format: date-time */
                        updatedAt: string;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip, or it belongs to someone else. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The id or the body is not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    archiveTrip: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Trip id (UUID). */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The trip. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * Format: uuid
                         * @description Trip id (UUID).
                         */
                        id: string;
                        title: string;
                        /**
                         * Format: date
                         * @description Calendar date, no time zone.
                         * @example 2027-04-03
                         */
                        startDate: string | null;
                        currency: string;
                        /** @enum {string} */
                        status: "active" | "traveling" | "completed" | "archived";
                        /** @enum {string} */
                        visibility: "private";
                        /** Format: date-time */
                        createdAt: string;
                        /** Format: date-time */
                        updatedAt: string;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip, or it belongs to someone else. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The id is not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    listDestinations: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Trip id (UUID). */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The route. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        destinations: {
                            /** Format: uuid */
                            id: string;
                            position: number;
                            placeKey: string;
                            name: string;
                            countryCode: string | null;
                            region: string | null;
                            latitude: number;
                            longitude: number;
                            nights: number;
                            note: string | null;
                            /** @enum {string|null} */
                            legMode: "flight" | "train" | "bus" | "car" | "boat" | "walk" | "other" | null;
                            visited: boolean;
                            spots: {
                                name: string;
                                latitude: number | null;
                                longitude: number | null;
                                done: boolean;
                            }[];
                            todos: {
                                text: string;
                                done: boolean;
                            }[];
                            photos: {
                                /** Format: uuid */
                                mediaId: string;
                                alt: string;
                            }[];
                        }[];
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip, or it belongs to someone else. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The id is not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    replaceDestinations: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Trip id (UUID). */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description The whole route, in order (at most 100 stops). */
                    destinations: {
                        /**
                         * @description The client’s stable key for the place.
                         * @example geoapify:51a1b2
                         */
                        placeKey: string;
                        /**
                         * @description Display name of the place.
                         * @example Kyoto
                         */
                        name: string;
                        /**
                         * @description ISO 3166-1 alpha-2, upper case.
                         * @example JP
                         */
                        countryCode?: string | null;
                        region?: string | null;
                        latitude: number;
                        longitude: number;
                        /**
                         * @description Nights spent here. Day trips are 0.
                         * @default 0
                         */
                        nights?: number;
                        /** @description The person’s note about the stop. Blank is no note. */
                        note?: string | null;
                        /**
                         * @description How they travel from this stop to the next. Ignored on the last stop.
                         * @enum {string|null}
                         */
                        legMode?: "flight" | "train" | "bus" | "car" | "boat" | "walk" | "other" | null;
                        /**
                         * @description The person marked it visited (their word, not a verification). The first visited stop in a country stamps a commemorative visa.
                         * @default false
                         */
                        visited?: boolean;
                        /**
                         * @description Places to see here (at most 30).
                         * @default []
                         */
                        spots?: {
                            /** @example Fushimi Inari */
                            name: string;
                            /** @default null */
                            latitude?: number | null;
                            /** @default null */
                            longitude?: number | null;
                            /** @default false */
                            done?: boolean;
                        }[];
                        /**
                         * @description Things to do for this stop (at most 30).
                         * @default []
                         */
                        todos?: {
                            /** @example Book the ryokan */
                            text: string;
                            /** @default false */
                            done?: boolean;
                        }[];
                        /**
                         * @description The stop's photos (at most 12): images the caller uploaded (`POST /v1/media`).
                         * @default []
                         */
                        photos?: {
                            /** Format: uuid */
                            mediaId: string;
                            /**
                             * @description What the photo shows, for people who cannot see it. Blank is allowed.
                             * @default
                             */
                            alt?: string;
                        }[];
                    }[];
                };
            };
        };
        responses: {
            /** @description The route as stored, and the visas it stamped. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        destinations: {
                            /** Format: uuid */
                            id: string;
                            position: number;
                            placeKey: string;
                            name: string;
                            countryCode: string | null;
                            region: string | null;
                            latitude: number;
                            longitude: number;
                            nights: number;
                            note: string | null;
                            /** @enum {string|null} */
                            legMode: "flight" | "train" | "bus" | "car" | "boat" | "walk" | "other" | null;
                            visited: boolean;
                            spots: {
                                name: string;
                                latitude: number | null;
                                longitude: number | null;
                                done: boolean;
                            }[];
                            todos: {
                                text: string;
                                done: boolean;
                            }[];
                            photos: {
                                /** Format: uuid */
                                mediaId: string;
                                alt: string;
                            }[];
                        }[];
                        stampedVisas: {
                            /** @example JP */
                            countryCode: string;
                            /**
                             * @description The stop that stamped it.
                             * @example Kyoto
                             */
                            city: string;
                            /** Format: date-time */
                            stampedAt: string;
                        }[];
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip, or it belongs to someone else. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The id or the body is not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    listVisas: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The visas, newest first. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description Commemorative Globetrot visas, newest first. Decorative: never an official document. */
                        visas: {
                            /** @example JP */
                            countryCode: string;
                            /**
                             * @description The stop that stamped it.
                             * @example Kyoto
                             */
                            city: string;
                            /** Format: date-time */
                            stampedAt: string;
                        }[];
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    getBudget: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Trip id (UUID). */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The budget. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        currency: string;
                        total: {
                            /**
                             * @description Major units, exact.
                             * @example 1250.00
                             */
                            amount: string;
                            currency: string;
                        };
                        byCategory: {
                            /** @enum {string} */
                            category: "flights" | "stay" | "local_transport" | "intercity_transport" | "food" | "experiences" | "insurance" | "documents" | "taxes" | "shopping" | "buffer" | "other";
                            amount: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            };
                        }[];
                        byStatus: {
                            /** @enum {string} */
                            status: "estimate" | "confirmed" | "paid" | "unknown";
                            amount: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            };
                        }[];
                        savings: {
                            /** @enum {string} */
                            status: "no-costs" | "fully-saved" | "saving";
                            saved: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            };
                            monthly: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            };
                            left: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            };
                            progressBasisPoints: number;
                            monthsNeeded: number | null;
                            readyMonth: string | null;
                            departure: string | null;
                            departed: boolean;
                            monthsUntilDeparture: number | null;
                            monthlyNeeded: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            } | null;
                            onTime: boolean | null;
                            ceiling: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            } | null;
                            ceilingSlack: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            } | null;
                        };
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip or cost, or it belongs to someone else. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The id is not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    listExpenses: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Trip id (UUID). */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The costs. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        expenses: {
                            /** Format: uuid */
                            id: string;
                            description: string;
                            /** @enum {string} */
                            category: "flights" | "stay" | "local_transport" | "intercity_transport" | "food" | "experiences" | "insurance" | "documents" | "taxes" | "shopping" | "buffer" | "other";
                            /** @enum {string} */
                            status: "estimate" | "confirmed" | "paid" | "unknown";
                            original: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            };
                            inTripCurrency: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            };
                            fx: {
                                rate: string;
                                source: string;
                                asOf: string;
                            } | null;
                            /** Format: date-time */
                            createdAt: string;
                        }[];
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip or cost, or it belongs to someone else. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The id is not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    createExpense: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Trip id (UUID). */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @example Flights to Tokyo */
                    description: string;
                    /** @enum {string} */
                    category: "flights" | "stay" | "local_transport" | "intercity_transport" | "food" | "experiences" | "insurance" | "documents" | "taxes" | "shopping" | "buffer" | "other";
                    /**
                     * @description estimate (≈), confirmed (✓), paid (●) or unknown (?).
                     * @enum {string}
                     */
                    status: "estimate" | "confirmed" | "paid" | "unknown";
                    /**
                     * @description Major units as a decimal string.
                     * @example 1250.00
                     */
                    amount: string;
                    /**
                     * @description ISO 4217 currency code. Defaults to USD.
                     * @example USD
                     */
                    currency: string;
                    /**
                     * @description Required when `currency` is not the trip’s: how much of the trip’s currency 1 unit of `currency` is worth.
                     * @example 0.0065
                     */
                    fxRate?: string | null;
                    /**
                     * Format: date
                     * @description The day the rate was taken. Defaults to today.
                     * @example 2027-04-03
                     */
                    fxAsOf?: string | null;
                };
            };
        };
        responses: {
            /** @description The cost. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        id: string;
                        description: string;
                        /** @enum {string} */
                        category: "flights" | "stay" | "local_transport" | "intercity_transport" | "food" | "experiences" | "insurance" | "documents" | "taxes" | "shopping" | "buffer" | "other";
                        /** @enum {string} */
                        status: "estimate" | "confirmed" | "paid" | "unknown";
                        original: {
                            /**
                             * @description Major units, exact.
                             * @example 1250.00
                             */
                            amount: string;
                            currency: string;
                        };
                        inTripCurrency: {
                            /**
                             * @description Major units, exact.
                             * @example 1250.00
                             */
                            amount: string;
                            currency: string;
                        };
                        fx: {
                            rate: string;
                            source: string;
                            asOf: string;
                        } | null;
                        /** Format: date-time */
                        createdAt: string;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip or cost, or it belongs to someone else. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The id or the body is not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    updateExpense: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Trip id (UUID). */
                id: string;
                expenseId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @example Flights to Tokyo */
                    description: string;
                    /** @enum {string} */
                    category: "flights" | "stay" | "local_transport" | "intercity_transport" | "food" | "experiences" | "insurance" | "documents" | "taxes" | "shopping" | "buffer" | "other";
                    /**
                     * @description estimate (≈), confirmed (✓), paid (●) or unknown (?).
                     * @enum {string}
                     */
                    status: "estimate" | "confirmed" | "paid" | "unknown";
                    /**
                     * @description Major units as a decimal string.
                     * @example 1250.00
                     */
                    amount: string;
                    /**
                     * @description ISO 4217 currency code. Defaults to USD.
                     * @example USD
                     */
                    currency: string;
                    /**
                     * @description Required when `currency` is not the trip’s: how much of the trip’s currency 1 unit of `currency` is worth.
                     * @example 0.0065
                     */
                    fxRate?: string | null;
                    /**
                     * Format: date
                     * @description The day the rate was taken. Defaults to today.
                     * @example 2027-04-03
                     */
                    fxAsOf?: string | null;
                };
            };
        };
        responses: {
            /** @description The cost. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        id: string;
                        description: string;
                        /** @enum {string} */
                        category: "flights" | "stay" | "local_transport" | "intercity_transport" | "food" | "experiences" | "insurance" | "documents" | "taxes" | "shopping" | "buffer" | "other";
                        /** @enum {string} */
                        status: "estimate" | "confirmed" | "paid" | "unknown";
                        original: {
                            /**
                             * @description Major units, exact.
                             * @example 1250.00
                             */
                            amount: string;
                            currency: string;
                        };
                        inTripCurrency: {
                            /**
                             * @description Major units, exact.
                             * @example 1250.00
                             */
                            amount: string;
                            currency: string;
                        };
                        fx: {
                            rate: string;
                            source: string;
                            asOf: string;
                        } | null;
                        /** Format: date-time */
                        createdAt: string;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip or cost, or it belongs to someone else. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids or the body are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    deleteExpense: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Trip id (UUID). */
                id: string;
                expenseId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Removed. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip or cost, or it belongs to someone else. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    updateSavings: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Trip id (UUID). */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /**
                     * @description Already set aside, in the trip’s currency.
                     * @example 300.00
                     */
                    saved?: string;
                    /**
                     * @description Planned monthly amount, in the trip’s currency.
                     * @example 300.00
                     */
                    monthly?: string;
                    /**
                     * @description The most the trip should cost, in the trip’s currency; null clears it.
                     * @example 300.00
                     */
                    ceiling?: string | null;
                };
            };
        };
        responses: {
            /** @description The budget. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        currency: string;
                        total: {
                            /**
                             * @description Major units, exact.
                             * @example 1250.00
                             */
                            amount: string;
                            currency: string;
                        };
                        byCategory: {
                            /** @enum {string} */
                            category: "flights" | "stay" | "local_transport" | "intercity_transport" | "food" | "experiences" | "insurance" | "documents" | "taxes" | "shopping" | "buffer" | "other";
                            amount: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            };
                        }[];
                        byStatus: {
                            /** @enum {string} */
                            status: "estimate" | "confirmed" | "paid" | "unknown";
                            amount: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            };
                        }[];
                        savings: {
                            /** @enum {string} */
                            status: "no-costs" | "fully-saved" | "saving";
                            saved: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            };
                            monthly: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            };
                            left: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            };
                            progressBasisPoints: number;
                            monthsNeeded: number | null;
                            readyMonth: string | null;
                            departure: string | null;
                            departed: boolean;
                            monthsUntilDeparture: number | null;
                            monthlyNeeded: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            } | null;
                            onTime: boolean | null;
                            ceiling: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            } | null;
                            ceilingSlack: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            } | null;
                        };
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip or cost, or it belongs to someone else. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The id or the body is not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    getChecklist: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Trip id (UUID). */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The lists and the readiness stamps. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: {
                            /** Format: uuid */
                            id: string;
                            /** @enum {string} */
                            group: "documents" | "money" | "bookings" | "packing";
                            label: string;
                            done: boolean;
                        }[];
                        readiness: {
                            dest?: boolean;
                            route?: boolean;
                            budget?: boolean;
                            saved?: boolean;
                            docs?: boolean;
                            stays?: boolean;
                            itin?: boolean;
                            check?: boolean;
                            ready?: boolean;
                        };
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip or item, or it belongs to someone else. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The id is not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    addChecklistItems: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Trip id (UUID). */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description One or several items, for example a suggested starter list. */
                    items: {
                        /** @enum {string} */
                        group: "documents" | "money" | "bookings" | "packing";
                        /** @example Passport valid for 6 months */
                        label: string;
                    }[];
                };
            };
        };
        responses: {
            /** @description The lists and the readiness stamps. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: {
                            /** Format: uuid */
                            id: string;
                            /** @enum {string} */
                            group: "documents" | "money" | "bookings" | "packing";
                            label: string;
                            done: boolean;
                        }[];
                        readiness: {
                            dest?: boolean;
                            route?: boolean;
                            budget?: boolean;
                            saved?: boolean;
                            docs?: boolean;
                            stays?: boolean;
                            itin?: boolean;
                            check?: boolean;
                            ready?: boolean;
                        };
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip or item, or it belongs to someone else. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The id or the body is not valid, or the trip’s lists are full. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    deleteChecklistItem: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Trip id (UUID). */
                id: string;
                itemId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The lists and the readiness stamps. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: {
                            /** Format: uuid */
                            id: string;
                            /** @enum {string} */
                            group: "documents" | "money" | "bookings" | "packing";
                            label: string;
                            done: boolean;
                        }[];
                        readiness: {
                            dest?: boolean;
                            route?: boolean;
                            budget?: boolean;
                            saved?: boolean;
                            docs?: boolean;
                            stays?: boolean;
                            itin?: boolean;
                            check?: boolean;
                            ready?: boolean;
                        };
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip or item, or it belongs to someone else. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    updateChecklistItem: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Trip id (UUID). */
                id: string;
                itemId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    done?: boolean;
                    /** @example Passport valid for 6 months */
                    label?: string;
                };
            };
        };
        responses: {
            /** @description The lists and the readiness stamps. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: {
                            /** Format: uuid */
                            id: string;
                            /** @enum {string} */
                            group: "documents" | "money" | "bookings" | "packing";
                            label: string;
                            done: boolean;
                        }[];
                        readiness: {
                            dest?: boolean;
                            route?: boolean;
                            budget?: boolean;
                            saved?: boolean;
                            docs?: boolean;
                            stays?: boolean;
                            itin?: boolean;
                            check?: boolean;
                            ready?: boolean;
                        };
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip or item, or it belongs to someone else. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids or the body are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    suggestDayPlaces: {
        parameters: {
            query?: {
                language?: "en" | "pt-BR";
            };
            header?: never;
            path: {
                /** @description Trip id (UUID). */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Ideas per stop. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        stops: {
                            stopId: string;
                            ideas: {
                                name: string;
                                /** @enum {string} */
                                kind: "landmark" | "museum" | "park" | "viewpoint" | "neighbourhood" | "market" | "beach" | "daytrip";
                                minutes: number;
                            }[];
                            /** @enum {string|null} */
                            source: "provider" | "built-in" | null;
                            attribution: string | null;
                        }[];
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip or place, or it belongs to someone else. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description Too many requests. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    listDayPlaces: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Trip id (UUID). */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The trip’s places to see, in trip order, each on a day or on "No day". */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        places: {
                            /** Format: uuid */
                            id: string;
                            /** Format: uuid */
                            destinationId: string | null;
                            name: string;
                            minutes: number;
                            day: number | null;
                        }[];
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip or place, or it belongs to someone else. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The id is not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    addDayPlace: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Trip id (UUID). */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @example Fushimi Inari */
                    name: string;
                    /** Format: uuid */
                    destinationId?: string | null;
                    /**
                     * @description Estimated time there, 15 minutes to 12 hours.
                     * @example 120
                     */
                    minutes: number;
                };
            };
        };
        responses: {
            /** @description The trip’s places to see, in trip order, each on a day or on "No day". */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        places: {
                            /** Format: uuid */
                            id: string;
                            /** Format: uuid */
                            destinationId: string | null;
                            name: string;
                            minutes: number;
                            day: number | null;
                        }[];
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip or place, or it belongs to someone else. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The id or the body is not valid, the stop is not on the trip, or the plan is full. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    removeDayPlace: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Trip id (UUID). */
                id: string;
                placeId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The trip’s places to see, in trip order, each on a day or on "No day". */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        places: {
                            /** Format: uuid */
                            id: string;
                            /** Format: uuid */
                            destinationId: string | null;
                            name: string;
                            minutes: number;
                            day: number | null;
                        }[];
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip or place, or it belongs to someone else. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    moveDayPlace: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Trip id (UUID). */
                id: string;
                placeId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    day: number | null;
                    /** Format: uuid */
                    beforeId?: string;
                };
            };
        };
        responses: {
            /** @description The trip’s places to see, in trip order, each on a day or on "No day". */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        places: {
                            /** Format: uuid */
                            id: string;
                            /** Format: uuid */
                            destinationId: string | null;
                            name: string;
                            minutes: number;
                            day: number | null;
                        }[];
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip or place, or it belongs to someone else. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids or the body are not valid, or the day is not on the route. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    searchPlaces: {
        parameters: {
            query: {
                query: string;
                /** @description Language for place names. */
                language?: "en" | "pt-BR";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Up to 8 places. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        places: {
                            /** @description Stable key of the place (use it as `placeKey`). */
                            key: string;
                            name: string;
                            countryCode: string | null;
                            region: string | null;
                            latitude: number;
                            longitude: number;
                            /** @example © OpenStreetMap contributors · Geoapify */
                            attribution: string;
                        }[];
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The query is not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description Too many lookups in a minute. Wait and try again. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description Place search is not configured or the provider is not answering. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    reversePlace: {
        parameters: {
            query?: {
                latitude?: number | null;
                longitude?: number | null;
                /** @description Language for place names. */
                language?: "en" | "pt-BR";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The place, or null. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        place: {
                            /** @description Stable key of the place (use it as `placeKey`). */
                            key: string;
                            name: string;
                            countryCode: string | null;
                            region: string | null;
                            latitude: number;
                            longitude: number;
                            /** @example © OpenStreetMap contributors · Geoapify */
                            attribution: string;
                        } | null;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The query is not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description Too many lookups in a minute. Wait and try again. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description Place search is not configured or the provider is not answering. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    listFeed: {
        parameters: {
            query?: {
                feed?: "all" | "following";
                before?: string;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description A page of posts. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        posts: {
                            /** Format: uuid */
                            id: string;
                            /** @enum {string} */
                            kind: "moment" | "tip" | "route" | "visa" | "goal";
                            body: string;
                            place: {
                                name: string;
                                countryCode: string | null;
                            } | null;
                            /** @enum {string} */
                            audience: "everyone" | "followers";
                            attachment: {
                                /** @enum {string} */
                                kind: "route";
                                title: string;
                                nights: number;
                                stops: {
                                    name: string;
                                    countryCode: string | null;
                                    nights: number;
                                }[];
                                total: {
                                    /**
                                     * @description Major units, exact.
                                     * @example 1250.00
                                     */
                                    amount: string;
                                    currency: string;
                                } | null;
                            } | {
                                /** @enum {string} */
                                kind: "visa";
                                countryCode: string;
                                city: string;
                                /** Format: date-time */
                                stampedAt: string;
                                ordinal: number;
                            } | {
                                /** @enum {string} */
                                kind: "goal";
                                tripTitle: string;
                                readyMonth: string;
                                reached: boolean;
                            } | null;
                            photos: {
                                /** Format: uuid */
                                mediaId: string;
                                alt: string;
                            }[];
                            /** Format: date-time */
                            createdAt: string;
                            /** Format: date-time */
                            editedAt: string | null;
                            author: {
                                handle: string;
                                name: string;
                                pipLook: {
                                    /** @enum {string} */
                                    hat: "straw" | "helmet" | "cap" | "none";
                                    /** @enum {string} */
                                    outfit: "none" | "scarf" | "aloha" | "vest";
                                    /** @enum {string} */
                                    bag: "trolley" | "backpack" | "vintage";
                                    /** @enum {string} */
                                    bagColor: "amber" | "cyan" | "pink";
                                };
                            };
                            mine: boolean;
                            following: boolean;
                            likes: number;
                            liked: boolean;
                            saved: boolean;
                            comments: number;
                            likedBy: {
                                handle: string;
                                name: string;
                                pipLook: {
                                    /** @enum {string} */
                                    hat: "straw" | "helmet" | "cap" | "none";
                                    /** @enum {string} */
                                    outfit: "none" | "scarf" | "aloha" | "vest";
                                    /** @enum {string} */
                                    bag: "trolley" | "backpack" | "vintage";
                                    /** @enum {string} */
                                    bagColor: "amber" | "cyan" | "pink";
                                };
                            } | null;
                        }[];
                        /** Format: uuid */
                        nextBefore: string | null;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids or the body are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    getCommunityMe: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Handle and counts. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        handle: string | null;
                        suggestedHandle: string;
                        posts: number;
                        followers: number;
                        following: number;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    updateHandle: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @example ana.mochila */
                    handle: string;
                };
            };
        };
        responses: {
            /** @description Handle and counts. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        handle: string | null;
                        suggestedHandle: string;
                        posts: number;
                        followers: number;
                        following: number;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The handle is not valid or is taken (`handle_taken`). */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    getDiscover: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Suggestions. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        suggestions: {
                            person: {
                                handle: string;
                                name: string;
                                pipLook: {
                                    /** @enum {string} */
                                    hat: "straw" | "helmet" | "cap" | "none";
                                    /** @enum {string} */
                                    outfit: "none" | "scarf" | "aloha" | "vest";
                                    /** @enum {string} */
                                    bag: "trolley" | "backpack" | "vintage";
                                    /** @enum {string} */
                                    bagColor: "amber" | "cyan" | "pink";
                                };
                            };
                            posts: number;
                        }[];
                        trending: {
                            countryCode: string;
                            posts: number;
                        }[];
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    createPost: {
        parameters: {
            query?: never;
            header?: {
                /** @description Client-chosen key that makes a retry safe. */
                "idempotency-key"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    kind: "moment" | "tip" | "route" | "visa" | "goal";
                    /** @default  */
                    body?: string;
                    place?: {
                        name: string;
                        countryCode?: string | null;
                    } | null;
                    /**
                     * @default everyone
                     * @enum {string}
                     */
                    audience?: "everyone" | "followers";
                    /** Format: uuid */
                    tripId?: string;
                    /** @default false */
                    showAmounts?: boolean;
                    /** @default [] */
                    photos?: {
                        /** Format: uuid */
                        mediaId: string;
                        /**
                         * @description What the photo shows, for people who cannot see it. Blank is allowed.
                         * @default
                         */
                        alt?: string;
                    }[];
                    visaCountry?: string;
                };
            };
        };
        responses: {
            /** @description The post as others will read it. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        id: string;
                        /** @enum {string} */
                        kind: "moment" | "tip" | "route" | "visa" | "goal";
                        body: string;
                        place: {
                            name: string;
                            countryCode: string | null;
                        } | null;
                        /** @enum {string} */
                        audience: "everyone" | "followers";
                        attachment: {
                            /** @enum {string} */
                            kind: "route";
                            title: string;
                            nights: number;
                            stops: {
                                name: string;
                                countryCode: string | null;
                                nights: number;
                            }[];
                            total: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            } | null;
                        } | {
                            /** @enum {string} */
                            kind: "visa";
                            countryCode: string;
                            city: string;
                            /** Format: date-time */
                            stampedAt: string;
                            ordinal: number;
                        } | {
                            /** @enum {string} */
                            kind: "goal";
                            tripTitle: string;
                            readyMonth: string;
                            reached: boolean;
                        } | null;
                        photos: {
                            /** Format: uuid */
                            mediaId: string;
                            alt: string;
                        }[];
                        /** Format: date-time */
                        createdAt: string;
                        /** Format: date-time */
                        editedAt: string | null;
                        author: {
                            handle: string;
                            name: string;
                            pipLook: {
                                /** @enum {string} */
                                hat: "straw" | "helmet" | "cap" | "none";
                                /** @enum {string} */
                                outfit: "none" | "scarf" | "aloha" | "vest";
                                /** @enum {string} */
                                bag: "trolley" | "backpack" | "vintage";
                                /** @enum {string} */
                                bagColor: "amber" | "cyan" | "pink";
                            };
                        };
                        mine: boolean;
                        following: boolean;
                        likes: number;
                        liked: boolean;
                        saved: boolean;
                        comments: number;
                        likedBy: {
                            handle: string;
                            name: string;
                            pipLook: {
                                /** @enum {string} */
                                hat: "straw" | "helmet" | "cap" | "none";
                                /** @enum {string} */
                                outfit: "none" | "scarf" | "aloha" | "vest";
                                /** @enum {string} */
                                bag: "trolley" | "backpack" | "vintage";
                                /** @enum {string} */
                                bagColor: "amber" | "cyan" | "pink";
                            };
                        } | null;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip, or it belongs to someone else. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The Idempotency-Key was already used with a different request. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids or the body are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description Too many posts today. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    getPost: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                postId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The post. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        id: string;
                        /** @enum {string} */
                        kind: "moment" | "tip" | "route" | "visa" | "goal";
                        body: string;
                        place: {
                            name: string;
                            countryCode: string | null;
                        } | null;
                        /** @enum {string} */
                        audience: "everyone" | "followers";
                        attachment: {
                            /** @enum {string} */
                            kind: "route";
                            title: string;
                            nights: number;
                            stops: {
                                name: string;
                                countryCode: string | null;
                                nights: number;
                            }[];
                            total: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            } | null;
                        } | {
                            /** @enum {string} */
                            kind: "visa";
                            countryCode: string;
                            city: string;
                            /** Format: date-time */
                            stampedAt: string;
                            ordinal: number;
                        } | {
                            /** @enum {string} */
                            kind: "goal";
                            tripTitle: string;
                            readyMonth: string;
                            reached: boolean;
                        } | null;
                        photos: {
                            /** Format: uuid */
                            mediaId: string;
                            alt: string;
                        }[];
                        /** Format: date-time */
                        createdAt: string;
                        /** Format: date-time */
                        editedAt: string | null;
                        author: {
                            handle: string;
                            name: string;
                            pipLook: {
                                /** @enum {string} */
                                hat: "straw" | "helmet" | "cap" | "none";
                                /** @enum {string} */
                                outfit: "none" | "scarf" | "aloha" | "vest";
                                /** @enum {string} */
                                bag: "trolley" | "backpack" | "vintage";
                                /** @enum {string} */
                                bagColor: "amber" | "cyan" | "pink";
                            };
                        };
                        mine: boolean;
                        following: boolean;
                        likes: number;
                        liked: boolean;
                        saved: boolean;
                        comments: number;
                        likedBy: {
                            handle: string;
                            name: string;
                            pipLook: {
                                /** @enum {string} */
                                hat: "straw" | "helmet" | "cap" | "none";
                                /** @enum {string} */
                                outfit: "none" | "scarf" | "aloha" | "vest";
                                /** @enum {string} */
                                bag: "trolley" | "backpack" | "vintage";
                                /** @enum {string} */
                                bagColor: "amber" | "cyan" | "pink";
                            };
                        } | null;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such post, comment or person, or the session may not see it (answered the same way). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids or the body are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    deletePost: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                postId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Done. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {boolean} */
                        ok: true;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such post, comment or person, or the session may not see it (answered the same way). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids or the body are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    updatePost: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                postId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    body: string;
                };
            };
        };
        responses: {
            /** @description The post. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        id: string;
                        /** @enum {string} */
                        kind: "moment" | "tip" | "route" | "visa" | "goal";
                        body: string;
                        place: {
                            name: string;
                            countryCode: string | null;
                        } | null;
                        /** @enum {string} */
                        audience: "everyone" | "followers";
                        attachment: {
                            /** @enum {string} */
                            kind: "route";
                            title: string;
                            nights: number;
                            stops: {
                                name: string;
                                countryCode: string | null;
                                nights: number;
                            }[];
                            total: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            } | null;
                        } | {
                            /** @enum {string} */
                            kind: "visa";
                            countryCode: string;
                            city: string;
                            /** Format: date-time */
                            stampedAt: string;
                            ordinal: number;
                        } | {
                            /** @enum {string} */
                            kind: "goal";
                            tripTitle: string;
                            readyMonth: string;
                            reached: boolean;
                        } | null;
                        photos: {
                            /** Format: uuid */
                            mediaId: string;
                            alt: string;
                        }[];
                        /** Format: date-time */
                        createdAt: string;
                        /** Format: date-time */
                        editedAt: string | null;
                        author: {
                            handle: string;
                            name: string;
                            pipLook: {
                                /** @enum {string} */
                                hat: "straw" | "helmet" | "cap" | "none";
                                /** @enum {string} */
                                outfit: "none" | "scarf" | "aloha" | "vest";
                                /** @enum {string} */
                                bag: "trolley" | "backpack" | "vintage";
                                /** @enum {string} */
                                bagColor: "amber" | "cyan" | "pink";
                            };
                        };
                        mine: boolean;
                        following: boolean;
                        likes: number;
                        liked: boolean;
                        saved: boolean;
                        comments: number;
                        likedBy: {
                            handle: string;
                            name: string;
                            pipLook: {
                                /** @enum {string} */
                                hat: "straw" | "helmet" | "cap" | "none";
                                /** @enum {string} */
                                outfit: "none" | "scarf" | "aloha" | "vest";
                                /** @enum {string} */
                                bag: "trolley" | "backpack" | "vintage";
                                /** @enum {string} */
                                bagColor: "amber" | "cyan" | "pink";
                            };
                        } | null;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such post, comment or person, or the session may not see it (answered the same way). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids or the body are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    restorePost: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                postId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Done. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {boolean} */
                        ok: true;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such post, comment or person, or the session may not see it (answered the same way). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids or the body are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    addLike: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                postId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The post after the change. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        id: string;
                        /** @enum {string} */
                        kind: "moment" | "tip" | "route" | "visa" | "goal";
                        body: string;
                        place: {
                            name: string;
                            countryCode: string | null;
                        } | null;
                        /** @enum {string} */
                        audience: "everyone" | "followers";
                        attachment: {
                            /** @enum {string} */
                            kind: "route";
                            title: string;
                            nights: number;
                            stops: {
                                name: string;
                                countryCode: string | null;
                                nights: number;
                            }[];
                            total: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            } | null;
                        } | {
                            /** @enum {string} */
                            kind: "visa";
                            countryCode: string;
                            city: string;
                            /** Format: date-time */
                            stampedAt: string;
                            ordinal: number;
                        } | {
                            /** @enum {string} */
                            kind: "goal";
                            tripTitle: string;
                            readyMonth: string;
                            reached: boolean;
                        } | null;
                        photos: {
                            /** Format: uuid */
                            mediaId: string;
                            alt: string;
                        }[];
                        /** Format: date-time */
                        createdAt: string;
                        /** Format: date-time */
                        editedAt: string | null;
                        author: {
                            handle: string;
                            name: string;
                            pipLook: {
                                /** @enum {string} */
                                hat: "straw" | "helmet" | "cap" | "none";
                                /** @enum {string} */
                                outfit: "none" | "scarf" | "aloha" | "vest";
                                /** @enum {string} */
                                bag: "trolley" | "backpack" | "vintage";
                                /** @enum {string} */
                                bagColor: "amber" | "cyan" | "pink";
                            };
                        };
                        mine: boolean;
                        following: boolean;
                        likes: number;
                        liked: boolean;
                        saved: boolean;
                        comments: number;
                        likedBy: {
                            handle: string;
                            name: string;
                            pipLook: {
                                /** @enum {string} */
                                hat: "straw" | "helmet" | "cap" | "none";
                                /** @enum {string} */
                                outfit: "none" | "scarf" | "aloha" | "vest";
                                /** @enum {string} */
                                bag: "trolley" | "backpack" | "vintage";
                                /** @enum {string} */
                                bagColor: "amber" | "cyan" | "pink";
                            };
                        } | null;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such post, comment or person, or the session may not see it (answered the same way). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids or the body are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    removeLike: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                postId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The post after the change. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        id: string;
                        /** @enum {string} */
                        kind: "moment" | "tip" | "route" | "visa" | "goal";
                        body: string;
                        place: {
                            name: string;
                            countryCode: string | null;
                        } | null;
                        /** @enum {string} */
                        audience: "everyone" | "followers";
                        attachment: {
                            /** @enum {string} */
                            kind: "route";
                            title: string;
                            nights: number;
                            stops: {
                                name: string;
                                countryCode: string | null;
                                nights: number;
                            }[];
                            total: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            } | null;
                        } | {
                            /** @enum {string} */
                            kind: "visa";
                            countryCode: string;
                            city: string;
                            /** Format: date-time */
                            stampedAt: string;
                            ordinal: number;
                        } | {
                            /** @enum {string} */
                            kind: "goal";
                            tripTitle: string;
                            readyMonth: string;
                            reached: boolean;
                        } | null;
                        photos: {
                            /** Format: uuid */
                            mediaId: string;
                            alt: string;
                        }[];
                        /** Format: date-time */
                        createdAt: string;
                        /** Format: date-time */
                        editedAt: string | null;
                        author: {
                            handle: string;
                            name: string;
                            pipLook: {
                                /** @enum {string} */
                                hat: "straw" | "helmet" | "cap" | "none";
                                /** @enum {string} */
                                outfit: "none" | "scarf" | "aloha" | "vest";
                                /** @enum {string} */
                                bag: "trolley" | "backpack" | "vintage";
                                /** @enum {string} */
                                bagColor: "amber" | "cyan" | "pink";
                            };
                        };
                        mine: boolean;
                        following: boolean;
                        likes: number;
                        liked: boolean;
                        saved: boolean;
                        comments: number;
                        likedBy: {
                            handle: string;
                            name: string;
                            pipLook: {
                                /** @enum {string} */
                                hat: "straw" | "helmet" | "cap" | "none";
                                /** @enum {string} */
                                outfit: "none" | "scarf" | "aloha" | "vest";
                                /** @enum {string} */
                                bag: "trolley" | "backpack" | "vintage";
                                /** @enum {string} */
                                bagColor: "amber" | "cyan" | "pink";
                            };
                        } | null;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such post, comment or person, or the session may not see it (answered the same way). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids or the body are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    addSave: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                postId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The post after the change. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        id: string;
                        /** @enum {string} */
                        kind: "moment" | "tip" | "route" | "visa" | "goal";
                        body: string;
                        place: {
                            name: string;
                            countryCode: string | null;
                        } | null;
                        /** @enum {string} */
                        audience: "everyone" | "followers";
                        attachment: {
                            /** @enum {string} */
                            kind: "route";
                            title: string;
                            nights: number;
                            stops: {
                                name: string;
                                countryCode: string | null;
                                nights: number;
                            }[];
                            total: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            } | null;
                        } | {
                            /** @enum {string} */
                            kind: "visa";
                            countryCode: string;
                            city: string;
                            /** Format: date-time */
                            stampedAt: string;
                            ordinal: number;
                        } | {
                            /** @enum {string} */
                            kind: "goal";
                            tripTitle: string;
                            readyMonth: string;
                            reached: boolean;
                        } | null;
                        photos: {
                            /** Format: uuid */
                            mediaId: string;
                            alt: string;
                        }[];
                        /** Format: date-time */
                        createdAt: string;
                        /** Format: date-time */
                        editedAt: string | null;
                        author: {
                            handle: string;
                            name: string;
                            pipLook: {
                                /** @enum {string} */
                                hat: "straw" | "helmet" | "cap" | "none";
                                /** @enum {string} */
                                outfit: "none" | "scarf" | "aloha" | "vest";
                                /** @enum {string} */
                                bag: "trolley" | "backpack" | "vintage";
                                /** @enum {string} */
                                bagColor: "amber" | "cyan" | "pink";
                            };
                        };
                        mine: boolean;
                        following: boolean;
                        likes: number;
                        liked: boolean;
                        saved: boolean;
                        comments: number;
                        likedBy: {
                            handle: string;
                            name: string;
                            pipLook: {
                                /** @enum {string} */
                                hat: "straw" | "helmet" | "cap" | "none";
                                /** @enum {string} */
                                outfit: "none" | "scarf" | "aloha" | "vest";
                                /** @enum {string} */
                                bag: "trolley" | "backpack" | "vintage";
                                /** @enum {string} */
                                bagColor: "amber" | "cyan" | "pink";
                            };
                        } | null;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such post, comment or person, or the session may not see it (answered the same way). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids or the body are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    removeSave: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                postId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The post after the change. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        id: string;
                        /** @enum {string} */
                        kind: "moment" | "tip" | "route" | "visa" | "goal";
                        body: string;
                        place: {
                            name: string;
                            countryCode: string | null;
                        } | null;
                        /** @enum {string} */
                        audience: "everyone" | "followers";
                        attachment: {
                            /** @enum {string} */
                            kind: "route";
                            title: string;
                            nights: number;
                            stops: {
                                name: string;
                                countryCode: string | null;
                                nights: number;
                            }[];
                            total: {
                                /**
                                 * @description Major units, exact.
                                 * @example 1250.00
                                 */
                                amount: string;
                                currency: string;
                            } | null;
                        } | {
                            /** @enum {string} */
                            kind: "visa";
                            countryCode: string;
                            city: string;
                            /** Format: date-time */
                            stampedAt: string;
                            ordinal: number;
                        } | {
                            /** @enum {string} */
                            kind: "goal";
                            tripTitle: string;
                            readyMonth: string;
                            reached: boolean;
                        } | null;
                        photos: {
                            /** Format: uuid */
                            mediaId: string;
                            alt: string;
                        }[];
                        /** Format: date-time */
                        createdAt: string;
                        /** Format: date-time */
                        editedAt: string | null;
                        author: {
                            handle: string;
                            name: string;
                            pipLook: {
                                /** @enum {string} */
                                hat: "straw" | "helmet" | "cap" | "none";
                                /** @enum {string} */
                                outfit: "none" | "scarf" | "aloha" | "vest";
                                /** @enum {string} */
                                bag: "trolley" | "backpack" | "vintage";
                                /** @enum {string} */
                                bagColor: "amber" | "cyan" | "pink";
                            };
                        };
                        mine: boolean;
                        following: boolean;
                        likes: number;
                        liked: boolean;
                        saved: boolean;
                        comments: number;
                        likedBy: {
                            handle: string;
                            name: string;
                            pipLook: {
                                /** @enum {string} */
                                hat: "straw" | "helmet" | "cap" | "none";
                                /** @enum {string} */
                                outfit: "none" | "scarf" | "aloha" | "vest";
                                /** @enum {string} */
                                bag: "trolley" | "backpack" | "vintage";
                                /** @enum {string} */
                                bagColor: "amber" | "cyan" | "pink";
                            };
                        } | null;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such post, comment or person, or the session may not see it (answered the same way). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids or the body are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    listComments: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                postId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The comments. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        comments: {
                            /** Format: uuid */
                            id: string;
                            body: string;
                            /** Format: date-time */
                            createdAt: string;
                            author: {
                                handle: string;
                                name: string;
                                pipLook: {
                                    /** @enum {string} */
                                    hat: "straw" | "helmet" | "cap" | "none";
                                    /** @enum {string} */
                                    outfit: "none" | "scarf" | "aloha" | "vest";
                                    /** @enum {string} */
                                    bag: "trolley" | "backpack" | "vintage";
                                    /** @enum {string} */
                                    bagColor: "amber" | "cyan" | "pink";
                                };
                            };
                            mine: boolean;
                            canDelete: boolean;
                            likes: number;
                            liked: boolean;
                        }[];
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such post, comment or person, or the session may not see it (answered the same way). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids or the body are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    addComment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                postId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    body: string;
                };
            };
        };
        responses: {
            /** @description The new comment’s id. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        id: string;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such post, comment or person, or the session may not see it (answered the same way). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids or the body are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description Too many comments today. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    reportPost: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                postId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    reason: "spam" | "abuse" | "unsafe" | "other";
                };
            };
        };
        responses: {
            /** @description Done. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {boolean} */
                        ok: true;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such post, comment or person, or the session may not see it (answered the same way). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids or the body are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    copyRoute: {
        parameters: {
            query?: never;
            header?: {
                /** @description Client-chosen key that makes a retry safe. */
                "idempotency-key"?: string;
            };
            path: {
                postId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The new trip. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * Format: uuid
                         * @description Trip id (UUID).
                         */
                        id: string;
                        title: string;
                        /**
                         * Format: date
                         * @description Calendar date, no time zone.
                         * @example 2027-04-03
                         */
                        startDate: string | null;
                        currency: string;
                        /** @enum {string} */
                        status: "active" | "traveling" | "completed" | "archived";
                        /** @enum {string} */
                        visibility: "private";
                        /** Format: date-time */
                        createdAt: string;
                        /** Format: date-time */
                        updatedAt: string;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such route post, or the session may not see it. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The Idempotency-Key was already used with a different request. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids or the body are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    deleteComment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                commentId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Done. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {boolean} */
                        ok: true;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such post, comment or person, or the session may not see it (answered the same way). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids or the body are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    restoreComment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                commentId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Done. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {boolean} */
                        ok: true;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such post, comment or person, or the session may not see it (answered the same way). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids or the body are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    addCommentLike: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                commentId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Done. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {boolean} */
                        ok: true;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such post, comment or person, or the session may not see it (answered the same way). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids or the body are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    removeCommentLike: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                commentId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Done. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {boolean} */
                        ok: true;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such post, comment or person, or the session may not see it (answered the same way). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids or the body are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    getPerson: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                handle: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The person and their counts. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        person: {
                            handle: string;
                            name: string;
                            pipLook: {
                                /** @enum {string} */
                                hat: "straw" | "helmet" | "cap" | "none";
                                /** @enum {string} */
                                outfit: "none" | "scarf" | "aloha" | "vest";
                                /** @enum {string} */
                                bag: "trolley" | "backpack" | "vintage";
                                /** @enum {string} */
                                bagColor: "amber" | "cyan" | "pink";
                            };
                        };
                        posts: number;
                        followers: number;
                        following: number;
                        followed: boolean;
                        muted: boolean;
                        mine: boolean;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such post, comment or person, or the session may not see it (answered the same way). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids or the body are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    listPersonPosts: {
        parameters: {
            query?: {
                before?: string;
                limit?: number;
            };
            header?: never;
            path: {
                handle: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description A page of posts. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        posts: {
                            /** Format: uuid */
                            id: string;
                            /** @enum {string} */
                            kind: "moment" | "tip" | "route" | "visa" | "goal";
                            body: string;
                            place: {
                                name: string;
                                countryCode: string | null;
                            } | null;
                            /** @enum {string} */
                            audience: "everyone" | "followers";
                            attachment: {
                                /** @enum {string} */
                                kind: "route";
                                title: string;
                                nights: number;
                                stops: {
                                    name: string;
                                    countryCode: string | null;
                                    nights: number;
                                }[];
                                total: {
                                    /**
                                     * @description Major units, exact.
                                     * @example 1250.00
                                     */
                                    amount: string;
                                    currency: string;
                                } | null;
                            } | {
                                /** @enum {string} */
                                kind: "visa";
                                countryCode: string;
                                city: string;
                                /** Format: date-time */
                                stampedAt: string;
                                ordinal: number;
                            } | {
                                /** @enum {string} */
                                kind: "goal";
                                tripTitle: string;
                                readyMonth: string;
                                reached: boolean;
                            } | null;
                            photos: {
                                /** Format: uuid */
                                mediaId: string;
                                alt: string;
                            }[];
                            /** Format: date-time */
                            createdAt: string;
                            /** Format: date-time */
                            editedAt: string | null;
                            author: {
                                handle: string;
                                name: string;
                                pipLook: {
                                    /** @enum {string} */
                                    hat: "straw" | "helmet" | "cap" | "none";
                                    /** @enum {string} */
                                    outfit: "none" | "scarf" | "aloha" | "vest";
                                    /** @enum {string} */
                                    bag: "trolley" | "backpack" | "vintage";
                                    /** @enum {string} */
                                    bagColor: "amber" | "cyan" | "pink";
                                };
                            };
                            mine: boolean;
                            following: boolean;
                            likes: number;
                            liked: boolean;
                            saved: boolean;
                            comments: number;
                            likedBy: {
                                handle: string;
                                name: string;
                                pipLook: {
                                    /** @enum {string} */
                                    hat: "straw" | "helmet" | "cap" | "none";
                                    /** @enum {string} */
                                    outfit: "none" | "scarf" | "aloha" | "vest";
                                    /** @enum {string} */
                                    bag: "trolley" | "backpack" | "vintage";
                                    /** @enum {string} */
                                    bagColor: "amber" | "cyan" | "pink";
                                };
                            } | null;
                        }[];
                        /** Format: uuid */
                        nextBefore: string | null;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such post, comment or person, or the session may not see it (answered the same way). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids or the body are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    followPerson: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                handle: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The person after the change. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        person: {
                            handle: string;
                            name: string;
                            pipLook: {
                                /** @enum {string} */
                                hat: "straw" | "helmet" | "cap" | "none";
                                /** @enum {string} */
                                outfit: "none" | "scarf" | "aloha" | "vest";
                                /** @enum {string} */
                                bag: "trolley" | "backpack" | "vintage";
                                /** @enum {string} */
                                bagColor: "amber" | "cyan" | "pink";
                            };
                        };
                        posts: number;
                        followers: number;
                        following: number;
                        followed: boolean;
                        muted: boolean;
                        mine: boolean;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such post, comment or person, or the session may not see it (answered the same way). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids or the body are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    unfollowPerson: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                handle: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The person after the change. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        person: {
                            handle: string;
                            name: string;
                            pipLook: {
                                /** @enum {string} */
                                hat: "straw" | "helmet" | "cap" | "none";
                                /** @enum {string} */
                                outfit: "none" | "scarf" | "aloha" | "vest";
                                /** @enum {string} */
                                bag: "trolley" | "backpack" | "vintage";
                                /** @enum {string} */
                                bagColor: "amber" | "cyan" | "pink";
                            };
                        };
                        posts: number;
                        followers: number;
                        following: number;
                        followed: boolean;
                        muted: boolean;
                        mine: boolean;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such post, comment or person, or the session may not see it (answered the same way). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids or the body are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    mutePerson: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                handle: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The person after the change. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        person: {
                            handle: string;
                            name: string;
                            pipLook: {
                                /** @enum {string} */
                                hat: "straw" | "helmet" | "cap" | "none";
                                /** @enum {string} */
                                outfit: "none" | "scarf" | "aloha" | "vest";
                                /** @enum {string} */
                                bag: "trolley" | "backpack" | "vintage";
                                /** @enum {string} */
                                bagColor: "amber" | "cyan" | "pink";
                            };
                        };
                        posts: number;
                        followers: number;
                        following: number;
                        followed: boolean;
                        muted: boolean;
                        mine: boolean;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such post, comment or person, or the session may not see it (answered the same way). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids or the body are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    unmutePerson: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                handle: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The person after the change. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        person: {
                            handle: string;
                            name: string;
                            pipLook: {
                                /** @enum {string} */
                                hat: "straw" | "helmet" | "cap" | "none";
                                /** @enum {string} */
                                outfit: "none" | "scarf" | "aloha" | "vest";
                                /** @enum {string} */
                                bag: "trolley" | "backpack" | "vintage";
                                /** @enum {string} */
                                bagColor: "amber" | "cyan" | "pink";
                            };
                        };
                        posts: number;
                        followers: number;
                        following: number;
                        followed: boolean;
                        muted: boolean;
                        mine: boolean;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such post, comment or person, or the session may not see it (answered the same way). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The ids or the body are not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    uploadMedia: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "image/jpeg": string;
                "image/png": string;
                "image/webp": string;
            };
        };
        responses: {
            /** @description The stored image. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        id: string;
                        contentType: string;
                        width: number;
                        height: number;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The body is larger than 8 MB. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description Not a JPEG, PNG or WebP within the limits (`unsupported_image`). */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description Too many uploads today. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    getMedia: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                mediaId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The image bytes. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/jpeg": string;
                    "image/png": string;
                    "image/webp": string;
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such image, or the session may not see it. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The id is not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    exportAccount: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The export. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {string} */
                        format: "globetrot-account-export";
                        version: number;
                        /** Format: date-time */
                        exportedAt: string;
                        data: {
                            [key: string]: unknown;
                        };
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    listProposals: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Trip id (UUID). */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Proposals. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        proposals: {
                            /** Format: uuid */
                            id: string;
                            /** Format: uuid */
                            tripId: string;
                            request: string;
                            summary: string;
                            currency: string;
                            changes: ({
                                /** @enum {string} */
                                kind: "addStop";
                                name: string;
                                /** @default null */
                                countryCode: string | null;
                                latitude: number;
                                longitude: number;
                                nights: number;
                                /** @default null */
                                afterStopId: string | null;
                                /** @default  */
                                reason: string;
                            } | {
                                /** @enum {string} */
                                kind: "removeStop";
                                stopId: string;
                                /** @default  */
                                reason: string;
                            } | {
                                /** @enum {string} */
                                kind: "setNights";
                                stopId: string;
                                nights: number;
                                /** @default  */
                                reason: string;
                            } | {
                                /** @enum {string} */
                                kind: "reorder";
                                order: string[];
                                /** @default  */
                                reason: string;
                            } | {
                                /** @enum {string} */
                                kind: "addPlace";
                                /** @default null */
                                stopId: string | null;
                                name: string;
                                /** @default 90 */
                                minutes: number;
                                /** @default  */
                                reason: string;
                            } | {
                                /** @enum {string} */
                                kind: "addChecklistItem";
                                /** @enum {string} */
                                group: "documents" | "money" | "bookings" | "packing";
                                label: string;
                                /** @default  */
                                reason: string;
                            } | {
                                /** @enum {string} */
                                kind: "addExpense";
                                /** @enum {string} */
                                category: "flights" | "stay" | "local_transport" | "intercity_transport" | "food" | "experiences" | "insurance" | "documents" | "taxes" | "shopping" | "buffer" | "other";
                                description: string;
                                amount: string;
                                /** @default  */
                                reason: string;
                            } | {
                                /** @enum {string} */
                                kind: "setMonthly";
                                amount: string;
                                /** @default  */
                                reason: string;
                            })[];
                            /** @enum {string} */
                            status: "proposed" | "applied" | "discarded" | "undone";
                            applied: number[];
                            undoable: boolean;
                            /** Format: date-time */
                            createdAt: string;
                            /** Format: date-time */
                            decidedAt: string | null;
                        }[];
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip or proposal, or it belongs to someone else. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    askPip: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Trip id (UUID). */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /**
                     * @description What the person asks Pip, in their own words.
                     * @example Make this trip ten days and add must-see places in Kyoto
                     */
                    request: string;
                };
            };
        };
        responses: {
            /** @description The proposal as the person sees it. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        id: string;
                        /** Format: uuid */
                        tripId: string;
                        request: string;
                        summary: string;
                        currency: string;
                        changes: ({
                            /** @enum {string} */
                            kind: "addStop";
                            name: string;
                            /** @default null */
                            countryCode: string | null;
                            latitude: number;
                            longitude: number;
                            nights: number;
                            /** @default null */
                            afterStopId: string | null;
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "removeStop";
                            stopId: string;
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "setNights";
                            stopId: string;
                            nights: number;
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "reorder";
                            order: string[];
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "addPlace";
                            /** @default null */
                            stopId: string | null;
                            name: string;
                            /** @default 90 */
                            minutes: number;
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "addChecklistItem";
                            /** @enum {string} */
                            group: "documents" | "money" | "bookings" | "packing";
                            label: string;
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "addExpense";
                            /** @enum {string} */
                            category: "flights" | "stay" | "local_transport" | "intercity_transport" | "food" | "experiences" | "insurance" | "documents" | "taxes" | "shopping" | "buffer" | "other";
                            description: string;
                            amount: string;
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "setMonthly";
                            amount: string;
                            /** @default  */
                            reason: string;
                        })[];
                        /** @enum {string} */
                        status: "proposed" | "applied" | "discarded" | "undone";
                        applied: number[];
                        undoable: boolean;
                        /** Format: date-time */
                        createdAt: string;
                        /** Format: date-time */
                        decidedAt: string | null;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description Pip credits are used up (`OUT_OF_CREDITS`) or the trial is over (`PLAN_REQUIRED`). */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip or proposal, or it belongs to someone else. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The request is empty or too long. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description Too many requests to Pip today. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description Pip is not configured or the model did not answer. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    applyProposal: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                proposalId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description Indexes of the changes to apply; the rest are left out. */
                    include: number[];
                };
            };
        };
        responses: {
            /** @description The proposal as the person sees it. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        id: string;
                        /** Format: uuid */
                        tripId: string;
                        request: string;
                        summary: string;
                        currency: string;
                        changes: ({
                            /** @enum {string} */
                            kind: "addStop";
                            name: string;
                            /** @default null */
                            countryCode: string | null;
                            latitude: number;
                            longitude: number;
                            nights: number;
                            /** @default null */
                            afterStopId: string | null;
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "removeStop";
                            stopId: string;
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "setNights";
                            stopId: string;
                            nights: number;
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "reorder";
                            order: string[];
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "addPlace";
                            /** @default null */
                            stopId: string | null;
                            name: string;
                            /** @default 90 */
                            minutes: number;
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "addChecklistItem";
                            /** @enum {string} */
                            group: "documents" | "money" | "bookings" | "packing";
                            label: string;
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "addExpense";
                            /** @enum {string} */
                            category: "flights" | "stay" | "local_transport" | "intercity_transport" | "food" | "experiences" | "insurance" | "documents" | "taxes" | "shopping" | "buffer" | "other";
                            description: string;
                            amount: string;
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "setMonthly";
                            amount: string;
                            /** @default  */
                            reason: string;
                        })[];
                        /** @enum {string} */
                        status: "proposed" | "applied" | "discarded" | "undone";
                        applied: number[];
                        undoable: boolean;
                        /** Format: date-time */
                        createdAt: string;
                        /** Format: date-time */
                        decidedAt: string | null;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip or proposal, or it belongs to someone else. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description Already decided (`already_decided`) or no longer undoable (`not_undoable`). */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    discardProposal: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                proposalId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The proposal as the person sees it. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        id: string;
                        /** Format: uuid */
                        tripId: string;
                        request: string;
                        summary: string;
                        currency: string;
                        changes: ({
                            /** @enum {string} */
                            kind: "addStop";
                            name: string;
                            /** @default null */
                            countryCode: string | null;
                            latitude: number;
                            longitude: number;
                            nights: number;
                            /** @default null */
                            afterStopId: string | null;
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "removeStop";
                            stopId: string;
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "setNights";
                            stopId: string;
                            nights: number;
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "reorder";
                            order: string[];
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "addPlace";
                            /** @default null */
                            stopId: string | null;
                            name: string;
                            /** @default 90 */
                            minutes: number;
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "addChecklistItem";
                            /** @enum {string} */
                            group: "documents" | "money" | "bookings" | "packing";
                            label: string;
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "addExpense";
                            /** @enum {string} */
                            category: "flights" | "stay" | "local_transport" | "intercity_transport" | "food" | "experiences" | "insurance" | "documents" | "taxes" | "shopping" | "buffer" | "other";
                            description: string;
                            amount: string;
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "setMonthly";
                            amount: string;
                            /** @default  */
                            reason: string;
                        })[];
                        /** @enum {string} */
                        status: "proposed" | "applied" | "discarded" | "undone";
                        applied: number[];
                        undoable: boolean;
                        /** Format: date-time */
                        createdAt: string;
                        /** Format: date-time */
                        decidedAt: string | null;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip or proposal, or it belongs to someone else. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description Already decided (`already_decided`) or no longer undoable (`not_undoable`). */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    undoProposal: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                proposalId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The proposal as the person sees it. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        id: string;
                        /** Format: uuid */
                        tripId: string;
                        request: string;
                        summary: string;
                        currency: string;
                        changes: ({
                            /** @enum {string} */
                            kind: "addStop";
                            name: string;
                            /** @default null */
                            countryCode: string | null;
                            latitude: number;
                            longitude: number;
                            nights: number;
                            /** @default null */
                            afterStopId: string | null;
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "removeStop";
                            stopId: string;
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "setNights";
                            stopId: string;
                            nights: number;
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "reorder";
                            order: string[];
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "addPlace";
                            /** @default null */
                            stopId: string | null;
                            name: string;
                            /** @default 90 */
                            minutes: number;
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "addChecklistItem";
                            /** @enum {string} */
                            group: "documents" | "money" | "bookings" | "packing";
                            label: string;
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "addExpense";
                            /** @enum {string} */
                            category: "flights" | "stay" | "local_transport" | "intercity_transport" | "food" | "experiences" | "insurance" | "documents" | "taxes" | "shopping" | "buffer" | "other";
                            description: string;
                            amount: string;
                            /** @default  */
                            reason: string;
                        } | {
                            /** @enum {string} */
                            kind: "setMonthly";
                            amount: string;
                            /** @default  */
                            reason: string;
                        })[];
                        /** @enum {string} */
                        status: "proposed" | "applied" | "discarded" | "undone";
                        applied: number[];
                        undoable: boolean;
                        /** Format: date-time */
                        createdAt: string;
                        /** Format: date-time */
                        decidedAt: string | null;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip or proposal, or it belongs to someone else. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description Already decided (`already_decided`) or no longer undoable (`not_undoable`). */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    getBilling: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The plan facts. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {string} */
                        access: "trial" | "explorer" | "voyager" | "expired";
                        readOnly: boolean;
                        trialEndsAt: string;
                        trialDaysLeft: number;
                        /** @enum {string|null} */
                        plan: "explorer" | "voyager" | null;
                        /** @enum {string|null} */
                        interval: "month" | "year" | null;
                        /** @enum {string|null} */
                        status: "active" | "past_due" | "canceled" | null;
                        renewsAt: string | null;
                        maxActiveTrips: number | null;
                        activeTrips: number;
                        credits: {
                            monthly: number;
                            monthlyLeft: number;
                            topUpLeft: number;
                            total: number;
                            periodEnd: string;
                            dailyCap: number;
                        };
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    startCheckout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    item: "explorer" | "voyager" | "top-up";
                    /** @enum {string} */
                    interval?: "month" | "year";
                };
            };
        };
        responses: {
            /** @description Where to send the person. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        url: string;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The body is not valid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description Payments are not switched on yet. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    openBillingPortal: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Where to send the person. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        url: string;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description Nothing has been paid yet. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description Payments are not switched on yet. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    getTripShare: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The link, or `slug: null`. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        slug: string | null;
                        showAmounts: boolean;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip, or not yours. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    shareTrip: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    showAmounts?: boolean;
                };
            };
        };
        responses: {
            /** @description The link. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        slug: string | null;
                        showAmounts: boolean;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description The trial is over (`PLAN_REQUIRED`). */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip, or not yours. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
    unshareTrip: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description `slug: null`. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        slug: string | null;
                        showAmounts: boolean;
                    };
                };
            };
            /** @description No valid session. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
            /** @description No such trip, or not yours. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": {
                        /** @description A URN identifying the kind of problem. */
                        type: string;
                        title: string;
                        status: number;
                        /** @description Stable machine-readable code. Clients switch on this. */
                        code: string;
                        detail?: string;
                        /** @description Per-field problems, present for VALIDATION_FAILED. */
                        errors?: {
                            field: string;
                            code: string;
                            message: string;
                        }[];
                    };
                };
            };
        };
    };
}
