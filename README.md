# Eurotrips Booking System

Єдина система бронювання та операційного управління для туроператора **Eurotrips**.

## Зміст
- [Швидкий старт](#швидкий-старт)
- [Статус модулів](#статус-модулів)
- [Структура проекту](#структура-проекту)
- [API документація](#api-документація)
- [Тести](#тести)
- [Команди](#команди)

---

## Швидкий старт

### 1. Клонувати репозиторій
```bash
git clone https://github.com/stantoha/eurotrips-booking-system.git
cd eurotrips-booking-system
```

### 2. Налаштувати змінні середовища
```bash
cp .env.example .env
# Відредагувати .env — заповнити DATABASE_URL, Redis, JWT secrets
```

### 3. Запустити базу даних
```bash
npm run docker:up
# PostgreSQL на :5432, Redis на :6379
```

### 4. Встановити залежності та запустити міграції
```bash
npm install
npm run db:migrate       # застосувати міграції
npm run db:generate      # оновити Prisma Client
npm run db:seed          # завантажити тестові дані
```

### 5. Запустити сервер
```bash
npm run dev
# API доступне на http://localhost:3000
# Swagger UI: http://localhost:3000/documentation
```

### Тестові акаунти (після seed)
| Роль | Email | Пароль |
|------|-------|--------|
| Адмін | admin@eurotrips.ua | test1234 |
| Менеджер | manager@eurotrips.ua | test1234 |
| Ops менеджер | ops@eurotrips.ua | test1234 |
| Бухгалтер | finance@eurotrips.ua | test1234 |
| Агент | agent@agency.ua | test1234 |
| Агент 2 | agent2@agency.ua | test1234 |

---

## Статус модулів

### Backend API (`/api/v1/`)

| Модуль | Endpoints | Статус | Примітки |
|--------|-----------|--------|----------|
| **Auth** | POST /auth/login, /auth/refresh, /auth/logout, /auth/me | ✅ Готово | JWT 15хв + HttpOnly Cookie 30д |
| **Tours** | GET /tours, GET /tours/:id, GET /tours/:id/availability, POST /tours, PATCH /tours/:id/status | ✅ Готово | BR-04: costPrice/margin прихований від агента |
| **Bookings** | GET /bookings, GET /bookings/:id, POST /bookings, PATCH /:id/status, POST /:id/payment, POST /:id/cancel | ✅ Готово | BR-01/02/06/08, 15 статусів, номер ET-YYYY-NNNNN |
| **Leads/CRM** | GET /leads, POST /leads, PUT /leads/:id, PATCH /leads/:id/convert | ✅ Готово | Конвертація ліда → бронювання (BR-01) |
| **Finance** | GET /finance/summary, GET /finance/debts, GET /finance/tours/:id/pnl | ✅ Готово | RBAC: тільки admin/director/manager/accountant |
| **Agents** | GET /agents (placeholder) | 🔄 MVP | Деталі агентів — в розробці |
| **Tourists** | — | 📋 Planned | CRUD туристів |
| **Documents** | — | 📋 Planned | PDF генерація (Puppeteer) |
| **Analytics** | — | 📋 Planned | Звіти та дашборди |
| **Communications** | — | 📋 Planned | SendGrid, Telegram, Viber |

### Frontend (`frontend/src/`)

| Сторінка / Компонент | Шлях | Статус |
|---------------------|------|--------|
| Dashboard | `/dashboard` | ✅ Готово |
| Tours | `/tours` | ✅ Готово |
| Bookings | `/bookings` | ✅ Готово |
| AgentCabinet | `/agent/*` | ✅ Готово |
| Finance | `/finance` | 🔄 Stub |
| Operations | `/operations` | 🔄 Stub |

### QA / E2E тести (`tests/e2e/tests/`)

| Файл | Покриття | Тестів |
|------|---------|--------|
| auth.spec.ts | TC-AUTH-01..11 (login, refresh, logout, me) | 22 |
| rbac.spec.ts | TC-RBAC-001..016 (RBAC по всіх ролях) | 16 |
| tours.spec.ts | TC-TOURS-01..04 + edge cases | 16 |

---

## Структура проекту

```
prisma/
  schema.prisma     ← 20 моделей БД (джерело правди)
  seed.ts           ← тестові дані (реальні тури з CSV)

src/
  main.ts           ← точка входу
  app.ts            ← реєстрація плагінів та маршрутів
  config/           ← env валідація (Zod)
  modules/
    auth/           ← login, register, refresh, logout
    tours/          ← каталог, availability, CRUD
    bookings/       ← BR-01/02/06/08, 15 статусів
    leads/          ← CRM, конвертація в бронювання
    finance/        ← P&L, борги, зведення
  shared/
    database/       ← Prisma client singleton
    guards/         ← JWT guard, RBAC guard
    utils/          ← booking-number, status-machine, commission

frontend/src/       ← React + TypeScript reference implementation
  pages/            ← Dashboard, Tours, Bookings, Finance, Operations
    agent/          ← AgentCabinet (BR-02/03/04/07)
  components/       ← auth/, tours/, ui/, bookings/
  hooks/            ← useAuth
  store/            ← authStore (Zustand)
  services/         ← api (Axios), auth

tests/e2e/          ← Playwright E2E тести
  tests/
    auth.spec.ts
    rbac.spec.ts
    tours.spec.ts   ← TC-TOURS-01..04

scripts/
  init.sql          ← CREATE EXTENSION uuid-ossp

docker-compose.yml  ← локальне dev-середовище
Dockerfile          ← production збірка
CLAUDE.md           ← контекст та бізнес-правила BR-01..BR-12
```

---

## API документація

Swagger UI доступний після запуску:  
**http://localhost:3000/documentation**

Base URL: `/api/v1/`

### Ключові ендпоінти

```
POST /api/v1/auth/login          → { data: { access_token, user } }
GET  /api/v1/tours               → { data: Tour[], meta: { total, page, limit } }
POST /api/v1/bookings            → 201 { data: Booking }  (BR-01 atomic seats)
GET  /api/v1/finance/summary     → фінансова зведення (403 для агента)
PATCH /api/v1/leads/:id/convert  → конвертація ліда в бронювання
```

---

## Тести

```bash
npm test                  # unit тести (Vitest)
npm run test:coverage     # з покриттям коду
npm run test:e2e          # Playwright E2E

# Запуск конкретного spec
npx playwright test tests/e2e/tests/tours.spec.ts
npx playwright test tests/e2e/tests/auth.spec.ts
npx playwright test tests/e2e/tests/rbac.spec.ts --grep "TC-RBAC-002"
```

---

## Команди

```bash
# Розробка
npm run dev               # запуск з hot-reload
npm run type-check        # перевірка TypeScript

# БД
npm run db:studio         # GUI для БД (Prisma Studio :5555)
npm run db:migrate        # нова міграція
npm run db:reset          # скинути та перестворити БД

# Docker
npm run docker:up         # postgres + redis
npm run docker:up:tools   # + pgAdmin (:5050) + RedisInsight (:5540)
npm run docker:down       # зупинити контейнери

# Build
npm run build             # компіляція для production
```

---

## Технічний стек

| Шар | Технологія |
|-----|-----------|
| Backend | Node.js 20 + Fastify 4 + TypeScript 5 strict |
| ORM | Prisma 5 + PostgreSQL 16 |
| Cache / Queue | Redis 7 + BullMQ |
| Auth | JWT access 15хв + Refresh Token HttpOnly Cookie 30д |
| PDF | Puppeteer 22.x |
| Email | SendGrid / Brevo |
| Messenger | Telegram Bot API |
| Тести (unit) | Vitest 2.x |
| Тести (E2E) | Playwright |
| RBAC ролі | admin, director, manager, ops_manager, accountant, agent, tourist |

---

Детальніше: [CLAUDE.md](./CLAUDE.md)
