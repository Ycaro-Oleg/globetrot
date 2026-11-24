# syntax=docker/dockerfile:1
# Build from the repository root: docker build -f apps/worker/Dockerfile .
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.11.10 prune @globetrot/worker --docker

FROM base AS builder
COPY --from=pruner /repo/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=@globetrot/worker

# The build bundles all dependencies into dist/, so the runtime image needs nothing else.
FROM node:24-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
USER node
COPY --from=builder --chown=node:node /repo/apps/worker/dist ./dist
CMD ["node", "dist/index.js"]
