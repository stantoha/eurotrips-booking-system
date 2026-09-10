// =============================================================================
// EUROTRIPS — верифікація токена вебхука
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  verifyWebhookToken,
  safeCompareSecrets,
  WEBHOOK_TOKEN_HEADERS,
} from './webhook-token';

const SECRET = 'super_secret_webhook_token_32chars';

describe('safeCompareSecrets', () => {
  it('true на однакових секретах', () => {
    expect(safeCompareSecrets(SECRET, SECRET)).toBe(true);
  });

  it('false на різних', () => {
    expect(safeCompareSecrets(SECRET, SECRET + 'x')).toBe(false);
    expect(safeCompareSecrets('abc', 'abd')).toBe(false);
  });

  it('false на порожньому з будь-якого боку', () => {
    expect(safeCompareSecrets('', SECRET)).toBe(false);
    expect(safeCompareSecrets(SECRET, '')).toBe(false);
    expect(safeCompareSecrets('', '')).toBe(false);
  });

  it('не кидає на секретах різної довжини', () => {
    // timingSafeEqual вимагає однакової довжини — тому порівнюємо SHA-256,
    // а не самі рядки. Без цього тут був би виняток.
    expect(() => safeCompareSecrets('a', 'дуже довгий секрет')).not.toThrow();
    expect(safeCompareSecrets('a', 'дуже довгий секрет')).toBe(false);
  });
});

describe('verifyWebhookToken', () => {
  it('ВІДХИЛЯЄ запит, якщо секрет не налаштований', () => {
    // Ключова регресія: раніше порожній ZOHO_WEBHOOK_TOKEN означав
    // «пропустити перевірку», і ендпоінт приймав будь-який запит.
    expect(verifyWebhookToken({ 'x-zoho-webhook-token': 'будь-що' }, undefined))
      .toEqual({ ok: false, reason: 'not_configured' });
    expect(verifyWebhookToken({}, ''))
      .toEqual({ ok: false, reason: 'not_configured' });
    expect(verifyWebhookToken({}, null))
      .toEqual({ ok: false, reason: 'not_configured' });
  });

  it('пропускає правильний токен', () => {
    expect(verifyWebhookToken({ 'x-zoho-webhook-token': SECRET }, SECRET))
      .toEqual({ ok: true });
  });

  it('приймає токен з альтернативного заголовка', () => {
    expect(verifyWebhookToken({ 'x-webhook-token': SECRET }, SECRET))
      .toEqual({ ok: true });
  });

  it('відхиляє відсутній заголовок', () => {
    expect(verifyWebhookToken({}, SECRET))
      .toEqual({ ok: false, reason: 'missing_token' });
  });

  it('відхиляє порожній заголовок', () => {
    expect(verifyWebhookToken({ 'x-zoho-webhook-token': '' }, SECRET))
      .toEqual({ ok: false, reason: 'missing_token' });
  });

  it('відхиляє невірний токен', () => {
    expect(verifyWebhookToken({ 'x-zoho-webhook-token': 'wrong' }, SECRET))
      .toEqual({ ok: false, reason: 'invalid_token' });
  });

  it('ігнорує нерядкові значення заголовків', () => {
    expect(verifyWebhookToken({ 'x-zoho-webhook-token': 12345 }, SECRET))
      .toEqual({ ok: false, reason: 'missing_token' });
    expect(verifyWebhookToken({ 'x-zoho-webhook-token': ['a', 'b'] }, SECRET))
      .toEqual({ ok: false, reason: 'missing_token' });
  });

  it('перевіряє обидва відомі заголовки', () => {
    expect(WEBHOOK_TOKEN_HEADERS).toEqual(['x-zoho-webhook-token', 'x-webhook-token']);
  });
});
