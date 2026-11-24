import type { z } from 'zod';
import type { Actor } from './actor';
import { ValidationError } from './errors';

/**
 * A query (reads) or command (writes). The schemas are the contract: the HTTP adapter publishes them as
 * OpenAPI and an MCP server can expose them as tool schemas without restating anything.
 */
export interface Operation<I extends z.ZodType, O extends z.ZodType> {
  readonly name: string;
  readonly kind: 'query' | 'command';
  readonly input: I;
  readonly output: O;
  /**
   * Validates `input`, runs the handler as `actor`, and returns the output **parsed through the output
   * schema**, which drops any field the schema does not name. A row that carries a hash or a token can
   * therefore never leak through an operation by accident.
   */
  execute(actor: Actor, input: z.input<I>): Promise<z.output<O>>;
}

interface OperationSpec<I extends z.ZodType, O extends z.ZodType> {
  readonly name: string;
  readonly kind: 'query' | 'command';
  readonly input: I;
  readonly output: O;
  /** Authorize against `actor` first, then act. `input` is already validated. */
  readonly handler: (actor: Actor, input: z.output<I>) => Promise<z.input<O>>;
}

export function defineOperation<I extends z.ZodType, O extends z.ZodType>(
  spec: OperationSpec<I, O>,
): Operation<I, O> {
  return {
    name: spec.name,
    kind: spec.kind,
    input: spec.input,
    output: spec.output,
    async execute(actor, rawInput) {
      const parsed = spec.input.safeParse(rawInput);
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            code: issue.code,
            message: issue.message,
          })),
        );
      }
      return spec.output.parse(await spec.handler(actor, parsed.data));
    },
  };
}
