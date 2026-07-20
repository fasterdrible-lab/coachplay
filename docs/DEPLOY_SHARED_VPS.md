# Deploy em VPS compartilhado — Coach Play

Variante de `docs/DEPLOY.md` para quando o VPS **não é dedicado** ao Coach
Play — já hospeda outros projetos seus. Usa `docker-compose.vps.yml` (não
`docker-compose.prod.yml`) e `deploy/nginx/coachplay-shared-vps.conf.template`
(não `coachplay.conf.template`).

## Por que uma variante separada

Investigando o VPS de coachplayals.com.br (2026-07-20), encontramos:

- O servidor não tem um reverse proxy único compartilhado por todos os
  projetos. Cada projeto (`easysub`, `nexals`, etc.) tem seu **próprio**
  container de nginx, e cada um tenta ocupar as portas 80/443 sozinho — só
  um consegue estar de pé por vez. Hoje é o `easysub-nginx-1` que está
  rodando; outros (`nexals`) ficam parados por causa desse mesmo conflito.
- `docker-compose.prod.yml` do Coach Play sobe seu próprio `nginx`/`certbot`
  nas portas 80/443 — entraria em conflito direto com o `easysub-nginx-1`
  já rodando.
- Solução: o Coach Play **não sobe nginx próprio**. Em vez disso, vira mais
  um vhost dentro do nginx que já está de pé (`easysub-nginx-1`), com os
  containers do Coach Play conectados à mesma rede Docker dele
  (`easysub_easysub`, referenciada como rede externa em
  `docker-compose.vps.yml`).
- Nomes de container prefixados (`coachplay-api`, `coachplay-web`, etc.) —
  evita colisão de alias de rede com os containers do outro projeto que
  também está na rede `easysub_easysub`.

## Certificado TLS — desafio DNS, não webroot

O `easysub-nginx-1` não tem (nem precisa ganhar) acesso de escrita a nenhum
diretório de desafio ACME — usamos o desafio **DNS-01** do certbot, que só
depende de um registro TXT no DNS, sem tocar no nginx que já está rodando:

```bash
certbot certonly --manual --preferred-challenges dns \
  -d coachplayals.com.br -d www.coachplayals.com.br
```

O certbot vai pedir pra criar um registro TXT tipo `_acme-challenge.coachplayals.com.br`
com o valor que ele mostrar, no DNS do domínio (Registro.br). Depois de
confirmar que o registro propagou (`dig TXT _acme-challenge.coachplayals.com.br`),
segue no prompt do certbot. O certificado sai em
`/etc/letsencrypt/live/coachplayals.com.br/` — como esse diretório já é
montado (read-only) no `easysub-nginx-1`, o certificado fica visível pra ele
automaticamente, sem precisar mexer no container.

**Trade-off**: sem plugin de API do provedor de DNS, a renovação automática
(`certbot renew` via cron) não funciona pro desafio DNS-01 manual — precisa
repetir esse passo a cada renovação (~60-90 dias) até configurar um plugin
de DNS com API (ex.: `certbot-dns-cloudflare` se o DNS migrar pra lá).

## Passo a passo

1. **DNS**: registro A de `coachplayals.com.br` e `www.coachplayals.com.br`
   apontando pro IP do VPS (feito no Registro.br).
2. **Clonar e configurar** (no VPS, ex. `/opt/coachplay`):
   ```bash
   git clone <repo> /opt/coachplay && cd /opt/coachplay
   cp .env.example .env
   # editar .env: mesmas variáveis do docs/DEPLOY.md (seção 1), com:
   #   FRONTEND_URL=https://coachplayals.com.br
   #   NEXT_PUBLIC_API_URL=https://coachplayals.com.br/api/v1
   #   DATABASE_URL=postgresql://USER:PASS@postgres:5432/DB
   #   REDIS_URL=redis://redis:6379
   ```
3. **Build + banco**:
   ```bash
   docker compose -f docker-compose.vps.yml build
   docker compose -f docker-compose.vps.yml up -d postgres redis
   docker compose -f docker-compose.vps.yml run --rm migrate
   docker compose -f docker-compose.vps.yml run --rm --entrypoint sh migrate -c "npx prisma db seed"
   ```
4. **Certificado TLS** (ver seção acima).
5. **Subir api/web**:
   ```bash
   docker compose -f docker-compose.vps.yml up -d
   ```
6. **Vhost no nginx compartilhado**:
   ```bash
   envsubst '${DOMAIN}' < deploy/nginx/coachplay-shared-vps.conf.template > /opt/easysub/nginx/conf.d/coachplay.conf
   docker exec easysub-nginx-1 nginx -t   # valida a config antes de recarregar
   docker exec easysub-nginx-1 nginx -s reload
   ```
   `nginx -s reload` recarrega a configuração sem derrubar conexões — não é
   um restart do container, os outros domínios servidos por ele não sofrem
   interrupção perceptível.
7. Acesse `https://coachplayals.com.br`.

## Importante: recriar `coachplay-api`/`coachplay-web` sempre exige reload do nginx

Toda vez que um desses containers é recriado (`up -d web`, `up -d api`, deploy de nova versão),
o IP dele na rede `easysub_easysub` muda. O `easysub-nginx-1` resolve o hostname (`coachplay-api`/
`coachplay-web`) uma vez e cacheia o IP resolvido — sem um reload, ele continua tentando o IP
antigo e todo request retorna 502 (`connect() failed (111: Connection refused)`), mesmo com o
container novo saudável. Sempre rodar depois de qualquer recreate:

```bash
docker exec easysub-nginx-1 nginx -s reload
```

## `web` precisa de `HOSTNAME: 0.0.0.0` explícito

O Next.js standalone usa a env var `HOSTNAME` como endereço de bind do servidor. O Docker define
`HOSTNAME` automaticamente como o ID do container — como `coachplay-web` está em duas redes
(`internal` + `easysub_easysub`), esse ID resolve para **dois** IPs diferentes em `/etc/hosts`
dentro do container, e o servidor só faz bind no primeiro deles. Se esse primeiro IP for o da
rede `internal`, o nginx compartilhado (que está na rede `easysub_easysub`) nunca consegue
alcançá-lo, mesmo com o container saudável e o IP/DNS corretos (connection refused). Por isso
`docker-compose.vps.yml` já define `HOSTNAME: 0.0.0.0` no serviço `web`, forçando bind em todas
as interfaces — não remover essa variável.

## Deploy de uma nova versão

```bash
git pull
docker compose -f docker-compose.vps.yml build api web
docker compose -f docker-compose.vps.yml run --rm migrate   # se houver migration nova
docker compose -f docker-compose.vps.yml up -d api web
```

## Backup do PostgreSQL

Mesmo script de `docs/DEPLOY.md` (`deploy/backup/backup-postgres.sh`), só
trocando o nome do container nos comandos (`coachplay-postgres` em vez do
padrão do compose dedicado).
