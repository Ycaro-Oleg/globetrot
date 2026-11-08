import { connectDatabase } from '@globetrot/db';
import { serve } from '@hono/node-server';
import { ApiConfigError, loadApiConfig, type ApiConfig } from './config';
import { createServices } from './wire';

// Fails fast (and loudly) on a missing or unsafe setting, before opening any port. The message names
// the setting and never its value, so it is safe in container logs.
function loadConfigOrExit(): ApiConfig {
  try {
    return loadApiConfig();
  } catch (error) {
    if (error instanceof ApiConfigError) {
      console.error(`Invalid configuration: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}

const config = loadConfigOrExit();
if (config.usingInsecureSecret) {
  console.warn(
    'BETTER_AUTH_SECRET is not set: using the public development secret. Never do this in production.',
  );
}

const database = connectDatabase(config.databaseUrl);
const { app } = createServices(database.db, config);

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`api listening on :${info.port}`);
});

const shutdown = () => {
  server.close(() => {
    void database.close().finally(() => process.exit(0));
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
