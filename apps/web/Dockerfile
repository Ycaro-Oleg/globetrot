# syntax=docker/dockerfile:1
# Build from the repository root: docker build -f apps/web/Dockerfile .
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.11.10 prune @globetrot/web --docker

FROM base AS builder
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
# A NEXT_PUBLIC_* value is written into the browser bundle at build time, so it is a build argument. The map key
# is a public, domain-restricted key (never a secret); without it the board shows its search as unavailable. The
# others switch on browser error monitoring and analytics; each stays off when empty.
ARG NEXT_PUBLIC_GEOAPIFY_API_KEY=
ARG NEXT_PUBLIC_SENTRY_DSN=
ARG NEXT_PUBLIC_POSTHOG_KEY=
ARG NEXT_PUBLIC_POSTHOG_HOST=
ARG NEXT_PUBLIC_PLAUSIBLE_DOMAIN=
ARG NEXT_PUBLIC_PLAUSIBLE_SRC=
ARG NEXT_PUBLIC_META_PIXEL_ID=
ENV NEXT_PUBLIC_GEOAPIFY_API_KEY=$NEXT_PUBLIC_GEOAPIFY_API_KEY \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY \
    NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST \
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN=$NEXT_PUBLIC_PLAUSIBLE_DOMAIN \
    NEXT_PUBLIC_PLAUSIBLE_SRC=$NEXT_PUBLIC_PLAUSIBLE_SRC \
    NEXT_PUBLIC_META_PIXEL_ID=$NEXT_PUBLIC_META_PIXEL_ID
RUN pnpm turbo run build --filter=@globetrot/web

# Next.js standalone output (see next.config.ts).
FROM node:24-alpine AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
USER node
COPY --from=builder --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /repo/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
