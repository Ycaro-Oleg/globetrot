import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  // Self-contained server output for the Docker image (Hetzner + Coolify, ADR-0002).
  output: 'standalone',
  // Trace files from the monorepo root so workspace packages are included in the standalone output.
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  // Workspace packages ship TypeScript sources.
  transpilePackages: ['@globetrot/application', '@globetrot/domain'],
};

export default config;
