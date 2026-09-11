# ETOS — Етап 1: звіт

**Гілка:** `fix/stage-1-pre-integration` (від `develop` @ `72f0782`)
**Дата:** 11 вересня 2026
**Комітів:** 7 — по одному на кожну з 5 задач, звіт і прогін на живій БД
**Тестів:** 135 юніт + 5 інтеграційних на живій БД — усі зелені
**Перевірено на:** Neon, проєкт `eurotrips`, гілка від `production`

---

## Зроблено

### Задача 1 — BR-01, гонка при списанні місць

**Коміт `d81d284`** `fix(bookings): BR-01 — атомарне списання місць замість find+update`

Новий спільний хелпер `claimSeats()` виконує перевірку й декремент одним
`updateMany` з умовою у `WHERE`. Виправлено в трьох місцях:

| Файл | Що було | Що стало |
|---|---|---|
| `src/shared/utils/seat-claim.ts` | — | новий: `claimSeats()` + `SEAT_CLAIMABLE_TOUR_STATUSES` |
| `src/modules/bookings/bookings.service.ts` | транзакція є, але `findFirst` + `update` | `claimSeats(tx, ...)`, потім читання туру для `basePrice`/`cancelPolicy` |
| `src/modules/leads/leads.service.ts` | перевірка через кореневий `prisma`, тобто **поза** транзакцією | уся логіка перенесена всередину `$transaction` |
| `src/modules/tours/tours.service.ts` | транзакції не було зовсім | `$transaction` + атомарний зсув `availableSeats` на дельту `totalSeats` |

Статуси туру звірені з `enum TourStatus` у `schema.prisma`: `open` / `active` /
`almost_full` — підтверджено, решта (`draft`, `closed`, `on_tour`, `completed`,
`cancelled`) місць не продають.

Помилка при нестачі місць — існуюча `Errors.seatsUnavailable()`
(`SEATS_UNAVAILABLE`, 409), нових типів не додавав.

### Задача 2 — констрейнт розсадки

**Коміт `80904df`** `fix(seats): місце в автобусі унікальне в межах виїзду, не бронювання`

- `BookingTourist.tourId` денормалізовано з `Booking.tourId` + FK + індекс
- `@@unique([bookingId, busSeaNumber])` → `@@unique([tourId, busSeatNumber])`
- `busSeaNumber` → `busSeatNumber` (поле Prisma; про БД — див. «Розбіжності» §4)
- запити розсадки спрощені: `tourId` тепер на учаснику, join через `booking` не потрібен
- `P2002` на призначенні місця мапиться в той самий `409 SEAT_TAKEN`

Змінено: `prisma/schema.prisma`, `seat-map.service.ts`, `seat-map.schema.ts`,
`seat-map.routes.ts`, `bookings.service.ts`, `leads.service.ts`,
`documents.service.ts`, `tourists.service.ts`, `prisma/seed.ts`
+ 5 файлів фронтенду.

### Задача 3 — ідентичність туриста

**Коміт `5bd2a12`** `fix(tourists): ідентичність за паспортом+ДН замість @unique email`

- знято `@unique` з `Tourist.email`, додано `@@unique([passportNumber, dateOfBirth])`
- новий `src/shared/utils/tourist-identity.ts` — каскад паспорт+ДН → email → `null`
- переписано обидва місця пошуку: `tourists.service.ts`, `leads.service.ts`
- DTO розширено полями `passportNumber` / `dateOfBirth` (див. «Розбіжності» §10)

### Задача 4 — ZOHO_DEAL_STAGE_MAP

**Коміт `01b50bd`** `fix(zoho): переписано ZOHO_DEAL_STAGE_MAP з реальних значень`

Новий `src/shared/utils/zoho-stage-map.ts` — **поза** `integrations/zoho/`,
щоб потрапляти у збірку й покриватись тестами.

- `ZOHO_DEAL_STAGE_MAP` — 8 реальних стадій пайплайну «Поездка»
- `ETOS_TO_ZOHO_STAGE: Record<BookingStatus, string>` — повний по всіх 15 статусах
- `ZOHO_PIPELINE = 'Поездка'`
- `zohoStageToBookingStatus()` — невідома стадія → `null` + `warn`, без винятку

### Задача 5 — централізований конфіг

**Коміт `d973033`** `fix(config): ZOHO_* через централізовану валідацію + гейт ZOHO_ENABLED`

- усі 8 змінних у схемі `config/index.ts`
- `ZOHO_ENABLED` (default `false`); при `true` `superRefine` вимагає
  `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN`, `WEBHOOK_TOKEN`
- новий `src/shared/utils/webhook-token.ts`: відсутній секрет → `not_configured`
  і **відмова**, порівняння constant-time через `timingSafeEqual` над SHA-256
- `.env.example` — повний перелік із коментарями

Перевірено вручну:

```
$ ZOHO_ENABLED=true node -e "require('./dist/src/config')"
❌ Помилка конфігурації:
  ZOHO_CLIENT_ID: Обовʼязкова змінна при ZOHO_ENABLED=true
  ZOHO_CLIENT_SECRET: Обовʼязкова змінна при ZOHO_ENABLED=true
  ZOHO_REFRESH_TOKEN: Обовʼязкова змінна при ZOHO_ENABLED=true
  ZOHO_WEBHOOK_TOKEN: Обовʼязкова змінна при ZOHO_ENABLED=true
```

---

## Тести

Додано **50** тестів у 7 файлах. Разом у проєкті **135** (було 85), усі зелені.

| Файл | Тестів | Що покриває |
|---|---|---|
| `src/modules/bookings/bookings.seats.test.ts` | 5 | форма atomic claim, `SEATS_UNAVAILABLE`, `NOT_FOUND`, claim усередині транзакції |
| `src/modules/leads/leads.seats.test.ts` | 3 | claim у конверсії ліда; перевірка не тече повз транзакцію |
| `src/modules/tours/tours.seats.test.ts` | 5 | зсув на дельту, guard у `WHERE`, `SEATS_REDUCE_CONFLICT`, місця не чіпаються без зміни `totalSeats` |
| `src/modules/bookings/seat-map.constraint.test.ts` | 4 | область конфлікту = виїзд, нове ім'я поля, `SEAT_TAKEN` |
| `src/shared/utils/tourist-identity.test.ts` | 6 | каскад, порожні рядки, `orderBy` при кількох збігах по email |
| `src/shared/utils/zoho-stage-map.test.ts` | 15 | повнота мап, mojibake, `1. ?????`, чужий пайплайн, alias з warn |
| `src/shared/utils/webhook-token.test.ts` | 12 | **відмова при ненастроєному секреті**, різна довжина, нерядкові заголовки |

**Тести на задачі 1 і 2 написані до правки.** Прогін до фіксу:

```
BR-01:      Tests  5 failed (5)
Розсадка:   Tests  2 failed | 2 passed (4)
```

Два тести розсадки пройшли одразу — сервіс уже шукав конфлікт по всьому туру
(через `booking: { tourId }`). Дірка була суто на рівні БД-констрейнту, тому
падали лише тести на перейменування поля.

Тести BR-01 перевіряють **форму запиту**, а не результат: на моках зламаний
код віддає той самий результат, що й виправлений. Гонка виникає в СУБД.

Додано два DB-gated набори (пропускаються без `RUN_DB_TESTS=1`):

- `test/integration/seats.concurrency.test.ts` — тур з 1 місцем, два
  паралельні claim, очікування: рівно один виграє, `availableSeats === 0`
- `test/integration/seat-uniqueness.test.ts` — те саме місце двом бронюванням
  одного виїзду → `P2002`

**Обидва прогнані на живій БД — 5/5 зелених.** Деталі в розділі «Прогін на
живій БД (Neon)». Запуск: `npm run test:integration` із `RUN_DB_TESTS=1` і
справжнім `DATABASE_URL`; без них набори пропускаються, тож CI без БД
лишається зеленим.

---

## Міграції

### `20260911010000_seat_unique_per_tour`

Backfill **є**. Порядок:

1. `DO`-блок: перевірка дублів `(tour_id, bus_seat_number)` серед заповнених;
   при знахідці — `RAISE EXCEPTION` зі списком до 20 прикладів
2. `ADD COLUMN tour_id UUID` (nullable)
3. `UPDATE ... SET tour_id = b.tour_id FROM bookings b`
4. `ALTER COLUMN tour_id SET NOT NULL`
5. `ADD CONSTRAINT ... FOREIGN KEY` → `tours(id)`
6. `DROP INDEX booking_tourists_booking_id_bus_seat_number_key`
7. `CREATE UNIQUE INDEX (tour_id, bus_seat_number)` + `CREATE INDEX (tour_id)`

### `20260911020000_tourist_identity`

Backfill **не потрібен** (лише індекси).

1. `DO`-блок: перевірка дублів `(passport_number, date_of_birth)`
2. `DROP INDEX tourists_email_key`
3. `CREATE UNIQUE INDEX (passport_number, date_of_birth)`

### Перевірка повноти

`prisma migrate diff` від схеми `develop` до поточної дає 7 DDL-операцій.
Усі 7 покриті двома міграціями (перевірено звіркою рядок за рядком).
`npx prisma validate` — OK.

---

## Знайдені дублі даних

**ПЕРЕВІРЕНО на живій БД.** Запити виконані read-only просто на гілці
`production` проєкту Neon `eurotrips`, база `eurotrips_booking`.

| Перевірка | Результат |
|---|---|
| Задача 2 — дублі `(tour_id, bus_seat_number)` | **0** — порожній результат |
| Задача 3 — дублі `(passport_number, date_of_birth)` | **0** — порожній результат |
| Осиротілі `booking_tourists` без `bookings` | **0** |

Обсяг даних на момент перевірки: 7 турів, 9 бронювань, 6 учасників,
10 туристів, 4 ліди. Це фактично демо-дані, не продакшн-навантаження.

Запити також лишились **вбудованими в самі міграції** як `DO`-блоки — на
випадок, якщо дублі з'являться до накату на інше середовище: накат зупиниться
з явним повідомленням і списком прикладів замість глухого `23505`.

```sql
-- задача 2
SELECT b.tour_id, bt.bus_seat_number, count(*)
FROM booking_tourists bt
JOIN bookings b ON b.id = bt.booking_id
WHERE bt.bus_seat_number IS NOT NULL
GROUP BY 1, 2 HAVING count(*) > 1;

-- задача 3
SELECT passport_number, date_of_birth, count(*)
FROM tourists
WHERE passport_number IS NOT NULL AND date_of_birth IS NOT NULL
GROUP BY 1, 2 HAVING count(*) > 1;
```

---

## Прогін на живій БД (Neon)

Перевірка виконана на гілках Neon, зроблених від `production`. Прод не
змінювався — на ньому лише read-only `SELECT`.

### Накат на дані (головний тест backfill)

`prisma migrate deploy` **без** попереднього reset — саме так backfill
перевіряється на справжніх рядках:

```
Applying migration `00000000000000_enable_extensions`
Applying migration `20260911010000_seat_unique_per_tour`
Applying migration `20260911020000_tourist_identity`
All migrations have been successfully applied.
```

Результат backfill:

| Перевірка | Результат |
|---|---|
| `booking_tourists` усього | 6 |
| `tour_id` заповнено | **6** |
| розбіжностей із `bookings.tour_id` | **0** |

Констрейнти після накату:

| Індекс | Стан |
|---|---|
| `booking_tourists_tour_id_bus_seat_number_key` | ✅ створено |
| `booking_tourists_tour_id_idx` | ✅ створено |
| `booking_tourists_booking_id_bus_seat_number_key` | ✅ прибрано |
| `tourists_passport_number_date_of_birth_key` | ✅ створено |
| `tourists_email_key` | ✅ прибрано |
| `tourists_email_idx` | ✅ збережено |

### Інтеграційні тести

```
✓ test/integration/seat-uniqueness.test.ts   (4 tests)
✓ test/integration/seats.concurrency.test.ts (1 test)
  ✓ BR-01 · два паралельні claim на 1 місце: рівно один виграє, availableSeats = 0
Tests  5 passed (5)
```

**Це та сама перевірка, якої бракувало.** Конкурентний тест BR-01 пройшов на
живій PostgreSQL — на моках задача 1 не доводилась узагалі.

Тест констрейнту переписаний: раніше він шукав придатні рядки серед наявних
даних і **мовчки пропускався**, коли не знаходив (що й сталось на першому
прогоні). Тепер створює власні фікстури — два різні бронювання на один виїзд —
і перевіряє, що друге призначення того самого місця падає з `P2002`.

### Юніт-тести без БД

`npm test` — 135/135, працює без `DATABASE_URL`, як і було.

---

## Розбіжності з завданням

Найважливіший розділ. Завдання складене за аудитом, частина припущень не
збіглася з кодом.

**1. `statuses.ts` не існує.** Статуси туру — це `enum TourStatus` у
`schema.prisma`. Значення `open`/`active`/`almost_full` **правильні**.

**2. Номери рядків зсунулись** на 1–7 у всіх трьох місцях BR-01. Шукав за
вмістом, як і просили.

**3. `createBooking` не можна звести до самого `updateMany`.** Об'єкт `tour`
використовується далі — `tour.basePrice` для комісії (BR-02) і
`include: { cancelPolicy: true }`. Тому: спершу atomic claim, потім читання
туру в тій самій транзакції. Те саме в `leads.service.ts`.

**4. `busSeaNumber` → `busSeatNumber` НЕ торкається бази.** Колонка від
початку звалась `bus_seat_number` (див. `20260708124108_ops_migration_v1_1`),
помилка була лише в імені поля Prisma-моделі. `prisma migrate diff` не
генерує жодного `RENAME`. У завданні це подано як зміну поля **й** `@map` —
`@map` мінятись не мав.

**5. Сервіс розсадки вже шукав конфлікт по всьому туру** (`booking: { tourId }`
у `seat-map.service.ts`), а не в межах бронювання. Розбіжність була лише між
констрейнтом БД і коментарем. Це змінює оцінку ризику: дірка існувала, але
через код її було важче дістати, ніж здається з опису.

**6. `SELECT ... FOR UPDATE` залишено.** Завдання пропонувало покластись на
констрейнт, але FOR UPDATE лишився як швидкий шлях: він дає зрозумілий `409`
замість помилки констрейнту, коли місце **вже** зайняте. Констрейнт ловить
решту гонок (`P2002` → той самий `409`).

**7. Перенесення бронювання на інший тур не існує.** Перевірено grep-ом:
`tourId` ніде не змінюється після створення (`booking.update` його не
торкається). Додано `TODO(stage-2)` у `bookings.service.ts` — саме там, де
створюються учасники.

**8. Зміна API-контракту.** Тіло `PATCH /bookings/:id/tourist/:tId/preferences`
тепер приймає `busSeatNumber` (було `busSeaNumber`); у відповідях
`bus_seat_number`. Оновлено 5 файлів фронтенду. Зовнішніх споживачів немає,
але формально це breaking change.

**9. `Tourist.email` вже був nullable** (`String?`). Завдання просило
«перевірити, чи обов'язковий» — ні. Також у наведеному фрагменті схеми було
`email String? @map("email")`: `@map` тут зайвий, поле й так лягає в колонку
`email`.

**10. DTO не містили `passportNumber` і `dateOfBirth`.** Перша ланка каскаду
була б мертвим кодом. Довелось розширити `CreateTouristSchema` і вкладений
`tourist` у `CreateLeadSchema`. Це вихід за буквальні межі задачі, але без
нього задача не має сенсу.

**11. `seed.ts` робив `tourist.upsert({ where: { email } })` у трьох місцях.**
Після зняття `@unique` це перестало компілюватись (TypeScript спіймав одразу).
Додано локальний `seedTourist()` — find-then-create, ідемпотентність збережена.

**12. Ключі `ETOS_TO_ZOHO_STAGE` збіглися з `BookingStatus` повністю** — усі
15 значень. Нових статусів не додавав.

**13. ⚠ ДЖЕРЕЛА СУПЕРЕЧАТЬ ОДНЕ ОДНОМУ щодо формату `Stage` в API.**

- «Zoho CRM — модуль Deals: розшифровка кастомних полів»: *«Критично: для API
  використовувати `actual_value`, а не те, що видно в UI»* + таблиця
  (`1. Новая` → `Qualification`, `6. Завершена успешно` → `Closed Won`)
- Завдання етапу 1 і «Контракт синхронізації v3»: *«API повертає й приймає
  display-значення, не `actual_value`»*, позначено як перевірене емпірично

**ЗАКРИТО 11.09.2026.** Правий — контракт v3: API повертає й приймає
display-значення. Винним виявився `zoho-deals-field-map.md` — його склали з
метаданих до перевірки на живому API, і твердження про `actual_value` було
хибним. Запис підтверджено непрямо: продакшн-Deluge виконує
`zoho.crm.updateRecord("Deals", potID, {"Stage":"4. Бронь"})` тисячі разів на
добу і не падає.

Документ виправлено: розділ про стадії позначено як помилковий, наведено
правильну таблицю, стару лишено під `<details>` для історії. Таблиці
кастомних полів у ньому чинні — вони з метаданих і від помилки не залежать.

Запасна таблиця `ZOHO_DEAL_STAGE_ACTUAL_VALUE_ALIASES` лишена: коштує нічого,
а від тихого провалу страхує.

**14. Конфлікт із забороною чіпати `integrations/zoho/*`.** Задача 4.4 просить
позначити `ZOHO_LEAD_STATUS_MAP` / `ZOHO_SOURCE_MAP` коментарем `TODO(stage-3)`,
а вони лежать у `zoho.types.ts` — усередині забороненої теки. Файл не чіпав;
`TODO(stage-3)` із поясненням записав у новий `zoho-stage-map.ts`. Наслідок:
`ZOHO_DEAL_STAGE_MAP` тепер існує у двох місцях — стара (у `zoho.types.ts`)
і нова (у `shared/utils/zoho-stage-map.ts`). Прибрати стару — на етапі 3.

Уточнення: стара мапа **не «поза збіркою»**. У `tsconfig.build.json` виключені
поіменно `zoho-migration.ts`, `zoho-verify.ts` і `zoho.webhook.ts`, але не
`zoho.types.ts` — тому він компілюється, і `dist/` містить хибні
`ZOHO_DEAL_STAGE_MAP`, `ZOHO_LEAD_STATUS_MAP`, `ZOHO_SOURCE_MAP` під тими
самими іменами, що й правильні. У рантаймі це поки нешкідливо: єдиний
споживач старої мапи — `zoho-migration.ts`, а він зі збірки виключений.
Але два однойменні експорти — пастка: `import { ZOHO_DEAL_STAGE_MAP }` з
неправильного шляху скомпілюється мовчки. На етапі 3 стару мапу видалити,
а `zoho.types.ts` до того часу — або в exclude, або почистити.

**15. Той самий конфлікт у задачі 5.4.** «Перевірку підпису переписати» — це
`zoho.webhook.ts`, теж заборонена тека. Логіку реалізовано повністю в
`shared/utils/webhook-token.ts` із тестами; підключення до маршруту — етап 3.
Сам маршрут лишається закоментованим у `app.ts`, як і був.

**16. `ZOHO_*` змінних вісім, а не дев'ять.** Фактично в `src/`:
`ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN` (через
`requireEnv()`, тому не видно грепом по `process.env.ZOHO_`), `ZOHO_BASE_URL`,
`ZOHO_AUTH_URL`, `ZOHO_PAYMENT_MODULE`, `ZOHO_TRAVEL_MODULE`,
`ZOHO_WEBHOOK_TOKEN`. Дев'ятою, схоже, рахувався `ZOHO_ORG_ID` — він є в
`.env.example`, але в коді **не використовується взагалі**. У схему додав
(як optional), щоб не губився. `ZOHO_WEBHOOK_SECRET` згадується лише у
docs-копії вебхука, у `src/` його немає.

**17. `z.coerce.boolean()` для `ZOHO_ENABLED` не годиться** — вона віддає
`true` на будь-якому непорожньому рядку, тобто `ZOHO_ENABLED=false` увімкнуло
б інтеграцію. Зроблено окремий `envBool` через `z.enum`.

**18. `tours.service.ts` виправлено сильніше, ніж просило завдання.** ТЗ:
«обгорнути транзакцією». Зробив додатково: `availableSeats` зсувається на
дельту `totalSeats` (`increment: delta`) замість абсолютного присвоєння, плюс
guard `availableSeats >= -delta` у `WHERE`. Причина: сама лише транзакція на
READ COMMITTED не рятує — бронювання, що пройшло між читанням і записом,
затиралось би абсолютним значенням. Тест на цю задачу я переписав під нове
рішення **до** реалізації.

---

## Заблоковано

### Чеклист

| Команда | Стан |
|---|---|
| `npx prisma validate` | ✅ OK |
| `npm run build` | ✅ OK, без помилок |
| `npm test` | ✅ 135/135 |
| `npx prisma migrate deploy` (на даних) | ✅ пройшло, backfill коректний |
| SQL-перевірки дублів (задачі 2 і 3) | ✅ дублів немає |
| Конкурентний тест BR-01 на живій БД | ✅ пройшов |
| `npx prisma migrate reset` | ❌ **неможливо** — див. нижче |

Локальний Docker Desktop (v29.5.3) лишився зламаним: Linux-движок віддає
`500 Internal Server Error` на `/containers/json`, контейнер не піднімається.
Обійдено через гілки Neon — це виявилось кращим варіантом, бо міграції
перевірились на справжніх даних.

### ❌ Накат з нуля неможливий: міграційна історія не самодостатня

`migrate reset` падає, і причина глибша за відсутність БД.

**Крок 1.** Reset знищує розширення `uuid-ossp`, і жодна міграція його не
створювала — воно було заведене вручну. Перша ж міграція падає:

```
ERROR: function uuid_generate_v4() does not exist  (42883)
```

Виправлено: додано `00000000000000_enable_extensions` із
`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`. Ім'я з нулів навмисне —
міграції застосовуються в лексикографічному порядку, тож вона йде першою.
Ідемпотентна, наявні міграції не редагувались (контрольні суми збережені).

**Крок 2.** Після цього падає вже наступна:

```
Applying migration `20260705101941_add_tour_checklists`
ERROR: relation "tours" does not exist  (42P01)
```

Причина — **базової міграції не існує взагалі**:

| | |
|---|---|
| моделей у `schema.prisma` | **25** |
| таблиць, які створюють усі міграції разом | **1** (`tour_checklists`) |

Історія міграцій починається з інкрементальної `add_tour_checklists`, яка
змінює вже наявні таблиці. Решту 24 таблиці колись створили через
`prisma db push` повз міграції.

**Наслідки:**

- `migrate reset` не спрацює ніколи
- CI не може підняти БД з нуля
- новий розробник теж не може — треба `db push`, а потім вручну позначати
  міграції застосованими
- `migrate deploy` працює **тільки** на базах, де схема вже є

**Не виправляв навмисно.** Лікується baseline-міграцією
(`migrate diff --from-empty --to-schema-datamodel`) плюс
`migrate resolve --applied` на кожній наявній базі. Це змінює процедуру
деплою продакшену — рішення не моє. Пункт для етапу 2.

### Побічна знахідка: інтеграційні тести не підхоплювались

`vitest.config.ts` має `include: ['src/**/*.test.ts']`, тож усе в
`test/integration/` ігнорувалося — `vitest run test/integration` віддавав
«No test files found». Тести існували, але запустити їх було неможливо.

Додано `vitest.integration.config.ts` і скрипт `npm run test:integration`.
Основний `npm test` лишився швидким і без БД.

### Що НЕ чіпав за умовою

- `src/modules/integrations/zoho/*` — жодного файлу
- BullMQ-воркери в `main.ts` — рядки лишились закоментованими
- нічого поза межами п'яти задач

Перевірено: у `dist/` із теки `integrations/zoho` лежить лише
`zoho.types.js` — виключення в `tsconfig.build.json` не порушене.

---

## Ризики для етапу 2

**1. ~~Формат `Stage`~~ — закрито.** Див. §13. Джерело суперечності —
застарілий `zoho-deals-field-map.md`, виправлений.

**2. Денормалізація `tourId` — точка майбутнього розсинхрону.** Зараз безпечна
(перенесення бронювань немає). На етапі 2, коли з'явиться `BookingOrigin` і
двосторонній потік, будь-яка операція, що змінює `Booking.tourId`, мусить
оновлювати `tourId` в усіх учасників. `TODO(stage-2)` стоїть у коді.

**3. B2C-бронювання зі списанням місця (етап 3) вимагає рішення про
`overbooked`.** Контракт v3 каже: якщо місць немає, бронювання створюється зі
статусом `overbooked`, а не відкидається. Такого статусу в `BookingStatus`
**немає**, а `claimSeats()` зараз кидає `SEATS_UNAVAILABLE`. Знадобиться або
новий статус, або окремий шлях для вхідних подій, який обходить claim.

**4. Строгий FSM лишається строгим.** `syncMode` не робив — це етап 2. Доки
його немає, будь-який вхідний потік із Zoho ламатиметься на 175 типах
переходів (реактивація `7. Отказ → 2. Переговоры`, відкати з `Closed Won`).

**5. `ETOS_TO_ZOHO_STAGE` згортає 15 статусів у 8.** Зворотний мапінг не
ізоморфний: `confirmed`, `docs_collected`, `ready_to_depart`, `on_trip` усі
йдуть у `5. 100 проц.`. Синхронізація туди-назад **не збереже** операційний
статус ETOS. Для двостороннього потоку це означає: Zoho не може бути джерелом
правди для цих чотирьох статусів.

**6. Каскад ідентичності при міграції 91 860 контактів.** `findExistingTourist`
падає назад на email і бере **найстаріший** запис при кількох збігах. На
масовій міграції це склеїть різних людей зі спільною агентською адресою.
Для міграції потрібен окремий, суворіший режим — лише паспорт+ДН, без
email-фолбеку.

**7. ~~Дублі в живих даних~~ — перевірено, їх немає.** Але дані зараз майже
порожні (9 бронювань, 10 туристів). Справжня перевірка буде на етапі 5, коли
приїдуть 91 860 контактів із Zoho — там колізії ймовірні.

**9. Міграційна історія не самодостатня** — 25 моделей, 1 таблиця в
міграціях. Потрібна baseline-міграція плюс `migrate resolve --applied` на
наявних базах. Без цього CI не підніме БД, а `migrate reset` не працює.
Деталі — у «Заблоковано». Це найбільший борг, знайдений на цьому етапі.

**8. Фронтенд має 65 передіснуючих помилок типізації** (`lucide-react`,
`BookingDetail.tsx` — 42 з них). Мої зміни їх не додали й не зачепили, але
`frontend/npm run type-check` червоний і до, і після. Це маскуватиме реальні
регресії типів у майбутніх правках фронтенду.
