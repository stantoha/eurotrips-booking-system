// =============================================================
// EUROTRIPS — Zoho CRM Types (повна версія)
// API: Zoho CRM REST v8
// Модулі: 22 (Deals, Contacts, Leads, Travel, Products,
//   Invoices, Invoiced_Items, PreInvoices, CustomModule3,
//   Agencies, Vendors, Promocodes, Requisites,
//   Customer_Survey, Calls, Events, Tasks,
//   Achievement_Rules, DealHistory, Rules, Invoice1, Positions)
// =============================================================

// ─── OAuth2 ──────────────────────────────────────────────────

export interface ZohoTokenResponse {
  access_token:  string;
  expires_in:    number;
  token_type:    'Bearer';
  api_domain?:   string;
}

// ─── Загальні типи ───────────────────────────────────────────

export interface ZohoOwner {
  id:    string;
  name:  string;
  email: string;
}

export interface ZohoModuleRef {
  id:   string;
  name: string;
}

export interface ZohoPaginationInfo {
  page:         number;
  count:        number;
  per_page:     number;
  more_records: boolean;
}

export interface ZohoListResponse<T> {
  data: T[];
  info: ZohoPaginationInfo;
}

// =============================================================
// МОДУЛЬ 1: Deals (Угоди / Бронювання)
// → наша система: bookings
// =============================================================

export interface ZohoDeal {
  id:            string;
  Owner:         ZohoOwner;
  Deal_Name:     string;

  // Статус воронки
  Stage:         string | null;   // "Qualification" | "Closed Won" | "Closed Lost" тощо

  // Посилання на тур та клієнта
  TOUR_AGC?:     ZohoModuleRef | null;   // кастомне поле → тур
  Client?:       ZohoModuleRef | null;   // кастомне поле → контакт/турист
  Contract_Name?: string | null;

  // Кількість учасників
  Children_count?: number | null;        // кастомне поле
  Adults_count?:   number | null;        // кастомне поле
  Add_child_details?: string | null;     // деталі дітей (вік тощо)

  // Фінанси
  Currency?:      string | null;         // USD / EUR / UAH

  // UTM / маркетинг
  utm_content?:           string | null;
  utm_source?:            string | null;
  utm_term?:              string | null;
  KEYWORD?:               string | null;
  ADGROUPID?:             string | null;
  Click_Type?:            string | null;
  Ad_Network?:            string | null;
  Search_Partner_Network?: string | null;
  Match_Type?:            string | null;

  // Конверсія
  Source?:        string | null;    // канал залучення

  // Системні часові мітки
  Created_Time:   string;
  Modified_Time:  string;

  // Кастомні поля (уточнити у замовника)
  field2?:   unknown;
  field4?:   unknown;
  field5?:   unknown;
  field12?:  unknown;
  field25?:  unknown;
  field26?:  unknown;
  field29?:  unknown;
  field30?:  unknown;
  field31?:  unknown;
  field33?:  unknown;
  field37?:  unknown;
}

// =============================================================
// МОДУЛЬ 2: Contacts (Клієнти / Туристи)
// → наша система: tourists
// =============================================================

export interface ZohoContact {
  id:            string;
  Owner:         ZohoOwner;
  First_Name:    string | null;
  Last_Name:     string | null;
  Full_Name:     string | null;
  Email:         string | null;
  Phone:         string | null;
  Mobile:        string | null;

  // Посилання на агентство
  Account_Name?: ZohoModuleRef | null;

  // Системна інформація
  Created_By?:   ZohoOwner;
  Modified_By?:  ZohoOwner;
  Created_Time:  string;
  Modified_Time: string;

  // Персональні дані
  Date_of_Birth?:         string | null;    // YYYY-MM-DD
  Allergic_reaction?:     string | null;    // ⚠️  важливо для операцій
  Dietary_restriction?:   string | null;    // вегетаріанець, халяль тощо
  Description?:           string | null;    // нотатки

  // Маркетингові
  Subscribed?:  boolean | null;

  // UTM / рекламна аналітика
  KEYWORD?:                 string | null;
  Click_Type?:              string | null;
  Device_Type?:             string | null;
  Ad_Network?:              string | null;
  Search_Partner_Network?:  string | null;
  Ad_Campaign_Name?:        string | null;
  AdGroup_Name?:            string | null;
  ZCAMPAIGNID?:             string | null;
  ZCADGROUPID?:             string | null;

  // Соціальні мережі
  LinkedIn?:  string | null;

  // Внутрішній ID
  C_ID?:  string | null;

  // Фінансові
  Exchange_Rate?: number | null;

  // Кастомні поля (уточнити)
  field1?:  unknown;
  field2?:  unknown;
  field3?:  unknown;
  field4?:  unknown;
  field5?:  unknown;
  field6?:  unknown;
  field7?:  unknown;
  field10?: unknown;
  field11?: unknown;
  field12?: unknown;
  field13?: unknown;
  field17?: unknown;
}

// =============================================================
// МОДУЛЬ 3: Leads (Ліди)
// → наша система: leads
// =============================================================

export interface ZohoLead {
  id:            string;
  Owner:         ZohoOwner;
  Phone:         string | null;
  Email:         string | null;
  URL?:          string | null;

  // Класифікація
  Lead_Source?:  string | null;
  Lead_Status?:  string | null;
  Tag?:          string | string[] | null;

  // Конверсія
  Lead_Conversion_Time?:       string | null;
  Ad_Click_Date?:              string | null;
  Converted_Contact?:          ZohoModuleRef | null;
  Conversion_Stage?:           string | null;
  Conversion_Expired?:         boolean | null;
  Reason_for_Conversion_Failure?: string | null;

  // UTM
  KEYWORD?:    string | null;
  ADGROUPID?:  string | null;
  ZCAMPAIGNID?: string | null;
  Click_Type?:  string | null;

  // Часові мітки
  Created_By?:         ZohoOwner;
  Modified_By?:        ZohoOwner;
  Change_Log_Time?:    string | null;
  Record_Date?:        string | null;
  Last_Activity_Time?: string | null;
  Created_Time?:       string;
  Modified_Time?:      string;

  // Кастомні поля
  Lead_ID?:  string | null;   // внутрішній ID ліда
  field3?:   unknown;
  field4?:   unknown;
}

// =============================================================
// МОДУЛЬ 4: Travel (Операційні дані туру / Подорожі)
// ⚠️  КРИТИЧНИЙ МОДУЛЬ — операційна інформація по кожному туру
// → наша система: bookings (операційна частина) + rooming
// =============================================================

export interface ZohoTravel {
  Owner:      ZohoOwner;
  Name:       string;           // назва запису (зазвичай код туру + дата)

  // Прив'язка до туру
  tourID?:    ZohoModuleRef | null;  // посилання на Products (тур)
  Project?:   ZohoModuleRef | null;  // можливо Deal або інший об'єкт

  // Учасники
  participant_count?: number | null;
  adult_count?:       number | null;
  child_count?:       number | null;

  // Логістика
  pickup?:    string | null;    // місце посадки

  // Фінанси
  Currency?:       string | null;
  exchange_rate?:  number | null;

  // Вимоги / побажання
  Requires?:  string | null;

  // Часові мітки
  Created_Time: string;

  // Кастомні поля (28+ штук — уточнити у замовника)
  field1?:  unknown;
  field2?:  unknown;
  field3?:  unknown;
  field4?:  unknown;
  field5?:  unknown;
  field6?:  unknown;
  field7?:  unknown;
  field8?:  unknown;
  field9?:  unknown;
  field10?: unknown;
  field11?: unknown;
  field12?: unknown;
  field13?: unknown;
  field14?: unknown;
  field15?: unknown;
  field16?: unknown;
  field17?: unknown;
  field20?: unknown;
  field21?: unknown;
  field22?: unknown;
  field23?: unknown;
  field24?: unknown;
  field25?: unknown;
  field26?: unknown;
  field27?: unknown;
  field28?: unknown;
  field29?: unknown;
  field30?: unknown;
  field31?: unknown;
  field32?: unknown;
  field33?: unknown;
  field34?: unknown;
  field35?: unknown;
  field36?: unknown;
  field37?: unknown;
}

// =============================================================
// МОДУЛЬ 5: Products (Тури / Каталог)
// → наша система: tours
// =============================================================

export interface ZohoProduct {
  id:              string;
  Owner:           ZohoOwner;
  PRODUCT_NAME:    string;
  PRODUCT_IMAGE?:  string | null;   // URL зображення
  CATEGORY?:       string | null;   // тип туру
  Unit_Price?:     number | null;   // базова ціна
  Priority?:       number | null;   // пріоритет відображення
  Qty_in_Stock?:   number | null;   // кількість місць

  // Системні
  C_ID?:             string | null;
  Record_Status?:    string | null;
  Is_Active?:        boolean | null;
  Locked?:           boolean | null;
  ID_PRODUCT_ZCRM?:  string | null;
  Tag?:              string | string[] | null;
  Created_Time:      string;
  Modified_Time:     string;
  Last_Activity_Time?: string | null;
}

// =============================================================
// МОДУЛЬ 6: Invoices (Рахунки)
// → наша система: invoices
// =============================================================

export interface ZohoInvoice {
  id?:             string;
  Owner:           ZohoOwner;
  Subject?:        string | null;
  Invoice_Number?: string | null;   // номер рахунку

  // Фінанси
  Status?:         string | null;
  Currency?:       string | null;
  Exchange_Rate?:  number | null;
  Grand_Total?:    number | null;
  Discount?:       number | null;
  Tax?:            number | null;

  // Посилання
  Agency?:         ZohoModuleRef | null;   // агентство
  Contract_Name?:  string | null;
  Payment_link?:   string | null;

  // Юридична інформація
  ENRPOU?:  string | null;   // ЄДРПОУ

  // Управління
  Send_Invoice?:      boolean | null;
  Month_of_payment?:  string | null;

  // Системні
  Created_By?:    ZohoOwner;
  Modified_By?:   ZohoOwner;
  Created_Time?:  string;
  Modified_Time?: string;

  field2?:  unknown;
  field3?:  unknown;
  field10?: unknown;
  field12?: unknown;
  field16?: unknown;
  field17?: unknown;
  field18?: unknown;
  field20?: unknown;
  field23?: unknown;
  field27?: unknown;
  field71?: unknown;
}

// =============================================================
// МОДУЛЬ 7: Invoiced_Items (Позиції рахунку — підлегла форма)
// → наша система: invoice_items
// =============================================================

export interface ZohoInvoicedItem {
  Sequence_Number?:       number | null;
  Parent_Id:              string;          // ID батьківського рахунку
  Product_Name?:          string | null;
  Description?:           string | null;
  Unit_Price?:            number | null;
  Quantity?:              number | null;
  Total?:                 number | null;
  Discount?:              number | null;
  Total_After_Discount?:  number | null;
  Net_Total?:             number | null;
  Created_Time?:          string;
  Modified_Time?:         string;
}

// =============================================================
// МОДУЛЬ 8: PreInvoices (Проформи / Попередні рахунки)
// → наша система: pre_invoices або частина invoices
// =============================================================

export interface ZohoPreInvoice {
  id:                string;
  Owner:             ZohoOwner;
  Name?:             string | null;
  Deal?:             ZohoModuleRef | null;   // пов'язана угода
  Grand_Total_Amount?: number | null;
  Amount_from_Deal?:   number | null;
  Exchange_Rate?:      number | null;
  Currency?:           string | null;
  Tag?:                string | string[] | null;
  Record_Status?:      string | null;
  Locked?:             boolean | null;
  Created_Time:        string;
  Modified_Time:       string;
  Last_Activity_Time?: string | null;
}

// =============================================================
// МОДУЛЬ 9: CustomModule3 (Платежі)
// → наша система: payments
// =============================================================

export interface ZohoPayment {
  id:             string;
  Owner:          ZohoOwner;
  Name?:          string | null;    // зазвичай номер/назва платежу

  // Платіжна система
  Payment_System?: string | null;  // LiqPay / Fondy / WayForPay / готівка тощо

  // Фінанси
  Currency?:       string | null;
  Exchange_Rate?:  number | null;

  // Системні
  Created_By?:    ZohoOwner;
  Modified_By?:   ZohoOwner;
  Tag?:           string | string[] | null;
  Record_Status?: string | null;
  Locked?:        boolean | null;
  Created_Time:   string;
  Modified_Time:  string;
  Last_Activity_Time?: string | null;

  // Кастомні поля (сума, статус тощо — уточнити)
  field2?:  unknown;   // ймовірно: сума платежу
  field3?:  unknown;   // ймовірно: дата платежу
  field5?:  unknown;   // ймовірно: статус або призначення
}

// =============================================================
// МОДУЛЬ 10: Agencies (Агентства / Турагенти)
// → наша система: agents
// =============================================================

export interface ZohoAgency {
  id?:         string;
  Owner:       ZohoOwner;
  Name:        string;       // назва агентства
  Agent_Name?: string | null; // ім'я агента

  // Контакти
  Email?:    string | null;
  Phone?:    string | null;
  Website?:  string | null;

  // Класифікація
  Stage?:  string | null;   // статус агентства
  Size?:   string | null;   // розмір / рівень

  // Юридична інформація
  ENRPOU?:  string | null;  // ЄДРПОУ

  // Кастомні поля (29+ штук — уточнити: комісія, умови, реквізити)
  field29?: unknown;
  field30?: unknown;
  field31?: unknown;
  field32?: unknown;
  field33?: unknown;
  field34?: unknown;
  field35?: unknown;
  field36?: unknown;
  field37?: unknown;
  field40?: unknown;
  field41?: unknown;
  field42?: unknown;
  field43?: unknown;
  field44?: unknown;
  field45?: unknown;
  field46?: unknown;
  field47?: unknown;
  field48?: unknown;
  field49?: unknown;
  field50?: unknown;
  field51?: unknown;
  field52?: unknown;
  field53?: unknown;
  field54?: unknown;
  field55?: unknown;
  field56?: unknown;
}

// =============================================================
// МОДУЛЬ 11: Vendors (Постачальники)
// → наша система: suppliers (майбутнє)
// =============================================================

export interface ZohoVendor {
  id:              string;
  Owner:           ZohoOwner;
  Vendor_Name?:    string | null;
  Achievement_Type?: string | null;
  Agency?:         ZohoModuleRef | null;   // пов'язане агентство
  Competitor_Date?: string | null;
  Promocode?:      ZohoModuleRef | null;
  Tag?:            string | string[] | null;
  Record_Status?:  string | null;
  Locked?:         boolean | null;
  Created_Time:    string;
  Modified_Time:   string;
  Last_Activity_Time?: string | null;
}

// =============================================================
// МОДУЛЬ 12: Promocodes
// → наша система: promo_codes (майбутнє)
// =============================================================

export interface ZohoPromocode {
  id:             string;
  Owner:          ZohoOwner;
  Name?:          string | null;
  Description?:   string | null;
  Tag?:           string | string[] | null;
  Record_Status?: string | null;
  Created_Time:   string;
  Modified_Time:  string;
  // Кастомні поля (знижка, тип, термін дії)
  field?:   unknown;
  field1?:  unknown;
  field2?:  unknown;
  field3?:  unknown;
  field4?:  unknown;
  field5?:  unknown;
}

// =============================================================
// МОДУЛЬ 13: Requisites (Реквізити)
// → наша система: requisites / bank_accounts (майбутнє)
// =============================================================

export interface ZohoRequisite {
  id:             string;
  Tag?:           string | string[] | null;
  Record_Status?: string | null;
  Locked?:        boolean | null;
  Created_Time:   string;
  Modified_Time:  string;
  Last_Activity_Time?: string | null;
  // Кастомні поля (назва банку, IBAN, МФО тощо)
  field1?:  unknown;
  field2?:  unknown;
  field3?:  unknown;
  field4?:  unknown;
}

// =============================================================
// МОДУЛЬ 14: Customer_Survey (Відгуки клієнтів)
// → наша система: reviews (майбутнє)
// =============================================================

export interface ZohoCustomerSurvey {
  id:             string;
  Owner:          ZohoOwner;
  Name?:          string | null;
  Email?:         string | null;
  Gen_Survey?:    string | null;     // тип анкети
  Survey_Response?: string | null;   // відповідь
  Record_Status?: string | null;
  Created_Time:   string;
  Modified_Time:  string;
  Last_Activity_Time?: string | null;
  field1?:  unknown; field2?:  unknown; field3?:  unknown;
  field4?:  unknown; field5?:  unknown; field6?:  unknown;
  field7?:  unknown; field8?:  unknown; field9?:  unknown;
  field10?: unknown; field11?: unknown; field12?: unknown;
  field13?: unknown;
}

// =============================================================
// МОДУЛЬ 15: Calls (Дзвінки)
// → наша система: communications (channel: 'phone')
// =============================================================

export interface ZohoCall {
  id:                   string;
  Owner:                ZohoOwner;
  Subject?:             string | null;
  Caller_ID?:           string | null;
  Call_Duration?:       string | null;   // "00:05:23"
  Call_Result?:         string | null;   // результат дзвінка
  Call_Agenda?:         string | null;   // тема дзвінка
  Voice_Recording?:     string | null;   // URL запису
  Call_Start_Time?:     string | null;
  Call_Type?:           string | null;   // Inbound / Outbound
  Outgoing_Call_Status?: string | null;

  // Прив'язки
  Who_Id?:   ZohoModuleRef | null;   // контакт
  What_Id?:  ZohoModuleRef | null;   // угода

  // Системні
  Scheduled_in_CRM?: boolean | null;
  CTI_Entry?:        boolean | null;
  Tag?:              string | string[] | null;
  Record_Status?:    string | null;
  Last_Activity_Time?: string | null;
}

// =============================================================
// МОДУЛЬ 16: Events (Зустрічі / Події)
// → наша система: communications або calendar (майбутнє)
// =============================================================

export interface ZohoEvent {
  id:              string;
  Owner:           ZohoOwner;
  Event_Title?:    string | null;
  Subject?:        string | null;
  Venue?:          string | null;
  Start_DateTime?: string | null;
  End_DateTime?:   string | null;
  Description?:    string | null;
  Participants?:   ZohoModuleRef[] | null;
  What_Id?:        ZohoModuleRef | null;   // угода / тур

  // Геолокація
  Check_in_Time?:     string | null;
  Check_in_City?:     string | null;
  Check_in_Country?:  string | null;
  Latitude?:          number | null;
  Longitude?:         number | null;

  // Фінанси
  Currency?:       string | null;
  Exchange_Rate?:  number | null;
  Tag?:            string | string[] | null;
}

// =============================================================
// МОДУЛЬ 17: Tasks (Завдання)
// → наша система: tasks (майбутнє)
// =============================================================

export interface ZohoTask {
  id:           string;
  Owner:        ZohoOwner;
  Subject?:     string | null;
  Status?:      string | null;   // Not Started | In Progress | Completed
  Priority?:    string | null;   // High | Medium | Low
  Due_Date?:    string | null;
  Closed_Time?: string | null;
  What_Id?:     ZohoModuleRef | null;   // угода / тур
  Tag?:         string | string[] | null;
  Created_By?:  ZohoOwner;
  Modified_By?: ZohoOwner;
}

// =============================================================
// МОДУЛЬ 18: Achievement_Rules (Правила бонусів)
// → наша система: loyalty / gamification (майбутнє)
// =============================================================

export interface ZohoAchievementRule {
  id:             string;
  Owner:          ZohoOwner;
  Name?:          string | null;
  Tag?:           string | string[] | null;
  Record_Status?: string | null;
  Created_Time:   string;
  Modified_Time:  string;
  Last_Activity_Time?: string | null;
}

// =============================================================
// МОДУЛЬ 19: DealHistory (Історія статусів угод)
// → наша система: booking_history (audit_log)
// =============================================================

export interface ZohoDealHistory {
  id?:               string;
  Stage?:            string | null;
  Stage_Duration?:   number | null;   // хвилини або дні
  Modified_By?:      ZohoOwner;
  Modified_Time?:    string | null;
  Amount?:           number | null;
  Probability?:      number | null;
  Expected_Revenue?: number | null;
  Closing_Date?:     string | null;
  Exchange_Rate?:    number | null;
  Currency?:         string | null;
  Moved_To?:         string | null;   // наступний статус
}

// =============================================================
// ПІДЛЕГЛІ ФОРМИ
// =============================================================

// Модуль 20: Rules (підлегла форма Achievement_Rules)
export interface ZohoAchievementRuleItem {
  Parent_ID:      string;
  Name?:          string | null;
  Description?:   string | null;
  Reward_Common?: number | null;
  Promocode?:     ZohoModuleRef | null;
  Achievement_ID?: string | null;
  Created_Time?:  string;
  Modified_Time?: string;
}

// Модуль 21: Invoice1 (підлегла форма Invoices — типи/відсотки)
export interface ZohoInvoicePaymentType {
  Parent_ID:        string;
  Amount_Percent?:  number | null;   // відсоток від суми
  Type?:            string | null;   // тип: передоплата / доплата
  Total_Amount?:    number | null;
  total_non_deal?:  number | null;
  field?:           unknown;
  Created_Time?:    string;
  Modified_Time?:   string;
}

// Модуль 22: Positions (підлегла форма — позиції рахунків/турів)
export interface ZohoPosition {
  Parent_ID: string;
  // Поля не вдалося визначити зі скріншотів — уточнити у замовника
  [key: string]: unknown;
}

// =============================================================
// МАППІНГИ СТАТУСІВ
// =============================================================

/** Deal Stage → booking status */
export const ZOHO_DEAL_STAGE_MAP: Record<string, string> = {
  // Стандартні Zoho
  'Qualification':              'in_work',
  'Needs Analysis':             'in_work',
  'Value Proposition':          'proposal_sent',
  'Id. Decision Makers':        'proposal_sent',
  'Perception Analysis':        'awaiting_decision',
  'Proposal/Price Quote':       'proposal_sent',
  'Negotiation/Review':         'awaiting_decision',
  'Closed Won':                 'confirmed',
  'Closed Lost':                'cancelled_client',
  // Кастомні Eurotrips (уточнити реальні значення)
  'Нова заявка':                'new',
  'В роботі':                   'in_work',
  'Попередньо заброньовано':    'pre_booked',
  'Очікує оплату':              'awaiting_payment',
  'Частково оплачено':          'partially_paid',
  'Підтверджено':               'confirmed',
  'Документи зібрані':          'docs_collected',
  'Готово до виїзду':           'ready_to_depart',
  'У поїздці':                  'on_trip',
  'Завершено':                  'completed',
  'Скасовано клієнтом':         'cancelled_client',
  'Скасовано оператором':       'cancelled_operator',
  'No-show':                    'no_show',
  'Повернення':                 'refund',
};

/** Lead_Status → leads.status */
export const ZOHO_LEAD_STATUS_MAP: Record<string, string> = {
  'New':                    'new',
  'Not Contacted':          'new',
  'Contacted':              'in_work',
  'Pre-Qualified':          'in_work',
  'Qualified':              'proposal_sent',
  'Not Qualified':          'lost',
  'Lost Lead':              'lost',
  'Lost':                   'lost',
  // Українські
  'Нова':                   'new',
  'В роботі':               'in_work',
  'Потребує уточнення':     'needs_clarification',
  'Надіслано пропозицію':   'proposal_sent',
  'Очікує рішення':         'awaiting_decision',
  'Успішний':               'successful',
  'Втрачений':              'lost',
};

/** Lead_Source / utm_source / Source → leads.source */
export const ZOHO_SOURCE_MAP: Record<string, string> = {
  'Web Site':       'site',
  'Website':        'site',
  'Cold Call':      'phone',
  'Email':          'email',
  'Phone':          'phone',
  'Referral':       'referral',
  'Advertisement':  'ads',
  'Partner':        'agent',
  'Instagram':      'instagram',
  'Facebook':       'facebook',
  'Telegram':       'telegram',
  'Viber':          'viber',
  // UTM source
  'google':         'google',
  'facebook':       'facebook',
  'instagram':      'instagram',
  // Українські
  'Сайт':           'site',
  'Телефон':        'phone',
  'Повторний':      'repeat',
  'Агент':          'agent',
  'Реклама':        'ads',
};

/** Agency Stage → agent qualification level */
export const ZOHO_AGENCY_STAGE_MAP: Record<string, string> = {
  'Active':       'active',
  'Inactive':     'inactive',
  'Prospect':     'prospect',
  'Partner':      'partner',
  'Premium':      'premium',
  // Українські (уточнити)
  'Активний':     'active',
  'Неактивний':   'inactive',
  'Партнер':      'partner',
};

// =============================================================
// РЕЗУЛЬТАТИ МІГРАЦІЇ
// =============================================================

export interface MigrationBatchStats {
  fetched:  number;
  created:  number;
  updated:  number;
  skipped:  number;
  errors:   number;
}

export interface MigrationResult {
  success:   boolean;
  duration:  string;
  startedAt: string;
  finishedAt: string;
  modules: {
    leads:     MigrationBatchStats;
    contacts:  MigrationBatchStats;
    deals:     MigrationBatchStats;
    travel:    MigrationBatchStats;
    products:  MigrationBatchStats;
    agencies:  MigrationBatchStats;
    payments:  MigrationBatchStats;
    invoices:  MigrationBatchStats;
    calls:     MigrationBatchStats;
  };
}
