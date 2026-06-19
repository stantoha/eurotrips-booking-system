#!/usr/bin/env bash
# =============================================================
#  scripts/verify-prod.sh
#  Запускати НА СЕРВЕРІ після server-setup.sh
#  або ЛОКАЛЬНО після першого deploy.
#
#  Перевіряє:
#    1. Docker і Compose
#    2. UFW firewall
#    3. DNS resolution
#    4. SSL сертифікати
#    5. Nginx
#    6. Docker containers (running/healthy)
#    7. API health endpoint
#    8. PostgreSQL (tables count)
#    9. Redis
#   10. Backup script
#
#  Запуск:
#    On server:  bash /srv/eurotrips/scripts/verify-prod.sh
#    Locally:    bash scripts/verify-prod.sh --remote deploy@IP
# =============================================================

set -euo pipefail

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
BLUE='\033[0;34m'; BOLD='\033[1m'; GRAY='\033[0;37m'; RESET='\033[0m'

REMOTE=""
APP_DIR="/srv/eurotrips"
API_URL="https://api.eurotrips.ua"
FRONT_URL="https://booking.eurotrips.ua"
PASS=0; FAIL=0; WARN=0

# ── Parse args ───────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --remote) REMOTE="$2"; shift 2 ;;
    --app-dir) APP_DIR="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# ── Helper functions ─────────────────────────────────────────
ok()   { echo -e "  ${GREEN}✓${RESET} $1"; ((PASS++)); }
fail() { echo -e "  ${RED}✗${RESET} $1"; ((FAIL++)); }
warn() { echo -e "  ${YELLOW}⚠${RESET} $1"; ((WARN++)); }
info() { echo -e "  ${GRAY}·${RESET} $1"; }
sep()  { echo ""; echo -e "${BOLD}── $1 ──────────────────────────────────────────────────${RESET}"; }

check() {
  local desc="$1"; shift
  if "$@" > /dev/null 2>&1; then
    ok "$desc"
  else
    fail "$desc"
  fi
}

# ── Remote mode ──────────────────────────────────────────────
if [[ -n "$REMOTE" ]]; then
  echo -e "${BLUE}Запуск верифікації на ${REMOTE}...${RESET}"
  ssh "$REMOTE" "bash -s" < "$0" -- --app-dir "$APP_DIR"
  exit $?
fi

# ── Header ───────────────────────────────────────────────────
echo ""
echo -e "${BOLD}================================================================${RESET}"
echo -e "${BOLD}  Eurotrips Production Verification${RESET}"
echo -e "${BOLD}  $(date '+%Y-%m-%d %H:%M:%S UTC')${RESET}"
echo -e "${BOLD}================================================================${RESET}"

# ── 1. Docker ────────────────────────────────────────────────
sep "1. Docker"
if command -v docker &>/dev/null; then
  DOCKER_VER=$(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)
  ok "Docker ${DOCKER_VER}"
else
  fail "Docker не встановлено"
fi

if docker compose version &>/dev/null 2>&1; then
  COMPOSE_VER=$(docker compose version | grep -oP '\d+\.\d+\.\d+' | head -1)
  ok "Docker Compose ${COMPOSE_VER}"
else
  fail "Docker Compose v2 не знайдено"
fi

check "Docker daemon running" systemctl is-active docker

# ── 2. Firewall ──────────────────────────────────────────────
sep "2. UFW Firewall"
if command -v ufw &>/dev/null; then
  UFW_STATUS=$(ufw status 2>/dev/null | head -1)
  if echo "$UFW_STATUS" | grep -q "active"; then
    ok "UFW active"
    for port in 22 80 443; do
      if ufw status | grep -qE "^${port}(/tcp)?.*ALLOW"; then
        ok "Port ${port} allowed"
      else
        warn "Port ${port} not explicitly allowed"
      fi
    done
  else
    warn "UFW not active — ${UFW_STATUS}"
  fi
else
  warn "UFW не встановлено"
fi

# ── 3. DNS ───────────────────────────────────────────────────
sep "3. DNS Resolution"
MY_IP=$(curl -sf ifconfig.me 2>/dev/null || echo "unknown")
info "Server IP: ${MY_IP}"

for domain in "api.eurotrips.ua" "booking.eurotrips.ua"; do
  if command -v dig &>/dev/null; then
    DNS_IP=$(dig +short "$domain" 2>/dev/null | head -1)
  else
    DNS_IP=$(nslookup "$domain" 2>/dev/null | grep Address | tail -1 | awk '{print $2}')
  fi
  if [[ "$DNS_IP" == "$MY_IP" ]]; then
    ok "${domain} → ${DNS_IP} ✓ (matches server IP)"
  elif [[ -n "$DNS_IP" ]]; then
    warn "${domain} → ${DNS_IP} (відрізняється від ${MY_IP})"
  else
    fail "${domain} — DNS не резолвиться"
  fi
done

# ── 4. SSL Сертифікати ───────────────────────────────────────
sep "4. SSL / Let's Encrypt"
if [[ -d "/etc/letsencrypt/live" ]]; then
  for domain in "api.eurotrips.ua" "booking.eurotrips.ua"; do
    CERT_DIR="/etc/letsencrypt/live/${domain}"
    if [[ -f "${CERT_DIR}/fullchain.pem" ]]; then
      EXPIRY=$(openssl x509 -enddate -noout -in "${CERT_DIR}/fullchain.pem" 2>/dev/null | cut -d= -f2)
      EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$EXPIRY" +%s 2>/dev/null)
      NOW_EPOCH=$(date +%s)
      DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
      if [[ $DAYS_LEFT -gt 30 ]]; then
        ok "SSL ${domain} — ${DAYS_LEFT} днів до закінчення"
      elif [[ $DAYS_LEFT -gt 0 ]]; then
        warn "SSL ${domain} — закінчується через ${DAYS_LEFT} днів!"
      else
        fail "SSL ${domain} — ПРОСТРОЧЕНО"
      fi
    else
      # Перевірити без SNI (обидва домени на одному сертифікаті)
      if [[ -f "/etc/letsencrypt/live/api.eurotrips.ua/fullchain.pem" ]]; then
        ok "SSL ${domain} — shared cert (api.eurotrips.ua)"
      else
        fail "SSL ${domain} — сертифікат не знайдено"
      fi
    fi
  done
else
  fail "Let's Encrypt директорія не знайдена"
fi

# ── 5. Nginx ─────────────────────────────────────────────────
sep "5. Nginx"
if command -v nginx &>/dev/null; then
  check "Nginx config valid" nginx -t
  check "Nginx running" systemctl is-active nginx
else
  fail "Nginx не встановлено"
fi

# ── 6. Docker containers ─────────────────────────────────────
sep "6. Docker Containers"
if [[ -f "${APP_DIR}/docker-compose.prod.yml" ]]; then
  cd "$APP_DIR"
  expected_services=("eurotrips_postgres" "eurotrips_redis" "eurotrips_backend" "eurotrips_frontend" "eurotrips_nginx")

  for svc in "${expected_services[@]}"; do
    STATUS=$(docker inspect --format='{{.State.Status}}' "$svc" 2>/dev/null || echo "not_found")
    HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null || echo "")
    if [[ "$STATUS" == "running" ]]; then
      if [[ -n "$HEALTH" && "$HEALTH" != "healthy" ]]; then
        warn "${svc}: running (health: ${HEALTH})"
      else
        ok "${svc}: running${HEALTH:+ (${HEALTH})}"
      fi
    elif [[ "$STATUS" == "not_found" ]]; then
      fail "${svc}: не запущено (container not found)"
    else
      fail "${svc}: ${STATUS}"
    fi
  done
else
  warn "docker-compose.prod.yml не знайдено в ${APP_DIR}"
fi

# ── 7. API Health Check ───────────────────────────────────────
sep "7. API Endpoint"
for attempt in 1 2 3; do
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    --max-time 10 "${API_URL}/api/v1/health" 2>/dev/null || echo "000")
  if [[ "$HTTP_STATUS" == "200" ]]; then
    HEALTH_BODY=$(curl -sf --max-time 10 "${API_URL}/api/v1/health" 2>/dev/null || echo "{}")
    ok "${API_URL}/api/v1/health → HTTP 200"
    info "Response: ${HEALTH_BODY}"
    break
  elif [[ $attempt -lt 3 ]]; then
    info "Спроба ${attempt}/3: HTTP ${HTTP_STATUS}, retry..."
    sleep 5
  else
    fail "${API_URL}/api/v1/health → HTTP ${HTTP_STATUS}"
  fi
done

# Frontend check
HTTP_FRONT=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time 10 "${FRONT_URL}" 2>/dev/null || echo "000")
if [[ "$HTTP_FRONT" == "200" ]]; then
  ok "${FRONT_URL} → HTTP 200"
else
  warn "${FRONT_URL} → HTTP ${HTTP_FRONT}"
fi

# ── 8. PostgreSQL (tables) ────────────────────────────────────
sep "8. PostgreSQL"
if docker ps --filter "name=eurotrips_postgres" --filter "status=running" \
    | grep -q "eurotrips_postgres" 2>/dev/null; then

  PG_USER="${POSTGRES_USER:-eurotrips}"
  PG_DB="${POSTGRES_DB:-eurotrips_booking}"

  if [[ -f "${APP_DIR}/.env" ]]; then
    PG_USER=$(grep '^POSTGRES_USER=' "${APP_DIR}/.env" | cut -d= -f2)
    PG_DB=$(grep '^POSTGRES_DB=' "${APP_DIR}/.env" | cut -d= -f2)
  fi

  TABLE_COUNT=$(docker exec eurotrips_postgres psql -U "$PG_USER" -d "$PG_DB" \
    -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" \
    2>/dev/null | tr -d ' \n' || echo "0")

  if [[ "$TABLE_COUNT" -ge 15 ]]; then
    ok "PostgreSQL: ${TABLE_COUNT} таблиць (Prisma migrations OK)"
  elif [[ "$TABLE_COUNT" -gt 0 ]]; then
    warn "PostgreSQL: ${TABLE_COUNT} таблиць (очікується 20+, міграції неповні?)"
  else
    fail "PostgreSQL: 0 таблиць (migrate deploy не виконано?)"
  fi

  # Extensions
  EXT_CHECK=$(docker exec eurotrips_postgres psql -U "$PG_USER" -d "$PG_DB" \
    -t -c "SELECT COUNT(*) FROM pg_extension WHERE extname IN ('uuid-ossp','pgcrypto','pg_trgm');" \
    2>/dev/null | tr -d ' \n' || echo "0")
  if [[ "$EXT_CHECK" -ge 3 ]]; then
    ok "PostgreSQL extensions: uuid-ossp, pgcrypto, pg_trgm"
  else
    warn "PostgreSQL extensions: тільки ${EXT_CHECK}/3 (init.sql запускався?)"
  fi
else
  fail "PostgreSQL container не запущено"
fi

# ── 9. Redis ─────────────────────────────────────────────────
sep "9. Redis"
if docker ps --filter "name=eurotrips_redis" --filter "status=running" \
    | grep -q "eurotrips_redis" 2>/dev/null; then

  REDIS_PASS=$(grep '^REDIS_PASSWORD=' "${APP_DIR}/.env" 2>/dev/null | cut -d= -f2 || echo "")
  REDIS_PONG=$(docker exec eurotrips_redis redis-cli \
    ${REDIS_PASS:+-a "$REDIS_PASS"} --no-auth-warning ping 2>/dev/null || echo "FAIL")

  if [[ "$REDIS_PONG" == "PONG" ]]; then
    ok "Redis: PONG"
  else
    fail "Redis: не відповідає (${REDIS_PONG})"
  fi

  REDIS_MEM=$(docker exec eurotrips_redis redis-cli \
    ${REDIS_PASS:+-a "$REDIS_PASS"} --no-auth-warning info memory 2>/dev/null \
    | grep "used_memory_human" | cut -d: -f2 | tr -d '\r\n' || echo "?")
  info "Redis used memory: ${REDIS_MEM}"
else
  fail "Redis container не запущено"
fi

# ── 10. Backup script ─────────────────────────────────────────
sep "10. Backup"
if [[ -f "${APP_DIR}/scripts/backup.sh" ]]; then
  ok "backup.sh exists"
  if [[ -x "${APP_DIR}/scripts/backup.sh" ]]; then
    ok "backup.sh executable"
  else
    warn "backup.sh не executable (chmod +x)"
  fi
  # Check cron
  if crontab -u deploy -l 2>/dev/null | grep -q "backup.sh"; then
    ok "Cron job configured for deploy user"
  else
    warn "Cron не налаштований — запустити: crontab -u deploy -e"
    info "Додати: 0 3 * * * /srv/eurotrips/scripts/backup.sh >> /var/log/eurotrips-backup.log 2>&1"
  fi
else
  warn "backup.sh не знайдено в ${APP_DIR}/scripts/"
fi

# Check rclone config
if [[ -f "/home/deploy/.config/rclone/rclone.conf" ]]; then
  if grep -q "ЗАМІНИТИ" /home/deploy/.config/rclone/rclone.conf 2>/dev/null; then
    warn "rclone.conf не заповнено (ще є ЗАМІНИТИ placeholder)"
  else
    ok "rclone.conf налаштований"
  fi
else
  warn "rclone.conf не знайдено"
fi

# ── Summary ───────────────────────────────────────────────────
echo ""
echo -e "${BOLD}================================================================${RESET}"
echo -e "${BOLD}  Результат верифікації${RESET}"
echo -e "${BOLD}================================================================${RESET}"
echo ""
echo -e "  ${GREEN}PASS: ${PASS}${RESET}"
echo -e "  ${YELLOW}WARN: ${WARN}${RESET}"
echo -e "  ${RED}FAIL: ${FAIL}${RESET}"
echo ""

if [[ $FAIL -eq 0 ]]; then
  echo -e "  ${GREEN}${BOLD}✓ Production готовий до роботи!${RESET}"
elif [[ $FAIL -le 2 ]]; then
  echo -e "  ${YELLOW}${BOLD}⚠ Є незначні проблеми — перевірте FAIL вище${RESET}"
else
  echo -e "  ${RED}${BOLD}✗ Є критичні проблеми — deploy не готовий${RESET}"
fi

echo ""
echo "  Деплой:   https://github.com/stantoha/eurotrips-booking-system/actions"
echo "  API:      ${API_URL}/api/v1/health"
echo "  Frontend: ${FRONT_URL}"
echo ""

exit $FAIL
