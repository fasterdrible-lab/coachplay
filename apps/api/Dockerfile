# syntax=docker/dockerfile:1

# Build de produção da API (NestJS). Contexto: raiz do monorepo — necessário
# para o npm workspaces resolver o package-lock.json compartilhado.
# Debian (não Alpine): @ffmpeg-installer/ffmpeg não publica binário musl.

FROM node:20-bookworm-slim AS build
# openssl precisa estar presente já no build: `prisma generate` detecta a versão
# do libssl no momento da geração e baixa o engine binário correspondente —
# sem isso, ele assume "openssl-1.1.x" e pode gerar um engine incompatível
# com o libssl3 instalado no estágio de produção.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

COPY apps/api apps/api
COPY packages/shared packages/shared

RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npm run build --workspace=apps/api

# ---- migrator: imagem com Prisma CLI para `migrate deploy` / `db seed` em produção ----
FROM build AS migrator
WORKDIR /repo/apps/api
ENTRYPOINT ["npx", "prisma"]
CMD ["migrate", "deploy"]

# ---- pruned: mesma build, sem devDependencies ----
FROM build AS pruned
RUN npm prune --omit=dev

FROM node:20-bookworm-slim AS production
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends dumb-init openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /repo
COPY --from=pruned /repo/node_modules node_modules
COPY --from=pruned /repo/apps/api/dist apps/api/dist
COPY --from=pruned /repo/apps/api/prisma apps/api/prisma
COPY --from=pruned /repo/apps/api/package.json apps/api/package.json

WORKDIR /repo/apps/api
EXPOSE 3001
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
