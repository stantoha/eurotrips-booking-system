#!/usr/bin/env bash
# =============================================================
#  scripts/generate-secrets.sh
#  Локальний скрипт — запускати на своїй машині, НЕ на сервері
#
#  Генерує всі 14 GitHub Secrets і виводить команди для
#  GitHub CLI (gh) або список для ручного введення.
#
#  Запуск:
#    bash scripts/generate-secrets.sh
#
#  Вимоги (опційно — для автоматичного запису в GitHub):
#    brew install gh   # macOS
#    gh auth login     # один раз
# =============================================================

set -euo pipefail

REPO="stantoha/eurotrips-booking-system"
SECRETS_FILE="$(dirname "$0")/../.secrets.generated"

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'

echo ""
echo -e "${BOLD}================================================================${RESET}"
echo -e "${BOLD}  Eurotrips — Генератор GitHub Secrets${RESET}"
echo -e "${BOLD}  Репо: ${REPO}${RESET}"
echo -e "${BOLD}================================================================${RESET}"
echo ""

# ── Зібрати всі значення ─────────────────────────────────────
echo -e "${BLUE}>>> Генерація криптографічних ключів...${RESET}"

JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 20)
REDIS_PASSWORD=$(openssl rand -hex 20)

echo -e "  ${GREEN}✓${RESET} JWT_SECRET              (64 символи)"
echo -e "  ${GREEN}✓${RESET} JWT_REFRESH_SECRET      (64 символи)"
echo -e "  ${GREEN}✓${RESET} POSTGRES_PASSWORD       (40 символів)"
echo -e "  ${GREEN}✓${RESET} REDIS_PASSWORD          (40 символів)"
echo ""

# ── Запитати ручні значення ──────────────────────────────────
echo -e "${BLUE}>>> Введіть значення, які потребують ручного налаштування:${RESET}"
echo ""

read -rp "  HETZNER_HOST (IP сервера, напр. 65.21.123.45): " HETZNER_HOST
read -rp "  HETZNER_USER (зазвичай: deploy): " HETZNER_USER
echo ""
echo -e "  ${YELLOW}SSH ключ — вміст приватного ключа (~/.ssh/eurotrips_prod):${RESET}"
echo "  (шлях до файлу, або натисніть Enter для ~/.ssh/eurotrips_prod)"
read -rp "  SSH key path [~/.ssh/eurotrips_prod]: " SSH_KEY_PATH
SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/eurotrips_prod}"

if [[ -f "$SSH_KEY_PATH" ]]; then
  HETZNER_SSH_KEY=$(cat "$SSH_KEY_PATH")
  echo -e "  ${GREEN}✓${RESET} SSH key прочитано з ${SSH_KEY_PATH}"
else
  echo -e "  ${YELLOW}⚠${RESET} Файл не знайдено. Введіть вміст ключа вручну нижче."
  echo "  (закінчіть введення порожнім рядком)"
  HETZNER_SSH_KEY=""
  while IFS= read -r line; do
    [[ -z "$line" ]] && break
    HETZNER_SSH_KEY+="$line"$'\n'
  done
fi

echo ""
read -rp "  SENDGRID_API_KEY (з SendGrid dashboard): " SENDGRID_API_KEY
read -rp "  TELEGRAM_BOT_TOKEN (з @BotFather): " TELEGRAM_BOT_TOKEN
read -rp "  TELEGRAM_NOTIFY_CHAT_ID (з @userinfobot): " TELEGRAM_NOTIFY_CHAT_ID

echo ""
echo -e "  ${YELLOW}GHCR_TOKEN — GitHub PAT з write:packages${RESET}"
echo "  Отримати: github.com/settings/tokens → New classic token → scope: write:packages"
read -rp "  GHCR_TOKEN: " GHCR_TOKEN

# ── Фіксовані значення ───────────────────────────────────────
POSTGRES_USER="eurotrips"
POSTGRES_DB="eurotrips_booking"
VITE_API_URL="https://api.eurotrips.ua/api/v1"

# ── Зберегти у файл (захищений) ──────────────────────────────
cat > "$SECRETS_FILE" << SECRETS_EOF
# Згенеровано: $(date)
# УВАГА: цей файл містить секрети — не комітити в git!
# Додано до .gitignore автоматично

HETZNER_HOST=${HETZNER_HOST}
HETZNER_USER=${HETZNER_USER}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}
REDIS_PASSWORD=${REDIS_PASSWORD}
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
SENDGRID_API_KEY=${SENDGRID_API_KEY}
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
TELEGRAM_NOTIFY_CHAT_ID=${TELEGRAM_NOTIFY_CHAT_ID}
GHCR_TOKEN=${GHCR_TOKEN}
VITE_API_URL=${VITE_API_URL}
SECRETS_EOF
chmod 600 "$SECRETS_FILE"

# Додати до .gitignore
GITIGNORE="$(dirname "$0")/../.gitignore"
if ! grep -q ".secrets.generated" "$GITIGNORE" 2>/dev/null; then
  echo ".secrets.generated" >> "$GITIGNORE"
fi

echo ""
echo -e "${BOLD}================================================================${RESET}"
echo -e "${BOLD}  14 GitHub Secrets${RESET}"
echo -e "${BOLD}================================================================${RESET}"
echo ""

# ── Вивід: таблиця всіх секретів ────────────────────────────
secrets=(
  "HETZNER_HOST|${HETZNER_HOST}"
  "HETZNER_USER|${HETZNER_USER}"
  "HETZNER_SSH_KEY|*** (з файлу ${SSH_KEY_PATH})"
  "POSTGRES_USER|${POSTGRES_USER}"
  "POSTGRES_PASSWORD|${POSTGRES_PASSWORD}"
  "POSTGRES_DB|${POSTGRES_DB}"
  "REDIS_PASSWORD|${REDIS_PASSWORD}"
  "JWT_SECRET|${JWT_SECRET}"
  "JWT_REFRESH_SECRET|${JWT_REFRESH_SECRET}"
  "SENDGRID_API_KEY|${SENDGRID_API_KEY:-<не вказано>}"
  "TELEGRAM_BOT_TOKEN|${TELEGRAM_BOT_TOKEN:-<не вказано>}"
  "TELEGRAM_NOTIFY_CHAT_ID|${TELEGRAM_NOTIFY_CHAT_ID:-<не вказано>}"
  "GHCR_TOKEN|${GHCR_TOKEN:-<не вказано>}"
  "VITE_API_URL|${VITE_API_URL}"
)

i=1
for secret in "${secrets[@]}"; do
  name="${secret%%|*}"
  val="${secret##*|}"
  printf "  %2d. %-30s %s\n" "$i" "$name" "$val"
  ((i++))
done

echo ""

# ── Спробувати GitHub CLI ─────────────────────────────────────
echo -e "${BOLD}================================================================${RESET}"
if command -v gh &>/dev/null && gh auth status &>/dev/null 2>&1; then
  echo -e "${BOLD}  GitHub CLI знайдено — записуємо секрети автоматично...${RESET}"
  echo -e "${BOLD}================================================================${RESET}"
  echo ""

  gh_set() {
    local name="$1"
    local val="$2"
    if [[ -n "$val" ]]; then
      echo -n "  Setting ${name}... "
      echo "$val" | gh secret set "$name" -R "$REPO" --body - 2>&1 && \
        echo -e "${GREEN}✓${RESET}" || echo -e "${RED}✗ FAILED${RESET}"
    else
      echo -e "  ${YELLOW}⚠ Skipping ${name} (порожнє значення)${RESET}"
    fi
  }

  gh_set "HETZNER_HOST"           "$HETZNER_HOST"
  gh_set "HETZNER_USER"           "$HETZNER_USER"
  gh_set "HETZNER_SSH_KEY"        "$HETZNER_SSH_KEY"
  gh_set "POSTGRES_USER"          "$POSTGRES_USER"
  gh_set "POSTGRES_PASSWORD"      "$POSTGRES_PASSWORD"
  gh_set "POSTGRES_DB"            "$POSTGRES_DB"
  gh_set "REDIS_PASSWORD"         "$REDIS_PASSWORD"
  gh_set "JWT_SECRET"             "$JWT_SECRET"
  gh_set "JWT_REFRESH_SECRET"     "$JWT_REFRESH_SECRET"
  gh_set "SENDGRID_API_KEY"       "$SENDGRID_API_KEY"
  gh_set "TELEGRAM_BOT_TOKEN"     "$TELEGRAM_BOT_TOKEN"
  gh_set "TELEGRAM_NOTIFY_CHAT_ID" "$TELEGRAM_NOTIFY_CHAT_ID"
  gh_set "GHCR_TOKEN"             "$GHCR_TOKEN"
  gh_set "VITE_API_URL"           "$VITE_API_URL"

  echo ""
  echo -e "  ${GREEN}Перевірити: github.com/${REPO}/settings/secrets/actions${RESET}"

else
  echo -e "${BOLD}  GitHub CLI не знайдено — команди для ручного введення:${RESET}"
  echo -e "${BOLD}================================================================${RESET}"
  echo ""
  echo "  Відкрити: https://github.com/${REPO}/settings/secrets/actions"
  echo "  Натиснути: New repository secret"
  echo ""
  echo "  Або встановити GitHub CLI і запустити команди нижче:"
  echo ""
  echo "  brew install gh && gh auth login"
  echo ""
  echo "  # Потім скопіювати та запустити:"

  for secret in "${secrets[@]}"; do
    name="${secret%%|*}"
    if [[ "$name" == "HETZNER_SSH_KEY" ]]; then
      echo "  gh secret set ${name} -R ${REPO} < ${SSH_KEY_PATH}"
    else
      val="${secret##*|}"
      echo "  gh secret set ${name} -R ${REPO} --body '${val}'"
    fi
  done
fi

echo ""
echo -e "${BOLD}================================================================${RESET}"
echo -e "  ${GREEN}Секрети збережено у: ${SECRETS_FILE}${RESET}"
echo -e "  ${YELLOW}⚠ Цей файл НЕ буде закомічено (.gitignore)${RESET}"
echo -e "${BOLD}================================================================${RESET}"

# ── Генерація .env для сервера ────────────────────────────────
ENV_FILE="$(dirname "$0")/../.env.production"
cat > "$ENV_FILE" << ENV_EOF
# Eurotrips Production .env
# Згенеровано: $(date)
# Скопіювати на сервер: scp .env.production deploy@${HETZNER_HOST}:/srv/eurotrips/.env
# УВАГА: не комітити в git!

POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}
REDIS_PASSWORD=${REDIS_PASSWORD}
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
SENDGRID_API_KEY=${SENDGRID_API_KEY:-}
SENDGRID_FROM_EMAIL=noreply@eurotrips.ua
SENDGRID_FROM_NAME=Eurotrips
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-}
TELEGRAM_NOTIFY_CHAT_ID=${TELEGRAM_NOTIFY_CHAT_ID:-}
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://booking.eurotrips.ua
API_URL=https://api.eurotrips.ua
CORS_ORIGIN=https://booking.eurotrips.ua,https://eurotrips.ua
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
QUEUE_CONCURRENCY=5
QUEUE_MAX_RETRIES=3
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
GITHUB_REPO=${REPO}
IMAGE_TAG=latest
ENV_EOF
chmod 600 "$ENV_FILE"
echo ""
echo -e "  ${GREEN}Production .env: ${ENV_FILE}${RESET}"
echo "  Скопіювати на сервер:"
echo "  scp .env.production deploy@${HETZNER_HOST}:/srv/eurotrips/.env"
echo ""
