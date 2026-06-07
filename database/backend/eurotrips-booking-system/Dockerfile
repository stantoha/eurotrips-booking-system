# =============================================================================
# EUROTRIPS — Dockerfile (Multi-stage)
# =============================================================================

# ── Stage 1: Dependencies ──────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --only=production && \
    npx prisma generate

# ── Stage 2: Builder ───────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY tsconfig*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY src ./src

RUN npm run build && \
    npx prisma generate

# ── Stage 3: Production ────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Мінімальні залежності для prod
RUN apk add --no-cache dumb-init

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Chromium для Puppeteer (PDF генерація)
RUN apk add --no-cache chromium && \
    echo "PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser" >> /etc/environment

EXPOSE 3000

USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
