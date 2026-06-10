# Eurotrips Booking System

Єдина система бронювання та операційного управління для туроператора **Eurotrips**.

## Зміст
- [Швидкий старт](#швидкий-старт)
- [Структура проекту](#структура-проекту)
- [API документація](#api-документація)
- [Тести](#тести)
- [Команди](#команди)

---

## Швидкий старт

### 1. Клонувати репозиторій
```bash
git clone https://github.com/eurotrips-ua/eurotrips-booking-system.git
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
| Адмін | admin@eurotrips.ua | admin123! |
| Менеджер | a.sych@eurotrips.ua | manager123! |
| Агент | i.koval@ta-mriia.ua | agent123! |

---

## Структура проекту

```
prisma/
  schema.prisma     ← 20 моделей БД (джерело правди)
  seed.ts           ← тестові дані

src/
  main.ts           ← точка входу
  app.ts            ← реєстрація плагінів
  config/           ← env валідація
  modules/          ← бізнес-модулі
  shared/           ← спільний код (auth, db, utils)

scripts/
  init.sql          ← ініціалізація PostgreSQL

docker-compose.yml  ← локальне dev-середовище
Dockerfile          ← production збірка
CLAUDE.md           ← контекст для AI-агентів
```

---

## API документація

Swagger UI доступний після запуску:  
**http://localhost:3000/documentation**

Base URL: `/api/v1/`

---

## Тести

```bash
npm test                  # unit тести
npm run test:coverage     # з покриттям коду
npm run test:e2e          # e2e тести
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
| Backend | Node.js 20 + Fastify 4 + TypeScript |
| ORM | Prisma 5 + PostgreSQL 16 |
| Cache | Redis 7 + BullMQ |
| Auth | JWT + Refresh Token |
| Docs | Puppeteer PDF |
| Тести | Vitest |

---

Детальніше: [CLAUDE.md](./CLAUDE.md) | [ADR-001](../docs/ADR-001_Eurotrips_Architecture.docx)
