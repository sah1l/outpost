FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

FROM base AS deps
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/app/package.json ./apps/app/
RUN pnpm install --frozen-lockfile --filter @offsprint/app...

FROM base AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/app/node_modules ./apps/app/node_modules
COPY . .
RUN pnpm --filter @offsprint/app build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /repo/apps/app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/app/.next/static ./apps/app/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/app/public ./apps/app/public
USER nextjs
EXPOSE 8080
CMD ["node", "apps/app/server.js"]
