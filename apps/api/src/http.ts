import type { Actor } from '@globetrot/application';
import { PROBLEM_CONTENT_TYPE, problemSchema } from './problem';

/** Hono environment: what middleware puts on the context. `actor` is set only by the session middleware. */
export interface Env {
  Variables: { actor: Actor };
}

/** An OpenAPI response entry for an error: always problem+json. */
export const problemResponse = (description: string) => ({
  description,
  content: { [PROBLEM_CONTENT_TYPE]: { schema: problemSchema } },
});
