#
# 🧑‍💻 Stage 1: Install dependencies + generate Prisma client
#
FROM node:22-alpine AS development

RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=development

RUN addgroup --system nodejs && \
    adduser  --system nestjs

COPY --chown=nestjs:nodejs package*.json    ./
COPY --chown=nestjs:nodejs prisma.config.ts ./
COPY --chown=nestjs:nodejs prisma           ./prisma/

RUN npm ci

# Pass a dummy DATABASE_URL so prisma.config.ts env() validation passes.
# `prisma generate` only reads the schema — it never connects to the database.
RUN mkdir -p src/generated && \
    DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

USER nestjs

#
# 🏡 Stage 2: Production build
#
FROM node:22-alpine AS build

RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system nodejs && \
    adduser  --system nestjs

COPY --chown=nestjs:nodejs --from=development /app/node_modules  ./node_modules
COPY --chown=nestjs:nodejs --from=development /app/src/generated ./src/generated

COPY --chown=nestjs:nodejs . .

RUN npm run build

RUN npm prune --production

USER nestjs

#
# 🚀 Stage 3: Production server
#
FROM node:22-alpine AS production

RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system nodejs && \
    adduser  --system nestjs

COPY --chown=nestjs:nodejs --from=build /app/dist             ./dist
COPY --chown=nestjs:nodejs --from=build /app/node_modules     ./node_modules
COPY --chown=nestjs:nodejs --from=build /app/src/generated    ./src/generated
COPY --chown=nestjs:nodejs --from=build /app/prisma           ./prisma
COPY --chown=nestjs:nodejs --from=build /app/package.json     ./package.json
COPY --chown=nestjs:nodejs --from=build /app/prisma.config.ts ./prisma.config.ts

USER nestjs

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]