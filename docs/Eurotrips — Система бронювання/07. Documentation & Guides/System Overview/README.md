# Eurotrips Booking System

> Система бронювання для українського туроператора Eurotrips.  
> Мова системи: **Українська**.

## Статус реалізації — червень 2026

### Загальна готовність MVP: **73%** · ~4–5 тижнів до production

| Компонент | Модуль / Сторінка | Статус | % |
|-----------|-------------------|--------|---|
| **Backend** | Auth API (login, refresh, logout, me, change-password) | ✅ Завершено | 95% |
| **Backend** | Tours API (CRUD, availability, status, BR-04) | ✅ Завершено | 90% |
| **Backend** | Bookings API (6 ендпоінтів, BR-01/06/08) | ✅ Завершено | 85% |
| **Backend** | Leads / CRM (4 ендпоінти + convert) | ✅ Завершено | 80% |
| **Backend** | Agents API (profile, commissions, royalty BR-07) | 🔄 В процесі | 75% |
| **Backend** | Finance API (summary, P&L, debts) | 🔄 В процесі | 70% |
| **Backend** | База даних (Prisma 20 моделей) | ✅ Завершено | 88% |
| **Frontend** | Login / Auth UI | ✅ Завершено | 95% |
| **Frontend** | AgentCabinet | ✅ Завершено | 80% |
| **Frontend** | Tours.tsx | 🔄 В процесі | 75% |
| **Frontend** | Bookings.tsx (список) | 🔄 В процесі | 70% |
| **Frontend** | Dashboard | 🔄 В процесі | 65% |
| **Frontend** | BookingDetail | 🚧 В процесі | 20% |
| **Frontend** | LeadsList | ⬜ Заплановано | — |
| **Інтеграції** | LiqPay (SHA1, idempotent) | ✅ Завершено | 90% |
| **Інтеграції** | Email / Brevo (5 шаблонів) | ✅ Завершено | 80% |
| **Інтеграції** | Zoho webhook (POST /webhooks/zoho) | 🔄 В процесі | 75% |
| **Інтеграції** | Zoho міграція (leads + contacts) | 🔄 В процесі | 65% |
| **Інтеграції** | SMS TurboSMS | 🚧 Розпочато | 30% |
| **Інтеграції** | Telegram Bot | 🚧 Розпочато | 25% |
| **QA** | E2E тести (85 Playwright тестів) | 🔄 В процесі | 75% |
| **DevOps** | Docker (dev + prod конфіги) | ✅ Завершено | 95% |
| **DevOps** | CI/CD GitHub Actions | ✅ Завершено | 90% |
| **DevOps** | Nginx / SSL | ✅ Завершено | 85% |
| **DevOps** | Backup / rollback | ✅ Завершено | 90% |
| **DevOps** | Production deploy (Hetzner CX32) | ❌ Очікує | 10% |

> **🚨 Критичний блокер:** Production deploy на Hetzner не виконано.  
> Інструкція: `DEPLOY_NOW.md` · Скрипти: `first-deploy.sh`, `verify-prod.sh`

---

## Швидкий старт

### Вимоги

| Інструмент | Версія |
|-----------|--------|
| Docker Desktop | 25.x+ |
| Docker Compose | v2.x+ (вбудовано) |
| Git | 2.40+ |

### 1. Клонувати репозиторій

```bash
git clone https://github.com/eurotrips-ua/eurotrips-booking-system.git
cd eurotrips-booking-system
```

### 2. Налаштувати змінні середовища

```bash
cp .env.example .env
```

Відкрити `.env` та заповнити обов'язкові значення:

```bash
# JWT-ключі:
openssl rand -hex 32   # → JWT_SECRET
openssl rand -hex 32   # → JWT_REFRESH_SECRET

# Паролі:
# POSTGRES_PASSWORD=<мін. 16 символів>
# REDIS_PASSWORD=<мін. 16 символів>

# Zoho CRM:
# ZOHO_CLIENT_ID=
# ZOHO_CLIENT_SECRET=
# ZOHO_REFRESH_TOKEN=
# ZOHO_WEBHOOK_TOKEN=<random secret>

# LiqPay:
# LIQPAY_PUBLIC_KEY=
# LIQPAY_PRIVATE_KEY=
```

### 3. Запустити середовище

```bash
docker-compose up
```

Перший запуск (~2-3 хв): встановлює залежності, генерує Prisma Client, запускає міграції БД.

#### Результат — всі сервіси Running:

```
NAME                    STATUS
eurotrips_postgres      running (healthy)
eurotrips_redis         running (healthy)
eurotrips_backend       running
eurotrips_frontend      running
eurotrips_nginx         running
```

#### Доступні адреси:

| Сервіс | URL |
|--------|-----|
| Frontend (React) | http://localhost:5173 |
| Backend API | http://localhost:3000/api/v1 |
| Swagger docs | http://localhost:3000/docs |
| Via Nginx | http://localhost |

### 4. Запуск з інструментами (pgAdmin, RedisInsight, MailHog)

```bash
docker-compose --profile tools up
```

| Інструмент | URL | Логін |
|-----------|-----|-------|
| pgAdmin 4 | http://localhost:5050 | admin@eurotrips.ua / admin |
| RedisInsight | http://localhost:8001 | — |
| MailHog (email) | http://localhost:8025 | — |

---

## Корисні команди

```bash
# Фоновий режим
docker-compose up -d

# Логи сервісу
docker-compose logs -f backend

# Підключитися до PostgreSQL
docker-compose exec postgres psql -U eurotrips -d eurotrips_booking

# Нова Prisma міграція
docker-compose exec backend npx prisma migrate dev --name назва

# Seed (тестові дані, 9 користувачів + 5 турів)
docker-compose exec backend npm run db:seed

# Prisma Studio (GUI для БД)
docker-compose exec backend npm run db:studio
# → http://localhost:5555

# Тести
docker-compose exec backend npm test

# Зупинити все
docker-compose down

# Повний reset (видалити дані БД)
docker-compose down -v

# Міграція з Zoho CRM (одноразово)
docker-compose exec backend npm run migrate:zoho
```

---

## Структура репозиторію

```
eurotrips-booking-system/
├── backend/                     # Node.js 20 + Fastify 4 + TypeScript
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/            # login, refresh, logout
│   │   │   ├── tours/           # каталог, availability, BR-04
│   │   │   ├── bookings/        # центральний модуль, BR-01/06/08
│   │   │   ├── leads/           # CRM, конвертація в бронювання
│   │   │   ├── agents/          # standard + network, BR-07
│   │   │   ├── finance/         # P&L, борги, комісії
│   │   │   └── integrations/
│   │   │       ├── zoho/        # zoho-migration.ts, zoho_webhook.ts
│   │   │       └── liqpay/      # liqpay_service.ts, liqpay_routes.ts
│   │   └── shared/              # auth, db, redis, guards
│   ├── prisma/
│   │   ├── schema.prisma        # 20 таблиць — джерело правди
│   │   └── seed.ts              # 9 users, 5 tours, 2 bookings (pwd: test1234)
│   └── Dockerfile
├── frontend/                    # React 18 + Vite + TypeScript
│   └── Dockerfile
├── nginx/
│   └── nginx.dev.conf
├── scripts/
│   └── init.sql                 # PostgreSQL extensions
├── .github/
│   └── workflows/               # CI/CD (ci.yml, deploy-*.yml)
├── docker-compose.yml           # DEV середовище
├── docker-compose.prod.yml      # PROD середовище
├── first-deploy.sh              # Скрипт першого деплою на Hetzner
├── verify-prod.sh               # Перевірка production після деплою
├── generate-secrets.sh          # Генерація секретів для .env
├── DEPLOY_NOW.md                # Інструкція production деплою
├── CLAUDE.md                    # Контекст для AI-агентів (Frontend)
├── CLAUDE_backend.md            # Контекст для AI-агентів (Backend + BR)
└── README.md
```

---

## Стек

| Шар | Технологія |
|-----|-----------|
| Runtime | Node.js 20 LTS |
| Framework | Fastify 4 |
| ORM | Prisma 5 + PostgreSQL 16 |
| Cache / Queue | Redis 7 + BullMQ |
| Frontend | React 18 + Vite + TypeScript |
| Auth | JWT (15хв access) + Refresh Token (30д, HttpOnly) |
| Платежі | LiqPay (MVP) · WayForPay (Реліз 2) |
| Email | Brevo / MailHog (dev) |
| Месенджери | Telegram Bot + Viber |
| CRM | Zoho CRM (зберігається для продажів) |
| Hosting | Hetzner CX32 (Nürnberg, ~22 EUR/міс) |

---

## Тестові дані (seed)

```
# Пароль для всіх: test1234
admin@eurotrips.ua      — Адміністратор
director@eurotrips.ua   — Директор
manager@eurotrips.ua    — Менеджер
ops@eurotrips.ua        — Операційний менеджер
agent@eurotrips.ua      — Агент (standard)
agent2@eurotrips.ua     — Агент (network, 2% роялті)
accountant@eurotrips.ua — Бухгалтер
tourist@eurotrips.ua    — Турист
tourist2@eurotrips.ua   — Турист 2
```

---

## Документи проекту

| Документ | Що описує |
|---------|-----------|
| `CLAUDE_backend.md` | Бізнес-правила BR-01..08, RBAC, API ендпоінти |
| `CLAUDE.md` | Frontend архітектура, компоненти, хуки |
| `DEPLOY_NOW.md` | Покрокова інструкція production деплою |
| `ADR-001_Architecture.docx` | Архітектурні рішення (ADR) |
| `ADR-003_Departure_Zoho_Insurance.docx` | ADR: Departure entity, Zoho, Insurance |
| `Eurotrips_Glossary_v1.docx` | Глосарій 25+ термінів системи |
| `Eurotrips_Agent_Guide_v2_Draft.docx` | Гайд агента (15 статусів, ануляція, ДОПи) |
| `Eurotrips_Zoho_Integration_Guide.docx` | Webhook + міграція Zoho (для ops) |
| `Eurotrips_Security_Audit_Report_v1.docx` | Аудит безпеки, 10 знахідок |
