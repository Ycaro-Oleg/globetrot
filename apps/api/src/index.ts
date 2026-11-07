import { serve } from '@hono/node-server';
import { createApp } from './app';

const port = Number(process.env.PORT ?? 4000);

const server = serve({ fetch: createApp().fetch, port }, (info) => {
  console.log(`api listening on :${info.port}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
