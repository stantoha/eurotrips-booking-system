# CLAUDE.md — Eurotrips Booking System

> Цей файл читають Codex, Claude Code та всі AI-агенти перед виконанням будь-яких завдань.
> Мова проекту: **Українська** (весь UI, нотифікації, документи, коментарі в коді — українською).

---

## 1. Проект

**Eurotrips** — єдина система бронювання та операційного управління для українського туроператора.

- Продає тури напряму клієнтам (B2C) та через агентів (B2B)
- Веде бронювання від першого ліда до завершення туру
- Контролює місця, оплату, документи, статуси та комунікацію
- Дає аналітику по продажах, каналах і прибутковості

---

## 2. Технічний стек

| Шар | Технологія |
|-----|-----------|
| Backend API | Node.js 20 LTS + Fastify 4 + TypeScript |
| ORM | Prisma 5 + PostgreSQL 16 |
| Cache / Queue | Redis 7 + BullMQ |
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Auth | JWT access (15хв) + Refresh Token (30д, HttpOnly Cookie) |
| PDF | Puppeteer (ваучери, рахунки, підтвердження) |
| Email | SendGrid / Brevo (transactional) |
| Месенджери | Telegram Bot API + Viber API |
| DevOps | Docker + docker-compose + GitHub Actions CI/CD |
| Моніторинг | Sentry + Grafana |

---

## 3. Структура репозиторію

```
eurotrips-booking/
├── src/
│   ├── modules/
│   │   ├── tours/
│   │   ├── bookings/
│   │   ├── tourists/
│   │   ├── leads/
│   │   ├── agents/
│   │   ├── payments/
│   │   ├── hotels/
│   │   ├── transport/
│   │   ├── activities/
│   │   ├── documents/
│   │   ├── communications/
│   │   └── analytics/
│   ├── shared/
│   │   ├── auth/
│   │   ├── database/
│   │   ├── redis/
│   │   ├── queue/
│   │   └── utils/
│   └── config/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── frontend/
│   ├── admin/        ← адмін-панель
│   └── agent/        ← кабінет агента
├── docker-compose.yml
├── CLAUDE.md
└── .env.example
```

---

## 4. База даних — 18 таблиць MVP

```
tours                  ← каталог турів
tourists               ← клієнти / туристи
users                  ← всі користувачі системи
roles / permissions    ← RBAC
agents                 ← агенти (direct + network)
agent_networks         ← мережі агентів (для network-типу)
leads                  ← CRM / ліди
bookings               ← бронювання (центральна таблиця)
booking_tourists       ← учасники бронювання (M:N)
payments               ← всі платежі
cancellation_policies  ← умови скасування
hotels                 ← база готелів (563+ записів)
hotel_bookings         ← бронювання готелів по турах
transport_bookings     ← транспортні бронювання
tour_activities        ← активності/екскурсії туру
tour_extras            ← додаткові витрати (гід, парковки, страхування)
staff                  ← турлідери, гіди, водії
documents              ← файли/документи системи
communications         ← лог комунікацій (email, SMS, Telegram)
```

---

## 5. Ключові правила бізнес-логіки

### 5.1 Типи агентів
```typescript
// КРИТИЧНО: два типи агентів з різною логікою комісії
type AgentType = 'direct' | 'network';

// direct агент:
// - commission_pct = індивідуальна (напр. 0.10 = 10%)
// - royalty_pct = null
// - network_id = null

// network агент:
// - commission_pct = загальна комісія
// - co_commission_pct = % що іде ЦО мережі (напр. 0.02)
// - royalty_pct = % роялті франшизи (напр. 0.01)
// - network_id → agent_networks.id

// Розрахунок виплати:
// agent_payout = base_price * (commission_pct - co_commission_pct - royalty_pct)
// co_payout = base_price * co_commission_pct
// royalty = base_price * royalty_pct
```

### 5.2 Ідентифікатори турів
```
Формат коду туру: [PRODUCT_CODE][YEAR][MONTH][DAY][SEQ]
Приклади:
  LP26010301  → Лапландія, 2026-01-03, рейс 01
  PN25102505  → Париж+Нормандія, 2025-10-25, рейс 05
  VD26050301  → Адріатичне море+Доломіти, 2026-05-03, рейс 01
```

### 5.3 Номери бронювань
```
Формат: ET-YYYY-NNNNN
Приклад: ET-2025-00123
```

### 5.4 Валюта та курси
```
- Всі суми зберігаються в EUR (NUMERIC 10,2)
- Курс EUR/UAH зберігається в payments.exchange_rate на момент оплати
- Собівартість туру також в EUR
```

### 5.5 Бронювання місць (race condition)
```typescript
// ОБОВ'ЯЗКОВО: оптимістичне блокування при бронюванні місць
// Не робити просто UPDATE tours SET available_seats = available_seats - N
// Використовувати транзакцію з перевіркою:

await prisma.$transaction(async (tx) => {
  const tour = await tx.tours.findFirst({
    where: { id: tourId, available_seats: { gte: personsCount } },
  });
  if (!tour) throw new Error('Місць недостатньо');
  
  await tx.tours.update({
    where: { id: tourId },
    data: { available_seats: { decrement: personsCount } }
  });
  
  // ... створити booking
});
```

### 5.6 Статуси бронювання (state machine)
```
Дозволені переходи:
new → in_progress → preliminary → waiting_payment
waiting_payment → partially_paid → confirmed
confirmed → docs_collected → ready_to_depart → on_tour → completed
Будь-який → cancelled_by_client | cancelled_by_operator | no_show | refund
```

---

## 6. API

- Base URL: `/api/v1/`
- Auth header: `Authorization: Bearer <access_token>`
- Content-Type: `application/json`
- Відповіді: `{ data, meta, error }`
- Пагінація: `?page=1&limit=20`
- Фільтри: query params: `?status=confirmed&tour_id=xxx&date_from=2025-01-01`

### Ключові ендпоінти
```
GET    /tours                    # каталог турів
GET    /tours/:id/availability   # доступність місць
POST   /bookings                 # створити бронювання
PATCH  /bookings/:id/status      # змінити статус
POST   /bookings/:id/payment     # зафіксувати оплату
GET    /agents/:id/commission    # комісія агента
GET    /agents/:id/royalty       # роялті (тільки network)
GET    /finance/tours/:id/pnl    # P&L по туру
```

---

## 7. RBAC — Ролі доступу

```
admin       → * (повний доступ)
director    → read:all, analytics:full, finance:read
manager     → leads:*, bookings:*, tourists:*, communications:*
ops         → tours:*, checklists:*, documents:*, suppliers:*
agent       → own_bookings:*, own_tourists:*, commission:read
accountant  → finance:*, payments:*, invoices:*, refunds:*
tourist     → own_booking:read, own_docs:read, own_payments:read
```

**Правило**: Agent бачить ТІЛЬКИ свої бронювання. Ніколи не показувати:
- внутрішню маржу компанії
- собівартість туру
- бронювання інших агентів

---

## 8. Команди розробки

```bash
# Запуск dev середовища
docker-compose up -d postgres redis
npm run dev

# БД міграції
npx prisma migrate dev --name <назва>
npx prisma generate

# Seed тестових даних
npm run seed

# Тести
npm run test
npm run test:e2e

# Build
npm run build
```

---

## 9. Міграція з Google Sheets / Zoho CRM

При імпорті даних зберігати оригінальні ідентифікатори:
- `tours.code` — оригінальний код з CSV (LP26010301, etc.)
- `hotels.hotel_external_id` — Hotel ID з Final_Hotel_Database
- `tours.asana_link` — посилання на Asana task

Zoho CRM синхронізується через webhook до завершення міграції.

---

## 10. Заборонено (DO NOT)

- Не показувати агенту собівартість туру або маржу компанії
- Не дозволяти бронювання якщо `available_seats < persons_count` (без транзакції)
- Не зберігати паролі у відкритому вигляді (тільки bcrypt)
- Не повертати sensitive дані (password_hash, internal margins) в API-відповідях
- Не робити бізнес-логіку в контролерах — тільки в service-шарі
- Не міняти статус бронювання в обхід state machine
- Не видаляти записи фізично (soft delete через is_archived / deleted_at)
