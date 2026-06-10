#!/usr/bin/env bash
# =============================================================
#  scripts/server-setup.sh
#  Первинне налаштування Hetzner CX32 (Ubuntu 24.04)
#
#  Запуск (від root):
#    bash server-setup.sh production
#    bash server-setup.sh staging
#
#  Що встановлює:
#    Docker 25 + Docker Compose v2
#    Nginx (reverse proxy / SSL termination)
#    Certbot + Let's Encrypt
#    UFW firewall (22/80/443 only)
#    Fail2ban (brute-force захист)
#    rclone (backup → Hetzner Object Storage)
#    deploy user (окремий від root)
#    Swap 2GB (стабільність при пікових навантаженнях)
#    Структура директорій /srv/eurotrips
# =============================================================

set -euo pipefail

# ── Аргументи ────────────────────────────────────────────────
ENV=${1:-production}
DEPLOY_USER="deploy"
REPO="stantoha/eurotrips-booking-system"

if [[ "$ENV" == "production" ]]; then
  APP_DIR="/srv/eurotrips"
  DOMAIN_API="api.eurotrips.ua"
  DOMAIN_FRONT="booking.eurotrips.ua"
  CERTBOT_EMAIL="devops@eurotrips.ua"
else
  APP_DIR="/srv/eurotrips-staging"
  DOMAIN_API="staging-api.eurotrips.ua"
  DOMAIN_FRONT="staging.eurotrips.ua"
  CERTBOT_EMAIL="devops@eurotrips.ua"
fi

echo "================================================================"
echo "  Eurotrips Server Setup — ENV: ${ENV}"
echo "  App dir:   ${APP_DIR}"
echo "  API domain: ${DOMAIN_API}"
echo "================================================================"
echo ""

# ── 0. Перевірка ОС ──────────────────────────────────────────
if ! grep -qi "ubuntu" /etc/os-release; then
  echo "ERROR: потрібен Ubuntu 22.04 або 24.04"
  exit 1
fi

# ── 1. Оновлення системи ─────────────────────────────────────
echo ">>> [1/10] System update..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
  curl wget git ufw fail2ban unattended-upgrades \
  apt-transport-https ca-certificates gnupg lsb-release \
  htop ncdu jq logrotate

# ── 2. Swap 2GB ──────────────────────────────────────────────
echo ">>> [2/10] Swap 2GB..."
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  # Зменшуємо swappiness для production
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
  sysctl -p
  echo "  Swap: created 2GB"
else
  echo "  Swap: already exists, skipping"
fi

# ── 3. Docker ─────────────────────────────────────────────────
echo ">>> [3/10] Docker install..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | bash
  systemctl enable --now docker
  echo "  Docker: installed"
else
  echo "  Docker: already installed ($(docker --version))"
fi

# ── 4. Deploy user ────────────────────────────────────────────
echo ">>> [4/10] Deploy user '${DEPLOY_USER}'..."
if ! id "$DEPLOY_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$DEPLOY_USER"
  echo "  User: created"
else
  echo "  User: already exists"
fi

usermod -aG docker "$DEPLOY_USER"

# Копіюємо SSH ключі від root
mkdir -p "/home/${DEPLOY_USER}/.ssh"
if [[ -f /root/.ssh/authorized_keys ]]; then
  cp /root/.ssh/authorized_keys "/home/${DEPLOY_USER}/.ssh/"
  chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh"
  chmod 700 "/home/${DEPLOY_USER}/.ssh"
  chmod 600 "/home/${DEPLOY_USER}/.ssh/authorized_keys"
  echo "  SSH keys: copied from root"
fi

# sudo без пароля для deploy (тільки docker, systemctl)
cat > /etc/sudoers.d/deploy-user << 'SUDO'
deploy ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/bin/systemctl restart nginx, /usr/bin/certbot
SUDO
chmod 0440 /etc/sudoers.d/deploy-user

# ── 5. UFW Firewall ───────────────────────────────────────────
echo ">>> [5/10] UFW firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp  comment 'SSH'
ufw allow 80/tcp  comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable
echo "  UFW: 22/80/443 allowed, all else denied"

# ── 6. Fail2ban ───────────────────────────────────────────────
echo ">>> [6/10] Fail2ban..."
cat > /etc/fail2ban/jail.local << 'FAIL2BAN'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port    = ssh
logpath = %(sshd_log)s

[nginx-http-auth]
enabled = true
FAIL2BAN
systemctl enable --now fail2ban
echo "  Fail2ban: enabled"

# ── 7. Nginx ──────────────────────────────────────────────────
echo ">>> [7/10] Nginx..."
if ! command -v nginx &>/dev/null; then
  apt-get install -y -qq nginx
  systemctl enable nginx
fi

# Тимчасовий конфіг для Certbot challenge
cat > /etc/nginx/sites-available/certbot-challenge << NGINX_TEMP
server {
  listen 80;
  server_name ${DOMAIN_API} ${DOMAIN_FRONT};
  location /.well-known/acme-challenge/ {
    root /var/www/certbot;
  }
  location / {
    return 200 'server ready';
    add_header Content-Type text/plain;
  }
}
NGINX_TEMP

ln -sf /etc/nginx/sites-available/certbot-challenge \
       /etc/nginx/sites-enabled/certbot-challenge
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "  Nginx: installed and running"

# ── 8. Certbot / Let's Encrypt ────────────────────────────────
echo ">>> [8/10] Certbot..."
if ! command -v certbot &>/dev/null; then
  apt-get install -y -qq certbot python3-certbot-nginx
fi

mkdir -p /var/www/certbot

# Отримати сертифікат (DNS має вже вказувати на цей сервер!)
if [[ ! -d "/etc/letsencrypt/live/${DOMAIN_API}" ]]; then
  echo "  Requesting certificate for ${DOMAIN_API} ${DOMAIN_FRONT}..."
  certbot certonly --webroot \
    --webroot-path=/var/www/certbot \
    -d "${DOMAIN_API}" \
    -d "${DOMAIN_FRONT}" \
    --email "${CERTBOT_EMAIL}" \
    --agree-tos \
    --non-interactive \
    --no-eff-email \
    || echo "  WARNING: Certbot failed — можливо DNS ще не вказує на сервер. Запустіть вручну пізніше."
else
  echo "  Certificate: already exists, skipping"
fi

# Auto-renew cron
echo "0 3 * * * root certbot renew --quiet --deploy-hook 'systemctl reload nginx'" \
  > /etc/cron.d/certbot-renew
echo "  Auto-renew: configured (daily at 03:00 UTC)"

# ── 9. rclone (backup → Hetzner Object Storage) ───────────────
echo ">>> [9/10] rclone..."
if ! command -v rclone &>/dev/null; then
  curl -fsSL https://rclone.org/install.sh | bash
  echo "  rclone: installed"
else
  echo "  rclone: already installed ($(rclone version | head -1))"
fi

# Шаблон конфігу rclone — заповнити вручну
mkdir -p /home/${DEPLOY_USER}/.config/rclone
cat > /home/${DEPLOY_USER}/.config/rclone/rclone.conf << 'RCLONE'
# Hetzner Object Storage (S3-compatible)
# Документація: https://docs.hetzner.com/storage/object-storage/
#
# Заповнити після замовлення Object Storage у Hetzner:
[hetzner-s3]
type = s3
provider = Other
env_auth = false
access_key_id     = ЗАМІНИТИ_ACCESS_KEY
secret_access_key = ЗАМІНИТИ_SECRET_KEY
endpoint = https://nbg1.your-objectstorage.com
region = eu-central
acl = private
RCLONE
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" \
  "/home/${DEPLOY_USER}/.config"
echo "  rclone: config template created at ~/.config/rclone/rclone.conf"
echo "  ACTION NEEDED: заповнити access_key_id і secret_access_key"

# ── 10. Директорії застосунку ────────────────────────────────
echo ">>> [10/10] App directories..."
mkdir -p "${APP_DIR}"/{nginx,scripts,logs}
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}"

# Backup директорія
mkdir -p /var/backups/eurotrips
chown "${DEPLOY_USER}:${DEPLOY_USER}" /var/backups/eurotrips

# Шаблон .env для production
if [[ ! -f "${APP_DIR}/.env" ]]; then
  cat > "${APP_DIR}/.env.template" << 'ENV_TMPL'
# Eurotrips Production ENV — заповнити перед першим deploy
POSTGRES_USER=eurotrips
POSTGRES_PASSWORD=         # з GitHub Secrets
POSTGRES_DB=eurotrips_booking
REDIS_PASSWORD=            # з GitHub Secrets
JWT_SECRET=                # з GitHub Secrets
JWT_REFRESH_SECRET=        # з GitHub Secrets
SENDGRID_API_KEY=          # з GitHub Secrets
SENDGRID_FROM_EMAIL=noreply@eurotrips.ua
SENDGRID_FROM_NAME=Eurotrips
TELEGRAM_BOT_TOKEN=        # з GitHub Secrets
TELEGRAM_NOTIFY_CHAT_ID=   # з GitHub Secrets
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
GITHUB_REPO=stantoha/eurotrips-booking-system
IMAGE_TAG=latest
ENV_TMPL
  chown "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}/.env.template"
  echo "  .env.template created at ${APP_DIR}/.env.template"
fi

# Unattended upgrades (автоматичні патчі безпеки)
cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'APT_CONF'
Unattended-Upgrade::Allowed-Origins {
  "${distro_id}:${distro_codename}-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::Remove-Unused-Packages "true";
APT_CONF

# Логротація
cat > /etc/logrotate.d/eurotrips << 'LOGROT'
/srv/eurotrips/logs/*.log {
  daily
  rotate 14
  compress
  missingok
  notifempty
  create 0640 deploy deploy
}
LOGROT

# ── Підсумок ──────────────────────────────────────────────────
echo ""
echo "================================================================"
echo "  SERVER SETUP COMPLETE — ENV: ${ENV}"
echo "================================================================"
echo ""
echo "  Встановлено:"
echo "    ✓ Docker $(docker --version | grep -oP '\d+\.\d+\.\d+')"
echo "    ✓ Docker Compose $(docker compose version | grep -oP '\d+\.\d+\.\d+')"
echo "    ✓ Nginx $(nginx -v 2>&1 | grep -oP '\d+\.\d+\.\d+')"
echo "    ✓ Certbot $(certbot --version 2>&1 | grep -oP '\d+\.\d+\.\d+')"
echo "    ✓ rclone $(rclone version 2>&1 | head -1 | grep -oP '\d+\.\d+\.\d+')"
echo "    ✓ UFW: 22/80/443"
echo "    ✓ Fail2ban"
echo "    ✓ Swap 2GB"
echo "    ✓ Deploy user: ${DEPLOY_USER}"
echo "    ✓ App dir: ${APP_DIR}"
echo ""
echo "  НАСТУПНІ КРОКИ:"
echo "    1. rclone config — заповнити access_key у ~/.config/rclone/rclone.conf"
echo "    2. Скопіювати docker-compose.prod.yml → ${APP_DIR}/"
echo "    3. Скопіювати .env (з GitHub Secrets) → ${APP_DIR}/.env"
echo "    4. Налаштувати nginx/nginx.prod.conf → /etc/nginx/sites-available/"
echo "    5. Запустити перший deploy: docker compose -f docker-compose.prod.yml up -d"
echo ""
echo "  DNS — переконайтесь що вказує на $(curl -s ifconfig.me):"
echo "    ${DOMAIN_API}   → $(curl -s ifconfig.me)"
echo "    ${DOMAIN_FRONT} → $(curl -s ifconfig.me)"
echo "================================================================"
