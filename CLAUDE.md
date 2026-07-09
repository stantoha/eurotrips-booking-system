## ⚠️ ОБОВ'ЯЗКОВО ЧИТАТИ НА ПОЧАТКУ КОЖНОЇ СЕСІЇ

1. Цей файл (CLAUDE.md) — правила backend
2. `EUROTRIPS_PROJECT_CONTEXT.md` — повний контекст проекту поза репо
3. `frontend/CLAUDE.md` — правила frontend

Без прочитання — не починати жодних змін.

# CLAUDE.md — Eurotrips Booking System (Backend)

> Цей файл читають Codex, Claude Code та всі AI-агенти перед виконанням будь-яких завдань.
> **Мова проекту: Українська** — весь UI, нотифікації, повідомлення, коментарі в коді, назви турів.

---

## 1. Що це за проект

**Eurotrips** — система бронювання та операційного управління для українського туроператора.
Продає тури B2C (напряму) та B2B (через агентів), веде весь цикл від ліда до завершення туру.

Сайт: https://eurotrips.ua (існуючий, не чіпаємо)
API: https://api.eurotrips.ua/api/v1/ (новий, будуємо)

---

## 2. Стек

| Шар | Технологія | Версія |
|-----|-----------|--------|
| Runtime | Node.js | 20 LTS |
| Framework | Fastify | 4.x |
| Language | TypeScript | 5.x (strict mode) |
| ORM | Prisma | 5.x |
| Database | PostgreSQL | 16 |
| Cache / Queue | Redis 7 + BullMQ | latest |
| Auth | JWT (access 15хв) + Refresh Token (30д) | — |
| PDF | Puppeteer | 22.x |
| Email | SendGrid / Brevo | — |
| Messenger | Telegram Bot API + Viber API | — |
| Tests | Vitest | 2.x |

---

## 3. Структура репозиторію

```
src/
├── main.ts                  ← точка входу Fastify
├── app.ts                   ← реєстрація плагінів, маршрутів
├── modules/
│   ├── auth/                ← login, register, refresh, logout
│   ├── tours/               ← каталог, availability, CRUD
│   ├── bookings/            ← бронювання, статусна машина
│   ├── tourists/            ← клієнти
│   ├── agents/              ← агенти (standard + network)
│   ├── leads/               ← CRM, ліди
│   ├── payments/            ← платежі, комісії
│   ├── hotels/              ← база готелів
│   ├── transport/           ← транспортні бронювання
│   ├── activities/          ← активності туру
│   ├── documents/           ← генерація PDF
│   ├── communications/      ← email, Telegram, Viber
│   ├── analytics/           ← дашборди, звіти
│   └── finance/             ← P&L, борги, зведення
├── shared/
│   ├── database/            ← Prisma client singleton
│   ├── redis/               ← Redis client + helpers
│   ├── queue/               ← BullMQ workers/processors
│   ├── guards/              ← JWT guard, RBAC guard
│   ├── decorators/          ← @CurrentUser(), @Roles()
│   └── utils/               ← formatCurrency, generateBookingNumber, etc.
└── config/
    └── index.ts             ← env validation via Zod

prisma/
├── schema.prisma            ← 20 моделей (джерело правди)
└── seed.ts                  ← тестові дані

scripts/
└── init.sql                 ← CREATE EXTENSION uuid-ossp
```

Кожен модуль містить: `*.routes.ts`, `*.service.ts`, `*.schema.ts` (Zod), `*.types.ts`

---

## 4. Правила бізнес-логіки (КРИТИЧНО)

### BR-01: Бронювання місць — тільки через транзакцію
```typescript
// НІКОЛИ не робити просто UPDATE available_seats
// Завжди через транзакцію з перевіркою:
await prisma.$transaction(async (tx) => {
  const tour = await tx.tour.findFirst({
    where: { id: tourId, availableSeats: { gte: count } }
  });
  if (!tour) throw new AppError('SEATS_UNAVAILABLE', 'Недостатньо місць', 409);
  await tx.tour.update({
    where: { id: tourId },
    data: { availableSeats: { decrement: count } }
  });
  // ... далі створювати booking
});
// Місця знімаються ТІЛЬКИ після підтвердження депозиту (BR-01)
```

### BR-02: Комісія агента
```typescript
// Комісія рахується ТІЛЬКИ від базової ціни туру (без ДОПів)
commission = tour.basePrice * persons * agent.commissionPct
// НЕ від totalAmount, НЕ від доплат, НЕ від страховок
```

### BR-03: Виплата комісії — тільки після завершення туру
```typescript
// CommissionStatus переходить в 'to_pay' ТІЛЬКИ коли:
// booking.status === 'completed' AND tour.status === 'completed'
// До цього — 'pending' або 'frozen'
```

### BR-04: Агент НІКОЛИ не бачить собівартість
```typescript
// В будь-якому API-відповіді для role === 'agent':
// ВИДАЛЯТИ поля: costPrice, margin, netProfit, internalNotes
// Використовувати окремий DTO: TourPublicDto (без costPrice)
```

### BR-05: Два типи агентів
```typescript
type AgentType = 'standard' | 'network';

// standard:
//   agentPayout = basePrice * personsCount * commissionPct

// network:
//   grossCommission = basePrice * personsCount * commissionPct
//   agentPayout     = grossCommission - coAmount - royaltyAmount
//   coAmount        = grossCommission * (coCommissionPct / commissionPct)
//   royaltyAmount   = grossCommission * (royaltyPct / commissionPct)
```

### BR-06: Статусна машина бронювань
```
Дозволені переходи (не можна стрибати через стадії):
new            → in_work, cancelled_operator
in_work        → needs_clarification, pre_booked, awaiting_payment, cancelled_operator
pre_booked     → awaiting_payment, cancelled_client, cancelled_operator
awaiting_payment → partially_paid, confirmed, cancelled_client
partially_paid → confirmed, cancelled_client
confirmed      → docs_collected
docs_collected → ready_to_depart
ready_to_depart → on_trip
on_trip        → completed, no_show
completed      → [terminal]
cancelled_*    → refund (якщо були платежі)
no_show        → [terminal]
refund         → [terminal]
```

### BR-07: Роялті мережі — після виплати субагентам
```typescript
// Роялті мережі обробляється ТІЛЬКИ після:
// agentCommission.status === 'paid' для всіх субагентів мережі
```

### BR-08: Скасування оператором — повне повернення
```typescript
// При booking.status → 'cancelled_operator':
// Автоматично створювати Payment { type: 'refund', amount: totalPaid }
// CommissionStatus → 'cancelled'
```

### BR-09: OPS-01 — Структура номерів обов'язкова перед відкриттям туру
```typescript
// Тур НЕ може перейти зі статусу 'draft' → 'open' якщо:
// hotel_bookings.structure_status === 'draft' (не затверджено)
// Виняток: tour.isFastLaunch === true (high season — одразу фінал)
```

### BR-10: OPS-01 — Валідація структури номерів
```typescript
// При PUT /tours/:id/room-structure:
// sum(planned_twin×2 + planned_double×2 + planned_triple×3 + planned_single×1) ≤ tour.total_seats
// Zod schema з .refine() — інакше 422
// Після structure_status = 'approved' → тільки admin може змінити
```

### BR-11: OPS-02 — BullMQ тригери румінгу (НЕ дублювати)
```typescript
// Тригер A: confirmedBookings >= 30 туристів по туру
// Тригер Б: (tour.departureDate - today) <= 14 днів
// Дедуплікація: якщо rooming_trigger_sent_at IS NOT NULL цього тижня → не слати
// Виняток: isFastLaunch === true → нотифікація НЕ надсилається
// Після відправки: opsRoomingRequired = true
```

### BR-12: OPS-03 — Self-service туриста (місце + тип номеру)
```typescript
// PATCH /bookings/:id/tourist/:tId/preferences → BLOCKED якщо:
// hotel_bookings.final_rooming_done === true  → 403
// booking.status < 'confirmed'               → 403
// hotel_bookings.structure_status === 'draft' → 200 з повідомленням "Розміщення ще готується"

// Унікальність місця в автобусі — 2 рівні захисту:
// 1. @@unique([bookingId, bus_seat_number]) в БД
// 2. SELECT FOR UPDATE у prisma.$transaction перед записом
```

---

## 5. Database schema (20 таблиць)

```
users                 ← всі користувачі
tourists              ← клієнти/туристи (без User-акаунта)
agent_networks        ← мережі агентів (для network-типу)
agents                ← агенти (standard + network)
cancellation_policies ← умови скасування (JSON rules)
staff                 ← турлідери, гіди, водії
tours                 ← каталог турів (ГОЛОВНИЙ довідник)
leads                 ← CRM ліди
bookings              ← бронювання (ЦЕНТРАЛЬНА ТАБЛИЦЯ)
booking_tourists      ← учасники бронювання (M:N)
payments              ← всі транзакції
agent_commissions     ← комісії агентів (окремо від bookings)
hotels                ← база готелів (563+ записи)
hotel_bookings        ← бронювання готелів по турах
transport_bookings    ← транспортні бронювання
tour_activities       ← активності/екскурсії туру
tour_extras           ← доп. витрати (гід, парковки, страхування)
documents             ← файли документів
communications        ← лог: email, SMS, Telegram, Viber
audit_log             ← журнал змін (безпека)
```

Файл: `prisma/schema.prisma` — **джерело правди для всіх структур БД**

---

## 6. API

- Base URL: `/api/v1/`
- Auth: `Authorization: Bearer <access_token>`
- Refresh: `POST /auth/refresh` (HttpOnly Cookie)
- Response shape: `{ data, meta?, error? }`
- Errors: `{ error: { code, message, details? } }`
- Pagination: `?page=1&limit=20` → `{ data: [], meta: { total, page, limit, pages } }`

### Ключові ендпоінти

```
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout

GET    /tours                    ?status=&type=&departure_from=&departure_to=
GET    /tours/:id
GET    /tours/:id/availability
POST   /tours                    [admin, ops]
PUT    /tours/:id                [admin, ops]
PATCH  /tours/:id/status         [admin, ops, director]

GET    /bookings                 (RBAC-фільтр: agent → свої, manager → всі)
GET    /bookings/:id
POST   /bookings
PATCH  /bookings/:id/status
POST   /bookings/:id/payment
POST   /bookings/:id/cancel
GET    /bookings/:id/participants

GET    /agents                   [admin, director, manager]
GET    /agents/:id
GET    /agents/:id/bookings
GET    /agents/:id/commission
GET    /agents/:id/royalty       [тільки network]

GET    /leads
POST   /leads
PUT    /leads/:id
PATCH  /leads/:id/convert        → creates booking

GET    /finance/summary
GET    /finance/tours/:id/pnl
GET    /finance/debts
POST   /finance/payments

GET    /hotels                   ?country=&city=&stars=
GET    /hotels/:id

// ── OPS-01/02/03: Румінг та структура номерів ──────────────────────────────
GET    /tours/:id/room-structure          [ops, manager, admin]  → структура + доступність
PUT    /tours/:id/room-structure          [ops, admin]           → внести/оновити (blocked after APPROVED)
PATCH  /tours/:id/room-structure/approve  [admin, director]      → затвердити → APPROVED
PATCH  /tours/:id/room-structure/finalize [ops, admin]           → закрити фінальний румінг → FINAL
GET    /bookings/:id/seat-map             [tourist, manager, ops] → схема автобуса (tourist: тільки is_occupied)
PATCH  /bookings/:id/tourist/:tId/preferences [tourist, manager] → preferred_room_type + bus_seat_number
```

---

## 7. RBAC

```typescript
// Визначено в: src/shared/guards/rbac.guard.ts
const ROLES = ['admin','director','manager','ops','agent','accountant','tourist'] as const;

// Декоратор на маршруті:
@Roles('admin', 'manager')
async createBooking(req, reply) { ... }

// Перевірка власності (agent бачить тільки своє):
if (user.role === 'agent' && booking.agentId !== user.agentId) {
  throw new ForbiddenError();
}
```

---

## 8. Ідентифікатори

```typescript
// Тур: [PRODUCT_CODE][YEAR][MONTH][DAY][SEQ]
// LP26010301 = Лапландія, 2026-01-03, рейс 01
// PN25102505 = Париж+Нормандія, 2025-10-25, рейс 05

// Бронювання: ET-{YEAR}-{NNNNN} (auto-increment per year)
// ET-2025-00123
// Генерація: src/shared/utils/booking-number.ts
```

---

## 9. Команди

```bash
# Dev
npm run dev                   # запуск з hot-reload
npm run docker:up             # запустити postgres + redis
npm run docker:up:tools       # + pgAdmin + RedisInsight

# БД
npm run db:migrate            # нова міграція
npm run db:generate           # оновити Prisma Client
npm run db:seed               # тестові дані
npm run db:studio             # Prisma Studio GUI на :5555

# Тести
npm test                      # unit тести
npm run test:e2e              # e2e тести
npm run test:coverage         # з покриттям

# Build
npm run build                 # компіляція TypeScript
npm run type-check            # перевірка типів без компіляції
```

---

## 10. Заборонено (DO NOT)

```
❌ Не показувати агенту: costPrice, margin, netProfit (BR-04)
❌ Не оновлювати availableSeats без транзакції (race condition → BR-01)
❌ Не рахувати комісію від totalAmount — тільки від basePrice (BR-02)
❌ Не виплачувати комісію до завершення туру (BR-03)
❌ Не робити бізнес-логіку в route-handler — тільки в service
❌ Не видаляти записи фізично — soft delete: isArchived / deletedAt
❌ Не зберігати паролі у відкритому вигляді — тільки bcrypt (rounds=12)
❌ Не повертати passwordHash, costPrice в API-відповідях
❌ Не стрибати через статуси бронювання (BR-06)
❌ Не хардкодити рядки Ukrainian UI в бізнес-логіці — тільки у відповідях API
```

---

## 11. Синхронізація з Frontend

Frontend CLAUDE.md: `../frontend/CLAUDE.md`
Спільні типи статусів (синхронізовані):

```typescript
// BookingStatus (15): new, in_work, needs_clarification, pre_booked,
//   awaiting_payment, partially_paid, confirmed, docs_collected,
//   ready_to_depart, on_trip, completed, cancelled_client,
//   cancelled_operator, no_show, refund
//
// TourStatus (8): draft, open, active, almost_full,
//   closed, on_tour, completed, cancelled
//
// CommissionStatus (5): pending, frozen, to_pay, paid, cancelled
//
// AgentType: standard | network
```

---

## 12. Пов'язані документи в проекті

| Документ | Розташування |
|----------|-------------|
| ADR-001 (Архітектура) | `03. Architecture & Tech / ADR/ADR-001_Eurotrips_Architecture.docx` |
| Gap Analysis + User Stories | `02. Business Analysis/` |
| Фінансова модель (BR-01..08) | `05. Finance & Business Rules/` |
| ТЗ-скелет | `01. Product & Strategy/ТЗ-скелет/` |
| QA Strategy | `06. QA & Testing/` |
| CSV-дані (тури, готелі, транспорт) | `08. Operational Data/` |

---

## 13. Робота кількох Claude-сесій паралельно

**Над цим репо одночасно працює кілька окремих Claude Code чатів** (за ролями: Backend, Frontend, QA, Integration API, UX/UI, DevOps, BA, Tech Writer, Архітектор, Data Analyst/BI, PM, Фінансова логіка, Управління агентами, Security review, Аналітика продажів). Кожна сесія комітить у ту саму гілку `develop` незалежно, без координації між собою.

**Наслідок:** різні частини кодової бази можуть відображати різні, несумісні припущення (напр. Dashboard.tsx довгий час використовував camelCase-типи, тоді як Tours.tsx/Bookings.tsx — snake_case; `Booking` тип у `types/index.ts` не збігався з реальною формою відповіді `/bookings`). **Не вважай, що весь код узгоджений між собою** — перед тим як покладатись на існуючий тип/контракт, звіряй з реальною відповіддю API (curl/Network tab), а не тільки з TypeScript-типом.

---

## 14. Продакшн-конфігурація та відомі технічні деталі

- **Числа в API:** Prisma `Decimal` серіалізується як `{s,e,d}` (внутрішня структура decimal.js), якщо просто рекурсивно копіювати ключі об'єкта. `src/shared/utils/case-transform.ts` вже обробляє це через `.toNumber()` — якщо додаєш нову рекурсивну трансформацію відповіді, враховуй це.
- **snake_case контракт:** Бекенд (`preSerialization` хук в `app.ts`) конвертує ВСІ відповіді API з camelCase (Prisma) в snake_case — фронтенд (типи в `types/index.ts`, ADR-001) побудований під snake_case. Вхідні тіла запитів (POST/PATCH body) конвертації НЕ мають — бекенд Zod-схеми очікують camelCase, як є в Prisma-моделях.
- **JWT payload:** реальні поля — `sub, email, role, agentId, agentType, networkId` (camelCase, не `full_name`/`agent_code`).
- **nixpacks.toml:** `nixPkgs: ["nodejs_20", "openssl"]` — НЕ видаляти жодне з двох (nodejs_20 дає npm, openssl потрібен Prisma).
- **railway.json:** `buildCommand` НЕ повинен дублювати `npm ci` (Nixpacks вже сам ставить залежності в install-фазі) — інакше конфлікт cache-mount (EBUSY).
- **liqPayRoutes і zohoWebhookRoutes** в `app.ts` — свідомо закоментовані через відомі баги (невідповідність полів Prisma-схемі). Не розкоментовувати без окремого дослідження.
- **Тестові акаунти (`prisma/seed.ts`, пароль `test1234`):** `admin@eurotrips.ua`, `manager@eurotrips.ua`, `a.sych@eurotrips.ua` (другий менеджер), `ops@eurotrips.ua`, `finance@eurotrips.ua` (роль `accountant`), `agent@agency.ua`, `agent2@agency.ua`. Ролей `tourist` в seed НЕМАЄ і маршруту для `tourist` в `App.tsx` теж немає (відкрите питання, потребує WF5-дизайну кабінету туриста).

---

## 15. Фінансова модель (каскад ціноутворення)

```text
Собівартість (СВ) = Розміщення + Транспорт + Персонал + Гіди + ДОПи в СВ + Непрямі
Базова ціна        = СВ + Маржа оператора
Ціна клієнта (gross) = Базова ціна + Доплати − Знижки
Агентська комісія   = gross_price × commissionPct (10–30%, диференційовано по продукту)
Маржа оператора (net) = gross − СВ − AG_commission − Роялті − Непрямі
```

ДОПи (додаткові послуги) — продаються під час туру, не входять в базову ціну, комісія агента на них НЕ нараховується, мають власний P&L.

**Відома знахідка:** тур Budapest+Vienna — комісія агента 30% при маржі оператора 14.5% → потенційний негативний P&L. Задокументовано для фінансового модуля, ще не вирішено.

---

## 16. Roadmap релізів

- **Реліз 1 (MVP, зараз):** каталог турів · бронювання · CRM/ліди · кабінет менеджера · кабінет агента · базові статуси · оплати · документи · базові повідомлення · базова аналітика
- **Реліз 2:** групові запити · корпоративні сценарії · розширені фінанси · автоматизація нагадувань · розсадка (rooming, OPS-01..03) · BI-дашборди · WayForPay · Departure як окрема сутність (ADR-003, зараз `Tour = Departure`)
- **Реліз 3:** мобільна версія · глибокі інтеграції · прогнозування · advanced analytics

---

## 17. Zoho CRM — інтеграція (webhook закоментовано, план готовий)

Zoho залишається основним CRM для менеджерів з продажу (двостороння синхронізація, вебхук на `POST /webhooks/zoho`, події `Deals.edit/add`, `Leads.edit`, `Contacts.edit`). Мапінг: Products→tours, Accounts→agents, Contacts→tourists, Leads→leads, Deals→bookings, Travel→UPDATE bookings, CustomModule3→payments.

Відкриті питання до клієнта (не вирішені): що таке `field2/field3/field5` в Zoho CustomModule3 (Payments) і `field29-field56` в Agencies; хто призначає коди нових турів; чи потрібна форма бронювання на eurotrips.ua; коли потрібен WayForPay.

---

## 18. Security — відомі невиправлені знахідки

- 🔴 **Rate limiting на `/auth/login`** — зараз тільки глобальний ліміт (200/хв), потрібен окремий `max=10 за 15хв per IP` саме на login (brute-force).
- 🟠 **Zoho webhook** — при відсутності `ZOHO_WEBHOOK_TOKEN` перевірка обходиться замість `401`.
- 🟠 **AuditLog** — можлива невідповідність між Prisma-моделлю і сервісом, що її пише.
- 🟠 **Tourist role** — немає маршруту `/my/*` у фронтенді (пов'язано з п.13 вище, OPS-03).

Вже підтверджено ОК: JWT blacklist при logout (Redis TTL), refresh token тільки в HttpOnly Cookie, access token in-memory (не localStorage), IDOR-захист (агент не бачить чужі бронювання), Prisma parameterized queries (без SQL-ін'єкцій), BR-04 server-side (агент не отримує costPrice в відповіді API).
