# syntax=docker/dockerfile:1
# Build from the repository root: docker build -f apps/api/Dockerfile .
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.11.10 prune @globetrot/api --docker

FROM base AS builder
COPY --from=pruner /repo/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=@globetrot/api

# The build bundles all dependencies into dist/, so the runtime image needs nothing else.
FROM node:24-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
USER node
COPY --from=builder --chown=node:node /repo/apps/api/dist ./dist
# The SQL migrations, for the release step (`node dist/migrate.js`).
COPY --from=builder --chown=node:node /repo/packages/db/migrations ./migrations
ENV PORT=4000
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:${PORT}/ready || exit 1
CMD ["node", "dist/index.js"]
