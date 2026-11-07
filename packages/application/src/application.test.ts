import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import {
  assertOwner,
  createApplication,
  defineOperation,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  type Actor,
  type UserReader,
  type UserRecord,
} from './index';
import { createFakePorts } from './testing';

const ana: UserRecord = { id: 'u-ana', email: 'ana@example.com', name: 'Ana', emailVerified: true };
const bruno: UserRecord = {
  id: 'u-bruno',
  email: 'bruno@example.com',
  name: 'Bruno',
  emailVerified: false,
};
const as = (user: UserRecord): Actor => ({ kind: 'user', userId: user.id });

const app = (users: UserReader) => createApplication({ ...createFakePorts().ports, users });

function fakeUsers(...records: UserRecord[]): UserReader & { readonly asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    async findById(userId) {
      asked.push(userId);
      return records.find((record) => record.id === userId) ?? null;
    },
  };
}

describe('getCurrentUser', () => {
  it("returns the actor's own account and asks the port for nobody else", async () => {
    const users = fakeUsers(ana, bruno);
    const { getCurrentUser } = app(users);
    expect(await getCurrentUser.execute(as(ana), {})).toEqual(ana);
    expect(await getCurrentUser.execute(as(bruno), {})).toEqual(bruno);
    expect(users.asked).toEqual(['u-ana', 'u-bruno']);
  });

  it('has no way to name another user: extra input is ignored, not honored', async () => {
    const { getCurrentUser } = app(fakeUsers(ana, bruno));
    const sneaky = { userId: 'u-bruno' } as unknown as Record<string, never>;
    expect((await getCurrentUser.execute(as(ana), sneaky)).id).toBe('u-ana');
  });

  it('exposes only id, email, name and the verification flag, even if the row carries more', async () => {
    const leaky = { ...ana, passwordHash: 'secret', token: 'abc' } as UserRecord;
    const { getCurrentUser } = app(fakeUsers(leaky));
    const result = await getCurrentUser.execute(as(ana), {});
    expect(Object.keys(result).sort()).toEqual(['email', 'emailVerified', 'id', 'name']);
  });

  it('reports a session whose account no longer exists as not found', async () => {
    const { getCurrentUser } = app(fakeUsers());
    await expect(getCurrentUser.execute(as(ana), {})).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('assertOwner', () => {
  it('accepts the owner', () => {
    expect(() => assertOwner(as(ana), 'u-ana')).not.toThrow();
  });

  it('refuses another user as "not found", so the existence of the record is not revealed', () => {
    expect(() => assertOwner(as(ana), 'u-bruno')).toThrow(NotFoundError);
    expect(() => assertOwner(as(ana), 'u-bruno')).not.toThrow(ForbiddenError);
  });
});

describe('defineOperation', () => {
  const double = defineOperation({
    name: 'double',
    kind: 'query',
    input: z.object({ n: z.number().int().min(0) }),
    output: z.object({ result: z.number() }),
    async handler(_actor, input) {
      return { result: input.n * 2 };
    },
  });

  it('runs the handler with validated input', async () => {
    expect(await double.execute(as(ana), { n: 4 })).toEqual({ result: 8 });
  });

  it('throws a ValidationError with field issues for bad input, and never runs the handler', async () => {
    let ran = false;
    const op = defineOperation({
      name: 'noop',
      kind: 'command',
      input: z.object({ n: z.number() }),
      output: z.object({}),
      async handler() {
        ran = true;
        return {};
      },
    });
    const error = await op
      .execute(as(ana), { n: 'x' as unknown as number })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).issues[0]).toMatchObject({
      field: 'n',
      code: 'invalid_type',
    });
    expect(ran).toBe(false);
  });

  it('fails loudly when a handler returns something the output schema rejects', async () => {
    const broken = defineOperation({
      name: 'broken',
      kind: 'query',
      input: z.object({}),
      output: z.object({ ok: z.boolean() }),
      handler: async () => ({ ok: 'yes' }) as unknown as { ok: boolean },
    });
    await expect(broken.execute(as(ana), {})).rejects.toThrow();
  });
});
