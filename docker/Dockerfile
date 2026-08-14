# Production image for the Continue Leads admin app (Next.js standalone).
# Build context = the monorepo root (app + infra live together). From CI, at repo root:
#   docker build -f docker/Dockerfile -t <ecr>:<sha> .
# The root .dockerignore excludes terraform/, secrets, and node_modules from the context.
# syntax=docker/dockerfile:1

# ---- deps: install workspace dependencies ----
FROM node:20-alpine AS deps
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY packages/db/package.json packages/db/package.json
RUN pnpm install --frozen-lockfile

# ---- build: compile the Next.js standalone bundle ----
FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/admin/node_modules ./apps/admin/node_modules
COPY . .
RUN pnpm --filter @cl/admin build

# ---- runner: minimal runtime ----
FROM node:20-alpine AS runner
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -S nextjs

# Standalone server + static assets + public dir.
COPY --from=build /repo/apps/admin/.next/standalone ./
COPY --from=build /repo/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=build /repo/apps/admin/public ./apps/admin/public

USER nextjs
EXPOSE 3000
# The monorepo standalone server entrypoint.
CMD ["node", "apps/admin/server.js"]
