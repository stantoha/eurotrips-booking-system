# Eurotrips MVP — Безкоштовний deploy

## Відповідь: ТАК, можна безкоштовно

**Стек для MVP (всі безкоштовні):**

| Що | Де | Ціна | Обмеження |
|----|-----|------|-----------|
| **Frontend** | Vercel | $0 назавжди | — жодних |
| **Backend** | Railway | $0 (~$5 кредит/міс) | ~2 місяці безкоштовно |
| **PostgreSQL** | Neon.tech | $0 назавжди | 500 MB, 1 проект |
| **Redis** | Upstash | $0 назавжди | 10 000 команд/день |

**Результат:** два URL, які відкриваються в браузері з будь-якого пристрою.

---

## Що РЕАЛЬНО блокує deploy прямо зараз

Інфраструктура готова. Блокують **не DevOps**, а код:

### Блокер 1 — Backend: модулі закоментовані в `app.ts` (Backend Dev)
```typescript
// Зараз в app.ts:
// app.register(bookingsRoutes)  ← закоментовано
// app.register(agentsRoutes)    ← закоментовано

// Потрібно розкоментувати мінімум:
app.register(authRoutes)      // ✅ вже є
app.register(toursRoutes)     // ✅ вже є
app.register(bookingsRoutes)  // ← розкоментувати
```

### Блокер 2 — Frontend: сторінки не існують, але `App.tsx` їх вже імпортує (Frontend Dev)
```typescript
// App.tsx lazy-imports:
const Dashboard    = React.lazy(() => import('./pages/Dashboard'))    // ← файл відсутній
const ToursPage    = React.lazy(() => import('./pages/Tours'))        // ← файл відсутній
const BookingsPage = React.lazy(() => import('./pages/Bookings'))     // ← файл відсутній
```
→ Build упаде на Vercel без цих файлів.

### Блокер 3 — Redis (некритично для MVP)
Redis потрібен для BullMQ (email-черги, відкладені задачі).
Для MVP-демо черги не потрібні → **тимчасово відключити**.

---

## Мінімум для MVP-демо у браузері

**Потрібно від Backend Dev (1-2 дні):**
- [ ] Розкоментувати `bookingsRoutes` в `app.ts`
- [ ] Зробити Redis опціональним: `if (REDIS_URL) { initQueue() }`

**Потрібно від Frontend Dev (2-3 дні):**
- [ ] `pages/Dashboard.tsx` — заглушка або базовий дашборд
- [ ] `pages/Tours.tsx` — список турів з seed даних
- [ ] `pages/Bookings.tsx` — картка бронювання

**DevOps (1 день, після виправлень вище):**
- [ ] Зареєструвати сервіси (Neon, Railway, Vercel, Upstash)
- [ ] Встановити env vars
- [ ] Підключити GitHub → автодеплой

---

## Покрокова інструкція (після виправлення блокерів)

### Крок 1 — Neon.tech (PostgreSQL, 5 хв)

```
1. https://neon.tech → Sign up (GitHub)
2. New Project → Name: eurotrips → Region: EU Frankfurt
3. Database: eurotrips_booking
4. Скопіювати Connection string:
   postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/eurotrips_booking?sslmode=require
   → це буде DATABASE_URL
```

### Крок 2 — Upstash Redis (2 хв)

```
1. https://upstash.com → Sign up
2. Create Database → Name: eurotrips-redis → Region: EU-West-1
3. Скопіювати: rediss://default:xxx@eu1-xxx.upstash.io:6379
   → це буде REDIS_URL
```

### Крок 3 — Railway (Backend, 10 хв)

```
1. https://railway.app → Sign up (GitHub)
2. New Project → Deploy from GitHub repo
3. Select: stantoha/eurotrips-booking-system
4. Service name: backend
5. Root Directory: backend/

Variables (Settings → Variables → Add all):
NODE_ENV=production
PORT=3000
DATABASE_URL=<з Neon.tech>
REDIS_URL=<з Upstash>
JWT_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
FRONTEND_URL=https://eurotrips.vercel.app
CORS_ORIGIN=https://eurotrips.vercel.app
SENDGRID_API_KEY=          ← порожньо для MVP
TELEGRAM_BOT_TOKEN=        ← порожньо для MVP

6. Deploy → копіювати URL: https://eurotrips-backend.up.railway.app
```

### Крок 4 — Vercel (Frontend, 5 хв)

```
1. https://vercel.com → Sign up (GitHub)
2. New Project → Import: stantoha/eurotrips-booking-system
3. Root Directory: frontend/
4. Framework: Vite (автовизначення)

Environment Variables:
VITE_API_URL=https://eurotrips-backend.up.railway.app/api/v1
VITE_APP_NAME=Eurotrips Booking
VITE_APP_LOCALE=uk

5. Deploy → отримати URL: https://eurotrips.vercel.app
```

### Крок 5 — Оновити CORS на Railway

```
Після отримання Vercel URL → Railway → Variables:
FRONTEND_URL=https://eurotrips.vercel.app
CORS_ORIGIN=https://eurotrips.vercel.app
→ Redeploy
```

---

## Результат після deploy

| URL | Що відкривається |
|-----|-----------------|
| `https://eurotrips.vercel.app/login` | Сторінка входу |
| `https://eurotrips.vercel.app/dashboard` | Дашборд (після логіну) |
| `https://eurotrips.vercel.app/tours` | Список турів (seed: 5 турів) |
| `https://eurotrips.vercel.app/bookings` | Картки бронювань |
| `https://eurotrips.vercel.app/agent` | Кабінет агента |
| `https://eurotrips-backend.up.railway.app/api/v1/health` | API health check |
| `https://eurotrips-backend.up.railway.app/docs` | Swagger UI |

**Тестові акаунти (seed.ts):**
```
admin@eurotrips.ua    / test1234  → admin
manager@eurotrips.ua  / test1234  → менеджер
agent@eurotrips.ua    / test1234  → агент
```

---

## Що НЕ потрібно для цього MVP

- ❌ Hetzner сервер (→ для повного production пізніше)
- ❌ SSL/Certbot (Vercel + Railway дають HTTPS автоматично)
- ❌ Nginx (не потрібен без власного сервера)
- ❌ server-setup.sh (→ для Hetzner пізніше)
- ❌ LiqPay/WayForPay інтеграція
- ❌ Zoho CRM sync
- ❌ SendGrid (email надсилатиметься в /dev/null для MVP)
- ❌ Telegram/Viber боти

---

## Оновлений план інфраструктури

```
MVP (зараз, безкоштовно)        Production (потім, ~22 EUR/міс)
─────────────────────────        ──────────────────────────────
Frontend: Vercel           →     Frontend: Vercel або Hetzner + Nginx
Backend:  Railway          →     Backend:  Hetzner CX32
Database: Neon.tech        →     Database: Hetzner CX32 (PostgreSQL)
Redis:    Upstash          →     Redis:    Hetzner CX32 (Redis)
Domain:   *.vercel.app     →     Domain:   api.eurotrips.ua
                                           booking.eurotrips.ua
```

Міграція з MVP → Production: просто змінити env vars.
Дані в Neon → `pg_dump` → завантажити в Hetzner PostgreSQL.
Vercel можна залишити як CDN для frontend навіть у production.

---

## ADR-003 Варіант A — вплив на цей план

| | |
|-|--|
| Tour = Departure (Variant A) | ✅ Нічого не змінюється в інфраструктурі |
| Insurance модель (2 нові таблиці) | ✅ `prisma migrate deploy` виконає автоматично при деплої |
| BR-09 (авіа → страховка обов'язкова) | ✅ Тільки backend код, не інфра |
| Нові env vars | ✅ Немає |
