# API contracts

The HTTP API is a thin adapter over [`packages/application`](adr/0006-api-and-application-layer.md): routes validate nothing about the business and decide nothing about permissions. They build an `Actor`, call one operation and translate the result. This page describes what is implemented (issue #56) and how to add an operation.

```text
Browser ─► apps/web (proxy.ts: /api/auth/*, /v1/*) ─► apps/api ─► @globetrot/application ─► ports ─► @globetrot/db
                                                         │
                                                         └─► /v1/openapi.json ─► packages/api-client (generated types)
```

## Versioning

- Every operation lives under **`/v1`**. A breaking change gets `/v2` next to it, never a silent edit. Adding an optional field or a new operation is not breaking.
- The contract is the OpenAPI 3.1 document served (publicly) at `GET /v1/openapi.json` and committed as `packages/api-client/openapi.json`. The `info.version` is the version of that contract.
- `/api/auth/*` (Better Auth) is separate and is not part of the OpenAPI contract: [`authentication.md`](authentication.md).

## Who is calling: the `Actor`

- `app.use('/v1/*')` in `apps/api/src/app.ts` resolves the **session cookie** through Better Auth and sets `actor = { kind: 'user', userId }`. It is the only place an actor is created.
- **No request field can name the caller.** Not a header (`X-User-Id`, `Authorization`, …), not a query parameter, not a body field. Operations take no user id for "me". Tests try every one of these and check the answer does not change (`app.test.ts`, `v1.int.test.ts`).
- No session: `401`, before any operation or port is touched. `/v1/openapi.json` is the only public path under `/v1`. It is registered **before** the authentication middleware, and Hono applies middleware in registration order, so anything registered after it requires a session.
- State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) from an untrusted `Origin` get `403 INVALID_ORIGIN`, as for auth ([`authentication.md`](authentication.md#request-protection)).
- The browser calls the web origin, never the API: `proxy.ts` forwards `/v1/*` (see `apps/web/lib/api-proxy.ts`), so the cookie is first-party. Server-side web code that calls the API must forward the request's `cookie` header itself.

## Errors: `application/problem+json`

Every error response, including 404 for an unknown route and 500, is RFC 9457 problem details:

```json
{
  "type": "urn:globetrot:problem:validation-failed",
  "title": "Validation failed",
  "status": 422,
  "code": "VALIDATION_FAILED",
  "detail": "The input is not valid",
  "errors": [{ "field": "name", "code": "too_small", "message": "…" }]
}
```

| `code` | Status | Meaning |
|---|---|---|
| `UNAUTHENTICATED` | 401 | No valid session |
| `FORBIDDEN` | 403 | Known actor lacking a permission |
| `INVALID_ORIGIN` | 403 | Untrusted `Origin` on a state-changing request |
| `NOT_FOUND` | 404 | Missing, **or not yours** (the two are indistinguishable on purpose) |
| `BAD_REQUEST` | 400 | The request body could not be read (malformed JSON) |
| `VALIDATION_FAILED` | 422 | Input broke the operation's schema. `errors` lists the fields |
| `INTERNAL_ERROR` | 500 | A bug. **No details**, no stack trace |

Clients switch on `code`, never on `detail` (which is English and may change). The 500 path logs only the kind of error (`unhandled TypeError (57P01) in a request`), because database driver errors can quote query parameters such as emails.

## Operations (`packages/application`)

An operation is `defineOperation({ name, kind, input, output, handler })`:

- `input` and `output` are Zod schemas. They are the contract: the same schema is the OpenAPI schema and, later, an MCP tool schema.
- `execute(actor, input)` validates the input (`ValidationError`), runs `handler(actor, input)` and returns the result **parsed through `output`**, so a field the schema does not name can never leak (a row with a hash or token comes out without it).
- Errors are `UnauthenticatedError`, `ForbiddenError`, `NotFoundError`, `ValidationError` (all `ApplicationError` with a stable `code`). Anything else is a bug and becomes a 500.
- **Ownership:** load the record, then `assertOwner(actor, record.ownerId)`. Another user's record is reported as not found.
- Storage goes through **ports** (`UserReader`, …) declared in `packages/application/src/ports.ts` and implemented in `apps/api/src/wire.ts`. The package has no HTTP, database or UI imports (lint-enforced), so unit tests use fakes.

Today: query `getCurrentUser` → `GET /v1/me` returns `{ id, email, name, emailVerified }` of the caller and nothing else. Mutations will add idempotency keys and audit with the trips issue.

## Adding an operation

1. **Application:** add the operation under `packages/application/src/queries/` (or `commands/`), with its schemas, authorization and any new port. Register it in `createApplication` (`src/index.ts`). Unit test it with fake ports, including a refusal for another user.
2. **Adapter:** if there is a new port, implement it in `apps/api/src/wire.ts`.
3. **Route:** in `apps/api/src/app.ts`, `createRoute({ method, path: '/v1/…', operationId, security: [{ cookieAuth: [] }], request, responses })` and `app.openapi(route, handler)`. The handler only calls `application.<operation>.execute(c.get('actor'), input)`. Declare the problem+json responses.
4. **Contract:** run `pnpm api:generate` and commit `packages/api-client/openapi.json` and `src/generated/schema.ts`. Two tests fail while they are stale (`apps/api/src/openapi.test.ts`, `packages/api-client/src/contract.test.ts`), so CI catches a forgotten run. Never edit the generated files by hand.
5. **Integration test** (`*.int.test.ts`, real database): anonymous, owner and another user.

## The typed client (`packages/api-client`)

`createApiClient({ baseUrl })` wraps `openapi-fetch` with the generated `paths` type, so paths, parameters and responses are checked by the compiler (an unknown path does not compile). `data` is the success body and `error` is the problem+json body:

```ts
const { data, error } = await client.GET('/v1/me');
if (error) handle(error.code); // 'UNAUTHENTICATED'
else show(data.email);
```
