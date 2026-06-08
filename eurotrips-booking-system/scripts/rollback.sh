#!/usr/bin/env bash
# =============================================================
#  scripts/rollback.sh
#  Ручний rollback на попередню версію production
#
#  Використання:
#    ./scripts/rollback.sh <commit-sha>
#    ./scripts/rollback.sh a1b2c3d4
#
#  Приклад (знайти SHA в GHCR або GitHub Actions logs):
#    ./scripts/rollback.sh abc123def456
#
#  Скрипт:
#    1. Перевіряє що image існує в GHCR
#    2. Зберігає поточний IMAGE_TAG (для відновлення)
#    3. Перезапускає backend і frontend зі старим SHA
#    4. Виконує health check
#    5. Telegram notify про результат
# =============================================================

set -euo pipefail

TARGET_SHA="${1:-}"
APP_DIR="${APP_DIR:-/srv/eurotrips}"
REGISTRY="ghcr.io"
REPO="stantoha/eurotrips-booking-system"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')] ROLLBACK"

# ── Валідація ────────────────────────────────────────────────
if [[ -z "$TARGET_SHA" ]]; then
  echo "================================================================"
  echo "  Eurotrips Rollback Tool"
  echo "================================================================"
  echo ""
  echo "  Використання: ./rollback.sh <commit-sha>"
  echo ""
  echo "  Доступні теги (з GHCR):"
  docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}" \
    | grep "${REPO}" | grep -v "latest\|staging" | head -10 || \
    echo "  (images не знайдені локально — шукайте на https://ghcr.io/${REPO})"
  echo ""
  echo "  Або перегляньте SHA в GitHub Actions:"
  echo "  https://github.com/${REPO}/actions"
  exit 1
fi

echo "${LOG_PREFIX} Target SHA: ${TARGET_SHA}"

# ── Завантажити .env ─────────────────────────────────────────
if [[ -f "${APP_DIR}/.env" ]]; then
  set -a; source "${APP_DIR}/.env"; set +a
fi

# ── Зберегти поточний tag ────────────────────────────────────
CURRENT_TAG="${IMAGE_TAG:-latest}"
echo "${LOG_PREFIX} Current IMAGE_TAG: ${CURRENT_TAG}"
echo "${LOG_PREFIX} Rolling back to:  ${TARGET_SHA}"

# ── Pull target image ────────────────────────────────────────
cd "${APP_DIR}"

echo "${LOG_PREFIX} Pulling backend:${TARGET_SHA}..."
docker pull "${REGISTRY}/${REPO}/backend:${TARGET_SHA}" || {
  echo "${LOG_PREFIX} ERROR: image backend:${TARGET_SHA} not found in GHCR"
  echo "  Перевірте: https://ghcr.io/${REPO}"
  exit 1
}

echo "${LOG_PREFIX} Pulling frontend:${TARGET_SHA}..."
docker pull "${REGISTRY}/${REPO}/frontend:${TARGET_SHA}" || {
  echo "${LOG_PREFIX} ERROR: image frontend:${TARGET_SHA} not found in GHCR"
  exit 1
}

# ── Оновити IMAGE_TAG у .env ─────────────────────────────────
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=${TARGET_SHA}/" "${APP_DIR}/.env"
echo "${LOG_PREFIX} .env updated: IMAGE_TAG=${TARGET_SHA}"

# ── Restart services ─────────────────────────────────────────
echo "${LOG_PREFIX} Restarting backend..."
IMAGE_TAG="${TARGET_SHA}" \
  docker compose -f docker-compose.prod.yml up -d --no-deps backend
sleep 8

echo "${LOG_PREFIX} Restarting frontend..."
IMAGE_TAG="${TARGET_SHA}" \
  docker compose -f docker-compose.prod.yml up -d --no-deps frontend
sleep 5

# ── Health check ─────────────────────────────────────────────
echo "${LOG_PREFIX} Running health checks..."
SUCCESS=false

for attempt in 1 2 3; do
  sleep 10
  if curl -sf "https://api.eurotrips.ua/api/v1/health" > /dev/null 2>&1; then
    SUCCESS=true
    echo "${LOG_PREFIX} Health check passed (attempt ${attempt}) ✓"
    break
  fi
  echo "${LOG_PREFIX} Health check attempt ${attempt} failed, retrying..."
done

# ── Результат ────────────────────────────────────────────────
if [[ "$SUCCESS" == "true" ]]; then
  echo ""
  echo "================================================================"
  echo "${LOG_PREFIX} ROLLBACK SUCCESSFUL ✓"
  echo "  Rolled back to: ${TARGET_SHA}"
  echo "  API health:     https://api.eurotrips.ua/api/v1/health"
  echo "================================================================"

  # Telegram notify
  if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_NOTIFY_CHAT_ID:-}" ]]; then
    curl -s -X POST \
      "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_NOTIFY_CHAT_ID}" \
      -d "parse_mode=HTML" \
      -d "text=<b>⏪ Production ROLLBACK виконано</b>%0A%0A<b>SHA:</b> <code>${TARGET_SHA}</code>%0AПопередній: <code>${CURRENT_TAG}</code>" \
      > /dev/null
  fi
else
  echo ""
  echo "================================================================"
  echo "${LOG_PREFIX} ROLLBACK FAILED ✗"
  echo "  Health check не пройшов після 3 спроб"
  echo "  Відновлення попереднього тегу: ${CURRENT_TAG}"
  echo "================================================================"

  # Відновити попередній tag
  sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=${CURRENT_TAG}/" "${APP_DIR}/.env"

  if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_NOTIFY_CHAT_ID:-}" ]]; then
    curl -s -X POST \
      "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_NOTIFY_CHAT_ID}" \
      -d "parse_mode=HTML" \
      -d "text=<b>❌ Rollback FAILED</b>%0ASHA: <code>${TARGET_SHA}</code>%0AПеревір логи на сервері" \
      > /dev/null
  fi
  exit 1
fi
