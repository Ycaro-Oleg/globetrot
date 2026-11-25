import {
  placeSchema,
  reversePlaceInput,
  searchPlacesInput,
  type Application,
} from '@globetrot/application';
import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import { problemResponse, type Env } from '../http';

const security = [{ cookieAuth: [] }];
const errors = {
  401: problemResponse('No valid session.'),
  422: problemResponse('The query is not valid.'),
  429: problemResponse('Too many lookups in a minute. Wait and try again.'),
  503: problemResponse('Place search is not configured or the provider is not answering.'),
};

const searchRoute = createRoute({
  method: 'get',
  path: '/v1/places/search',
  operationId: 'searchPlaces',
  tags: ['Places'],
  summary: 'Search places by name',
  description:
    'Cities, regions and addresses from the geocoding provider, in the language asked for. The provider key stays ' +
    'on the server. Show each result’s `attribution`. At most 60 lookups a minute per person.',
  security,
  request: { query: searchPlacesInput },
  responses: {
    200: {
      description: 'Up to 8 places.',
      content: { 'application/json': { schema: z.object({ places: z.array(placeSchema) }) } },
    },
    ...errors,
  },
});

const citiesRoute = createRoute({
  method: 'get',
  path: '/v1/places/cities',
  operationId: 'searchCities',
  tags: ['Places'],
  summary: 'Search cities by name',
  description:
    'Cities of 15 000 people or more from the built-in GeoNames index (CC BY 4.0): instant, no provider. Accents ' +
    'and case are ignored, and big cities also match a name in another language ("Londres"). Shared limit of 60 ' +
    'lookups a minute with the other place lookups.',
  security,
  request: { query: searchPlacesInput },
  responses: {
    200: {
      description: 'Up to 8 cities, most populous first.',
      content: { 'application/json': { schema: z.object({ places: z.array(placeSchema) }) } },
    },
    401: errors[401],
    422: errors[422],
    429: errors[429],
  },
});

const reverseRoute = createRoute({
  method: 'get',
  path: '/v1/places/reverse',
  operationId: 'reversePlace',
  tags: ['Places'],
  summary: 'The place at a point',
  description:
    'For a pin dropped on the map. `place` is null when nothing named is there (the sea).',
  security,
  request: { query: reversePlaceInput },
  responses: {
    200: {
      description: 'The place, or null.',
      content: { 'application/json': { schema: z.object({ place: placeSchema.nullable() }) } },
    },
    ...errors,
  },
});

export function registerPlaceRoutes(app: OpenAPIHono<Env>, application: Application) {
  app.openapi(searchRoute, async (c) =>
    c.json(await application.searchPlaces.execute(c.get('actor'), c.req.valid('query')), 200),
  );
  app.openapi(citiesRoute, async (c) =>
    c.json(await application.searchCities.execute(c.get('actor'), c.req.valid('query')), 200),
  );
  app.openapi(reverseRoute, async (c) =>
    c.json(await application.reversePlace.execute(c.get('actor'), c.req.valid('query')), 200),
  );
}
