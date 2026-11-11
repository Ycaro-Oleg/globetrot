export interface FieldIssue {
  /** Dotted path of the offending input, empty for a problem with the input as a whole. */
  readonly field: string;
  /** Stable machine-readable code (a Zod issue code today). */
  readonly code: string;
  readonly message: string;
}

/**
 * Base of every expected failure of an operation. Adapters translate it (HTTP: problem+json); anything that
 * is not an `ApplicationError` is a bug and must surface as a generic failure with no details.
 * Messages never contain secrets, tokens or other people's data.
 */
export abstract class ApplicationError extends Error {
  abstract readonly code: string;
}

/** There is no authenticated actor. */
export class UnauthenticatedError extends ApplicationError {
  readonly code = 'UNAUTHENTICATED';
  constructor(message = 'Authentication is required') {
    super(message);
    this.name = 'UnauthenticatedError';
  }
}

/** The actor is known but is not allowed to do this (a permission it lacks, never "someone else's data"). */
export class ForbiddenError extends ApplicationError {
  readonly code = 'FORBIDDEN';
  constructor(message = 'You are not allowed to do this') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/** The thing does not exist **or is not visible to this actor**; the two are deliberately indistinguishable. */
export class NotFoundError extends ApplicationError {
  readonly code = 'NOT_FOUND';
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/** The input does not satisfy the operation's schema. */
export class ValidationError extends ApplicationError {
  readonly code = 'VALIDATION_FAILED';
  readonly issues: readonly FieldIssue[];
  constructor(issues: readonly FieldIssue[]) {
    super('The input is not valid');
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

/** An `Idempotency-Key` was reused with a different request. Send a new key for a new request. */
export class IdempotencyKeyReusedError extends ApplicationError {
  readonly code = 'IDEMPOTENCY_KEY_REUSED';
  constructor() {
    super('This Idempotency-Key was already used with a different request');
    this.name = 'IdempotencyKeyReusedError';
  }
}

/** The actor asked too often. Try again after a short wait. */
export class RateLimitedError extends ApplicationError {
  readonly code = 'RATE_LIMITED';
  constructor(message = 'Too many requests. Wait a moment and try again') {
    super(message);
    this.name = 'RateLimitedError';
  }
}

/** An outside service this needs is not configured or not answering. Nothing was changed. */
export class UnavailableError extends ApplicationError {
  readonly code = 'SERVICE_UNAVAILABLE';
  constructor(message = 'This is not available right now') {
    super(message);
    this.name = 'UnavailableError';
  }
}
