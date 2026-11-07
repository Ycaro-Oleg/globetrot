import type { Actor } from './actor';
import { NotFoundError } from './errors';

/**
 * Rule for every user-owned record (data-model.md, "Ownership"): rows are private by default. Call this with
 * the row's owner after loading it. Someone else's row is reported as **not found**, never as forbidden,
 * so the answer does not reveal that the id exists.
 */
export function assertOwner(actor: Actor, ownerId: string): void {
  if (actor.userId !== ownerId) throw new NotFoundError();
}
