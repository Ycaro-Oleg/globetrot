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
}
