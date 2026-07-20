# syntax=docker/dockerfile:1

# Build de produção do frontend (Next.js standalone). Contexto: raiz do monorepo.

FROM node:20-alpine AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
# apps/api/package.json tem "postinstall": "prisma generate" (ver CHANGELOG 0.29.0),
# que dispara em qualquer "npm ci" na raiz do workspace — mesmo aqui, buildando só o
# web — então o schema precisa estar presente antes do npm ci.
COPY apps/api/prisma apps/api/prisma
RUN npm ci

COPY apps/web apps/web
COPY packages/shared packages/shared

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build --workspace=apps/web

FROM node:20-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public

EXPOSE 3000
ENV PORT=3000
CMD ["node", "apps/web/server.js"]
