# ─── Stage 1: Dependencies + Prisma generation ────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Copy everything needed for install AND prisma generate in one stage.
# prisma.config.ts + schema.prisma must both be present before `prisma generate`.
COPY package*.json       ./
COPY prisma.config.ts    ./
COPY prisma              ./prisma/

# Install all deps (including devDependencies — prisma CLI is a devDep)
RUN npm ci

# Generate Prisma client into src/generated/prisma-client
# (output path is defined in prisma/schema.prisma: output = "../src/generated/prisma-client")
# The directory must exist before the generator tries to write into it.
RUN mkdir -p src/generated && npx prisma generate

# ─── Stage 2: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Carry over node_modules AND the generated Prisma client from deps stage
COPY --from=deps /app/node_modules   ./node_modules
COPY --from=deps /app/src/generated  ./src/generated

# Copy full source — overlays src/**/* on top of the generated files already placed above
COPY . .

# Compile TypeScript → dist/
RUN npm run build

# ─── Stage 3: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nestjs

# Runtime artefacts only — compiled output + deps + generated client + migrations
COPY --from=builder /app/dist             ./dist
COPY --from=builder /app/node_modules     ./node_modules
COPY --from=builder /app/src/generated    ./src/generated
COPY --from=builder /app/prisma           ./prisma
COPY --from=builder /app/package.json     ./package.json
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

USER nestjs

EXPOSE 3001

# Run migrations on every start (safe/idempotent), then launch the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]