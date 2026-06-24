# 🚀 Eurotrips Production — Deploy зараз

> ADR-003 Варіант A: жодних інфраструктурних змін.
> Insurance model = нова Prisma міграція, запуститься автоматично у `first-deploy.sh`.

---

## День 1 — Локально (15 хв)

### 1. Замовити Hetzner CX32

```
https://console.hetzner.cloud/
→ Add Server
→ Location: Nürnberg (EU)
→ Image: Ubuntu 24.04
→ Type: CX32 (4 vCPU / 8 GB / 80 GB SSD) — ~22 EUR/міс
→ SSH key: вставити ~/.ssh/eurotrips_prod.pub (або згенерувати нижче)
→ Create & Buy Now
```

### 2. SSH ключ (якщо немає)

```bash
ssh-keygen -t ed25519 -C "eurotrips-prod" -f ~/.ssh/eurotrips_prod
cat ~/.ssh/eurotrips_prod.pub   # → вставити в Hetzner
```

### 3. Генерація та запис 14 GitHub Secrets

```bash
# Встановити GitHub CLI (один раз)
brew install gh          # macOS
# або: https://github.com/cli/cli/releases

gh auth login            # авторизуватись

# Запустити генератор
bash scripts/generate-secrets.sh
# → інтерактивно запитає: IP, SSH key, SendGrid, Telegram, GHCR token
# → автоматично запише всі 14 secrets через gh CLI
# → збереже .env.production готовий для scp
```

**Перевірити після:**
```
https://github.com/stantoha/eurotrips-booking-system/settings/secrets/actions
→ має бути 14 secrets
```

---

## День 2 — На сервері (20 хв)

```bash
# Підключитись
ssh -i ~/.ssh/eurotrips_prod root@<HETZNER_IP>

# Клонувати репо та запустити setup (~7 хв, від root)
git clone https://github.com/stantoha/eurotrips-booking-system.git /tmp/et
bash /tmp/et/scripts/server-setup.sh production

# Копіювати файли (з локальної машини — нове вікно терміналу)
scp -i ~/.ssh/eurotrips_prod .env.production          deploy@<IP>:/srv/eurotrips/.env
scp -i ~/.ssh/eurotrips_prod docker-compose.prod.yml  deploy@<IP>:/srv/eurotrips/
scp -i ~/.ssh/eurotrips_prod nginx/nginx.prod.conf     deploy@<IP>:/srv/eurotrips/nginx/
scp -i ~/.ssh/eurotrips_prod scripts/init.sql          deploy@<IP>:/srv/eurotrips/scripts/
scp -i ~/.ssh/eurotrips_prod scripts/first-deploy.sh   deploy@<IP>:/srv/eurotrips/scripts/
scp -i ~/.ssh/eurotrips_prod scripts/verify-prod.sh    deploy@<IP>:/srv/eurotrips/scripts/
scp -i ~/.ssh/eurotrips_prod scripts/backup.sh         deploy@<IP>:/srv/eurotrips/scripts/
chmod +x /srv/eurotrips/scripts/*.sh
```

### DNS (в панелі реєстратора домену)

```
Тип: A    Ім'я: api           Значення: <HETZNER_IP>   TTL: 3600
Тип: A    Ім'я: booking       Значення: <HETZNER_IP>   TTL: 3600
```

**Перевірити propagation (~5-15 хв):**
```bash
dig +short api.eurotrips.ua
# → має повернути <HETZNER_IP>
```

---

## День 3 — Перший deploy + верифікація (10 хв)

```bash
# SSH як deploy user
ssh -i ~/.ssh/eurotrips_prod deploy@<HETZNER_IP>

# Перший deploy
bash /srv/eurotrips/scripts/first-deploy.sh
# → docker login GHCR
# → pull images
# → postgres/redis → healthy
# → prisma migrate deploy  (включно з Insurance міграцією з ADR-003)
# → docker compose up -d
# → Telegram notify ✅

# Верифікація (10 перевірок)
bash /srv/eurotrips/scripts/verify-prod.sh
# Очікуваний результат:
#   PASS: 20+
#   WARN: 0-2
#   FAIL: 0

# Backup cron
(crontab -l 2>/dev/null; echo "0 3 * * * /srv/eurotrips/scripts/backup.sh >> /var/log/backup.log 2>&1") | crontab -
crontab -l   # перевірити
```

### Активувати CI/CD

```bash
# Після успішної верифікації — кожен push до main = автодеплой
git push origin main
# → GitHub Actions → deploy-production.yml → Telegram notify
```

---

## Перевірки після deploy

```bash
# API health
curl https://api.eurotrips.ua/api/v1/health
# → {"status":"ok","db":"connected","redis":"connected"}

# Frontend
curl -I https://booking.eurotrips.ua
# → HTTP/2 200

# PostgreSQL tables (має бути 22+ після Insurance міграції)
docker exec eurotrips_postgres psql -U eurotrips -d eurotrips_booking \
  -c "\dt" | wc -l

# Insurance таблиці (нові з ADR-003)
docker exec eurotrips_postgres psql -U eurotrips -d eurotrips_booking \
  -c "SELECT tablename FROM pg_tables WHERE tablename IN ('insurances','insurance_rates');"

# Логи backend
docker logs eurotrips_backend --tail=30
```

---

## Якщо щось пішло не так

```bash
# Показати статус контейнерів
docker compose -f /srv/eurotrips/docker-compose.prod.yml ps

# Логи конкретного сервісу
docker logs eurotrips_backend --tail=50
docker logs eurotrips_postgres --tail=20

# Rollback до попереднього SHA
bash /srv/eurotrips/scripts/rollback.sh <commit-sha>

# Перезапустити один сервіс
docker compose -f /srv/eurotrips/docker-compose.prod.yml restart backend
```

---

## ADR-003 — що це означає для DevOps

| Рішення | DevOps вплив |
|---------|-------------|
| Варіант A (Tour = Departure) | ✅ Нуль змін — поточна модель залишається |
| Insurance model (2 нових таблиці) | ✅ `prisma migrate deploy` запустить автоматично |
| BR-09 (авіа → страховка обов'язкова) | ✅ Код backend, не infra |
| Нові env vars | ✅ Немає |
| Нові сервіси або порти | ✅ Немає |

---

*Всі скрипти пройшли `bash -n` validation. Час виконання всіх 3 днів: ~45 хв.*
