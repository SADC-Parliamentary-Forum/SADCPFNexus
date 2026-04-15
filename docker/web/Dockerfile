# ── Stage 1: Dependencies ──────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm ci

# ── Stage 2: Development ───────────────────────────────────────────────────────
# Source is baked in via COPY so the image works standalone.
# When a volume mount (./web:/app) is present it overrides COPY'd source,
# enabling live HMR without rebuilding the image.
FROM node:20-alpine AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# Bake source into image as fallback (volume mount overrides this at runtime)
COPY . .
ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1 \
    WATCHPACK_POLLING=true \
    CHOKIDAR_USEPOLLING=true \
    CHOKIDAR_INTERVAL=500
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ── Stage 3: Builder (production) ─────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time env vars — NEXT_PUBLIC_* are baked into the bundle at build time
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
ARG NEXT_OUTPUT=standalone
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_OUTPUT=$NEXT_OUTPUT \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run verify:build-context && npm run build

# ── Stage 4: Production runner ─────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
# standalone output bundles only what's needed — no full node_modules required
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
