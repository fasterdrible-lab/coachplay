#!/usr/bin/env bash
# Backup automático do PostgreSQL via pg_dump (dentro do container postgres).
# Uso: ./deploy/backup/backup-postgres.sh
# Agendar via cron no VPS, ex. (todo dia às 3h): crontab -e
#   0 3 * * * cd /opt/coach-play && ./deploy/backup/backup-postgres.sh >> /var/log/coachplay-backup.log 2>&1

set -euo pipefail
cd "$(dirname "$0")/../.."

if [ -f .env ]; then set -a; source .env; set +a; fi

: "${POSTGRES_USER:?Defina POSTGRES_USER no .env}"
: "${POSTGRES_DB:?Defina POSTGRES_DB no .env}"

BACKUP_DIR=${BACKUP_DIR:-./backups}
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-14}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="$BACKUP_DIR/coachplay_${TIMESTAMP}.sql.gz"
COMPOSE="docker compose -f docker-compose.prod.yml"

mkdir -p "$BACKUP_DIR"

echo "==> Gerando dump de '$POSTGRES_DB' em $FILENAME"
$COMPOSE exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$FILENAME"

if [ ! -s "$FILENAME" ]; then
  echo "ERRO: dump vazio ou falhou — removendo arquivo inválido" >&2
  rm -f "$FILENAME"
  exit 1
fi

echo "==> Backup concluído: $(du -h "$FILENAME" | cut -f1)"

echo "==> Removendo backups com mais de ${RETENTION_DAYS} dias"
find "$BACKUP_DIR" -name 'coachplay_*.sql.gz' -mtime "+${RETENTION_DAYS}" -print -delete

echo "==> Backups atuais em $BACKUP_DIR:"
ls -lh "$BACKUP_DIR"
