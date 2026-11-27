import {
  groupMoneySchema,
  inviteCreatedSchema,
  invitePreviewSchema,
  inviteRoleSchema,
  tripMembersSchema,
  tripSchema,
  type Application,
} from '@globetrot/application';
import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import { problemResponse, type Env } from '../http';

const security = [{ cookieAuth: [] }];
const tripParams = z.object({ id: z.uuid() });
const tokenParams = z.object({ token: z.string().max(64) });

const membersRoute = createRoute({
  method: 'get',
  path: '/v1/trips/{id}/members',
  operationId: 'getTripMembers',
  tags: ['Trips'],
  summary: 'Who plans the trip',
  description:
    'The owner first, then the members (ADR-0024). The owner also sees the open invite links and how many ' +
    'people the plan lets join.',
  security,
  request: { params: tripParams },
  responses: {
    200: {
      description: 'The people.',
      content: { 'application/json': { schema: tripMembersSchema } },
    },
    401: problemResponse('No valid session.'),
    404: problemResponse('No such trip, or not one the caller plans.'),
  },
});

const createInviteRoute = createRoute({
  method: 'post',
  path: '/v1/trips/{id}/invites',
  operationId: 'createInvite',
  tags: ['Trips'],
  summary: 'A link to plan the trip together',
  description:
    'Owner only. The token is shown once and only its hash is stored; the link works for 7 days. Globetrot ' +
    'sends nothing: the owner copies the link. `402 GUEST_LIMIT_REACHED` when the plan allows no more people.',
  security,
  request: {
    params: tripParams,
    body: {
      required: false,
      content: {
        'application/json': { schema: z.object({ role: inviteRoleSchema.optional() }) },
      },
    },
  },
  responses: {
    201: {
      description: 'The new link.',
      content: { 'application/json': { schema: inviteCreatedSchema } },
    },
    401: problemResponse('No valid session.'),
    402: problemResponse('The plan allows no more people (`GUEST_LIMIT_REACHED`).'),
    404: problemResponse('No such trip, or not the caller’s.'),
  },
});

const revokeInviteRoute = createRoute({
  method: 'delete',
  path: '/v1/trips/{id}/invites/{inviteId}',
  operationId: 'revokeInvite',
  tags: ['Trips'],
  summary: 'Stop an invite link for good',
  security,
  request: { params: z.object({ id: z.uuid(), inviteId: z.uuid() }) },
  responses: {
    200: {
      description: 'Stopped.',
      content: { 'application/json': { schema: z.object({ revoked: z.boolean() }) } },
    },
    401: problemResponse('No valid session.'),
    404: problemResponse('No such trip or open link.'),
  },
});

const removeMemberRoute = createRoute({
  method: 'delete',
  path: '/v1/trips/{id}/members/{userId}',
  operationId: 'removeMember',
  tags: ['Trips'],
  summary: 'Take someone off the trip (owner only)',
  security,
  request: { params: z.object({ id: z.uuid(), userId: z.string().min(1).max(64) }) },
  responses: {
    200: {
      description: 'Removed.',
      content: { 'application/json': { schema: z.object({ removed: z.boolean() }) } },
    },
    401: problemResponse('No valid session.'),
    404: problemResponse('No such trip or member.'),
  },
});

const leaveRoute = createRoute({
  method: 'post',
  path: '/v1/trips/{id}/leave',
  operationId: 'leaveTrip',
  tags: ['Trips'],
  summary: 'Leave a trip the caller was invited to',
  security,
  request: { params: tripParams },
  responses: {
    200: {
      description: 'Left.',
      content: { 'application/json': { schema: z.object({ left: z.boolean() }) } },
    },
    401: problemResponse('No valid session.'),
    404: problemResponse('No such trip, or the caller owns it or is not a member.'),
  },
});

const previewInviteRoute = createRoute({
  method: 'get',
  path: '/v1/invites/{token}',
  operationId: 'previewInvite',
  tags: ['Trips'],
  summary: 'What an invite link opens',
  description: 'A revoked, expired or unknown link, and an archived trip, all answer 404.',
  security,
  request: { params: tokenParams },
  responses: {
    200: {
      description: 'The trip and role.',
      content: { 'application/json': { schema: invitePreviewSchema } },
    },
    401: problemResponse('No valid session.'),
    404: problemResponse('No such link.'),
  },
});

const acceptInviteRoute = createRoute({
  method: 'post',
  path: '/v1/invites/{token}',
  operationId: 'acceptInvite',
  tags: ['Trips'],
  summary: 'Join the trip through an invite link',
  description: 'Accepting twice, or as the owner, changes nothing.',
  security,
  request: { params: tokenParams },
  responses: {
    200: {
      description: 'The trip, with the caller’s role.',
      content: { 'application/json': { schema: tripSchema } },
    },
    401: problemResponse('No valid session.'),
    402: problemResponse('The plan allows no more people (`GUEST_LIMIT_REACHED`).'),
    404: problemResponse('No such link.'),
  },
});

const groupMoneyRoute = createRoute({
  method: 'get',
  path: '/v1/trips/{id}/money',
  operationId: 'getGroupMoney',
  tags: ['Budget'],
  summary: 'Each person’s part, savings and the settling up',
  description:
    'Everyone’s part of the trip’s cost (equal, or custom basis points), what each set aside and when they will ' +
    'have it, the group’s progress, and who pays whom for the costs already paid (ADR-0025).',
  security,
  request: { params: tripParams },
  responses: {
    200: {
      description: 'The money.',
      content: { 'application/json': { schema: groupMoneySchema } },
    },
    401: problemResponse('No valid session.'),
    404: problemResponse('No such trip, or not one the caller plans.'),
  },
});

const myMoneyRoute = createRoute({
  method: 'put',
  path: '/v1/trips/{id}/money/me',
  operationId: 'updateMyMoney',
  tags: ['Budget'],
  summary: 'The caller’s own savings for their part',
  security,
  request: {
    params: tripParams,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: z.object({ saved: z.string().optional(), monthly: z.string().optional() }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Saved.',
      content: { 'application/json': { schema: z.object({ saved: z.boolean() }) } },
    },
    401: problemResponse('No valid session.'),
    404: problemResponse('No such trip, or not one the caller plans.'),
    422: problemResponse('An amount is not valid.'),
  },
});

const sharesRoute = createRoute({
  method: 'put',
  path: '/v1/trips/{id}/shares',
  operationId: 'setShares',
  tags: ['Budget'],
  summary: 'Who pays how much of the trip (owner only)',
  description:
    'Everyone’s part in basis points adding up to 10 000, or `shares: null` to split equally.',
  security,
  request: {
    params: tripParams,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: z.object({
            shares: z.array(z.object({ userId: z.string(), shareBp: z.number().int() })).nullable(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Saved.',
      content: { 'application/json': { schema: z.object({ saved: z.boolean() }) } },
    },
    401: problemResponse('No valid session.'),
    404: problemResponse('No such trip, or not the caller’s.'),
    422: problemResponse('The parts do not cover everyone or do not add up to the whole trip.'),
  },
});

export function registerMemberRoutes(app: OpenAPIHono<Env>, application: Application) {
  app.openapi(membersRoute, async (c) =>
    c.json(
      await application.getTripMembers.execute(c.get('actor'), {
        tripId: c.req.valid('param').id,
      }),
      200,
    ),
  );
  app.openapi(createInviteRoute, async (c) => {
    // The body is optional: an empty request makes an editor link. The role is checked by the application.
    const body = (await c.req.json().catch(() => ({}))) as { role?: 'editor' | 'viewer' };
    return c.json(
      await application.createInvite.execute(c.get('actor'), {
        tripId: c.req.valid('param').id,
        ...(body.role === undefined ? {} : { role: body.role }),
      }),
      201,
    );
  });
  app.openapi(revokeInviteRoute, async (c) => {
    const { id, inviteId } = c.req.valid('param');
    return c.json(
      await application.revokeInvite.execute(c.get('actor'), { tripId: id, inviteId }),
      200,
    );
  });
  app.openapi(removeMemberRoute, async (c) => {
    const { id, userId } = c.req.valid('param');
    return c.json(
      await application.removeMember.execute(c.get('actor'), { tripId: id, userId }),
      200,
    );
  });
  app.openapi(leaveRoute, async (c) =>
    c.json(
      await application.leaveTrip.execute(c.get('actor'), { tripId: c.req.valid('param').id }),
      200,
    ),
  );
  app.openapi(previewInviteRoute, async (c) =>
    c.json(
      await application.previewInvite.execute(c.get('actor'), {
        token: c.req.valid('param').token,
      }),
      200,
    ),
  );
  app.openapi(acceptInviteRoute, async (c) =>
    c.json(
      await application.acceptInvite.execute(c.get('actor'), {
        token: c.req.valid('param').token,
      }),
      200,
    ),
  );
  app.openapi(groupMoneyRoute, async (c) =>
    c.json(
      await application.getGroupMoney.execute(c.get('actor'), { tripId: c.req.valid('param').id }),
      200,
    ),
  );
  app.openapi(myMoneyRoute, async (c) =>
    c.json(
      await application.updateMyMoney.execute(c.get('actor'), {
        tripId: c.req.valid('param').id,
        ...c.req.valid('json'),
      }),
      200,
    ),
  );
  app.openapi(sharesRoute, async (c) =>
    c.json(
      await application.setShares.execute(c.get('actor'), {
        tripId: c.req.valid('param').id,
        shares: c.req.valid('json').shares,
      }),
      200,
    ),
  );
}
