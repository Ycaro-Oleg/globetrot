import {
  applyProposalFields,
  askPipFields,
  proposalListSchema,
  proposalSchema,
  tripIdSchema,
  type Application,
} from '@globetrot/application';
import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import { problemResponse, type Env } from '../http';

const security = [{ cookieAuth: [] }];
const tags = ['Pip'];
const proposal = {
  description: 'The proposal as the person sees it.',
  content: { 'application/json': { schema: proposalSchema } },
};
const proposalParams = z.object({ proposalId: z.uuid() });
const notFound = problemResponse('No such trip or proposal, or it belongs to someone else.');

const askRoute = createRoute({
  method: 'post',
  path: '/v1/trips/{id}/pip/proposals',
  operationId: 'askPip',
  tags,
  summary: 'Ask Pip for a change list',
  description:
    'Pip (an AI model, DeepSeek today) sees this trip’s plan only, never the person’s name, email, home or other ' +
    'trips, and answers a change list that is validated here. Nothing changes until the person applies it. ' +
    'Amounts are estimates in the trip’s currency. At most 20 requests a day.',
  security,
  request: {
    params: z.object({ id: tripIdSchema }),
    body: { required: true, content: { 'application/json': { schema: askPipFields } } },
  },
  responses: {
    201: proposal,
    401: problemResponse('No valid session.'),
    404: notFound,
    422: problemResponse('The request is empty or too long.'),
    429: problemResponse('Too many requests to Pip today.'),
    503: problemResponse('Pip is not configured or the model did not answer.'),
  },
});

const listRoute = createRoute({
  method: 'get',
  path: '/v1/trips/{id}/pip/proposals',
  operationId: 'listProposals',
  tags,
  summary: 'A trip’s last ten proposals, newest first',
  security,
  request: { params: z.object({ id: tripIdSchema }) },
  responses: {
    200: {
      description: 'Proposals.',
      content: { 'application/json': { schema: proposalListSchema } },
    },
    401: problemResponse('No valid session.'),
    404: notFound,
  },
});

const decide = (action: 'apply' | 'discard' | 'undo', summary: string, description: string) =>
  createRoute({
    method: 'post',
    path: `/v1/pip/proposals/{proposalId}/${action}`,
    operationId: `${action}Proposal`,
    tags,
    summary,
    description,
    security,
    request:
      action === 'apply'
        ? {
            params: proposalParams,
            body: {
              required: true,
              content: { 'application/json': { schema: applyProposalFields } },
            },
          }
        : { params: proposalParams },
    responses: {
      200: proposal,
      401: problemResponse('No valid session.'),
      404: notFound,
      422: problemResponse(
        'Already decided (`already_decided`) or no longer undoable (`not_undoable`).',
      ),
    },
  });

const applyRoute = decide(
  'apply',
  'Apply the chosen changes',
  'In one transaction, with what "Undo" needs kept. Costs are added as estimates.',
);
const discardRoute = decide('discard', 'Discard a proposal', 'Nothing on the trip changes.');
const undoRoute = decide(
  'undo',
  'Undo an applied proposal',
  'Within 24 hours: puts the route and the monthly amount back as they were and removes what applying added.',
);

/** The actor comes from the session only. */
export function registerPipRoutes(app: OpenAPIHono<Env>, application: Application) {
  app.openapi(askRoute, async (c) =>
    c.json(
      await application.askPip.execute(c.get('actor'), {
        ...c.req.valid('json'),
        tripId: c.req.valid('param').id,
      }),
      201,
    ),
  );
  app.openapi(listRoute, async (c) =>
    c.json(
      await application.listProposals.execute(c.get('actor'), { tripId: c.req.valid('param').id }),
      200,
    ),
  );
  app.openapi(applyRoute, async (c) =>
    c.json(
      await application.applyProposal.execute(c.get('actor'), {
        proposalId: c.req.param('proposalId'),
        include: ((await c.req.json()) as { include?: number[] }).include ?? [],
      }),
      200,
    ),
  );
  app.openapi(discardRoute, async (c) =>
    c.json(
      await application.discardProposal.execute(c.get('actor'), {
        proposalId: c.req.param('proposalId'),
      }),
      200,
    ),
  );
  app.openapi(undoRoute, async (c) =>
    c.json(
      await application.undoProposal.execute(c.get('actor'), {
        proposalId: c.req.param('proposalId'),
      }),
      200,
    ),
  );
}
