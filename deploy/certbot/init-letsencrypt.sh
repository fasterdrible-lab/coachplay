#!/usr/bin/env bash
# Emite o primeiro certificado Let's Encrypt para o domínio configurado em .env
# e gera o nginx.conf final a partir do template (deploy/nginx/coachplay.conf.template).
#
# Uso (na raiz do repo, no VPS): ./deploy/certbot/init-letsencrypt.sh
# Requer: DOMAIN e LETSENCRYPT_EMAIL definidos em .env; docker + docker compose.
#
# Baseado no fluxo padrão nginx+certbot (dummy cert -> sobe nginx -> emite cert real).

set -euo pipefail
cd "$(dirname "$0")/../.."

if [ -f .env ]; then set -a; source .env; set +a; fi

: "${DOMAIN:?Defina DOMAIN no .env (ex.: coachplay.suaempresa.com)}"
: "${LETSENCRYPT_EMAIL:?Defina LETSENCRYPT_EMAIL no .env}"

COMPOSE="docker compose -f docker-compose.prod.yml"
CONF_DIR="deploy/nginx/conf.d"
DUMMY_PATH="/etc/letsencrypt/live/${DOMAIN}"
STAGING=${LETSENCRYPT_STAGING:-0}

mkdir -p "$CONF_DIR" deploy/certbot/conf deploy/certbot/www

echo "==> Gerando nginx conf para $DOMAIN"
DOMAIN="$DOMAIN" envsubst '${DOMAIN}' < deploy/nginx/coachplay.conf.template > "$CONF_DIR/coachplay.conf"

if [ ! -e deploy/certbot/conf/options-ssl-nginx.conf ] || [ ! -e deploy/certbot/conf/ssl-dhparams.pem ]; then
  echo "==> Baixando parâmetros TLS recomendados pelo certbot (options-ssl-nginx.conf, ssl-dhparams.pem)"
  curl -fsS https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
    -o deploy/certbot/conf/options-ssl-nginx.conf
  curl -fsS https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/ssl-dhparams.pem \
    -o deploy/certbot/conf/ssl-dhparams.pem
fi

echo "==> Criando certificado dummy (para o nginx conseguir subir antes do cert real)"
$COMPOSE run --rm --entrypoint sh certbot -c "
  mkdir -p '$DUMMY_PATH' &&
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout '$DUMMY_PATH/privkey.pem' \
    -out '$DUMMY_PATH/fullchain.pem' \
    -subj '/CN=localhost'
"

echo "==> Subindo nginx com o certificado dummy"
$COMPOSE up -d nginx

echo "==> Removendo certificado dummy"
$COMPOSE run --rm --entrypoint sh certbot -c "
  rm -rf '/etc/letsencrypt/live/$DOMAIN' &&
  rm -rf '/etc/letsencrypt/archive/$DOMAIN' &&
  rm -rf '/etc/letsencrypt/renewal/$DOMAIN.conf'
"

echo "==> Solicitando certificado real do Let's Encrypt"
STAGING_ARG=""
if [ "$STAGING" != "0" ]; then STAGING_ARG="--staging"; fi

$COMPOSE run --rm --entrypoint certbot certbot certonly --webroot -w /var/www/certbot \
  $STAGING_ARG \
  --email "$LETSENCRYPT_EMAIL" \
  -d "$DOMAIN" \
  --rsa-key-size 4096 \
  --agree-tos \
  --non-interactive \
  --force-renewal

echo "==> Recarregando nginx com o certificado real"
$COMPOSE exec nginx nginx -s reload

echo "==> Concluído. Certificado válido para $DOMAIN emitido em /etc/letsencrypt (volume certbot_conf)."
echo "    O serviço 'certbot' já roda em loop e renova automaticamente a cada 12h quando necessário."
