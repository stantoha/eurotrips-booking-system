# =============================================================================
# EUROTRIPS — Dockerfile (Multi-stage)
# =============================================================================

# ── Stage 1: Builder ───────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# openssl required for Prisma to detect OpenSSL version during prisma generate
RUN apk add --no-cache openssl

COPY package*.json ./
COPY tsconfig*.json ./
COPY prisma ./prisma/

# Full install (devDeps included) — postinstall runs prisma generate
RUN npm ci

COPY src ./src

RUN npm run build

# ── Stage 2: Production ────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# openssl required for Prisma engine detection at runtime
RUN apk add --no-cache dumb-init openssl chromium && \
    echo "PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser" >> /etc/environment

COPY package*.json ./
COPY prisma ./prisma/

# postinstall triggers prisma generate — openssl present → correct linux-musl-openssl-3.0.x binary
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000

USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
