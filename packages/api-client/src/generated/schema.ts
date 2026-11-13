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
        delete?: never;
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
        delete?: never;
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
}
