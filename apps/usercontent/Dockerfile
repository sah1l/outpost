FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

FROM base AS deps
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/usercontent/package.json ./apps/usercontent/
RUN pnpm install --frozen-lockfile --filter @offsprint/usercontent...

FROM base AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/usercontent/node_modules ./apps/usercontent/node_modules
COPY . .
RUN pnpm --filter @offsprint/usercontent build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /repo/apps/usercontent/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/usercontent/.next/static ./apps/usercontent/.next/static
USER nextjs
EXPOSE 8080
CMD ["node", "apps/usercontent/server.js"]
