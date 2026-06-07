[README.md](https://github.com/user-attachments/files/28685899/README.md)
# Eurotrips Booking System

> Система бронювання для українського туроператора Eurotrips.
> Мова системи: **Українська**.

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
```

---

## Структура репозиторію

```
eurotrips-booking-system/
├── backend/              # Node.js 20 + Fastify 4 + TypeScript
│   ├── src/
│   │   ├── modules/      # tours, bookings, agents, payments...
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
├── CLAUDE.md             # Контекст для AI-агентів
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
| Email | SendGrid / MailHog (dev) |
| PDF | Puppeteer |
| Mesengers | Telegram Bot + Viber |

---

## Документи проекту

| Документ | Що описує |
|---------|-----------|
| `CLAUDE_backend.md` | Бізнес-правила BR-01..08, RBAC, API |
| `CLAUDE.md` | Frontend архітектура, компоненти |
| `ADR-001_Architecture.docx` | Архітектурні рішення |
| `DevOps_Task7_Infrastructure.docx` | Хостинг, CI/CD рішення |
| `Eurotrips_CICD_Pipeline.docx` | GitHub Actions workflows |
