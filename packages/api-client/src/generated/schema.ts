/**
 * GENERATED from openapi.json by scripts/generate-schema.mjs. Do not edit by hand.
 * Regenerate with `pnpm api:generate` from the repository root.
 */

export interface paths {
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
}
