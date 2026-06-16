// =============================================================
// EUROTRIPS — Zoho CRM Migration v2.0
// 7 модулів: Products → Agencies → Contacts → Leads →
//            Deals → Travel → Payments
//
// Запуск:
//   npx ts-node -r tsconfig-paths/register \
//     src/modules/integrations/zoho/zoho-migration.ts
//
//   npm run migrate:zoho           # через package.json script
//   npm run migrate:zoho -- --dry  # dry-run: тільки лічильники
//
// Idempotent: безпечно для повторного запуску (upsert по externalId).
// Rate limit: 10 req/s → sleep 120ms між сторінками.
// =============================================================

import 'dotenv/config';
import axios, { AxiosError } from 'axios';
import pino                  from 'pino';
import { PrismaClient }      from '@prisma/client';
import {
  ZOHO_DEAL_STAGE_MAP,
  ZOHO_LEAD_STATUS_MAP,
  ZOHO_LEAD_SOURCE_MAP,
  ZOHO_AGENCY_STAGE_MAP,
  type ZohoLead,
  type ZohoContact,
  type ZohoDeal,
  type ZohoTravel,
  type ZohoProduct,
  type ZohoAgency,
  type ZohoPayment,
  type ZohoTokenResponse,
  type ZohoListResponse,
  type MigrationBatchStats,
  type MigrationResult,
} from './zoho.types';

// ─── Dry-run flag ─────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry');

// ─── Logger ──────────────────────────────────────────────────────────────────

const logger = pino({
  transport: { target: 'pino-pretty', options: { colorize: true } },
  level: process.env.LOG_LEVEL ?? 'info',
});

// ─── Prisma ──────────────────────────────────────────────────────────────────

const prisma = new PrismaClient({ log: ['warn', 'error'] });

// ─── ENV ─────────────────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Не встановлена обов'язкова змінна: ${key}`);
  return v;
}

const ZOHO_CLIENT_ID     = requireEnv('ZOHO_CLIENT_ID');
const ZOHO_CLIENT_SECRET = requireEnv('ZOHO_CLIENT_SECRET');
const ZOHO_REFRESH_TOKEN = requireEnv('ZOHO_REFRESH_TOKEN');
const ZOHO_BASE_URL      = process.env.ZOHO_BASE_URL ?? 'https://www.zohoapis.com/crm/v8';
const ZOHO_AUTH_URL      = process.env.ZOHO_AUTH_URL ?? 'https://accounts.zoho.com';

// Назва кастомного модуля Платежі в Zoho API (уточнити у замовника!)
const PAYMENT_MODULE     = process.env.ZOHO_PAYMENT_MODULE ?? 'CustomModule3';
// Назва кастомного модуля Travel в Zoho API
const TRAVEL_MODULE      = process.env.ZOHO_TRAVEL_MODULE  ?? 'Travel';

// ─── Token Manager ────────────────────────────────────────────────────────────

class ZohoTokenManager {
  private token:     string | null = null;
  private expiresAt: number        = 0;

  async getToken(): Promise<string> {
    if (this.token && Date.now() < this.expiresAt) return this.token;
    return this.refresh();
  }

  private async refresh(): Promise<string> {
    logger.debug('Zoho OAuth2: оновлення токена...');
    const res = await axios.post<ZohoTokenResponse>(
      `${ZOHO_AUTH_URL}/oauth/v2/token`, null,
      { params: { refresh_token: ZOHO_REFRESH_TOKEN, client_id: ZOHO_CLIENT_ID,
                  client_secret: ZOHO_CLIENT_SECRET, grant_type: 'refresh_token' } },
    );
    if (!res.data.access_token) throw new Error('Zoho OAuth2: access_token відсутній');
    this.token     = res.data.access_token;
    this.expiresAt = Date.now() + (res.data.expires_in - 60) * 1_000;
    logger.debug('Zoho OAuth2: токен оновлено');
    return this.token;
  }
}

const tokenManager = new ZohoTokenManager();

// ─── Zoho API client ──────────────────────────────────────────────────────────

async function zohoGet<T>(
  endpoint: string,
  params: Record<string, string | number> = {},
  retried = false,
): Promise<T> {
  const token = await tokenManager.getToken();
  try {
    const res = await axios.get<T>(`${ZOHO_BASE_URL}${endpoint}`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
      params,
    });
    return res.data;
  } catch (err) {
    const e = err as AxiosError;
    if (e.response?.status === 401 && !retried) {
      logger.warn('Zoho API 401 — примусово оновлюємо токен');
      (tokenManager as any).expiresAt = 0;
      return zohoGet<T>(endpoint, params, true);
    }
    throw err;
  }
}

// ─── Generic paginated fetcher (AsyncGenerator) ───────────────────────────────

const PAGE_SIZE     = 200;     // max per Zoho CRM API page
const RATE_LIMIT_MS = 120;     // 120ms ≈ 8 req/s  (limit: 10 req/s)

async function* fetchPages<T>(
  module: string,
  fields: string[],
): AsyncGenerator<T[]> {
  let page    = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await zohoGet<ZohoListResponse<T>>(
      `/${module}`,
      { page, per_page: PAGE_SIZE, fields: fields.join(',') },
    );

    if (!response.data?.length) break;

    logger.debug(`${module}: сторінка ${page}, ${response.data.length} записів`);
    yield response.data;

    hasMore = response.info.more_records;
    page++;
    await sleep(RATE_LIMIT_MS);
  }
}

// ─── Mapping helpers ──────────────────────────────────────────────────────────

function mapDealStage(stage: string | null): string {
  if (!stage) return 'new';
  return ZOHO_DEAL_STAGE_MAP[stage] ?? 'in_work';
}

function mapLeadStatus(s: string | null): string {
  return s ? (ZOHO_LEAD_STATUS_MAP[s] ?? 'new') : 'new';
}

function mapLeadSource(s: string | null): string {
  return s ? (ZOHO_LEAD_SOURCE_MAP[s] ?? 'other') : 'other';
}

function mapAgencyStage(s: string | null): string {
  return s ? (ZOHO_AGENCY_STAGE_MAP[s] ?? 'active') : 'active';
}

/**
 * Маппінг Payment_System Zoho → payment.method нашої системи.
 * field2 — ймовірно сума (уточнити у замовника).
 */
const PAYMENT_METHOD_MAP: Record<string, string> = {
  'LiqPay':             'liqpay',
  'WayForPay':          'wayforpay',
  'Fondy':              'fondy',
  'Готівка':            'cash',
  'Cash':               'cash',
  'Privat24':           'privat24',
  'Bank Transfer':      'transfer',
  'Банківський переказ':'transfer',
  'MonoPay':            'monopay',
};

function mapPaymentMethod(system: string | null): string {
  if (!system) return 'other';
  return PAYMENT_METHOD_MAP[system] ?? system.toLowerCase().replace(/\s+/g, '_');
}

/** Очищає телефон: залишає цифри та "+", відкидає рядки < 10 цифр. */
function sanitizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned    = phone.replace(/[^\d+\s()\-]/g, '').trim();
  const digitsOnly = cleaned.replace(/\D/g, '');
  return digitsOnly.length >= 10 ? cleaned : null;
}

/** Безпечне toNumber() для Prisma Decimal або number. */
function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'object' && 'toNumber' in (v as any)
    ? (v as any).toNumber()
    : Number(v);
  return isNaN(n) ? null : n;
}

/** Збирає невідомі кастомні поля в один JSON-об'єкт для metadata. */
function pickCustomFields(
  obj: Record<string, unknown>,
  ...prefixes: string[]
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([k]) =>
      prefixes.some((p) => k.startsWith(p)) && obj[k] !== null,
    ),
  );
}

// ─── Lookup cache (уникаємо зайвих запитів до БД) ────────────────────────────

/** Кеш externalId туру → внутрішній UUID */
const tourIdCache = new Map<string, string>();
/** Кеш externalId туриста → внутрішній UUID */
const touristIdCache = new Map<string, string>();
/** Кеш externalId агента → внутрішній UUID */
const agentIdCache = new Map<string, string>();
/** Кеш externalId бронювання → внутрішній UUID */
const bookingIdCache = new Map<string, string>();

async function lookupTourId(zohoProductId: string): Promise<string | null> {
  const extId = `zoho_product_${zohoProductId}`;
  if (tourIdCache.has(extId)) return tourIdCache.get(extId)!;
  const tour = await prisma.tour.findFirst({ where: { externalId: extId }, select: { id: true } });
  if (tour) tourIdCache.set(extId, tour.id);
  return tour?.id ?? null;
}

async function lookupTouristId(zohoContactId: string): Promise<string | null> {
  const extId = `zoho_contact_${zohoContactId}`;
  if (touristIdCache.has(extId)) return touristIdCache.get(extId)!;
  const tourist = await prisma.tourist.findFirst({
    where: { externalId: extId }, select: { id: true },
  });
  if (tourist) touristIdCache.set(extId, tourist.id);
  return tourist?.id ?? null;
}

async function lookupAgentId(zohoAgencyId: string): Promise<string | null> {
  const extId = `zoho_agency_${zohoAgencyId}`;
  if (agentIdCache.has(extId)) return agentIdCache.get(extId)!;
  const agent = await prisma.agent.findFirst({
    where: { externalId: extId }, select: { id: true },
  });
  if (agent) agentIdCache.set(extId, agent.id);
  return agent?.id ?? null;
}

async function lookupBookingId(zohoDealId: string): Promise<string | null> {
  const extId = `zoho_deal_${zohoDealId}`;
  if (bookingIdCache.has(extId)) return bookingIdCache.get(extId)!;
  const booking = await prisma.booking.findFirst({
    where: { externalId: extId }, select: { id: true },
  });
  if (booking) bookingIdCache.set(extId, booking.id);
  return booking?.id ?? null;
}

// =============================================================================
// IMPORT FUNCTIONS (порядок: Products → Agencies → Contacts →
//                            Leads → Deals → Travel → Payments)
// =============================================================================

// ─── 1. importProducts ────────────────────────────────────────────────────────

/**
 * Products (Тури) → tours
 *
 * Йде ПЕРШИМ — на нього посилаються Deals (TOUR_AGC) та Travel (tourID).
 * externalId = 'zoho_product_{id}'
 * Upsert по externalId; fallback upsert по code (C_ID) якщо externalId не знайдено.
 */
async function importProducts(stats: MigrationBatchStats): Promise<void> {
  logger.info('─── [1/7] Products → tours ─────────────────────────');

  const FIELDS = [
    'id', 'C_ID', 'PRODUCT_NAME', 'PRODUCT_IMAGE', 'CATEGORY',
    'Unit_Price', 'Qty_in_Stock', 'Is_Active', 'Priority',
    'ID_PRODUCT_ZCRM', 'Tag', 'Owner', 'Created_Time', 'Modified_Time',
  ];

  for await (const batch of fetchPages<ZohoProduct>('Products', FIELDS)) {
    for (const product of batch) {
      stats.fetched++;
      try {
        const externalId = `zoho_product_${product.id}`;
        const status     = product.Is_Active === false ? 'draft' : 'open_for_sale';

        const data = {
          externalId,
          name:        product.PRODUCT_NAME,
          code:        product.C_ID ?? null,
          imageUrl:    product.PRODUCT_IMAGE ?? null,
          tourType:    product.CATEGORY ?? null,
          basePrice:   toNum(product.Unit_Price) ?? 0,
          totalSeats:  toNum(product.Qty_in_Stock) ?? 0,
          status,
          sortOrder:   toNum(product.Priority) ?? 0,
          metadata: {
            zoho_id:         product.id,
            zoho_product_id: product.ID_PRODUCT_ZCRM ?? null,
            zoho_owner:      product.Owner?.name ?? null,
            migrated_at:     new Date().toISOString(),
          },
          createdAt:   new Date(product.Created_Time),
          updatedAt:   new Date(product.Modified_Time),
        };

        if (!DRY_RUN) {
          const result = await prisma.tour.upsert({
            where:  { externalId },
            create: data,
            update: { name: data.name, status, imageUrl: data.imageUrl,
                      basePrice: data.basePrice, totalSeats: data.totalSeats,
                      updatedAt: data.updatedAt },
          });
          tourIdCache.set(externalId, result.id);
        }

        stats.created++;
      } catch (err: any) {
        stats.errors++;
        logger.error({ zohoId: product.id, err: err.message }, 'Помилка імпорту туру');
      }
    }
    logProgress('Products', stats);
  }
}

// ─── 2. importAgencies ────────────────────────────────────────────────────────

/**
 * Agencies → agents
 *
 * Йде ДО Contacts, бо Contacts.Account_Name → Agency.
 * externalId = 'zoho_agency_{id}'
 * Upsert по email (якщо є) або externalId.
 * 29+ кастомних полів (field29–field56) → metadata.zoho_fields.
 */
async function importAgencies(stats: MigrationBatchStats): Promise<void> {
  logger.info('─── [2/7] Agencies → agents ────────────────────────');

  const FIELDS = [
    'id', 'Name', 'Agent_Name', 'Email', 'Phone', 'Website',
    'Stage', 'Size', 'ENRPOU', 'Owner', 'Created_Time', 'Modified_Time',
    'field29', 'field30', 'field31', 'field32', 'field33', 'field34',
    'field35', 'field36', 'field37', 'field40', 'field41', 'field42',
    'field43', 'field44', 'field45', 'field46', 'field47', 'field48',
    'field49', 'field50', 'field51', 'field52', 'field53', 'field54',
    'field55', 'field56',
  ];

  for await (const batch of fetchPages<ZohoAgency>('Agencies', FIELDS)) {
    for (const agency of batch) {
      stats.fetched++;
      try {
        const externalId    = `zoho_agency_${agency.id}`;
        const customFields  = pickCustomFields(agency as any, 'field');

        const data = {
          externalId,
          agencyName:   agency.Name,
          contactName:  agency.Agent_Name   ?? null,
          email:        agency.Email        ?? null,
          phone:        sanitizePhone(agency.Phone),
          website:      agency.Website      ?? null,
          status:       mapAgencyStage(agency.Stage ?? null),
          agencySize:   agency.Size         ?? null,
          taxCode:      agency.ENRPOU       ?? null,
          agentType:    'standard' as const,
          metadata: {
            zoho_id:     agency.id,
            zoho_owner:  agency.Owner?.name ?? null,
            zoho_fields: Object.keys(customFields).length ? customFields : undefined,
            migrated_at: new Date().toISOString(),
          },
          createdAt: new Date(agency.Created_Time ?? Date.now()),
          updatedAt: new Date(agency.Modified_Time ?? Date.now()),
        };

        if (!DRY_RUN) {
          // Спочатку намагаємось знайти по externalId
          const existing = await prisma.agent.findFirst({ where: { externalId } });
          let result;
          if (existing) {
            result = await prisma.agent.update({ where: { id: existing.id },
              data: { status: data.status, phone: data.phone ?? undefined,
                      website: data.website ?? undefined, taxCode: data.taxCode ?? undefined,
                      updatedAt: data.updatedAt } });
            stats.updated++;
          } else {
            result = await prisma.agent.create({ data });
            stats.created++;
          }
          agentIdCache.set(externalId, result.id);
        } else {
          stats.created++;
        }
      } catch (err: any) {
        stats.errors++;
        logger.error({ zohoId: agency.id, err: err.message }, 'Помилка імпорту агентства');
      }
    }
    logProgress('Agencies', stats);
  }
}

// ─── 3. importContacts ───────────────────────────────────────────────────────

/**
 * Contacts → tourists
 *
 * Нові поля v2: externalId, dateOfBirth, allergies,
 *   dietaryRestrictions, isSubscribed, agentId (через Account_Name).
 * Upsert по email; externalId для зв'язків з Deals.
 */
async function importContacts(stats: MigrationBatchStats): Promise<void> {
  logger.info('─── [3/7] Contacts → tourists ──────────────────────');

  const FIELDS = [
    'id', 'First_Name', 'Last_Name', 'Email', 'Phone', 'Mobile',
    'Description', 'Date_of_Birth', 'Allergic_reaction', 'Dietary_restriction',
    'Subscribed', 'LinkedIn', 'Account_Name', 'C_ID',
    'Owner', 'Created_Time', 'Modified_Time',
  ];

  for await (const batch of fetchPages<ZohoContact>('Contacts', FIELDS)) {
    for (const contact of batch) {
      stats.fetched++;
      try {
        if (!contact.Email) { stats.skipped++; continue; }

        const externalId = `zoho_contact_${contact.id}`;
        const phone      = sanitizePhone(contact.Phone ?? contact.Mobile);
        const agentId    = contact.Account_Name?.id
          ? await lookupAgentId(contact.Account_Name.id)
          : null;

        const notes = [
          contact.Description,
          contact.Account_Name?.name ? `Агентство: ${contact.Account_Name.name}` : null,
        ].filter(Boolean).join('\n') || null;

        const createData = {
          externalId,
          firstName:           contact.First_Name            ?? 'Невідомо',
          lastName:            contact.Last_Name             ?? '',
          email:               contact.Email,
          phone,
          dateOfBirth:         contact.Date_of_Birth
                                 ? new Date(contact.Date_of_Birth) : null,
          allergies:           contact.Allergic_reaction      ?? null,
          dietaryRestrictions: contact.Dietary_restriction    ?? null,
          isSubscribed:        contact.Subscribed             ?? null,
          linkedinUrl:         contact.LinkedIn               ?? null,
          notes,
          agentId,
          sourceChannel:       'zoho_import',
          isRepeat:            false,
          metadata: {
            zoho_id:    contact.id,
            zoho_c_id:  contact.C_ID   ?? null,
            zoho_owner: contact.Owner?.name ?? null,
            zoho_agency: contact.Account_Name?.name ?? null,
            migrated_at: new Date().toISOString(),
          },
          createdAt: new Date(contact.Created_Time),
          updatedAt: new Date(contact.Modified_Time),
        };

        if (!DRY_RUN) {
          const result = await prisma.tourist.upsert({
            where:  { email: contact.Email },
            create: createData,
            update: {
              externalId,                                   // додаємо якщо вже існував без нього
              dateOfBirth:         createData.dateOfBirth,
              allergies:           createData.allergies,
              dietaryRestrictions: createData.dietaryRestrictions,
              isSubscribed:        createData.isSubscribed,
              notes:               notes ?? undefined,
              agentId:             agentId ?? undefined,
              updatedAt:           createData.updatedAt,
            },
          });
          touristIdCache.set(externalId, result.id);
        }
        stats.created++;
      } catch (err: any) {
        if (err.code === 'P2002') { stats.skipped++; continue; }
        stats.errors++;
        logger.error({ zohoId: contact.id, email: contact.Email, err: err.message }, 'Помилка імпорту контакту');
      }
    }
    logProgress('Contacts', stats);
  }
}

// ─── 4. importLeads ──────────────────────────────────────────────────────────

/**
 * Leads → leads
 *
 * Converted=true пропускаємо (вони стали Deals).
 * externalId = 'zoho_lead_{id}'
 */
async function importLeads(stats: MigrationBatchStats): Promise<void> {
  logger.info('─── [4/7] Leads → leads ────────────────────────────');

  const FIELDS = [
    'id', 'Phone', 'Email', 'Lead_Source', 'Lead_Status', 'Description',
    'KEYWORD', 'ADGROUPID', 'ZCAMPAIGNID', 'Click_Type',
    'Lead_Conversion_Time', 'Converted', 'Lead_ID',
    'Owner', 'Created_Time', 'Modified_Time', 'field3', 'field4',
  ];

  for await (const batch of fetchPages<ZohoLead>('Leads', FIELDS)) {
    for (const lead of batch) {
      stats.fetched++;
      try {
        if (lead.Converted) { stats.skipped++; continue; }

        const externalId = `zoho_lead_${lead.id}`;

        const data = {
          externalId,
          email:    lead.Email ?? null,
          phone:    sanitizePhone(lead.Phone),
          source:   mapLeadSource(lead.Lead_Source ?? null),
          status:   mapLeadStatus(lead.Lead_Status ?? null),
          notes:    lead.Description ?? null,
          paxCount: 1,
          metadata: {
            zoho_id:    lead.id,
            zoho_lead_id: lead.Lead_ID ?? null,
            zoho_owner: lead.Owner?.name ?? null,
            keyword:    lead.KEYWORD    ?? null,
            adgroup_id: lead.ADGROUPID  ?? null,
            campaign_id: lead.ZCAMPAIGNID ?? null,
            click_type: lead.Click_Type ?? null,
            field3:     (lead as any).field3 ?? null,
            field4:     (lead as any).field4 ?? null,
            migrated_at: new Date().toISOString(),
          },
          createdAt: new Date(lead.Created_Time ?? Date.now()),
          updatedAt: new Date(lead.Modified_Time ?? Date.now()),
        };

        if (!DRY_RUN) {
          await prisma.lead.upsert({
            where:  { externalId },
            create: data,
            update: { status: data.status, notes: data.notes, updatedAt: data.updatedAt },
          });
        }
        stats.created++;
      } catch (err: any) {
        stats.errors++;
        logger.error({ zohoId: lead.id, err: err.message }, 'Помилка імпорту ліда');
      }
    }
    logProgress('Leads', stats);
  }
}

// ─── 5. importDeals ──────────────────────────────────────────────────────────

/**
 * Deals → bookings
 *
 * Після Products та Contacts — бо посилається на них.
 * Ключові маппінги:
 *   TOUR_AGC   → tourId    (через tourIdCache)
 *   Client     → touristId (через touristIdCache)
 *   Stage      → status    (ZOHO_DEAL_STAGE_MAP)
 *   Adults_count + Children_count → adultsCount / childrenCount
 *   utm_source / utm_content / utm_term / KEYWORD → metadata
 *   Contract_Name → contractNumber
 * externalId = 'zoho_deal_{id}'
 */
async function importDeals(stats: MigrationBatchStats): Promise<void> {
  logger.info('─── [5/7] Deals → bookings ─────────────────────────');

  const FIELDS = [
    'id', 'Owner', 'Deal_Name', 'Stage', 'Currency',
    'TOUR_AGC', 'Client', 'Contract_Name',
    'Adults_count', 'Children_count', 'Add_child_details',
    'utm_source', 'utm_content', 'utm_term',
    'KEYWORD', 'ADGROUPID', 'Click_Type', 'Ad_Network',
    'Search_Partner_Network', 'Match_Type', 'Source',
    'Created_Time', 'Modified_Time',
    'field2', 'field4', 'field5', 'field12', 'field25',
    'field26', 'field29', 'field30', 'field31', 'field33', 'field37',
  ];

  for await (const batch of fetchPages<ZohoDeal>('Deals', FIELDS)) {
    for (const deal of batch) {
      stats.fetched++;
      try {
        const externalId = `zoho_deal_${deal.id}`;

        // ─── Resolve зовнішні ключі ──────────────────────────
        const tourId    = deal.TOUR_AGC?.id
          ? await lookupTourId(deal.TOUR_AGC.id)
          : null;

        const touristId = deal.Client?.id
          ? await lookupTouristId(deal.Client.id)
          : null;

        if (!tourId) {
          logger.warn({ dealId: deal.id, TOUR_AGC: deal.TOUR_AGC?.id },
            'Deal: тур не знайдено в БД — зберігаємо без tourId');
        }

        // ─── Кастомні поля → metadata ────────────────────────
        const unknownFields = pickCustomFields(deal as any, 'field');

        const data = {
          externalId,
          status:         mapDealStage(deal.Stage ?? null),
          currency:       deal.Currency          ?? 'EUR',
          contractNumber: deal.Contract_Name     ?? null,
          adultsCount:    toNum(deal.Adults_count),
          childrenCount:  toNum(deal.Children_count),
          childrenDetails: deal.Add_child_details ?? null,
          // UTM-поля як прямі колонки (потребують відповідних полів у Prisma схемі)
          utmSource:      deal.utm_source       ?? null,
          utmContent:     deal.utm_content      ?? null,
          utmTerm:        deal.utm_term         ?? null,
          adKeyword:      deal.KEYWORD          ?? null,
          leadSource:     deal.Source           ?? null,
          tourId:         tourId ?? null,
          touristId:      touristId ?? null,
          // paxCount = дорослі + діти (якщо є)
          paxCount: (toNum(deal.Adults_count) ?? 0) + (toNum(deal.Children_count) ?? 0) || 1,
          totalPrice:  0,   // фінансові дані — уточнити звідки брати
          amountPaid:  0,
          balanceDue:  0,
          metadata: {
            zoho_id:       deal.id,
            zoho_deal_name: deal.Deal_Name,
            zoho_owner:    deal.Owner?.name      ?? null,
            utm_source:    deal.utm_source       ?? null,
            utm_content:   deal.utm_content      ?? null,
            utm_term:      deal.utm_term         ?? null,
            keyword:       deal.KEYWORD          ?? null,
            adgroup_id:    deal.ADGROUPID        ?? null,
            click_type:    deal.Click_Type       ?? null,
            ad_network:    deal.Ad_Network       ?? null,
            match_type:    deal.Match_Type       ?? null,
            source:        deal.Source           ?? null,
            zoho_fields:   Object.keys(unknownFields).length ? unknownFields : undefined,
            migrated_at:   new Date().toISOString(),
          },
          createdAt: new Date(deal.Created_Time),
          updatedAt: new Date(deal.Modified_Time),
        };

        if (!DRY_RUN) {
          const result = await prisma.booking.upsert({
            where:  { externalId },
            create: data,
            update: {
              status:         data.status,
              adultsCount:    data.adultsCount,
              childrenCount:  data.childrenCount,
              childrenDetails: data.childrenDetails ?? undefined,
              utmSource:      data.utmSource  ?? undefined,
              utmContent:     data.utmContent ?? undefined,
              utmTerm:        data.utmTerm    ?? undefined,
              adKeyword:      data.adKeyword  ?? undefined,
              leadSource:     data.leadSource ?? undefined,
              tourId:         data.tourId    ?? undefined,
              touristId:      data.touristId ?? undefined,
              contractNumber: data.contractNumber ?? undefined,
              updatedAt:      data.updatedAt,
            },
          });
          bookingIdCache.set(externalId, result.id);
        }
        stats.created++;
      } catch (err: any) {
        stats.errors++;
        logger.error({ zohoId: deal.id, err: err.message }, 'Помилка імпорту Deal');
      }
    }
    logProgress('Deals', stats);
  }
}

// ─── 6. importTravel ─────────────────────────────────────────────────────────

/**
 * Travel → bookings (UPDATE операційних полів)
 *
 * Travel — операційний запис виїзду. Не створює новий booking,
 * а ДОПОВНЮЄ вже імпортований з Deals.
 *
 * Стратегія пошуку booking:
 *   1. Travel.Project.id → bookingIdCache['zoho_deal_{id}'] (найнадійніше)
 *   2. Travel.tourID.id  → шукаємо booking з відповідним tourId (якщо 1 booking на тур)
 *   3. Якщо не знайдено  → зберігаємо в metadata для ручного матчингу
 *
 * Нові поля: pickupPoint, specialRequirements, exchangeRate, pickupCity.
 * 28+ невідомих field1–field37 → booking.metadata.zoho_travel.
 */
async function importTravel(stats: MigrationBatchStats): Promise<void> {
  logger.info(`─── [6/7] ${TRAVEL_MODULE} → bookings (UPDATE) ──────────────`);

  const FIELDS = [
    'id', 'Name', 'Owner', 'tourID', 'Project',
    'pickup', 'participant_count', 'adult_count', 'child_count',
    'exchange_rate', 'Currency', 'Requires', 'Created_Time',
    ...Array.from({ length: 37 }, (_, i) =>
      [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37][i]
    ).filter(Boolean).map((n) => `field${n}`),
  ];

  for await (const batch of fetchPages<ZohoTravel>(TRAVEL_MODULE, FIELDS)) {
    for (const travel of batch) {
      stats.fetched++;
      try {
        let bookingId: string | null = null;

        // Спроба 1: Project → Deal → booking
        if ((travel as any).Project?.id) {
          bookingId = await lookupBookingId((travel as any).Project.id);
        }

        // Спроба 2: tourID → тур → знайти єдине бронювання
        if (!bookingId && travel.tourID?.id) {
          const tourId = await lookupTourId(travel.tourID.id);
          if (tourId) {
            const bookings = await prisma.booking.findMany({
              where: { tourId }, select: { id: true, externalId: true }, take: 2,
            });
            if (bookings.length === 1) {
              bookingId = bookings[0].id;
            } else if (bookings.length > 1) {
              logger.warn({ travelId: travel.id, tourId },
                'Travel: знайдено кілька бронювань для туру — не оновлюємо');
            }
          }
        }

        // Збираємо кастомні поля
        const travelCustomFields = pickCustomFields(travel as any, 'field');

        const operationalData = {
          pickupPoint:          travel.pickup         ?? null,
          specialRequirements:  travel.Requires       ?? null,
          exchangeRate:         toNum(travel.exchange_rate),
          // Перезаписуємо paxCount якщо Travel має точні дані
          ...(toNum(travel.participant_count) !== null && {
            paxCount: toNum(travel.participant_count)!,
          }),
          ...(toNum(travel.adult_count) !== null && {
            adultsCount: toNum(travel.adult_count)!,
          }),
          ...(toNum(travel.child_count) !== null && {
            childrenCount: toNum(travel.child_count)!,
          }),
        };

        if (bookingId && !DRY_RUN) {
          // Оновлюємо booking операційними полями
          await prisma.booking.update({
            where: { id: bookingId },
            data:  {
              ...operationalData,
              metadata: {
                // merge з існуючим metadata — зберігаємо zoho_travel окремо
                zoho_travel: {
                  zoho_id:       travel.id,
                  name:          travel.Name,
                  custom_fields: Object.keys(travelCustomFields).length
                    ? travelCustomFields : undefined,
                  migrated_at:   new Date().toISOString(),
                },
              },
              updatedAt: new Date(),
            },
          });
          stats.updated++;
        } else if (!bookingId) {
          // Зберігаємо orphan travel у staging-таблиці або просто логуємо
          logger.warn({ travelId: travel.id, travelName: travel.Name },
            'Travel: відповідне бронювання не знайдено — запис у metadata orphans');
          if (!DRY_RUN) {
            await prisma.auditLog.create({
              data: {
                action: 'ZOHO_TRAVEL_ORPHAN', entityType: 'travel',
                entityId: travel.id,
                details: { travel_name: travel.Name, ...operationalData,
                           zoho_travel_id: travel.id },
                severity: 'warning', source: 'zoho_migration', createdAt: new Date(),
              },
            });
          }
          stats.skipped++;
        } else {
          stats.updated++;
        }
      } catch (err: any) {
        stats.errors++;
        logger.error({ travelId: travel.id, err: err.message }, 'Помилка імпорту Travel');
      }
    }
    logProgress('Travel', stats);
  }
}

// ─── 7. importPayments ───────────────────────────────────────────────────────

/**
 * CustomModule3 (Платежі) → payments
 *
 * ⚠️  Маппінг field2/field3/field5 потребує уточнення у замовника.
 * Поточна гіпотеза:
 *   field2 → amount (сума платежу)
 *   field3 → paidAt (дата оплати)
 *   field5 → статус або призначення (передоплата/доплата)
 *
 * Зв'язок з booking:
 *   Очікується поле-lookup на Deal у custom module.
 *   Перевіряємо через metadata або пряме поле.
 * externalId = 'zoho_payment_{id}'
 */
async function importPayments(stats: MigrationBatchStats): Promise<void> {
  logger.info(`─── [7/7] ${PAYMENT_MODULE} → payments ───────────────────────`);

  const FIELDS = [
    'id', 'Name', 'Owner', 'Payment_System', 'Currency',
    'Exchange_Rate', 'field2', 'field3', 'field5',
    'Created_Time', 'Modified_Time',
  ];

  for await (const batch of fetchPages<ZohoPayment>(PAYMENT_MODULE, FIELDS)) {
    for (const payment of batch) {
      stats.fetched++;
      try {
        const externalId = `zoho_payment_${payment.id}`;

        // ─── Розбір кастомних полів ───────────────────────────
        // ⚠️  Уточнити у замовника реальне значення field2/field3/field5
        const rawAmount  = toNum((payment as any).field2);
        const rawPaidAt  = (payment as any).field3;
        const rawPurpose = (payment as any).field5;

        const amount  = rawAmount ?? 0;
        const paidAt  = rawPaidAt ? parseZohoDate(rawPaidAt) : new Date(payment.Created_Time);
        const method  = mapPaymentMethod(payment.Payment_System ?? null);

        const data = {
          externalId,
          amount,
          currency:    payment.Currency ?? 'UAH',
          method,
          status:      'completed' as const,   // в Zoho зберігаються тільки факти оплат
          type:        resolvePaymentType(rawPurpose),
          exchangeRate: toNum(payment.Exchange_Rate),
          paidAt,
          bookingId:   null as string | null,  // заповниться нижче
          metadata: {
            zoho_id:       payment.id,
            zoho_name:     payment.Name      ?? null,
            zoho_owner:    payment.Owner?.name ?? null,
            payment_system: payment.Payment_System ?? null,
            field2_raw:    rawAmount,      // original value for audit
            field3_raw:    rawPaidAt,
            field5_raw:    rawPurpose,
            migrated_at:   new Date().toISOString(),
          },
          createdAt: new Date(payment.Created_Time),
          updatedAt: new Date(payment.Modified_Time),
        };

        if (!DRY_RUN) {
          // Перевіряємо чи вже існує
          const existing = await prisma.payment.findFirst({
            where: { externalId }, select: { id: true },
          });
          if (existing) {
            stats.skipped++;
            continue;
          }
          await prisma.payment.create({ data });
        }
        stats.created++;
      } catch (err: any) {
        stats.errors++;
        logger.error({ zohoId: payment.id, err: err.message }, 'Помилка імпорту платежу');
      }
    }
    logProgress('Payments', stats);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Розпізнає тип платежу з поля field5 / назви.
 * ⚠️  Уточнити реальні значення у замовника.
 */
function resolvePaymentType(raw: unknown): string {
  if (!raw) return 'payment';
  const s = String(raw).toLowerCase();
  if (s.includes('депозит') || s.includes('передопл') || s.includes('deposit')) return 'deposit';
  if (s.includes('доплат') || s.includes('final') || s.includes('balance')) return 'final_payment';
  if (s.includes('поверн') || s.includes('refund')) return 'refund';
  return 'payment';
}

/** Намагається розпарсити дату з різних форматів Zoho. */
function parseZohoDate(raw: unknown): Date {
  if (!raw) return new Date();
  if (raw instanceof Date) return raw;
  const d = new Date(String(raw));
  return isNaN(d.getTime()) ? new Date() : d;
}

function logProgress(module: string, stats: MigrationBatchStats): void {
  logger.info(
    `${module}: ${stats.fetched} отримано | ${stats.created} створено | ` +
    `${stats.updated} оновлено | ${stats.skipped} пропущено | ${stats.errors} помилок`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function makeBatchStats(): MigrationBatchStats {
  return { fetched: 0, created: 0, updated: 0, skipped: 0, errors: 0 };
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}с` : `${Math.floor(s / 60)}хв ${s % 60}с`;
}

// ─── Audit log ────────────────────────────────────────────────────────────────

async function writeMigrationAuditLog(
  result: MigrationResult,
  errorMessage?: string,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action:     'ZOHO_MIGRATION_COMPLETED',
        entityType: 'system',
        entityId:   null,
        details:    { ...result, errorMessage: errorMessage ?? null, dry_run: DRY_RUN },
        severity:   result.success ? 'info' : 'error',
        source:     'zoho_migration_script',
        createdAt:  new Date(),
      },
    });
  } catch (dbErr) {
    logger.warn({ dbErr }, 'Не вдалося записати audit_log');
  }
}

// =============================================================================
// MAIN — runZohoMigration
// Порядок: Products → Agencies → Contacts → Leads → Deals → Travel → Payments
// =============================================================================

export async function runZohoMigration(): Promise<MigrationResult> {
  const startTime = Date.now();
  const startedAt = new Date().toISOString();

  // Порядок гарантує референсну цілісність:
  //   Products  — не залежить ні від чого
  //   Agencies  — не залежить ні від чого
  //   Contacts  — references Agencies (agentId)
  //   Leads     — незалежні
  //   Deals     — references Products + Contacts
  //   Travel    — UPDATE Deals/bookings
  //   Payments  — references Deals/bookings
  const stats = {
    products:  makeBatchStats(),
    agencies:  makeBatchStats(),
    contacts:  makeBatchStats(),
    leads:     makeBatchStats(),
    deals:     makeBatchStats(),
    travel:    makeBatchStats(),
    payments:  makeBatchStats(),
    invoices:  makeBatchStats(),
    calls:     makeBatchStats(),
  };

  logger.info('');
  logger.info('═══════════════════════════════════════════════════════');
  logger.info(`  EUROTRIPS — Zoho CRM Migration v2.0${DRY_RUN ? '  [DRY RUN]' : ''}`);
  logger.info(`  ${new Date().toLocaleString('uk-UA')}`);
  logger.info('  Порядок: Products → Agencies → Contacts → Leads');
  logger.info('           → Deals → Travel → Payments');
  logger.info('═══════════════════════════════════════════════════════');

  try {
    // ─── Auth check ────────────────────────────────────────────────────
    await tokenManager.getToken();
    const ping = await zohoGet<{ users: { full_name: string }[] }>(
      '/users', { type: 'CurrentUser' },
    );
    logger.info(`✓ Zoho CRM: ${ping.users?.[0]?.full_name ?? 'невідомий користувач'}`);
    if (DRY_RUN) logger.info('⚠️  DRY RUN: запис у БД вимкнено');

    // ─── 7 кроків міграції ─────────────────────────────────────────────
    await importProducts(stats.products);
    logger.info(`✓ Products: ${stats.products.created} турів`);

    await importAgencies(stats.agencies);
    logger.info(`✓ Agencies: ${stats.agencies.created} агентств`);

    await importContacts(stats.contacts);
    logger.info(`✓ Contacts: ${stats.contacts.created} туристів`);

    await importLeads(stats.leads);
    logger.info(`✓ Leads: ${stats.leads.created} лідів`);

    await importDeals(stats.deals);
    logger.info(`✓ Deals: ${stats.deals.created} бронювань`);

    await importTravel(stats.travel);
    logger.info(`✓ Travel: ${stats.travel.updated} бронювань оновлено`);

    await importPayments(stats.payments);
    logger.info(`✓ Payments: ${stats.payments.created} платежів`);

  } catch (err: any) {
    logger.error({ err: err.message }, '✗ Міграція перервана');
    const failResult: MigrationResult = {
      success: false, duration: formatDuration(Date.now() - startTime),
      startedAt, finishedAt: new Date().toISOString(),
      modules: stats,
    };
    await writeMigrationAuditLog(failResult, err.message);
    throw err;
  }

  const duration    = formatDuration(Date.now() - startTime);
  const finishedAt  = new Date().toISOString();

  const result: MigrationResult = {
    success: true, duration, startedAt, finishedAt,
    modules: stats,
  };

  // ─── Підсумковий звіт ─────────────────────────────────────────────
  const modules = [
    ['Products',  stats.products],
    ['Agencies',  stats.agencies],
    ['Contacts',  stats.contacts],
    ['Leads',     stats.leads],
    ['Deals',     stats.deals],
    ['Travel',    stats.travel],
    ['Payments',  stats.payments],
  ] as [string, MigrationBatchStats][];

  logger.info('');
  logger.info('═══════════════════════════════════════════════════════');
  logger.info(`  Zoho Migration${DRY_RUN ? ' [DRY RUN]' : ''} — завершено ✓  (${duration})`);
  logger.info('');
  logger.info(
    `  ${'Модуль'.padEnd(12)} | ${'Отримано'.padStart(8)} | ${'Створено'.padStart(8)} | ` +
    `${'Оновлено'.padStart(8)} | ${'Пропущ.'.padStart(8)} | ${'Помилок'.padStart(8)}`
  );
  logger.info(`  ${'-'.repeat(68)}`);
  for (const [name, s] of modules) {
    logger.info(
      `  ${name.padEnd(12)} | ${String(s.fetched).padStart(8)} | ${String(s.created).padStart(8)} | ` +
      `${String(s.updated).padStart(8)} | ${String(s.skipped).padStart(8)} | ${String(s.errors).padStart(8)}`
    );
  }
  const totalErrors = modules.reduce((sum, [, s]) => sum + s.errors, 0);
  if (totalErrors > 0)
    logger.warn(`  ⚠️  Всього помилок: ${totalErrors}. Перевірте логи вище.`);
  logger.info('═══════════════════════════════════════════════════════');
  logger.info('');

  await writeMigrationAuditLog(result);
  return result;
}

// ─── Standalone entry point ───────────────────────────────────────────────────

if (require.main === module) {
  runZohoMigration()
    .then((r) => process.exit(r.success ? 0 : 1))
    .catch((e: Error) => {
      logger.error({ err: e.message }, 'Критична помилка');
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
