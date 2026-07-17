# Deploy em VPS — Coach Play

Guia passo a passo para colocar o Coach Play em produção em um VPS (Ubuntu 22.04+
ou Debian 12), usando Docker Compose, Nginx como reverse proxy, TLS via
Let's Encrypt e backup automático do PostgreSQL.

> **Por que não Vercel para a API:** `apps/api` roda um worker BullMQ de longa duração,
> spawna processos FFmpeg e grava vídeos no disco local — nada disso funciona no modelo
> serverless do Vercel (funções sem estado, sem processo persistente, filesystem
> efêmero). O Vercel é uma boa opção para `apps/web` (Next.js), mas a API precisa de um
> host com processo persistente — VPS via Docker Compose (este guia) ou qualquer
> provedor equivalente (Railway, Render, Fly.io etc.).

Pré-requisitos no VPS:
- Docker Engine + Docker Compose plugin (`docker compose version`)
- Domínio (`DOMAIN` no `.env`) já apontando via DNS (registro A) para o IP do VPS
- Portas 80 e 443 liberadas no firewall

---

## 1. Preparar o servidor

```bash
git clone <repo> /opt/coach-play
cd /opt/coach-play
cp .env.example .env
```

Edite `.env` e preencha, no mínimo:

| Variável | Observação |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | credenciais do banco em produção |
| `DATABASE_URL` | trocar o host de `localhost` para `postgres` (nome do serviço no compose): `postgresql://USER:PASS@postgres:5432/DB` |
| `REDIS_URL` | trocar para `redis://redis:6379` |
| `JWT_SECRET` | string aleatória forte (ex.: `openssl rand -hex 64`) |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | chaves de produção |
| `FRONTEND_URL` | `https://SEU_DOMINIO` |
| `NEXT_PUBLIC_API_URL` | `https://SEU_DOMINIO/api/v1` |
| `NODE_ENV` | `production` |
| `DOMAIN` | domínio usado no certificado TLS |
| `LETSENCRYPT_EMAIL` | e-mail para avisos de expiração do Let's Encrypt |

Todas as demais variáveis (SMTP, limites de upload etc.) seguem o mesmo
significado do `.env` de desenvolvimento — ver `docs/ARCHITECTURE.md`.

---

## 2. Build das imagens

```bash
docker compose -f docker-compose.prod.yml build
```

Isso builda `apps/api/Dockerfile` (NestJS, Debian-based — necessário para os
binários FFmpeg/FFprobe estáticos, incompatíveis com musl/Alpine) e
`apps/web/Dockerfile` (Next.js standalone).

---

## 3. Subir banco e cache, aplicar migrations

```bash
docker compose -f docker-compose.prod.yml up -d postgres redis
docker compose -f docker-compose.prod.yml run --rm migrate
```

O serviço `migrate` roda `prisma migrate deploy` usando uma imagem própria
(`target: migrator`) que mantém o Prisma CLI — a imagem de produção da API é
enxuta (`npm prune --omit=dev`) e não o inclui.

Popular os planos (Free/Pro/Premium), se ainda não existirem:

```bash
docker compose -f docker-compose.prod.yml run --rm --entrypoint sh migrate -c "npx prisma db seed"
```

---

## 4. Emitir o certificado TLS (primeira vez)

```bash
chmod +x deploy/certbot/init-letsencrypt.sh deploy/backup/backup-postgres.sh
./deploy/certbot/init-letsencrypt.sh
```

O script:
1. gera `deploy/nginx/conf.d/coachplay.conf` a partir do template com o `DOMAIN` do `.env`;
2. baixa os parâmetros TLS recomendados pelo certbot (`options-ssl-nginx.conf`, `ssl-dhparams.pem`);
3. cria um certificado dummy para o nginx conseguir subir;
4. sobe o nginx, emite o certificado real via desafio HTTP-01 (webroot) e recarrega o nginx.

Use `LETSENCRYPT_STAGING=1` no `.env` para testar contra o ambiente de staging
do Let's Encrypt antes de emitir o certificado real (evita hit no rate limit).

O serviço `certbot` do compose já fica rodando em loop, renovando
automaticamente a cada 12h quando necessário.

---

## 5. Subir a stack completa

```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

Serviços de longa duração: `postgres`, `redis`, `api`, `web`, `nginx`, `certbot`
(todos com `restart: unless-stopped`). `migrate` é sob demanda (`profiles: [tools]`)
e não sobe com `up -d`.

Acesse `https://SEU_DOMINIO` — o nginx encaminha `/` para o Next.js (porta 3000),
`/api/` e `/uploads/` para a API NestJS (porta 3001).

---

## 6. Backup automático do PostgreSQL

```bash
crontab -e
```

Adicione (backup diário às 3h, com log):

```
0 3 * * * cd /opt/coach-play && ./deploy/backup/backup-postgres.sh >> /var/log/coachplay-backup.log 2>&1
```

O script (`deploy/backup/backup-postgres.sh`) gera um dump comprimido em
`BACKUP_DIR` (default `./backups`, configurável no `.env`) e remove backups com
mais de `BACKUP_RETENTION_DAYS` dias (default 14).

**Restaurar um backup:**

```bash
gunzip -c backups/coachplay_20260716_030000.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

---

## 7. Deploy de uma nova versão

```bash
git pull
docker compose -f docker-compose.prod.yml build api web
docker compose -f docker-compose.prod.yml run --rm migrate   # se houver migration nova
docker compose -f docker-compose.prod.yml up -d api web
```

---

## Notas de arquitetura do deploy

- **Debian, não Alpine, na API**: `@ffmpeg-installer/ffmpeg` só publica binários
  linkados contra glibc; em Alpine (musl) o FFmpeg falharia silenciosamente no
  processamento de vídeo. `apps/api/Dockerfile` usa `node:20-bookworm-slim`.
- **`prisma generate` roda no estágio de build com OpenSSL já instalado** —
  sem isso o Prisma não detecta a versão do libssl e baixa o engine binário
  errado (default `openssl-1.1.x`), incompatível com o `libssl3` do estágio
  de produção.
- **Imagem `migrator` separada**: a imagem de produção da API não carrega
  devDependencies (Prisma CLI incluso) — `docker-compose.prod.yml` define um
  serviço `migrate` com `target: migrator` (mesma build, sem `npm prune`)
  especificamente para `prisma migrate deploy` / `db seed`.
- **postgres/redis sem porta exposta ao host** — acessíveis apenas pela rede
  interna do compose (`internal`), diferente do `docker-compose.yml` de
  desenvolvimento.
- **`NEXT_PUBLIC_API_URL` é embutido no build do frontend** (variável pública do
  Next.js, inlined em tempo de build) — mudar seu valor exige rebuildar a
  imagem `web` (`docker compose -f docker-compose.prod.yml build web`), não
  basta reiniciar o container.
- **`deploy/certbot/conf` e `deploy/certbot/www` são bind-mounts** (não volumes
  nomeados) — necessário para o script de inicialização gravar os parâmetros
  TLS diretamente no host antes do primeiro certificado. Ambos os diretórios
  contêm segredos (chaves privadas) e estão no `.gitignore`.
