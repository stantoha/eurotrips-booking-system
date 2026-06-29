# =============================================================================
# EUROTRIPS — Dockerfile (Multi-stage)
# =============================================================================

# ── Stage 1: Builder (all deps + compile + generate) ──────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY tsconfig*.json ./
COPY prisma ./prisma/

# Install all deps (including devDeps) so prisma CLI is available
RUN npm ci

COPY src ./src

# Generate Prisma client, then compile TypeScript
RUN npx prisma generate && \
    npm run build

# ── Stage 2: Production ────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache dumb-init chromium && \
    echo "PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser" >> /etc/environment

COPY package*.json ./
COPY prisma ./prisma/

# Install only production deps; postinstall triggers prisma generate
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000

USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
