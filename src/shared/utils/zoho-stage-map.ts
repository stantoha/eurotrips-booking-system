// =============================================================================
// EUROTRIPS — мапінг стадій угоди Zoho CRM ↔ статусів бронювання ETOS
//
// Файл свідомо лежить ПОЗА src/modules/integrations/zoho/: та тека виключена
// з tsconfig.build.json, тож усе в ній не компілюється і не покривається
// тестами. Мапа статусів має потрапляти у збірку.
//
// Попередня версія мапи містила значення 'Нова заявка', 'В роботі',
// 'Попередньо заброньовано', 'Очікує оплату', 'Підтверджено'. Жодного з них
// у даних Zoho не існує — перетин із реальними стадіями був нульовий, і кожна
// угода падала у fallback.
// =============================================================================

import { BookingStatus } from '@prisma/client';

/**
 * Pipeline обовʼязковий при створенні угоди — без нього Zoho віддає 400.
 * `system_mandatory` за метаданими модуля Deals.
 */
export const ZOHO_PIPELINE = 'Поездка';

// ─── Zoho → ETOS ──────────────────────────────────────────────────────────

/**
 * Ключі — рядки, які повертає Zoho API у полі `Stage`.
 *
 * ⚠ РОЗБІЖНІСТЬ У ДЖЕРЕЛАХ, див. розділ «Розбіжності» у stage-1-report.md:
 * документ «розшифровка кастомних полів» стверджує, що API оперує
 * `actual_value` (Qualification, Negotiation/Review, Closed Won...), а
 * завдання етапу 1 і контракт синхронізації v3 — що display-значеннями
 * ('1. Новая', '6. Завершена успешно'), і позначають це як перевірене
 * емпірично через GET /crm/v8/Deals.
 *
 * Реалізовано за завданням (display), а actual_value підхоплюються
 * запасною таблицею нижче — щоб інтеграція не розсипалась мовчки, якщо
 * правий виявиться інший документ.
 */
export const ZOHO_DEAL_STAGE_MAP: Record<string, BookingStatus> = {
  '1. Новая':               BookingStatus.new,
  '2. Переговоры':          BookingStatus.in_work,
  '3. Ожидание оплаты':     BookingStatus.awaiting_payment,
  '4. Бронь':               BookingStatus.partially_paid,
  '5. 100 проц.':           BookingStatus.confirmed,
  '6. Завершена успешно':   BookingStatus.completed,
  '7. Отказ':               BookingStatus.cancelled_client,
  '8. Отказ в выдаче визы': BookingStatus.cancelled_client,
};

/**
 * Запасні ключі — форма `actual_value` тих самих стадій (layout «Поїздки»).
 * Використовуються лише якщо основна таблиця не дала збігу; спрацювання
 * логується як warn, бо означає, що припущення про формат API хибне.
 */
export const ZOHO_DEAL_STAGE_ACTUAL_VALUE_ALIASES: Record<string, BookingStatus> = {
  'Qualification':          BookingStatus.new,
  'Negotiation/Review':     BookingStatus.in_work,
  '4. Ожидание предоплаты': BookingStatus.awaiting_payment,
  'Получение визы':         BookingStatus.partially_paid,
  'Ожидание поездки':       BookingStatus.confirmed,
  'Closed Won':             BookingStatus.completed,
  'Closed Lost':            BookingStatus.cancelled_client,
};

// ─── ETOS → Zoho ──────────────────────────────────────────────────────────

/**
 * Повний по всіх значеннях BookingStatus — тип Record<BookingStatus, string>
 * це контролює на компіляції: додасться новий статус у schema.prisma —
 * складання впаде, доки його сюди не внесуть.
 *
 * Мапінг згортальний: ETOS має 15 статусів, Zoho — 8. Проміжні операційні
 * стадії ETOS (docs_collected, ready_to_depart, on_trip) для відділу продажів
 * Zoho нерозрізненні — усі вони «оплачено повністю».
 */
export const ETOS_TO_ZOHO_STAGE: Record<BookingStatus, string> = {
  [BookingStatus.new]:                 '1. Новая',
  [BookingStatus.in_work]:             '1. Новая',
  [BookingStatus.needs_clarification]: '1. Новая',
  [BookingStatus.pre_booked]:          '3. Ожидание оплаты',
  [BookingStatus.awaiting_payment]:    '3. Ожидание оплаты',
  [BookingStatus.partially_paid]:      '4. Бронь',
  [BookingStatus.confirmed]:           '5. 100 проц.',
  [BookingStatus.docs_collected]:      '5. 100 проц.',
  [BookingStatus.ready_to_depart]:     '5. 100 проц.',
  [BookingStatus.on_trip]:             '5. 100 проц.',
  [BookingStatus.completed]:           '6. Завершена успешно',
  [BookingStatus.cancelled_client]:    '7. Отказ',
  [BookingStatus.cancelled_operator]:  '7. Отказ',
  [BookingStatus.no_show]:             '7. Отказ',
  [BookingStatus.refund]:              '7. Отказ',
};

// ─── Резолвер ─────────────────────────────────────────────────────────────

/** Мінімальний контракт логера — підходять і pino, і console. */
export interface StageLogger {
  warn: (obj: unknown, msg?: string) => void;
}

const defaultLogger: StageLogger = {
  warn: (obj, msg) => console.warn(msg ?? 'zoho-stage-map', obj),
};

/**
 * Перетворює стадію Zoho у статус ETOS.
 *
 * Невідома стадія НЕ кидає виняток і НЕ мовчить: повертає null із
 * попередженням у лог. Причина — у даних Zoho трапляється сміття, на якому
 * падати не можна:
 *   'Ð¿ÐµÑ€ÐµÐ³Ð¾Ð²Ð¾Ñ€Ñ‹' — UTF-8, прочитаний як Latin-1
 *   '1. ?????'      — затерта кодировка
 * Плюс власні нумерації в інших пайплайнах («Ивенты»): там «Завершена
 * успешно» має номер 5, а не 6.
 *
 * Викликач сам вирішує, що робити з null — зазвичай лишити статус як є
 * і поставити задачу оператору.
 */
export function zohoStageToBookingStatus(
  stage: string | null | undefined,
  logger: StageLogger = defaultLogger,
): BookingStatus | null {
  if (!stage) {
    logger.warn({ stage }, 'Zoho stage: порожнє значення');
    return null;
  }

  const raw = stage.trim();

  const direct = ZOHO_DEAL_STAGE_MAP[raw];
  if (direct) return direct;

  const alias = ZOHO_DEAL_STAGE_ACTUAL_VALUE_ALIASES[raw];
  if (alias) {
    logger.warn(
      { stage: raw, mappedTo: alias },
      'Zoho stage: збіг лише за actual_value — API повертає не display-значення, перевірити припущення про формат',
    );
    return alias;
  }

  logger.warn(
    { stage: raw, codePoints: Array.from(raw).slice(0, 12).map((c) => c.codePointAt(0)) },
    'Zoho stage: невідома стадія — статус бронювання не змінено',
  );
  return null;
}

/** Перетворює статус ETOS у стадію Zoho. Тотальна функція — null неможливий. */
export function bookingStatusToZohoStage(status: BookingStatus): string {
  return ETOS_TO_ZOHO_STAGE[status];
}

// ─── Ще не звірені мапи ───────────────────────────────────────────────────
// TODO(stage-3): значення не звірені з Zoho.
// ZOHO_LEAD_STATUS_MAP і ZOHO_SOURCE_MAP лишаються у zoho.types.ts і НЕ
// використовуються в коді, доки їх не перевірять на живих даних. Відомо, що
// їхні цільові значення ('proposal_sent', 'awaiting_decision', 'successful',
// 'referral', 'ads', 'other') відсутні в Prisma-енумах LeadStatus і
// LeadSource, тобто запис із них зараз впав би на рівні БД.
