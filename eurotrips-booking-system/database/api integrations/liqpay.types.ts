// =============================================================
// EUROTRIPS — LiqPay Integration Types
// Документація: https://www.liqpay.ua/documentation/uk/api/home/
// =============================================================

/**
 * Payload, який LiqPay надсилає на server_url (webhook).
 * Обидва поля — обов'язкові для верифікації підпису.
 */
export interface LiqPayWebhookPayload {
  data: string;       // base64-encoded JSON об'єкт LiqPayCallbackData
  signature: string;  // base64(SHA1(PRIVATE_KEY + data + PRIVATE_KEY))
}

/**
 * Декодований об'єкт після base64-decode поля `data`.
 * Містить всю інформацію про транзакцію.
 */
export interface LiqPayCallbackData {
  /** Публічний ключ магазину */
  public_key: string;

  /** Версія API (завжди 3) */
  version: number;

  /** Статус платежу */
  status: LiqPayPaymentStatus;

  /**
   * Унікальний ідентифікатор платежу LiqPay.
   * Використовуємо як external_payment_id для idempotency.
   */
  payment_id: number;

  /**
   * Наш order_id, який ми передали при ініціюванні.
   * Формат: ET-{bookingId} або ET-{bookingId}-deposit
   */
  order_id: string;

  /** Тип транзакції */
  action: LiqPayAction;

  /** Сума транзакції */
  amount: number;

  /** Валюта (UAH, EUR, USD) */
  currency: string;

  /** Опис платежу */
  description: string;

  /** Час створення платежу (Unix timestamp * 1000) */
  create_date: number;

  /** Час фінального статусу (Unix timestamp * 1000) */
  end_date: number;

  /** Тип транзакції (debit, credit, ...) */
  transaction_id: number;

  /** Код помилки (при failure/error) */
  err_code?: string;

  /** Опис помилки (при failure/error) */
  err_description?: string;

  /** Маскована картка платника */
  sender_card_mask2?: string;

  /** Країна банку-емітента */
  sender_country_code?: string;

  /** Тип картки (visa, mastercard) */
  card_token?: string;

  /** Ідентифікатор підписки (якщо є) */
  info?: string;
}

/**
 * Всі можливі статуси платежу LiqPay.
 * Джерело: https://www.liqpay.ua/documentation/uk/api/callback
 */
export type LiqPayPaymentStatus =
  | 'success'          // Успішний платіж
  | 'sandbox'          // Тестовий успішний платіж
  | 'wait_accept'      // Очікує підтвердження (hold)
  | 'failure'          // Помилка платежу
  | 'error'            // Технічна помилка
  | 'reversed'         // Повернення коштів
  | 'wait_secure'      // Очікує перевірки безпеки
  | 'cash_wait'        // Очікує оплати готівкою
  | 'hold_wait'        // Холд: очікує підтвердження
  | 'processing'       // В обробці
  | 'prepared'         // Підготовлено до оплати
  | 'subscribed'       // Підписка активована
  | 'unsubscribed';    // Підписка деактивована

export type LiqPayAction =
  | 'pay'
  | 'hold'
  | 'paysplit'
  | 'subscribe'
  | 'paydonate'
  | 'auth'
  | 'regular'
  | 'refund';

/**
 * Параметри для генерації checkout форми LiqPay.
 */
export interface LiqPayCheckoutParams {
  orderId: string;          // ET-{bookingId} або ET-{bookingId}-deposit
  amount: number;           // Сума в UAH
  description: string;      // Текст для клієнта (назва туру)
  resultUrl: string;        // Redirect після оплати (фронтенд)
  serverUrl: string;        // Webhook URL для нашого сервера
}

/**
 * Результат генерації checkout.
 * Обидва поля вставляємо в HTML-форму LiqPay.
 */
export interface LiqPayCheckoutData {
  data: string;       // base64-encoded payload
  signature: string;  // SHA1 підпис
}
