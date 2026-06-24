# Eurotrips Booking System

> Система бронювання для українського туроператора Eurotrips.  
> Мова системи: **Українська**.

## Статус модулів — оновлено 21.06.2026

### Backend API (`/api/v1/`)

| Модуль | Ендпоінти | Статус | Бізнес-правила |
|--------|-----------|--------|----------------|
| **Auth** | login, refresh, logout, me, change-password | ✅ Готово | JWT 15хв + HttpOnly refresh 30д |
| **Tours** | CRUD, availability, status | ✅ Готово | BR-04 (маржа недоступна агенту) |
| **Bookings** | 6 ендпоінтів | ✅ Готово | BR-01, BR-06, BR-08 |
| **Leads / CRM** | 4 ендпоінти + convert | ✅ Готово | Конвертація ліда → бронювання |
| **Finance** | summary, tour P&L, debts | ✅ Готово | — |
| **Agents** | profile, commissions, royalty | ✅ Готово | BR-07 (роялті після субагентів) |
| **Zoho webhook** | POST /webhooks/zoho | ✅ Готово | Verif. via `ZOHO_WEBHOOK_TOKEN` |
| **Insurance** | — | ⬜ Заплановано | Реліз 2 |
| **Departure entity** | — | ⬜ Pending ADR | Архітектурне рішення pending |

### Frontend

| Сторінка / Компонент | Статус |
|----------------------|--------|
| Login | ✅ Готово |
| Dashboard | ✅ Готово |
| Tours | ✅ Готово |
| Bookings | ✅ Готово |
| AgentCabinet | ✅ Готово |
| BookingDetail | 🔄 В розробці |
| LeadsList | ⬜ Заплановано |

### Інтеграції

| Сервіс | Статус | Примітка |
|--------|--------|----------|
| Zoho CRM → міграція | ✅ Готово | `npm run migrate:zoho` |
| Zoho webhook (realtime) | ✅ Готово | `POST /webhooks/zoho` |
| LiqPay | ✅ Готово | Payments module |
| Brevo (email) | ✅ Готово | Transactional |
| WayForPay | ⬜ Реліз 2 | Основний шлюз |

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
# Генерувати JWT-ключі:
openssl rand -hex 32   # → JWT_SECRET
openssl rand -hex 32   # → JWT_REFRESH_SECRET

# Встановити паролі:
# POSTGRES_PASSWORD=<мін. 16 символів>
# REDIS_PASSWORD=<мін. 16 символів>

# Zoho CRM (для webhook та міграції):
# ZOHO_CLIENT_ID=
# ZOHO_CLIENT_SECRET=
# ZOHO_REFRESH_TOKEN=
# ZOHO_WEBHOOK_TOKEN=<random secret для верифікації>
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

# Логи конкретного сервісу
docker-compose logs -f backend

# Підключитися до PostgreSQL
docker-compose exec postgres psql -U eurotrips -d eurotrips_booking

# Нова Prisma міграція
docker-compose exec backend npx prisma migrate dev --name назва

# Seed (тестові дані)
docker-compose exec backend npm run db:seed

# Prisma Studio (GUI для БД)
docker-compose exec backend npm run db:studio
# → http://localhost:5555

# Запустити тести
docker-compose exec backend npm test

# Зупинити все
docker-compose down

# Повний reset (видалити дані БД)
docker-compose down -v

# Запустити міграцію з Zoho CRM (одноразово)
docker-compose exec backend npm run migrate:zoho
```

---

## Структура репозиторію

```
eurotrips-booking-system/
├── backend/              # Node.js 20 + Fastify 4 + TypeScript
│   ├── src/
│   │   ├── modules/      # tours, bookings, agents, leads, finance...
│   │   │   └── integrations/
│   │   │       └── zoho/ # zoho-migration.ts, zoho_webhook.ts
│   │   └── shared/       # auth, db, redis, guards
│   ├── prisma/
│   │   └── schema.prisma # 20 таблиць — джерело правди
│   └── Dockerfile
├── frontend/             # React 18 + Vite + TypeScript
│   └── Dockerfile
├── nginx/
│   └── nginx.dev.conf    # DEV reverse proxy
├── scripts/
│   └── init.sql          # PostgreSQL extensions
├── .github/
│   └── workflows/        # CI/CD (ci.yml, deploy-*.yml)
├── docker-compose.yml    # DEV середовище
├── docker-compose.prod.yml # PROD середовище
├── .env.example          # Шаблон змінних
├── CLAUDE.md             # Контекст для AI-агентів (Frontend)
├── CLAUDE_backend.md     # Контекст для AI-агентів (Backend + BR)
└── README.md
```

---

## Стек

| Шар | Технологія |
|-----|-----------|
| Runtime | Node.js 20 LTS |
| Framework | Fastify 4 |
| ORM | Prisma 5 + PostgreSQL 16 |
| Cache/Queue | Redis 7 + BullMQ |
| Frontend | React 18 + Vite + TypeScript |
| Auth | JWT (15хв) + Refresh Token (30д) |
| Email | Brevo / MailHog (dev) |
| Payments | LiqPay (MVP) · WayForPay (Реліз 2) |
| Messengers | Telegram Bot + Viber |
| CRM | Zoho CRM (зберігається для продажів) |

---

## Документи проекту

| Документ | Що описує |
|---------|-----------|
| `CLAUDE_backend.md` | Бізнес-правила BR-01..08, RBAC, API |
| `CLAUDE.md` | Frontend архітектура, компоненти |
| `ADR-001_Architecture.docx` | Архітектурні рішення |
| `DevOps_Task7_Infrastructure.docx` | Хостинг, CI/CD рішення |
| `Eurotrips_CICD_Pipeline.docx` | GitHub Actions workflows |
| `Eurotrips_Glossary_v1.docx` | Глосарій термінів системи |
| `Eurotrips_Agent_Guide_v2_Draft.docx` | Гайд агента (draft) |
