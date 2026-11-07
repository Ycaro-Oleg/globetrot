/**
 * Who is performing an operation. The HTTP adapter builds it from a verified session and nothing a client
 * sends can set it. Pip acting for a user and MCP grants join this union later (ADR-0006); every
 * authorization decision is written against `Actor`, so those additions are compile-time visible.
 */
export type Actor = { readonly kind: 'user'; readonly userId: string };
