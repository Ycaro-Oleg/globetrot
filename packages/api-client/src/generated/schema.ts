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
         * @description Sends the route as it should be, in order. The server assigns ids and positions, so sending the same route twice changes nothing. At most 100 stops. An empty list clears the route.
         */
        put: operations["replaceDestinations"];
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
                    }[];
                };
            };
        };
        responses: {
            /** @description The route as stored. */
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
}
