# Self-hosted (Hetzner) production image — built with output: "standalone"
# so the runtime image only carries the traced files server.js needs, not
# the full node_modules tree. Build this on a machine with real RAM/CPU
# headroom (CI, or a dev machine) — the target server is a small 2-core/4GB
# box and next.config.ts already documents that a full webpack+PWA+Sentry
# build risks SIGKILL under tight memory, same reasoning as the existing
# Vercel build tuning (cpus: 1, workerThreads: false).

FROM node:20-slim AS base
# Pin pnpm explicitly — letting corepack resolve "latest" grabbed pnpm 11.x,
# which requires Node 22+ (node:sqlite builtin) and hard-fails on Node 20.
RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

# ---- deps: install once, cached across builds ----
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# V8's default old-space limit (~1.7GB) is smaller than this build's real
# peak usage — raise it explicitly. Needs the server's swap to back it on a
# 4GB box; on CI with more real RAM this just goes unused.
ENV NODE_OPTIONS=--max-old-space-size=3072
RUN pnpm build

# ---- runtime: minimal, non-root ----
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# output: "standalone" traces only the files server.js needs; public/ and
# .next/static are deliberately not copied by Next.js itself (see
# next.config.js output docs) — copied explicitly below.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
