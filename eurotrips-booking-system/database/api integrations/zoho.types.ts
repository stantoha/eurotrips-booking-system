// =============================================================
// EUROTRIPS — Zoho CRM Types
// API: Zoho CRM REST v8
// Документація: https://www.zohoapis.com/crm/v8/
// =============================================================

// ─── OAuth2 ─────────────────────────────────────────────────

export interface ZohoTokenResponse {
  access_token:  string;
  expires_in:    number;   // секунди (зазвичай 3600)
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

// ─── Leads (Ліди) ────────────────────────────────────────────

/**
 * Поля ліда з Zoho CRM.
 * Запитуємо тільки потрібні поля через ?fields=... для ефективності.
 */
export interface ZohoLead {
  id:           string;
  First_Name:   string | null;
  Last_Name:    string | null;
  Email:        string | null;
  Phone:        string | null;
  Mobile:       string | null;
  Lead_Source:  string | null;   // Website, Instagram, Cold Call, тощо
  Lead_Status:  string | null;   // New, Contacted, Qualified, Lost, тощо
  Description:  string | null;   // Нотатки менеджера
  Created_Time: string;          // ISO datetime "2025-01-15T10:30:00+02:00"
  Modified_Time: string;

  // Кастомні поля Eurotrips (якщо є в Zoho)
  Tour_Name?:      string | null;   // Назва туру що цікавить
  Num_Tourists?:   number | null;   // Кількість туристів
  Budget_EUR?:     number | null;   // Бюджет в EUR

  // Системні
  Owner:      ZohoOwner;
  Converted:  boolean;             // true = лід конвертовано в угоду
}

// ─── Contacts (Клієнти) ──────────────────────────────────────

export interface ZohoContact {
  id:           string;
  First_Name:   string | null;
  Last_Name:    string | null;
  Email:        string | null;
  Phone:        string | null;
  Mobile:       string | null;
  Description:  string | null;
  Created_Time: string;
  Modified_Time: string;
  Owner:        ZohoOwner;

  // Пов'язаний акаунт (агентство)
  Account_Name?: ZohoModuleRef | null;
}

// ─── Deals (Угоди/Бронювання) ────────────────────────────────

export interface ZohoDeal {
  id:              string;
  Deal_Name:       string;
  Stage:           string;   // Qualification, Proposal/Price Quote, Closed Won, тощо
  Amount:          number | null;
  Closing_Date:    string | null;  // YYYY-MM-DD
  Description:     string | null;
  Created_Time:    string;
  Modified_Time:   string;
  Owner:           ZohoOwner;
  Contact_Name?:   ZohoModuleRef | null;
  Account_Name?:   ZohoModuleRef | null;

  // Кастомні поля Eurotrips
  Tour_Code?:     string | null;
  Num_Tourists?:  number | null;
  Deposit_Paid?:  boolean | null;
}

// ─── Accounts (Агентства) ────────────────────────────────────

export interface ZohoAccount {
  id:           string;
  Account_Name: string;
  Email:        string | null;
  Phone:        string | null;
  Description:  string | null;
  Created_Time: string;
  Owner:        ZohoOwner;
}

// ─── Статуси маппінгу ────────────────────────────────────────

/**
 * Маппінг статусів лідів Zoho → наша система.
 */
export const ZOHO_LEAD_STATUS_MAP: Record<string, string> = {
  // Англійські (default Zoho)
  'New':                 'new',
  'Not Contacted':       'new',
  'Contacted':           'in_work',
  'Pre-Qualified':       'in_work',
  'Qualified':           'proposal_sent',
  'Not Qualified':       'lost',
  'Lost Lead':           'lost',
  'Lost':                'lost',
  // Українські (кастомні значення в Zoho Eurotrips)
  'Нова':                'new',
  'В роботі':            'in_work',
  'Потребує уточнення':  'needs_clarification',
  'Надіслано пропозицію': 'proposal_sent',
  'Очікує рішення':      'awaiting_decision',
  'Успішний':            'successful',
  'Втрачений':           'lost',
};

/**
 * Маппінг каналів залучення Zoho → наша система.
 */
export const ZOHO_LEAD_SOURCE_MAP: Record<string, string> = {
  // Англійські
  'Web Site':      'site',
  'Website':       'site',
  'Cold Call':     'phone',
  'Email':         'email',
  'Phone':         'phone',
  'Referral':      'referral',
  'Advertisement': 'ads',
  'Internal Seminar': 'other',
  'Online Store':  'site',
  'Partner':       'agent',
  // Соціальні мережі
  'Instagram':     'instagram',
  'Facebook':      'facebook',
  'Telegram':      'telegram',
  'Viber':         'viber',
  // Українські
  'Сайт':          'site',
  'Телефон':       'phone',
  'Повторний':     'repeat',
  'Агент':         'agent',
  'Реклама':       'ads',
};

// ─── Результат міграції ───────────────────────────────────────

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
  leads:     MigrationBatchStats;
  contacts:  MigrationBatchStats;
  startedAt: string;
  finishedAt: string;
}
