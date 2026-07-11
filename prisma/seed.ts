// =============================================================================
// EUROTRIPS — Prisma Seed
// Тестові дані на основі реальних CSV-файлів та фронтенд-моків
// Запуск: npx prisma db seed
// =============================================================================

import { PrismaClient, UserRole, AgentType, TourType, TourStatus, LeadSource } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Починаємо seed...');

  // ── 1. CANCELLATION POLICIES ───────────────────────────────────────────────
  const standardPolicy = await prisma.cancellationPolicy.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Стандартна',
      description: 'Стандартна умова скасування для більшості турів Eurotrips',
      rules: [
        { days_before: 45, penalty_pct: 0 },
        { days_before: 30, penalty_pct: 0.2 },
        { days_before: 14, penalty_pct: 0.5 },
        { days_before: 7,  penalty_pct: 0.8 },
        { days_before: 0,  penalty_pct: 1.0 },
      ],
      isDefault: true,
    },
  });

  const premiumPolicy = await prisma.cancellationPolicy.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Преміум (невідшкодовувана)',
      description: 'Для преміум-турів. Депозит не повертається після підтвердження.',
      rules: [
        { days_before: 60, penalty_pct: 0 },
        { days_before: 30, penalty_pct: 0.5 },
        { days_before: 0,  penalty_pct: 1.0 },
      ],
      isDefault: false,
    },
  });

  // ── 2. STAFF ───────────────────────────────────────────────────────────────
  const guideOlena = await prisma.staff.upsert({
    where: { id: '00000000-0000-0000-0001-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0001-000000000001',
      firstName: 'Олена',
      lastName: 'Мельник',
      role: 'tour_leader',
      phone: '+380671234567',
      languages: ['uk', 'en', 'fr'],
      specializations: ['Франція', 'Нормандія', 'Париж'],
      status: 'active',
    },
  });

  const guideDmytro = await prisma.staff.upsert({
    where: { id: '00000000-0000-0000-0001-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0001-000000000002',
      firstName: 'Дмитро',
      lastName: 'Іваненко',
      role: 'tour_leader',
      phone: '+380679876543',
      languages: ['uk', 'fi', 'en'],
      specializations: ['Фінляндія', 'Лапландія', 'Скандинавія'],
      status: 'active',
    },
  });

  // ── 3. TOURS — 5 реальних турів з CSV-даних ──────────────────────────────
  // Джерела: собівартість_NEW.csv, AGcomission.csv
  // Включає: 2 завершені (для аналітики), 1 активний, 2 майбутніх (для тестів бронювання)

  // ── Тур 1: Адріатичне море + Доломіти (МАЙБУТНІЙ — 3 липня 2026) ────────
  const tourAdriatic = await prisma.tour.upsert({
    where: { code: 'VD26070301' },
    update: {},
    create: {
      code: 'VD26070301',
      name: 'Адріатичне море + Доломітові Альпи',
      product: 'Адріатичне море + Доломіти',
      direction: 'Хорватія / Словенія',
      countries: ['Хорватія', 'Словенія', 'Австрія'],
      tourType: TourType.bus,
      format: 'автобусний',
      departureDate: new Date('2026-07-03'),
      returnDate: new Date('2026-07-12'),
      durationDays: 9,
      departureCity: 'Львів',
      arrivalCity: 'Львів',
      basePrice: 840,
      currency: 'EUR',
      depositAmount: 168,
      depositDeadline: new Date('2026-06-15'),
      cancelPolicyId: standardPolicy.id,
      agentCommissionPct: 0.14,
      totalSeats: 52,
      availableSeats: 19,
      status: TourStatus.active,
      guideId: guideOlena.id,
      costPrice: 620,
      included: 'Автобусний трансфер, готель 3*, сніданки, страховка, супровід турлідера',
      notIncluded: 'Особисті витрати, обіди/вечері, в\'їздні збори',
      tags: ['sea', 'mountains', 'summer', 'popular'],
      isPremium: false,
      isFamily: false,
    },
  });

  // ── Тур 2: Адріатичне море + Доломіти (МАЙБУТНІЙ — 28 серпня 2026) ──────
  const tourAdriaticAug = await prisma.tour.upsert({
    where: { code: 'VD26082801' },
    update: {},
    create: {
      code: 'VD26082801',
      name: 'Адріатичне море + Доломітові Альпи',
      product: 'Адріатичне море + Доломіти',
      direction: 'Хорватія / Словенія',
      countries: ['Хорватія', 'Словенія', 'Австрія'],
      tourType: TourType.bus,
      format: 'автобусний',
      departureDate: new Date('2026-08-28'),
      returnDate: new Date('2026-09-06'),
      durationDays: 9,
      departureCity: 'Київ',
      arrivalCity: 'Київ',
      basePrice: 890,
      currency: 'EUR',
      depositAmount: 178,
      depositDeadline: new Date('2026-08-08'),
      cancelPolicyId: standardPolicy.id,
      agentCommissionPct: 0.14,
      totalSeats: 52,
      availableSeats: 52,   // 0 бронювань — відкрито для продажу
      status: TourStatus.open,
      guideId: guideDmytro.id,
      costPrice: 655,
      included: 'Автобусний трансфер, готель 3*, сніданки, страховка, супровід турлідера',
      notIncluded: 'Особисті витрати, обіди/вечері, в\'їздні збори',
      tags: ['sea', 'mountains', 'summer'],
      isPremium: false,
      isFamily: false,
    },
  });

  // ── Тур 3: Лапландія (ЗАВЕРШЕНИЙ — січень 2026) — для аналітики ─────────
  const tourLapland = await prisma.tour.upsert({
    where: { code: 'LP26010301' },
    update: {},
    create: {
      code: 'LP26010301',
      name: 'Лапландія — Країна Санти',
      product: 'Лапландія',
      direction: 'Фінляндія',
      countries: ['Фінляндія'],
      tourType: TourType.combined,
      format: 'комбінований',
      departureDate: new Date('2026-01-03'),
      returnDate: new Date('2026-01-10'),
      durationDays: 8,
      departureCity: 'Київ',
      arrivalCity: 'Київ',
      basePrice: 1290,
      currency: 'EUR',
      depositAmount: 258,
      cancelPolicyId: premiumPolicy.id,
      agentCommissionPct: 0.14,
      totalSeats: 52,
      availableSeats: 0,   // повністю заповнений
      status: TourStatus.completed,
      guideId: guideDmytro.id,
      costPrice: 139,      // з CSV: Собівартість 139 EUR
      tags: ['family', 'winter', 'premium', 'kids', 'lapland'],
      isFamily: true,
      isPremium: true,
    },
  });

  // ── Тур 4: Париж + Нормандія (ЗАВЕРШЕНИЙ — травень 2026) ────────────────
  const tourParis = await prisma.tour.upsert({
    where: { code: 'PN26052301' },
    update: {},
    create: {
      code: 'PN26052301',
      name: 'Париж + Нормандія',
      product: 'Париж + Нормандія',
      direction: 'Франція',
      countries: ['Франція'],
      tourType: TourType.bus,
      format: 'автобусний',
      departureDate: new Date('2026-05-23'),
      returnDate: new Date('2026-05-29'),
      durationDays: 7,
      departureCity: 'Львів',
      arrivalCity: 'Львів',
      basePrice: 840,
      currency: 'EUR',
      depositAmount: 168,
      cancelPolicyId: standardPolicy.id,
      agentCommissionPct: 0.14,
      totalSeats: 52,
      availableSeats: 0,
      status: TourStatus.completed,
      guideId: guideOlena.id,
      costPrice: 300,       // з CSV: Собівартість 300 EUR
      tags: ['culture', 'history', 'france', 'popular'],
      isPremium: true,
    },
  });

  // ── Тур 5: Швейцарія (АКТИВНИЙ — 24 травня 2026, ще є місця) ────────────
  const tourSwitzerland = await prisma.tour.upsert({
    where: { code: 'SW26052401' },
    update: {},
    create: {
      code: 'SW26052401',
      name: 'Швейцарія',
      product: 'Швейцарія',
      direction: 'Швейцарія',
      countries: ['Швейцарія'],
      tourType: TourType.combined,
      format: 'комбінований',
      departureDate: new Date('2026-05-24'),
      returnDate: new Date('2026-05-29'),
      durationDays: 6,
      departureCity: 'Київ',
      arrivalCity: 'Київ',
      basePrice: 790,
      currency: 'EUR',
      depositAmount: 158,
      cancelPolicyId: premiumPolicy.id,
      agentCommissionPct: 0.14,
      totalSeats: 50,
      availableSeats: 2,   // майже заповнений
      status: TourStatus.almost_full,
      guideId: guideDmytro.id,
      costPrice: 280,      // з CSV: Собівартість 280 EUR
      tags: ['mountains', 'alps', 'premium', 'switzerland'],
      isPremium: true,
    },
  });

  // ── 4. USERS — точно відповідають tests/fixtures/auth.fixtures.ts ──────────
  // КРИТИЧНО: будь-яка зміна тут = зміна у CREDENTIALS в auth.fixtures.ts
  // Всі паролі: test1234 (як у QA fixtures)
  const SEED_PASSWORD = 'test1234';

  const hashPassword = (p: string) => bcrypt.hash(p, 4); // rounds=4 для швидкості seed

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@eurotrips.ua' },
    update: { passwordHash: await hashPassword(SEED_PASSWORD) },
    create: {
      email: 'admin@eurotrips.ua',
      passwordHash: await hashPassword(SEED_PASSWORD),
      role: UserRole.admin,
      firstName: 'Адміністратор',
      lastName: 'Системи',
      phone: '+380441234567',
      isActive: true,
    },
  });

  // manager@eurotrips.ua / test1234 → name: "Олена Коваль"
  const managerOlena = await prisma.user.upsert({
    where: { email: 'manager@eurotrips.ua' },
    update: { passwordHash: await hashPassword(SEED_PASSWORD) },
    create: {
      email: 'manager@eurotrips.ua',
      passwordHash: await hashPassword(SEED_PASSWORD),
      role: UserRole.manager,
      firstName: 'Олена',
      lastName: 'Коваль',
      phone: '+380671111111',
      isActive: true,
    },
  });

  // director@eurotrips.ua / test1234 — раніше не існував взагалі, роль
  // director не мала жодного тестового акаунта для входу
  const directorUser = await prisma.user.upsert({
    where: { email: 'director@eurotrips.ua' },
    update: { passwordHash: await hashPassword(SEED_PASSWORD) },
    create: {
      email: 'director@eurotrips.ua',
      passwordHash: await hashPassword(SEED_PASSWORD),
      role: UserRole.director,
      firstName: 'Директор',
      lastName: 'Компанії',
      phone: '+380671234500',
      isActive: true,
    },
  });

  // Другий менеджер для тестів
  const managerAndrii = await prisma.user.upsert({
    where: { email: 'a.sych@eurotrips.ua' },
    update: { passwordHash: await hashPassword(SEED_PASSWORD) },
    create: {
      email: 'a.sych@eurotrips.ua',
      passwordHash: await hashPassword(SEED_PASSWORD),
      role: UserRole.manager,
      firstName: 'Андрій',
      lastName: 'Сич',
      phone: '+380672222222',
      isActive: true,
    },
  });

  // ops@eurotrips.ua / test1234
  const opsUser = await prisma.user.upsert({
    where: { email: 'ops@eurotrips.ua' },
    update: { passwordHash: await hashPassword(SEED_PASSWORD) },
    create: {
      email: 'ops@eurotrips.ua',
      passwordHash: await hashPassword(SEED_PASSWORD),
      role: UserRole.ops,
      firstName: 'Операційний',
      lastName: 'Менеджер',
      isActive: true,
    },
  });

  // finance@eurotrips.ua / test1234
  const financeUser = await prisma.user.upsert({
    where: { email: 'finance@eurotrips.ua' },
    update: { passwordHash: await hashPassword(SEED_PASSWORD) },
    create: {
      email: 'finance@eurotrips.ua',
      passwordHash: await hashPassword(SEED_PASSWORD),
      role: UserRole.accountant,
      firstName: 'Фінансист',
      lastName: 'Бухгалтер',
      isActive: true,
    },
  });

  // product_manager@eurotrips.ua / test1234
  const productManagerUser = await prisma.user.upsert({
    where: { email: 'product_manager@eurotrips.ua' },
    update: { passwordHash: await hashPassword(SEED_PASSWORD) },
    create: {
      email: 'product_manager@eurotrips.ua',
      passwordHash: await hashPassword(SEED_PASSWORD),
      role: UserRole.product_manager,
      firstName: 'Продакт',
      lastName: 'Менеджер',
      phone: '+380671234600',
      isActive: true,
    },
  });

  // logist@eurotrips.ua / test1234
  const logistUser = await prisma.user.upsert({
    where: { email: 'logist@eurotrips.ua' },
    update: { passwordHash: await hashPassword(SEED_PASSWORD) },
    create: {
      email: 'logist@eurotrips.ua',
      passwordHash: await hashPassword(SEED_PASSWORD),
      role: UserRole.logist,
      firstName: 'Логіст',
      lastName: 'Операційний',
      phone: '+380671234700',
      isActive: true,
    },
  });

  // agent@agency.ua / test1234 → name: "Тестовий Агент"
  const agentUserStandard = await prisma.user.upsert({
    where: { email: 'agent@agency.ua' },
    update: { passwordHash: await hashPassword(SEED_PASSWORD) },
    create: {
      email: 'agent@agency.ua',
      passwordHash: await hashPassword(SEED_PASSWORD),
      role: UserRole.agent,
      firstName: 'Тестовий',
      lastName: 'Агент',
      phone: '+380501234567',
      isActive: true,
    },
  });

  // agent2@agency.ua / test1234 → name: "Другий Агент" (для IDOR тесту TC-RBAC-011)
  const agentUserNetwork = await prisma.user.upsert({
    where: { email: 'agent2@agency.ua' },
    update: { passwordHash: await hashPassword(SEED_PASSWORD) },
    create: {
      email: 'agent2@agency.ua',
      passwordHash: await hashPassword(SEED_PASSWORD),
      role: UserRole.agent,
      firstName: 'Другий',
      lastName: 'Агент',
      phone: '+380509876543',
      isActive: true,
    },
  });

  // ── 5. AGENT NETWORK ──────────────────────────────────────────────────────
  const networkUkrTour = await prisma.agentNetwork.upsert({
    where: { id: '00000000-0000-0000-0002-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0002-000000000001',
      name: 'Мережа "УкрТур"',
      coCommissionPct: 0.02,
      royaltyPct: 0.01,
      contractNumber: 'МР-2024-001',
      contractDate: new Date('2024-01-15'),
      contactPerson: 'Директор мережі',
      email: 'info@ukrtour-network.ua',
      phone: '+380441000001',
      status: 'active',
    },
  });

  // ── 6. AGENTS ──────────────────────────────────────────────────────────────
  const agentStandard = await prisma.agent.upsert({
    where: { userId: agentUserStandard.id },
    update: {},
    create: {
      userId: agentUserStandard.id,
      agencyName: 'ТА "Мрія"',
      agentType: AgentType.standard,
      commissionPct: 0.14,
      contractNumber: 'АГ-2024-051',
      contractDate: new Date('2024-03-01'),
      status: 'active',
      city: 'Київ',
      country: 'Україна',
    },
  });

  const agentNetwork = await prisma.agent.upsert({
    where: { userId: agentUserNetwork.id },
    update: {},
    create: {
      userId: agentUserNetwork.id,
      agencyName: 'ТА "Галичина"',
      agentType: AgentType.network,
      networkId: networkUkrTour.id,
      commissionPct: 0.14,
      coCommissionPct: 0.02,   // 2% іде до ЦО мережі
      royaltyPct: 0.01,        // 1% роялті
      contractNumber: 'АГ-2024-067',
      contractDate: new Date('2024-04-15'),
      status: 'active',
      city: 'Львів',
      country: 'Україна',
    },
  });

  // ── 7. TOURISTS ───────────────────────────────────────────────────────────
  const touristMaria = await prisma.tourist.upsert({
    where: { email: 'm.kovalenko@email.com' },
    update: {},
    create: {
      firstName: 'Марія',
      lastName: 'Коваленко',
      email: 'm.kovalenko@email.com',
      phone: '+380671234567',
      nationality: 'Українець',
      sourceChannel: 'agent',
      isRepeat: false,
    },
  });

  const touristIvan = await prisma.tourist.upsert({
    where: { email: 'i.petrenko@email.com' },
    update: {},
    create: {
      firstName: 'Іван',
      lastName: 'Петренко',
      email: 'i.petrenko@email.com',
      phone: '+380504567890',
      nationality: 'Українець',
      sourceChannel: 'site',
      isRepeat: false,
    },
  });

  // tourist@eurotrips.ua / test1234 → self-service кабінет туриста (WF5, OPS-03)
  // touristId → touristIvan (Tourist.id) — контактна особа booking2 (ET-2025-04522,
  // створюється нижче в розділі BOOKINGS), щоб "Моє бронювання" мало реальні дані.
  await prisma.user.upsert({
    where: { email: 'tourist@eurotrips.ua' },
    update: { passwordHash: await hashPassword(SEED_PASSWORD), touristId: touristIvan.id },
    create: {
      email: 'tourist@eurotrips.ua',
      passwordHash: await hashPassword(SEED_PASSWORD),
      role: UserRole.tourist,
      firstName: touristIvan.firstName,
      lastName: touristIvan.lastName,
      phone: touristIvan.phone,
      isActive: true,
      touristId: touristIvan.id,
    },
  });

  // ── 8. BOOKINGS ──────────────────────────────────────────────────────────
  // booking1: belongs to agent@agency.ua (agentStandard)
  const booking1 = await prisma.booking.upsert({
    where: { bookingNumber: 'ET-2025-04521' },
    update: {},
    create: {
      bookingNumber: 'ET-2025-04521',
      tourId: tourAdriatic.id,
      bookingType: 'agent',
      contactTouristId: touristMaria.id,
      managerId: managerOlena.id,
      agentId: agentStandard.id,       // ← agent@agency.ua
      personsCount: 2,
      totalAmount: 1680,
      depositAmount: 336,
      depositPaid: 336,
      depositDeadline: new Date('2026-06-15'),
      balanceAmount: 1344,
      balancePaid: 504,
      balanceDeadline: new Date('2026-06-25'),
      paymentStatus: 'partially_paid',
      status: 'confirmed',
      agentCommissionRate: 0.14,
      agentCommissionAmount: 235.20,
      commissionStatus: 'pending',
      sourceChannel: 'agent',
      comment: 'Клієнт просить місця біля вікна в автобусі',
    },
  });

  // booking2: belongs to agent2@agency.ua (agentNetwork) — для IDOR тесту TC-RBAC-011
  // status='confirmed' + депозит сплачено — щоб self-service преференсів (C4/OPS-03)
  // touristIvan мав що показати (seat-map доступний, форма преференсів не заблокована
  // статусом; блокується тільки відсутньою структурою номерів — реалістичний стан "ще готується")
  const booking2 = await prisma.booking.upsert({
    where: { bookingNumber: 'ET-2025-04522' },
    update: { status: 'confirmed', paymentStatus: 'deposit_paid', depositPaid: 178 },
    create: {
      bookingNumber: 'ET-2025-04522',
      tourId: tourAdriaticAug.id,
      bookingType: 'agent',
      contactTouristId: touristIvan.id,
      managerId: managerOlena.id,
      agentId: agentNetwork.id,        // ← agent2@agency.ua (ІНШИЙ агент)
      personsCount: 1,
      totalAmount: 890,
      depositAmount: 178,
      depositPaid: 178,
      depositDeadline: new Date('2026-08-08'),
      balanceAmount: 712,
      balancePaid: 0,
      balanceDeadline: new Date('2026-08-18'),
      paymentStatus: 'deposit_paid',
      status: 'confirmed',
      sourceChannel: 'agent',
    },
  });

  // Учасник booking2 — сам touristIvan (контактна особа = єдиний учасник,
  // personsCount:1). Без цього запису self-service преференсів (BR-12) не
  // знайшов би bookingTourist рядок і завжди повертав би 404.
  await prisma.bookingTourist.upsert({
    where: { bookingId_touristId: { bookingId: booking2.id, touristId: touristIvan.id } },
    update: {},
    create: {
      bookingId: booking2.id,
      touristId: touristIvan.id,
      role: 'contact',
    },
  });

  // booking3: direct booking, status='new' — для QA тестів базового флоу
  await prisma.booking.upsert({
    where: { bookingNumber: 'ET-2025-04523' },
    update: {},
    create: {
      bookingNumber:   'ET-2025-04523',
      tourId:          tourAdriatic.id,
      bookingType:     'direct',
      contactTouristId: touristMaria.id,
      managerId:       managerOlena.id,
      personsCount:    1,
      totalAmount:     840,
      depositAmount:   168,
      depositPaid:     0,
      balanceAmount:   672,
      balancePaid:     0,
      paymentStatus:   'unpaid',
      status:          'new',
      sourceChannel:   'site',
    },
  });

  // ── 9. AGENT COMMISSIONS ─────────────────────────────────────────────────
  await prisma.agentCommission.upsert({
    where: {
      bookingId_agentId: {
        bookingId: booking1.id,
        agentId: agentStandard.id,
      }
    },
    update: {},
    create: {
      bookingId: booking1.id,
      agentId: agentStandard.id,
      grossAmount: 235.20,
      agentAmount: 235.20, // standard — вся комісія агенту
      commissionRate: 0.14,
      status: 'pending',
    },
  });

  // ── 10. LEADS ─────────────────────────────────────────────────────────────
  await prisma.lead.create({
    data: {
      touristId: touristIvan.id,
      managerId: managerOlena.id,
      tourId: tourAdriatic.id,        // VD26070301 — Адріатика липень
      source: LeadSource.instagram,
      status: 'in_work',
      interestNote: 'Цікавить Адріатичне море влітку. Є діти 5 та 8 років',
      personsCount: 3,
      budget: 3000,
      nextActionAt: new Date('2026-06-15T10:00:00Z'),
    },
  }).catch(() => {});

  // ── 11. DEMO ДАНІ: розселення / посадка в автобус / конверсія лідів ────────
  // Раніше на майбутньому турі (tourAdriaticAug) був лише 1 турист без
  // місця/кімнати — неможливо було наочно показати RoomingBoard, BusSeatMap
  // чи Kanban-конверсію лідів. Додаємо: 20 туристів у 3 бронюваннях на
  // tourAdriaticAug (частина вже розселена/розсаджена, частина — ні, щоб
  // було видно обидва стани), 8 окремих "вільних" туристів для тестування
  // оформлення нового бронювання, і 7 нових лідів у нетермінальних статусах,
  // готових для конвертації через Kanban-дошку /leads.

  const DEMO_NAMES: [string, string][] = [
    ['Олексій', 'Бондаренко'], ['Наталія', 'Ткаченко'], ['Дмитро', 'Мельник'],
    ['Оксана', 'Шевчук'], ['Сергій', 'Романюк'], ['Тетяна', 'Кравченко'],
    ['Андрій', 'Поліщук'], ['Юлія', 'Гончаренко'], ['Віталій', 'Савчук'],
    ['Ірина', 'Литвиненко'], ['Максим', 'Ковальчук'], ['Світлана', 'Марченко'],
    ['Павло', 'Волошин'], ['Христина', 'Дяченко'], ['Роман', 'Гриценко'],
    ['Аліна', 'Захарчук'], ['Богдан', 'Іщенко'], ['Вікторія', 'Кузьменко'],
    ['Ярослав', 'Мороз'], ['Марина', 'Соколова'],
    // Останні 8 свідомо НЕ прив'язані до жодного бронювання — 7 стають
    // лідами (конверсія), 1 лишається повністю вільним туристом
    // (тестування "оформлення бронювання" з нуля).
    ['Олег', 'Крамаренко'], ['Людмила', 'Осадча'], ['Іван', 'Бабенко'],
    ['Катерина', 'Руденко'], ['Артем', 'Ковтун'], ['Софія', 'Гуменюк'],
    ['Микола', 'Панченко'], ['Анастасія', 'Клименко'],
  ];

  const demoTourists = [];
  for (let i = 0; i < DEMO_NAMES.length; i++) {
    const [firstName, lastName] = DEMO_NAMES[i];
    const idx = String(i + 1).padStart(2, '0');
    const t = await prisma.tourist.upsert({
      where: { email: `demo.tourist${idx}@email.com` },
      update: {},
      create: {
        firstName,
        lastName,
        email: `demo.tourist${idx}@email.com`,
        phone: `+38050${String(1000000 + i * 111).padStart(7, '0')}`,
        nationality: 'Українець',
        sourceChannel: (['agent', 'site', 'instagram'] as const)[i % 3],
        isRepeat: i % 5 === 0,
        passportNumber: `FN${100000 + i}`,
        dateOfBirth: new Date(1970 + (i % 40), i % 12, (i % 27) + 1),
      },
    });
    demoTourists.push(t);
  }

  const roomingTourists = demoTourists.slice(0, 20); // на розселення/посадку
  const leadTourists     = demoTourists.slice(20, 27); // 7 → нові ліди
  // demoTourists[27] ("Анастасія Клименко") свідомо нічим не зайнята —
  // вільний турист для тесту оформлення нового бронювання з нуля

  // ── Готель для HotelBooking (беремо перший активний з імпортованих 563) ──
  const demoHotel = await prisma.hotel.findFirst({ where: { status: 'active' } });
  if (demoHotel) {
    await prisma.hotelBooking.upsert({
      where: { id: '00000000-0000-0000-0003-000000000001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0003-000000000001',
        tourId: tourAdriaticAug.id,
        hotelId: demoHotel.id,
        city: tourAdriaticAug.direction ?? 'Хорватія / Словенія',
        checkInDate: tourAdriaticAug.departureDate,
        nightsCount: tourAdriaticAug.durationDays,
        plannedTwin: 10,
        plannedTriple: 2,
        plannedSingle: 4,
        structureStatus: 'approved',
        structureApprovedAt: new Date(),
      },
    });
  }

  // ── 3 бронювання (8+6+6=20 осіб) на tourAdriaticAug — для розселення/посадки ──
  const ROOM_TYPES = ['twin', 'twin', 'triple', 'single'] as const;
  const roomingBookingsSpec = [
    { number: 'ET-2025-09001', persons: 8, status: 'confirmed',      payment: 'deposit_paid' },
    { number: 'ET-2025-09002', persons: 6, status: 'confirmed',      payment: 'deposit_paid' },
    { number: 'ET-2025-09003', persons: 6, status: 'docs_collected', payment: 'partially_paid' },
  ] as const;

  let touristCursor = 0;
  let seatCursor = 1;

  for (const spec of roomingBookingsSpec) {
    const contact = roomingTourists[touristCursor];
    const booking = await prisma.booking.upsert({
      where: { bookingNumber: spec.number },
      update: {},
      create: {
        bookingNumber: spec.number,
        tourId: tourAdriaticAug.id,
        bookingType: 'direct',
        contactTouristId: contact.id,
        managerId: managerOlena.id,
        personsCount: spec.persons,
        totalAmount: 890 * spec.persons,
        depositAmount: 178 * spec.persons,
        depositPaid: 178 * spec.persons,
        balanceAmount: 712 * spec.persons,
        balancePaid: spec.status === 'docs_collected' ? 712 * spec.persons : 0,
        paymentStatus: spec.payment,
        status: spec.status,
        sourceChannel: 'site',
      },
    });

    for (let j = 0; j < spec.persons; j++) {
      const tourist = roomingTourists[touristCursor];
      const seq = touristCursor + 1;
      touristCursor++;
      // ~2/3 вже розселені (actualRoomNumber), решта — для демо "без кімнати"
      const isRoomed = seq % 3 !== 0;
      // ~3/4 вже мають місце в автобусі, решта — вільні місця в BusSeatMap
      const isSeated = seq % 4 !== 0;

      await prisma.bookingTourist.upsert({
        where: { bookingId_touristId: { bookingId: booking.id, touristId: tourist.id } },
        update: {},
        create: {
          bookingId: booking.id,
          touristId: tourist.id,
          role: tourist.id === contact.id ? 'contact' : 'participant',
          preferredRoomType: ROOM_TYPES[seq % ROOM_TYPES.length],
          ...(isRoomed && {
            actualRoomNumber: String(100 + Math.floor(seq / 2)),
            actualRoomType: ROOM_TYPES[seq % ROOM_TYPES.length],
          }),
          ...(isSeated && { busSeaNumber: seatCursor++ }),
        },
      });
    }
  }

  // availableSeats туру — абсолютне значення (безпечно при повторному seed):
  // 52 місця - 1 (booking2/touristIvan) - 20 (demo) = 31
  await prisma.tour.update({
    where: { id: tourAdriaticAug.id },
    data: { availableSeats: 31 },
  });

  // ── 7 нових лідів у нетермінальних статусах — готові для конвертації ──────
  const demoLeadsSpec = [
    { tourist: leadTourists[0], status: 'new',                 source: LeadSource.instagram, tourId: tourAdriaticAug.id, budget: 1800, persons: 2 },
    { tourist: leadTourists[1], status: 'in_work',              source: LeadSource.site,      tourId: tourAdriaticAug.id, budget: 900,  persons: 1 },
    { tourist: leadTourists[2], status: 'needs_clarification',  source: LeadSource.telegram,  tourId: tourSwitzerland.id, budget: 1600, persons: 2 },
    { tourist: leadTourists[3], status: 'proposal_sent',        source: LeadSource.facebook,  tourId: tourSwitzerland.id, budget: 2400, persons: 3 },
    { tourist: leadTourists[4], status: 'waiting_decision',     source: LeadSource.viber,     tourId: tourAdriaticAug.id, budget: 890,  persons: 1 },
    { tourist: leadTourists[5], status: 'new',                  source: LeadSource.phone,     tourId: tourAdriaticAug.id, budget: 1780, persons: 2 },
    { tourist: leadTourists[6], status: 'lost',                 source: LeadSource.email,     tourId: tourSwitzerland.id, budget: 790,  persons: 1, lossReason: 'Обрали пропозицію іншого туроператора' },
  ] as const;

  for (const spec of demoLeadsSpec) {
    await prisma.lead.upsert({
      where: { externalId: `demo-lead-${spec.tourist.id}` },
      update: {},
      create: {
        externalId: `demo-lead-${spec.tourist.id}`,
        touristId: spec.tourist.id,
        managerId: managerOlena.id,
        tourId: spec.tourId,
        source: spec.source,
        status: spec.status,
        interestNote: `${spec.tourist.firstName} ${spec.tourist.lastName} цікавиться туром`,
        personsCount: spec.persons,
        budget: spec.budget,
        nextActionAt: spec.status === 'lost' ? undefined : new Date('2026-07-20T10:00:00Z'),
        ...('lossReason' in spec && { lossReason: spec.lossReason }),
      },
    });
  }

  // ── 12. ПЕРЕВІЗНИКИ ТА АВТОБУСИ (для роботи логіста) ────────────────────────
  const carriersSpec = [
    {
      id: '00000000-0000-0000-0004-000000000001',
      name: 'ТОВ "Карпати-Тур"',
      contactName: 'Роман Гринюк',
      phone: '+380671001001',
      email: 'dispatch@karpaty-tour.ua',
      buses: [
        { id: '00000000-0000-0000-0005-000000000001', brand: 'Setra S515HD', plateNumber: 'АА1234ВК', seatsCount: 52 },
        { id: '00000000-0000-0000-0005-000000000002', brand: 'Neoplan Tourliner', plateNumber: 'АА5678ВК', seatsCount: 49 },
      ],
    },
    {
      id: '00000000-0000-0000-0004-000000000002',
      name: 'ПП "Буковина-Експрес"',
      contactName: 'Марія Ковальчук',
      phone: '+380671002002',
      email: 'info@bukovyna-express.ua',
      buses: [
        { id: '00000000-0000-0000-0005-000000000003', brand: 'Mercedes-Benz Travego', plateNumber: 'ВО2233АЕ', seatsCount: 50 },
        { id: '00000000-0000-0000-0005-000000000004', brand: 'Setra S416GT-HD', plateNumber: 'ВО4455АЕ', seatsCount: 55 },
      ],
    },
    {
      id: '00000000-0000-0000-0004-000000000003',
      name: 'ТОВ "Галичина Тревел"',
      contactName: 'Andriy Petrenko',
      phone: '+380671003003',
      email: 'ops@halychyna-travel.ua',
      buses: [
        { id: '00000000-0000-0000-0005-000000000005', brand: 'Scania Touring', plateNumber: 'ВС7788НМ', seatsCount: 48 },
        { id: '00000000-0000-0000-0005-000000000006', brand: 'Setra S511HD', plateNumber: 'ВС9900НМ', seatsCount: 45 },
      ],
    },
  ];

  for (const spec of carriersSpec) {
    const carrier = await prisma.carrier.upsert({
      where: { id: spec.id },
      update: {},
      create: {
        id: spec.id,
        name: spec.name,
        contactName: spec.contactName,
        phone: spec.phone,
        email: spec.email,
      },
    });

    for (const bus of spec.buses) {
      await prisma.bus.upsert({
        where: { id: bus.id },
        update: {},
        create: {
          id: bus.id,
          carrierId: carrier.id,
          brand: bus.brand,
          plateNumber: bus.plateNumber,
          seatsCount: bus.seatsCount,
        },
      });
    }
  }

  console.log('✅ Seed завершено успішно!');
  console.log('');
  console.log('👤 Тестові акаунти (пароль test1234, якщо не вказано інше):');
  console.log('   Admin:           admin@eurotrips.ua / admin123!');
  console.log('   Manager:         a.sych@eurotrips.ua / manager123!');
  console.log('   Agent:           i.koval@ta-mriia.ua / agent123!');
  console.log('   Product manager: product_manager@eurotrips.ua');
  console.log('   Logist:          logist@eurotrips.ua');
  console.log('');
  console.log('🚌 Перевізники: 3 (Карпати-Тур, Буковина-Експрес, Галичина Тревел) × 2 автобуси');
  console.log('');
  console.log('🗺️  Тури (5 реальних турів з CSV):');
  console.log('   VD26070301 — Адріатика + Доломіти (active, 03.07.2026)  ← МАЙБУТНІЙ');
  console.log('   VD26082801 — Адріатика + Доломіти (open, 28.08.2026)    ← МАЙБУТНІЙ');
  console.log('   LP26010301 — Лапландія (completed, 03.01.2026)');
  console.log('   PN26052301 — Париж + Нормандія (completed, 23.05.2026)');
  console.log('   SW26052401 — Швейцарія (almost_full, 24.05.2026)');
  console.log('');
  console.log('📋 Бронювання: ET-2025-04521 (confirmed), ET-2025-04522 (awaiting_payment)');
}

main()
  .catch((e) => {
    console.error('❌ Seed помилка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
