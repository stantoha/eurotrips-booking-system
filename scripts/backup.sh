#!/usr/bin/env bash
# =============================================================
#  scripts/backup.sh
#  Щоденний backup PostgreSQL → Hetzner Object Storage
#
#  Cron (production): 0 3 * * * deploy /srv/eurotrips/scripts/backup.sh
#  Cron (staging):    0 4 * * 0 deploy /srv/eurotrips-staging/scripts/backup.sh
#
#  Вимоги:
#    - rclone налаштований з профілем [hetzner-s3]
#    - Docker контейнер eurotrips_postgres запущений
#    - /srv/eurotrips/.env містить POSTGRES_USER, POSTGRES_DB
# =============================================================

set -euo pipefail

APP_DIR="${APP_DIR:-/srv/eurotrips}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/eurotrips"
FILENAME="eurotrips_${TIMESTAMP}.dump.gz"
BUCKET="eurotrips-backups"
RETENTION_DAYS=7
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')] BACKUP"

# ── Завантажити змінні ────────────────────────────────────────
if [[ -f "${APP_DIR}/.env" ]]; then
  # shellcheck disable=SC1091
  set -a; source "${APP_DIR}/.env"; set +a
else
  echo "${LOG_PREFIX} ERROR: .env not found at ${APP_DIR}/.env"
  exit 1
fi

PG_USER="${POSTGRES_USER:-eurotrips}"
PG_DB="${POSTGRES_DB:-eurotrips_booking}"
CONTAINER="eurotrips_postgres"

echo "${LOG_PREFIX} Starting backup: ${FILENAME}"
echo "${LOG_PREFIX} Source: ${CONTAINER} → ${PG_DB}"

# ── 1. pg_dump через Docker ───────────────────────────────────
mkdir -p "${BACKUP_DIR}"

if ! docker ps --filter "name=${CONTAINER}" --filter "status=running" | grep -q "${CONTAINER}"; then
  echo "${LOG_PREFIX} ERROR: container ${CONTAINER} is not running"
  exit 1
fi

docker exec "${CONTAINER}" pg_dump \
  -U "${PG_USER}" \
  -d "${PG_DB}" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-acl \
  | gzip > "${BACKUP_DIR}/${FILENAME}"

BACKUP_SIZE=$(du -sh "${BACKUP_DIR}/${FILENAME}" | cut -f1)
echo "${LOG_PREFIX} Dump created: ${BACKUP_SIZE}"

# ── 2. Upload до Hetzner Object Storage ──────────────────────
if ! command -v rclone &>/dev/null; then
  echo "${LOG_PREFIX} ERROR: rclone not found"
  exit 1
fi

rclone copy "${BACKUP_DIR}/${FILENAME}" "hetzner-s3:${BUCKET}/" \
  --stats-log-level NOTICE \
  --retries 3

echo "${LOG_PREFIX} Uploaded → s3://${BUCKET}/${FILENAME}"

# ── 3. Видалити локальний файл ────────────────────────────────
rm -f "${BACKUP_DIR}/${FILENAME}"
echo "${LOG_PREFIX} Local file removed"

# ── 4. Retention: видалити старі бекапи ───────────────────────
DELETED=$(rclone delete "hetzner-s3:${BUCKET}/" \
  --min-age "${RETENTION_DAYS}d" \
  --include "eurotrips_*.dump.gz" \
  --dry-run 2>&1 | wc -l)

rclone delete "hetzner-s3:${BUCKET}/" \
  --min-age "${RETENTION_DAYS}d" \
  --include "eurotrips_*.dump.gz"

echo "${LOG_PREFIX} Cleaned up files older than ${RETENTION_DAYS} days (~${DELETED} files)"

# ── 5. Поточний список бекапів ────────────────────────────────
echo "${LOG_PREFIX} Current backups in s3://${BUCKET}/:"
rclone ls "hetzner-s3:${BUCKET}/" --include "eurotrips_*.dump.gz" \
  | sort -r | head -10

echo "${LOG_PREFIX} Backup completed successfully ✓"
