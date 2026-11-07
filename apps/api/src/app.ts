import { Hono } from 'hono';

/** Builds the HTTP app. Routes stay thin: they delegate to @globetrot/application (ADR-0006). */
export function createApp() {
  const app = new Hono();

  app.get('/health', (c) => c.json({ status: 'ok', service: 'api' }));

  return app;
}
