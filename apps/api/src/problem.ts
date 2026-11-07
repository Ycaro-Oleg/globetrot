import { z } from '@hono/zod-openapi';
import type { ApplicationError, FieldIssue } from '@globetrot/application';
import { ValidationError } from '@globetrot/application';

/** RFC 9457 problem details, plus a stable `code` clients switch on and optional field errors. */
export const problemSchema = z.object({
  type: z.string().meta({ description: 'A URN identifying the kind of problem.' }),
  title: z.string(),
  status: z.number().int(),
  code: z.string().meta({ description: 'Stable machine-readable code. Clients switch on this.' }),
  detail: z.string().optional(),
  errors: z
    .array(z.object({ field: z.string(), code: z.string(), message: z.string() }))
    .optional()
    .meta({ description: 'Per-field problems, present for VALIDATION_FAILED.' }),
});
export type Problem = z.infer<typeof problemSchema>;

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

const TITLES: Readonly<Record<number, string>> = {
  400: 'Bad request',
  401: 'Authentication required',
  403: 'Forbidden',
  404: 'Not found',
  422: 'Validation failed',
  500: 'Internal server error',
};

/** Builds a problem+json response. Never pass stack traces, SQL, tokens or other users' data in `detail`. */
export function problem(
  status: 400 | 401 | 403 | 404 | 422 | 500,
  code: string,
  extra: { detail?: string; errors?: readonly FieldIssue[] } = {},
): Response {
  const body: Problem = {
    type: `urn:globetrot:problem:${code.toLowerCase().replaceAll('_', '-')}`,
    title: TITLES[status] ?? 'Error',
    status,
    code,
    ...(extra.detail === undefined ? {} : { detail: extra.detail }),
    ...(extra.errors === undefined ? {} : { errors: [...extra.errors] }),
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': PROBLEM_CONTENT_TYPE },
  });
}

const STATUS_BY_CODE: Readonly<Record<string, 401 | 403 | 404 | 422>> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 422,
};

/** Translates an expected application failure. Unknown codes are a programming error, so they become a 500. */
export function problemFromApplicationError(error: ApplicationError): Response {
  const status = STATUS_BY_CODE[error.code];
  if (status === undefined) return problem(500, 'INTERNAL_ERROR');
  return problem(status, error.code, {
    detail: error.message,
    ...(error instanceof ValidationError ? { errors: error.issues } : {}),
  });
}
