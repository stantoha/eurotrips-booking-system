# EUROTRIPS PROJECT CONTEXT

Для Claude Code та всіх AI-агентів. Читай цей файл на початку кожної сесії разом з CLAUDE.md. Оновлюй після кожного значного блоку роботи.

## ⚠️ ПРАВИЛА ДЛЯ CLAUDE CODE

- **ЧИТАЙ ПЕРШИМ** — до будь-яких дій: CLAUDE.md → цей файл
- **РОЗВІДКА ПЕРЕД РЕДАГУВАННЯМ** — ніколи не припускай шляхи, завжди роби dir/Get-ChildItem спочатку
- **ПЕРЕВІРЯЙ СТАН** — частина функціоналу свідомо закоментована (BullMQ, liqpay, zoho webhook) — не розкоментовуй без підтвердження
- **МОВА** — весь UI, повідомлення, коментарі — тільки українською
- **ОНОВЛЮЙ ЦЕЙ ФАЙЛ** — після кожного значного завдання

## 1. ІДЕНТИФІКАЦІЯ ПРОЕКТУ

| Параметр | Значення |
|---|---|
| Компанія | Eurotrips (eurotrips.ua) |
| GitHub | github.com/stantoha/eurotrips-booking-system |
| Гілка розробки | develop |
| Локально | C:/EUROTRIPS/eurotrips-booking-system/ |
| Schema версія | v1.1 (OPS Migration вже застосована) |

Що замінюємо: Legacy система 1С СБ + частково Zoho CRM. Zoho залишається: двостороння синхронізація.

## 2. КРИТИЧНО — АРХІТЕКТУРА РЕПО

```
eurotrips-booking-system/    ← КОРІНЬ = BACKEND (немає папки backend/)
├── src/
│   ├── main.ts              ← точка входу Fastify
│   ├── app.ts               ← реєстрація routes і плагінів
│   ├── modules/             ← auth, tours, bookings, leads, finance, agents
│   └── shared/              ← database, redis, queue (BullMQ), guards, utils
├── prisma/
│   ├── schema.prisma        ← v1.1, 20 моделей + OPS Migration
│   └── seed.ts
├── railway.json             ← builder NIXPACKS, startCommand: node dist/src/main.js ✅
├── nixpacks.toml            ← ["nodejs_20", "openssl"] ✅
├── CLAUDE.md                ← читати ЗАВЖДИ першим (backend)
├── EUROTRIPS_PROJECT_CONTEXT.md  ← цей файл
└── frontend/
    ├── src/
    │   ├── App.tsx          ← маршрутизація (актуальна)
    │   ├── pages/           ← всі сторінки (існують)
    │   ├── components/      ← ui/, tours/, bookings/, agent/, crm/, finance/, layouts/
    │   ├── hooks/           ← useAuth, useBookings, useTours, useCommission
    │   ├── services/        ← api.ts, auth.ts
    │   ├── types/           ← index.ts (всі TypeScript типи)
    │   ├── constants/       ← statuses.ts, routes.ts
    │   └── mocks/           ← mock дані для розробки
    └── vercel.json          ✅ правильний
```

## 3. ТЕХНІЧНИЙ СТЕК

### Backend

- Node.js 20 LTS + Fastify 4 + TypeScript 5 (strict mode)
- Prisma 5 + PostgreSQL 16
- Redis 7 + BullMQ ← ⚠️ BullMQ workers ЗАКОМЕНТОВАНІ (ліміти Upstash free tier)
- JWT (access 15хв) + Refresh Token (30д, HttpOnly Cookie)
- Puppeteer 22.x (PDF генерація)
- Brevo (email)
- TurboSMS (SMS)
- Telegram Bot API + Viber API

### Frontend

- React 18 + TypeScript + Vite
- Tailwind CSS (dark mode: class strategy — обов'язковий)
- TanStack Query v5 (server state)
- Zustand (client/auth state)
- React Hook Form + Zod (форми і валідація)
- TanStack Table v8 (таблиці)
- Axios (HTTP + JWT auto-refresh interceptors)
- Lucide React (іконки)
- Vitest + Testing Library (тести)

## 4. ЗАКОМЕНТОВАНИЙ КОД — ЩО І ЧОМУ

| Що закоментовано | Де | Причина | Дія |
|---|---|---|---|
| BullMQ Workers | src/shared/queue/ | Ліміт 10k запитів/день Upstash free tier | Не розкоментовувати без підтвердження |
| liqPayRoutes | src/app.ts | Баги в реалізації | Не розкоментовувати |
| zohoWebhookRoutes | src/app.ts | Баги в реалізації | Не розкоментовувати |

## 5. DEPLOY — ПОТОЧНИЙ СТАН

| Компонент | Сервіс | Статус |
|---|---|---|
| Backend | Railway | 🔄 В процесі (nixpacks build error — вирішується) |
| Frontend | Vercel | ⏳ Очікує Railway URL |
| PostgreSQL | Neon.tech | ✅ Підключено |
| Redis | Upstash | ✅ Підключено (free tier, 10k req/day) |
| Production | Hetzner CX32 | ❌ Наступний етап |

Railway: `railway.json` в корені репо, builder NIXPACKS, startCommand: `node dist/src/main.js`
Vercel: `frontend/vercel.json` — SPA rewrites + security headers

Тестові акаунти seed.ts (пароль: `test1234`):

| Email | Роль |
|---|---|
| admin@eurotrips.ua | admin |
| director@eurotrips.ua | director |
| manager@eurotrips.ua | manager |
| ops@eurotrips.ua | ops_manager |
| accountant@eurotrips.ua | accountant |
| agent@agency.ua | agent (standard) |
| agent2@agency.ua | agent (network) |
| tourist@test.ua | tourist |
| tourist2@test.ua | tourist |

## 6. SCHEMA PRISMA v1.1 — АКТУАЛЬНИЙ СТАН

### Enums (актуальні, включно з OPS Migration)

```
UserRole:    admin | director | manager | ops | agent | accountant | tourist
AgentType:   standard | network
TourType:    bus | avia | combined
TourStatus:  draft | open | active | almost_full | closed | on_tour | completed | cancelled
BookingStatus: new | in_work | needs_clarification | pre_booked | awaiting_payment |
               partially_paid | confirmed | docs_collected | ready_to_depart |
               on_trip | completed | cancelled_client | cancelled_operator | no_show | refund
LeadStatus:  new | in_work | needs_clarification | proposal_sent | waiting_decision | won | lost
CommissionStatus: pending | frozen | to_pay | paid | cancelled
PaymentStatus:    pending | confirmed | failed | refunded
PaymentType:      deposit | balance | refund | commission | penalty
PaymentMethod:    card | bank_transfer | cash | payment_link
DocumentType:     voucher | contract | invoice | tourist_list | boarding_list | letter | pdf_report

# OPS Migration (v1.1) — нові enum:
RoomType:    twin | double | triple | single | no_preference
RoomingStatus: draft | approved | final  ← МАШИНА СТАНУ РУМІНГУ
```

### 20 Моделей (в порядку залежностей)

1. users — всі користувачі системи
2. tourists — клієнти (можуть бути без User-акаунта)
3. agent_networks — мережі агентів (для network-типу)
4. agents — standard + network
5. cancellation_policies — умови скасування (JSON rules)
6. staff — турлідери, гіди, водії
7. tours — каталог турів (ГОЛОВНИЙ довідник)
8. leads — CRM ліди
9. bookings — бронювання (ЦЕНТРАЛЬНА ТАБЛИЦЯ)
10. booking_tourists — учасники бронювання (M:N) + OPS поля
11. payments — всі транзакції
12. agent_commissions — комісії агентів
13. hotels — база готелів (563+ записи з CSV)
14. hotel_bookings — бронювання готелів + OPS румінг поля
15. transport_bookings — транспорт, km, тариф, розсадка (JSON)
16. tour_activities — активності/екскурсії (4341 з CSV)
17. tour_extras — ДОПи, витрати, гіди
18. documents — файли документів
19. communications — лог email/SMS/Telegram/Viber
20. audit_log — журнал змін (безпека)

### OPS Migration v1.1 — нові поля (вже в schema.prisma)

`booking_tourists` (6 нових полів):

```
preferredRoomType   RoomType?   ← турист обирає сам (self-service)
busSeaNumber        Int?        ← місце в автобусі (UNIQUE в межах бронювання)
actualRoomNumber    String?     ← фактичний номер кімнати (після румінгу)
actualRoomType      RoomType?   ← фактичний тип кімнати
roommatePreference  String?     ← побажання по сусіду
specialRequirements String?     ← алергії, медичні обмеження, VIP
```

`hotel_bookings` (14 нових полів):

```
# Структура кімнат:
plannedTwin    Int @default(0)
plannedDouble  Int @default(0)
plannedTriple  Int @default(0)
plannedSingle  Int @default(0)

# Машина стану румінгу:
structureStatus       RoomingStatus @default(draft)
structureApprovedBy   String?       ← FK → users.id
structureApprovedAt   DateTime?

# BullMQ автонотифікації (закоментовано через ліміт Redis):
roomingTriggerSentAt  DateTime?
opsRoomingRequired    Boolean @default(false)

# Прапорці виконання:
preliminaryRoomingDone Boolean @default(false)
preliminaryRoomingAt   DateTime?
finalRoomingDone       Boolean @default(false)
finalRoomingAt         DateTime?
isFastLaunch           Boolean @default(false)  ← запуск за тиждень
```

## 7. БІЗНЕС-ПРАВИЛА (НЕ ПОРУШУВАТИ)

### BR-01 — Атомарне зниження місць

```typescript
// ТІЛЬКИ через prisma.$transaction
// НЕ findFirst + update (TOCTOU race condition)
await prisma.$transaction(async (tx) => {
  const tour = await tx.tour.findFirst({
    where: { id: tourId, availableSeats: { gte: count } }
  });
  if (!tour) throw new AppError('SEATS_UNAVAILABLE', 'Недостатньо місць', 409);
  await tx.tour.update({
    where: { id: tourId },
    data: { availableSeats: { decrement: count } }
  });
});
// Місця знімаються ТІЛЬКИ після підтвердження депозиту
```

### BR-02 — Комісія агента

```
commission = tour.basePrice × persons × agent.commissionPct
НЕ від totalAmount, НЕ від ДОПів, НЕ від знижок
```

### BR-03 — Виплата комісії

```
CommissionStatus → 'to_pay' ТІЛЬКИ коли:
  booking.status = 'completed' І tour.status = 'completed'
```

### BR-04 — Видимість внутрішніх даних

```typescript
// Агент і турист НІКОЛИ не бачать:
// costPrice, margin, netProfit, internalNotes
// Використовувати TourPublicDto (окремий DTO без цих полів)
// canSeeMargin = true для: admin, director, manager, ops_manager, accountant
// canSeeMargin = false для: agent, tourist
// ⚠️ ВИПРАВЛЕНО: менеджер БАЧИТЬ маржу
```

### BR-05 — Два типи агентів

```
standard: payout = basePrice × persons × commissionPct
network:  gross − coAmount − royaltyAmount
```

### BR-06 — FSM статусів (15 станів, без пропусків)

```
new → in_work → needs_clarification / pre_booked → awaiting_payment
→ partially_paid → confirmed → docs_collected → ready_to_depart
→ on_trip → completed (terminal)

Скасування: → cancelled_client | cancelled_operator → refund
no_show, refund — термінальні
```

### BR-07 — Роялті мережі

Тільки після CommissionStatus = 'paid' у всіх субагентів мережі

### BR-08 — Скасування оператором

```
cancelled_operator → авто-refund totalPaid, penalty = 0
AgentCommission.status = 'cancelled'
```

## 8. РОЛІ ТА API

### Ролі (7)

`admin | director | manager | ops_manager | accountant | agent | tourist`

### Frontend маршрути (актуальний App.tsx)

```
/login           → public
/dashboard       → admin, director, manager, ops_manager, accountant
/tours           → admin, director, manager, ops_manager, accountant
/bookings        → admin, director, manager, ops_manager, accountant
/operations      → admin, director, manager, ops_manager, accountant
/finance         → admin, director (ТІЛЬКИ!)
/agent/*         → agent (AgentCabinet)
```

### Backend API endpoints (src/app.ts, всі зареєстровані)

```
GET  /api/v1/health     ← перевірка стану
POST /api/v1/auth/login, /refresh, /logout
GET/POST/PATCH /api/v1/tours, /tours/:id, /tours/:id/availability
GET/POST/PATCH /api/v1/bookings, /bookings/:id, /bookings/:id/status
GET/POST/PUT   /api/v1/leads, /leads/:id, /leads/:id/convert
GET            /api/v1/finance/summary, /finance/debts, /finance/tours/:id/pnl
GET            /api/v1/agents, /agents/:id, /agents/:id/commission
```

### JWT payload (snake_case)

```
{ sub, email, role, full_name, agentId, agentType, networkId, agent_code }
```

## 9. ІДЕНТИФІКАТОРИ

```
Тур:        [PRODUCT_CODE][YEAR][MONTH][DAY][SEQ] → LP26010301
Бронювання: ET-YYYY-NNNNN → ET-2026-00001
Генератор:  src/shared/utils/booking-number.ts
```

## 10. БРЕНДОВІ ТОКЕНИ

```css
--et-cyan:  #53c7d6;  /* primary */
--et-red:   #f0366d;  /* CTA */
--et-gold:  #f9c01d;  /* акцент */
--et-blue:  #2d70b9;  /* secondary */
--et-dark:  #1a1a2e;  /* фон */
--et-pink:  #f7c5d0;  /* пастельний */
```

Шрифти: Montserrat (заголовки), IBM Plex Sans (тіло), IBM Plex Mono (код). Кнопки: rounded-full (9999px).
Файли: `frontend/src/constants/brand.ts`, `frontend/src/styles/globals.css`

## 11. OPS МОДУЛЬ — АНАЛІЗ (BA+PM+UX, липень 2026)

Джерело: `Eurotrips_OPS_Module_Full.docx`. Дані аналізу: 1006 турів, 2577 готельних записів, 4341 активностей, тур MB26070401.

Проблема AS-IS: 8–12 годин ручної роботи в 5+ Google Sheets на підготовку одного виїзду. Ціль: скоротити до ≤4 годин, усунути 3–5 прострочених дедлайнів готелів/місяць.

13 операційних етапів (AS-IS):

1. Шаблон продукту (PM → PROD_LEGEND.csv)
2. Планування виїзду з датою (PM+ОМ → Календар.csv)
3. Відкриття продажів (ціна, комісія, місця)
4. Бронювання готелів (2577 рядків вручну)
5. Замовлення транспорту (перевізник, км, тариф)
6. Бронювання гідів та активностей (4341 записів)
7. Планування ДОПів (4140 рядків)
8. Управління наповненістю (квоти)
9. Підготовка попереднього румінгу
10. Фінальний румінг (розселення)
11. Розсадка в автобусі
12. Формування операційних документів
13. Контроль факт після виїзду

Ключові User Stories (OPS-01..OPS-20):

- OPS-01: Стандартна структура кімнат готелю
- OPS-02: Тригер румінгу: ≥30 осіб АБО ≤14 днів до виїзду
- OPS-03: Self-service туриста — побажання по кімнаті та місцю
- OPS-14..16: Попередній та фінальний румінг
- OPS-18: 9-пунктовий чекліст готовності
- OPS-19: Авто-генерація PDF документів
- OPS-20: Fast Launch Mode (запуск виїзду за 5 полів)

Машина стану румінгу:

```
DRAFT → APPROVED (продакт) → FINAL (передано логісту)
Після FINAL: self-service туриста вимкнено
```

10 нових UI компонентів (пріоритет MVP): CalendarGrid, TourProgressBar, RoomingBoard (split-panel), TimelineView, ProgressChecklist, DocumentCard, HotelStatusBadge, BusSeatMap, DeadlineIndicator

6 wireframes: Список виїздів, Готелі, Програма і Гіди, Румінг, Чекліст, Документи

## 12. ФІНАНСОВА МОДЕЛЬ

```
СВ = Розміщення + Транспорт + Персонал + Гіди + ДОПи + Непрямі
gross = basePrice + доплати − знижки
AG commission = gross × 10–30% (реальні дані: AGcomission.csv, 406 рядків)
net margin = gross − СВ − AG − роялті − непрямі
```

ДОПи: окремий P&L, без агентської комісії.

⚠️ Критичний ризик: деякі маршрути мають комісію агентів (30%) > маржі оператора (14.5%) → потрібен блокер публікації до підтвердження директора.

Суми в EUR. Відображення: `toLocaleString('uk-UA')`

## 13. ZOHO CRM ІНТЕГРАЦІЯ

22 модулі Zoho. Порядок міграції: Products → Agencies → Contacts → Leads → Deals. ExternalId: `zoho_{module}_{id}`

⚠️ Відкриті питання (тимчасово в `metadata.zoho_fields` JSONB):

- Q-01: field2/3/5 у CustomModule3
- Q-02: field29–56 у Agencies

`zoho-migration.ts` та `zoho_webhook.ts` — є в репо, але маршрути закоментовані (баги).

## 14. РЕАЛЬНІ CSV ДАНІ (в репо)

| Файл | Записів | Зміст |
|---|---|---|
| AGcomission.csv | 406 | Комісії агентів 10–30% по ID туру |
| собівартість_NEW.csv | 335 | Собівартість турів з компонентами |
| Final_Hotel_Database__Sheet1.csv | 563 | База готелів з цінами та рейтингами |
| Бронь_готелів.csv | 2577 | Готельні бронювання з дедлайнами |
| Бронювання_активностей.csv | 4341 | Активності, гіди, телефони |
| ДОПи_план_факт.csv | 4140 | Додаткові послуги план/факт |
| Транспорт.csv | 2827 | Перевізники, км, тариф |
| Календар.csv | 1006 | Каталог турів |

Тестовий виїзд для OPS демо: MB26070401 (Чорногорія–Будва, 50 туристів)

## 15. КОМАНДА ПРОЕКТУ

Антон (PO) оркеструє 15 AI-спеціалістів у окремих чатах: Backend Dev | Frontend Dev | QA/Тестування | Інтеграція API | UX/UI Дизайн | DevOps | Business Analyst | Tech Writer | Архітектор | Data Analyst/BI | Product Manager | Фінансова логіка | Управління агентами | Security Review | Аналітика продажів

Ключові колеги Eurotrips: CEO — Yaremkovych Dima | COO — Nazarenko Zhenya | Фінанси — Pavlyk Nata | Product Lead — Tretyakova Nastya | Sales Lead — Borovko Viktoriya | Marketing — Nosov Yura

## 16. КАТЕГОРИЧНІ ЗАБОРОНИ

- ❌ НЕ розкоментовувати liqPayRoutes, zohoWebhookRoutes, BullMQ workers без підтвердження
- ❌ НЕ вносити DATABASE_URL, REDIS_URL, JWT секрети в жоден git-файл
- ❌ НЕ використовувати "cd backend &&" в командах — backend IS the root
- ❌ НЕ оновлювати availableSeats без транзакції (BR-01)
- ❌ НЕ рахувати комісію від totalAmount (BR-02)
- ❌ НЕ показувати агенту costPrice/margin/netProfit (BR-04)
- ❌ НЕ припускати шляхи до файлів — завжди dir/Get-ChildItem перед редагуванням
- ❌ НЕ пушити без перевірки npm run build на обох частинах
- ❌ НЕ додавати окремий пакет "npm" до nixpkgs — він не існує, є тільки nodejs_20

## 17. ROADMAP

- **MVP (поточний, Q3 2026):** Auth + Tours + Bookings + Leads + Finance + AgentCabinet + OPS + Hotels + Transport + Insurance + Documents + Communications + Zoho + LiqPay + Agents
- **Реліз 2 (Q4 2026):** Analytics/BI (11 дашбордів), Кабінет туриста (self-service), Групові запити, WayForPay
- **Реліз 3 (2027):** Мобільний додаток, AI-рекомендації, GDPR

## 18. SELF-UPDATE — ЯК ОНОВЛЮВАТИ ЦЕЙ ФАЙЛ

Після кожного значного блоку роботи:

1. Оновити % готовності в розділі 5 (якщо змінився)
2. Зафіксувати нові закоментовані/розкоментовані секції в розділі 4
3. Додати нові бізнес-правила в розділ 7
4. Оновити Deploy статус в розділі 5
5. Зафіксувати нові поля schema в розділі 6

```bash
git add EUROTRIPS_PROJECT_CONTEXT.md
git commit -m "context: [що оновлено] — $(date +%Y-%m-%d)"
```

Сигнал застарілості: якщо файл не оновлювався більше 2 тижнів — синхронізувати з репо.

---

Версія: 2.0 | Оновлено: Липень 2026 | На основі: schema.prisma v1.1, CLAUDE.md, App.tsx, OPS Module Full
