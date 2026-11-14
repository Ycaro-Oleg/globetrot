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
  poweredByHeader: false,
  // Baseline security headers on every response. (The map's tile and worker sources make a strict
  // Content-Security-Policy a separate change; `frame-ancestors` alone already stops clickjacking.)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
          },
          // Browsers ignore it over plain http, so it only takes effect behind TLS in production.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ];
  },
};

export default createNextIntlPlugin('./i18n/request.ts')(config);
