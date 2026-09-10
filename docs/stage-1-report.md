# ETOS — Етап 1: звіт

**Гілка:** `fix/stage-1-pre-integration` (від `develop` @ `72f0782`)
**Дата:** 11 вересня 2026
**Комітів:** 6 — по одному на кожну з 5 задач плюс цей звіт
**Тестів:** 135 зелених (було 85, додано 50)

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

**Жоден із них не запускався** — див. «Заблоковано».

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

**НЕ ПЕРЕВІРЕНО — бази даних немає.** Обидва SQL-запити із завдання виконати
не вдалося (див. «Заблоковано»).

Замість ручної перевірки запити **вбудовані в самі міграції** як `DO`-блоки:
накат зупиниться з явним повідомленням і списком прикладів замість глухого
`23505` на `CREATE UNIQUE INDEX`.

Що треба зробити перед накатом на будь-яку живу БД:

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

Окремо: міграція 1 впаде, якщо є `booking_tourists` з `booking_id`, що не
вказує на живий рядок `bookings` — `tour_id` лишиться `NULL` і `SET NOT NULL`
не пройде. Це осиротілі записи; лікувати вручну.

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

Реалізовано **за завданням** (display-значення). Але додано запасну таблицю
`ZOHO_DEAL_STAGE_ACTUAL_VALUE_ALIASES`: якщо Zoho віддасть `actual_value`,
мапінг спрацює й запише `warn` про хибне припущення, замість тихого провалу
всіх угод у `null`. **Це треба закрити фактом до етапу 3** — один
`GET /crm/v8/Deals?fields=Stage` розв'язує питання остаточно.

**14. Конфлікт із забороною чіпати `integrations/zoho/*`.** Задача 4.4 просить
позначити `ZOHO_LEAD_STATUS_MAP` / `ZOHO_SOURCE_MAP` коментарем `TODO(stage-3)`,
а вони лежать у `zoho.types.ts` — усередині забороненої теки. Файл не чіпав;
`TODO(stage-3)` із поясненням записав у новий `zoho-stage-map.ts`. Наслідок:
`ZOHO_DEAL_STAGE_MAP` тепер існує у двох місцях — стара (мертва, у
`zoho.types.ts`, поза збіркою) і нова. Прибрати стару — на етапі 3.

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

### Бази даних немає — частину перевірок виконати неможливо

Docker Desktop встановлений (v29.5.3), але його Linux-движок відповідає
`500 Internal Server Error` на `/containers/json`. `docker compose up -d
postgres` завершується без помилки, контейнер не піднімається, порт 5432
закритий. Postgres локально теж не слухає.

**Не виконано з чеклиста:**

| Команда | Стан |
|---|---|
| `npx prisma validate` | ✅ OK |
| `npm run build` | ✅ OK, без помилок |
| `npm test` | ✅ 135/135 |
| `npx prisma migrate dev --name stage-1-fixes` | ❌ немає БД |
| `npx prisma migrate reset && npx prisma migrate deploy` | ❌ немає БД |
| SQL-перевірки дублів (задачі 2 і 3) | ❌ немає БД |
| Конкурентний тест BR-01 на живій БД | ❌ немає БД |

**Що зроблено натомість.** Міграції написані вручну, а їхній DDL звірений із
`prisma migrate diff --from-schema-datamodel ... --to-schema-datamodel`
(працює офлайн). Усі 7 операцій, яких вимагає різниця схем, покриті.
Backfill і `DO`-блоки в diff не входять — вони написані вручну і **не
виконувались жодного разу**.

**Це головний залишковий ризик етапу.** Перед мержем потрібен прогін на живій
БД: `migrate reset` + `migrate deploy` + `db:seed` + `RUN_DB_TESTS=1 vitest run
test/integration`.

### Що НЕ чіпав за умовою

- `src/modules/integrations/zoho/*` — жодного файлу
- BullMQ-воркери в `main.ts` — рядки лишились закоментованими
- нічого поза межами п'яти задач

Перевірено: у `dist/` із теки `integrations/zoho` лежить лише
`zoho.types.js` — виключення в `tsconfig.build.json` не порушене.

---

## Ризики для етапу 2

**1. Формат `Stage` у Zoho API не закритий фактом.** Див. §13. Один запит
знімає питання; поки що інтеграція побудована на суперечливих джерелах.

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

**7. Дублі в живих даних невідомі.** Міграції зупиняться, якщо вони є. Це
навмисно, але означає, що перший накат може впасти — і це виявиться вже на
етапі 2, а не зараз.

**8. Фронтенд має 65 передіснуючих помилок типізації** (`lucide-react`,
`BookingDetail.tsx` — 42 з них). Мої зміни їх не додали й не зачепили, але
`frontend/npm run type-check` червоний і до, і після. Це маскуватиме реальні
регресії типів у майбутніх правках фронтенду.
