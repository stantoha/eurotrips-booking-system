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

  // ── 3. TOURS (на основі реальних CSV-даних) ─────────────────────────────────
  const tourParis = await prisma.tour.upsert({
    where: { code: 'PN25102505' },
    update: {},
    create: {
      code: 'PN25102505',
      name: 'Париж + Нормандія',
      product: 'Париж + Нормандія',
      direction: 'Франція',
      countries: ['Франція'],
      tourType: TourType.bus,
      format: 'автобусний',
      departureDate: new Date('2025-10-25'),
      returnDate: new Date('2025-11-02'),
      durationDays: 8,
      departureCity: 'Київ',
      arrivalCity: 'Київ',
      basePrice: 840,
      currency: 'EUR',
      depositAmount: 168,
      depositDeadline: new Date('2025-10-01'),
      cancelPolicyId: standardPolicy.id,
      agentCommissionPct: 0.14,  // 14% з AGcomission.csv
      totalSeats: 48,
      availableSeats: 12,
      status: TourStatus.active,
      guideId: guideOlena.id,
      costPrice: 620,            // НІКОЛИ не показувати агентам (BR-04)
      included: 'Транспорт, готель 3*, сніданки, гід',
      notIncluded: 'Авіаквитки, особисті витрати, страхування',
      tags: ['premium', 'culture', 'europe'],
      isPremium: true,
    },
  });

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
      durationDays: 7,
      departureCity: 'Київ',
      arrivalCity: 'Київ',
      basePrice: 1290,
      currency: 'EUR',
      depositAmount: 258,
      cancelPolicyId: premiumPolicy.id,
      agentCommissionPct: 0.14,
      totalSeats: 36,
      availableSeats: 3,
      status: TourStatus.almost_full,
      guideId: guideDmytro.id,
      costPrice: 980,
      tags: ['family', 'winter', 'premium', 'kids'],
      isFamily: true,
      isPremium: true,
    },
  });

  const tourVenice = await prisma.tour.upsert({
    where: { code: 'VV25112101' },
    update: {},
    create: {
      code: 'VV25112101',
      name: 'Вікенд у Венеції',
      product: 'Вікенд у Венеції',
      direction: 'Італія',
      countries: ['Італія'],
      tourType: TourType.bus,
      format: 'автобусний',
      departureDate: new Date('2025-11-21'),
      returnDate: new Date('2025-11-24'),
      durationDays: 3,
      departureCity: 'Львів',
      arrivalCity: 'Львів',
      basePrice: 280,
      currency: 'EUR',
      depositAmount: 84,
      cancelPolicyId: standardPolicy.id,
      agentCommissionPct: 0.13,
      totalSeats: 52,
      availableSeats: 28,
      status: TourStatus.open,
      costPrice: 210,
      tags: ['weekend', 'romantic', 'budget'],
    },
  });

  // ── 4. USERS ─────────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('admin123!', 12);
  const managerPassword = await bcrypt.hash('manager123!', 12);
  const agentPassword = await bcrypt.hash('agent123!', 12);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@eurotrips.ua' },
    update: {},
    create: {
      email: 'admin@eurotrips.ua',
      passwordHash: adminPassword,
      role: UserRole.admin,
      firstName: 'Адмін',
      lastName: 'Системи',
      phone: '+380441234567',
      isActive: true,
    },
  });

  const managerAndrii = await prisma.user.upsert({
    where: { email: 'a.sych@eurotrips.ua' },
    update: {},
    create: {
      email: 'a.sych@eurotrips.ua',
      passwordHash: managerPassword,
      role: UserRole.manager,
      firstName: 'Андрій',
      lastName: 'Сич',
      phone: '+380671111111',
      isActive: true,
    },
  });

  const managerOlena = await prisma.user.upsert({
    where: { email: 'o.romaniuk@eurotrips.ua' },
    update: {},
    create: {
      email: 'o.romaniuk@eurotrips.ua',
      passwordHash: managerPassword,
      role: UserRole.manager,
      firstName: 'Олена',
      lastName: 'Романюк',
      phone: '+380672222222',
      isActive: true,
    },
  });

  const agentUserStandard = await prisma.user.upsert({
    where: { email: 'i.koval@ta-mriia.ua' },
    update: {},
    create: {
      email: 'i.koval@ta-mriia.ua',
      passwordHash: agentPassword,
      role: UserRole.agent,
      firstName: 'Ірина',
      lastName: 'Коваль',
      phone: '+380501234567',
      isActive: true,
    },
  });

  const agentUserNetwork = await prisma.user.upsert({
    where: { email: 'b.lysenko@ta-halychyna.ua' },
    update: {},
    create: {
      email: 'b.lysenko@ta-halychyna.ua',
      passwordHash: agentPassword,
      role: UserRole.agent,
      firstName: 'Богдан',
      lastName: 'Лисенко',
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

  // ── 8. BOOKINGS ──────────────────────────────────────────────────────────
  const booking1 = await prisma.booking.upsert({
    where: { bookingNumber: 'ET-2025-04521' },
    update: {},
    create: {
      bookingNumber: 'ET-2025-04521',
      tourId: tourParis.id,
      bookingType: 'agent',
      contactTouristId: touristMaria.id,
      managerId: managerAndrii.id,
      agentId: agentStandard.id,
      personsCount: 2,
      totalAmount: 1680,
      depositAmount: 336,
      depositPaid: 336,
      depositDeadline: new Date('2025-10-01'),
      balanceAmount: 1344,
      balancePaid: 504,
      balanceDeadline: new Date('2025-10-10'),
      paymentStatus: 'partially_paid',
      status: 'confirmed',
      agentCommissionRate: 0.14,
      agentCommissionAmount: 235.20,
      commissionStatus: 'pending',
      sourceChannel: 'agent',
      comment: 'Клієнт просить місця біля вікна в автобусі',
    },
  });

  const booking2 = await prisma.booking.upsert({
    where: { bookingNumber: 'ET-2025-04522' },
    update: {},
    create: {
      bookingNumber: 'ET-2025-04522',
      tourId: tourLapland.id,
      bookingType: 'direct',
      contactTouristId: touristIvan.id,
      managerId: managerOlena.id,
      personsCount: 1,
      totalAmount: 1290,
      depositAmount: 258,
      depositPaid: 0,
      depositDeadline: new Date('2025-11-15'),
      balanceAmount: 1032,
      balancePaid: 0,
      balanceDeadline: new Date('2025-12-15'),
      paymentStatus: 'unpaid',
      status: 'awaiting_payment',
      sourceChannel: 'site',
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
      tourId: tourLapland.id,
      source: LeadSource.instagram,
      status: 'in_work',
      interestNote: 'Цікавить Лапландія на Новий рік. Є діти 5 та 8 років',
      personsCount: 3,
      budget: 4000,
      nextActionAt: new Date('2025-10-20T10:00:00Z'),
    },
  }).catch(() => {}); // ігноруємо duplicate на повторних запусках

  console.log('✅ Seed завершено успішно!');
  console.log('');
  console.log('👤 Тестові акаунти:');
  console.log('   Admin:   admin@eurotrips.ua / admin123!');
  console.log('   Manager: a.sych@eurotrips.ua / manager123!');
  console.log('   Agent:   i.koval@ta-mriia.ua / agent123!');
  console.log('');
  console.log('🗺️  Тестові тури: PN25102505, LP26010301, VV25112101');
  console.log('📋  Тестові бронювання: ET-2025-04521, ET-2025-04522');
}

main()
  .catch((e) => {
    console.error('❌ Seed помилка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
