import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const config: NextConfig = {
  // Self-contained server output for the Docker image (Hetzner + Coolify, ADR-0002).
  output: 'standalone',
  devIndicators: false,
  // Trace files from the monorepo root so workspace packages are included in the standalone output.
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  // Workspace packages ship TypeScript sources.
  transpilePackages: [
    '@globetrot/api-client',
    '@globetrot/application',
    '@globetrot/domain',
    '@globetrot/i18n',
    '@globetrot/ui',
  ],
};

export default createNextIntlPlugin('./i18n/request.ts')(config);
