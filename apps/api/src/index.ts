import { serve } from '@hono/node-server';
import { createApp } from './app';

// PORT is set by the container platform (Coolify); API_PORT comes from the local .env.
const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);

const server = serve({ fetch: createApp().fetch, port }, (info) => {
  console.log(`api listening on :${info.port}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
