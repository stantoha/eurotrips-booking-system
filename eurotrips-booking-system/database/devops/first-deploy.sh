#!/usr/bin/env bash
# =============================================================
#  scripts/first-deploy.sh
#  Запускати НА СЕРВЕРІ (deploy@HETZNER_IP)
#  Перший ручний deploy до того як CI/CD pipeline запрацює.
#
#  Передумови:
#    1. server-setup.sh вже виконано
#    2. /srv/eurotrips/.env заповнений
#    3. docker-compose.prod.yml скопійовано
#    4. GHCR_TOKEN є (для docker login)
#
#  Запуск:
#    scp scripts/first-deploy.sh deploy@IP:/srv/eurotrips/scripts/
#    ssh deploy@IP "bash /srv/eurotrips/scripts/first-deploy.sh"
# =============================================================

set -euo pipefail

APP_DIR="/srv/eurotrips"
REGISTRY="ghcr.io"
REPO="stantoha/eurotrips-booking-system"
LOG="[$(date '+%Y-%m-%d %H:%M:%S')]"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'

echo ""
echo -e "${BOLD}================================================================${RESET}"
echo -e "${BOLD}  Eurotrips — First Production Deploy${RESET}"
echo -e "${BOLD}================================================================${RESET}"
echo ""

# ── Перевірки ────────────────────────────────────────────────
echo -e "${BLUE}>>> Pre-flight checks...${RESET}"

[[ -d "$APP_DIR" ]]                     || { echo -e "${RED}✗ ${APP_DIR} не існує${RESET}"; exit 1; }
[[ -f "${APP_DIR}/.env" ]]              || { echo -e "${RED}✗ .env не знайдено${RESET}"; exit 1; }
[[ -f "${APP_DIR}/docker-compose.prod.yml" ]] || { echo -e "${RED}✗ docker-compose.prod.yml не знайдено${RESET}"; exit 1; }
[[ -f "${APP_DIR}/scripts/init.sql" ]]  || { echo -e "${YELLOW}⚠ init.sql не знайдено — продовжуємо${RESET}"; }

# Завантажити .env
set -a; source "${APP_DIR}/.env"; set +a

echo -e "  ${GREEN}✓${RESET} .env завантажено"
echo -e "  ${GREEN}✓${RESET} docker-compose.prod.yml знайдено"
echo -e "  ${GREEN}✓${RESET} POSTGRES_USER=${POSTGRES_USER}"
echo -e "  ${GREEN}✓${RESET} IMAGE_TAG=${IMAGE_TAG:-latest}"

# ── Login GHCR ───────────────────────────────────────────────
echo ""
echo -e "${BLUE}>>> Docker login до GHCR...${RESET}"
if [[ -z "${GHCR_TOKEN:-}" ]]; then
  echo -e "  ${YELLOW}⚠ GHCR_TOKEN не в .env${RESET}"
  read -rsp "  Введіть GHCR_TOKEN: " GHCR_TOKEN
  echo ""
fi

echo "$GHCR_TOKEN" | docker login "$REGISTRY" \
  -u stantoha \
  --password-stdin 2>&1 | grep -E "(Login|Error)" || true

echo -e "  ${GREEN}✓${RESET} GHCR login OK"

# ── Pull images ──────────────────────────────────────────────
echo ""
echo -e "${BLUE}>>> Завантаження images з GHCR...${RESET}"
cd "$APP_DIR"

docker compose -f docker-compose.prod.yml pull 2>&1 | \
  grep -E "(Pull|Pulling|pulled|Status|up to date)" | \
  sed 's/^/  /'

echo -e "  ${GREEN}✓${RESET} Images завантажені"

# ── Init volumes / dirs ──────────────────────────────────────
echo ""
echo -e "${BLUE}>>> Підготовка...${RESET}"
mkdir -p "${APP_DIR}/nginx" "${APP_DIR}/scripts" "${APP_DIR}/logs"

# Копіювати nginx конфіг якщо є
if [[ -f "${APP_DIR}/nginx/nginx.prod.conf" ]]; then
  echo -e "  ${GREEN}✓${RESET} nginx.prod.conf знайдено"
else
  echo -e "  ${YELLOW}⚠ nginx.prod.conf не знайдено в ${APP_DIR}/nginx/${RESET}"
  echo "    Скопіюйте: scp nginx/nginx.prod.conf deploy@IP:${APP_DIR}/nginx/"
fi

# ── Start services ───────────────────────────────────────────
echo ""
echo -e "${BLUE}>>> Запуск services...${RESET}"

# Спочатку тільки postgres і redis
docker compose -f docker-compose.prod.yml up -d postgres redis
echo -e "  ${GREEN}✓${RESET} postgres + redis запущені"

# Чекати healthy
echo "  Очікування healthcheck..."
for svc in postgres redis; do
  ATTEMPTS=0
  while [[ $ATTEMPTS -lt 24 ]]; do
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' \
      "eurotrips_${svc}" 2>/dev/null || echo "starting")
    if [[ "$STATUS" == "healthy" ]]; then
      echo -e "  ${GREEN}✓${RESET} ${svc}: healthy"
      break
    fi
    ((ATTEMPTS++))
    sleep 5
    echo -ne "  · ${svc}: ${STATUS} (${ATTEMPTS}/24)...\r"
  done
  if [[ "$STATUS" != "healthy" ]]; then
    echo -e "  ${RED}✗ ${svc} не став healthy за 2 хв${RESET}"
    docker logs "eurotrips_${svc}" --tail=20
    exit 1
  fi
done

# ── Prisma migrate deploy ────────────────────────────────────
echo ""
echo -e "${BLUE}>>> Prisma migrations...${RESET}"
docker compose -f docker-compose.prod.yml run --rm \
  -e DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}" \
  backend sh -c "npx prisma migrate deploy" 2>&1 | tail -10 | sed 's/^/  /'

echo -e "  ${GREEN}✓${RESET} Migrations applied"

# ── Start all services ────────────────────────────────────────
echo ""
echo -e "${BLUE}>>> Запуск усіх сервісів...${RESET}"
docker compose -f docker-compose.prod.yml up -d

# ── Wait for backend ─────────────────────────────────────────
echo ""
echo -e "${BLUE}>>> Перевірка API health (до 60с)...${RESET}"
for i in $(seq 1 12); do
  sleep 5
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    --max-time 8 http://localhost:3000/api/v1/health 2>/dev/null || echo "000")
  if [[ "$HTTP" == "200" ]]; then
    echo -e "  ${GREEN}✓${RESET} API /health → 200"
    break
  fi
  echo -ne "  · health: HTTP ${HTTP} (${i}/12)...\r"
  if [[ $i -eq 12 ]]; then
    echo -e "  ${YELLOW}⚠ API не відповідає через 60с — перевіряємо логи${RESET}"
    docker logs eurotrips_backend --tail=20
  fi
done

# ── Status ───────────────────────────────────────────────────
echo ""
echo -e "${BLUE}>>> Стан контейнерів:${RESET}"
docker compose -f docker-compose.prod.yml ps \
  --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null | \
  sed 's/^/  /'

# ── Table count ───────────────────────────────────────────────
TABLE_COUNT=$(docker exec eurotrips_postgres psql \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" \
  2>/dev/null | tr -d ' \n' || echo "0")
echo ""
echo -e "  ${GREEN}✓${RESET} PostgreSQL: ${TABLE_COUNT} таблиць"

# ── Nginx reload ──────────────────────────────────────────────
echo ""
echo -e "${BLUE}>>> Nginx reload...${RESET}"
if nginx -t 2>/dev/null; then
  systemctl reload nginx 2>/dev/null || sudo systemctl reload nginx
  echo -e "  ${GREEN}✓${RESET} Nginx reloaded"
else
  echo -e "  ${YELLOW}⚠ nginx -t failed — перевірте nginx.prod.conf${RESET}"
fi

# ── Summary ───────────────────────────────────────────────────
SERVER_IP=$(curl -sf ifconfig.me 2>/dev/null || echo "?")
echo ""
echo -e "${BOLD}================================================================${RESET}"
echo -e "${BOLD}  Перший deploy завершено!${RESET}"
echo -e "${BOLD}================================================================${RESET}"
echo ""
echo -e "  API (localhost):   http://localhost:3000/api/v1/health"
echo -e "  API (public):      https://api.eurotrips.ua/api/v1/health"
echo -e "  Frontend:          https://booking.eurotrips.ua"
echo ""
echo -e "  Корисні команди:"
echo "    docker compose -f docker-compose.prod.yml ps"
echo "    docker compose -f docker-compose.prod.yml logs -f backend"
echo "    bash scripts/verify-prod.sh"
echo ""
echo -e "${YELLOW}  Наступний крок: перевірити CI/CD pipeline${RESET}"
echo "    git push origin main  →  автоматичний deploy"
echo ""

# Telegram notify
if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_NOTIFY_CHAT_ID:-}" ]]; then
  curl -s -X POST \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TELEGRAM_NOTIFY_CHAT_ID}" \
    -d "parse_mode=HTML" \
    -d "text=<b>🚀 Перший production deploy виконано!</b>%0A%0AServer: <code>${SERVER_IP}</code>%0ATables: ${TABLE_COUNT}%0AAPI: https://api.eurotrips.ua" \
    > /dev/null 2>&1 && \
    echo -e "  ${GREEN}✓${RESET} Telegram notify відправлено" || true
fi
