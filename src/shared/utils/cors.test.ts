// =============================================================================
// EUROTRIPS — CORS origin matching Unit Tests
// A1: startsWith дозволяв обхід origin-перевірки (eurotrips.ua.evil.com тощо)
// =============================================================================

import { describe, it, expect } from 'vitest';
import { isOriginAllowed, normalizeOrigin } from './cors';

const ALLOWED = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://eurotrips.ua',
];

describe('isOriginAllowed', () => {
  it('дозволяє точний збіг з дозволеним origin', () => {
    expect(isOriginAllowed('https://eurotrips.ua', ALLOWED)).toBe(true);
    expect(isOriginAllowed('http://localhost:5173', ALLOWED)).toBe(true);
  });

  it('блокує origin, що є суфіксною атакою через префіксний збіг (A1)', () => {
    expect(isOriginAllowed('https://eurotrips.ua.evil.com', ALLOWED)).toBe(false);
    expect(isOriginAllowed('https://eurotrips.ua.attacker.io', ALLOWED)).toBe(false);
    expect(isOriginAllowed('http://localhost:5173.evil.com', ALLOWED)).toBe(false);
  });

  it('блокує origin, що просто містить дозволений рядок як підрядок', () => {
    expect(isOriginAllowed('https://evil.com/https://eurotrips.ua', ALLOWED)).toBe(false);
    expect(isOriginAllowed('https://notEurotrips.ua', ALLOWED)).toBe(false);
  });

  it('блокує зовсім чужий origin', () => {
    expect(isOriginAllowed('https://attacker.com', ALLOWED)).toBe(false);
  });

  it('нормалізує кінцевий слеш перед порівнянням', () => {
    expect(isOriginAllowed('https://eurotrips.ua/', ALLOWED)).toBe(true);
    expect(isOriginAllowed('https://eurotrips.ua', ['https://eurotrips.ua/'])).toBe(true);
  });

  it('порівняння чутливе до схеми (http vs https)', () => {
    expect(isOriginAllowed('http://eurotrips.ua', ALLOWED)).toBe(false);
  });
});

describe('normalizeOrigin', () => {
  it('прибирає один кінцевий слеш', () => {
    expect(normalizeOrigin('https://eurotrips.ua/')).toBe('https://eurotrips.ua');
  });

  it('прибирає кілька кінцевих слешів', () => {
    expect(normalizeOrigin('https://eurotrips.ua///')).toBe('https://eurotrips.ua');
  });

  it('не чіпає origin без кінцевого слешу', () => {
    expect(normalizeOrigin('https://eurotrips.ua')).toBe('https://eurotrips.ua');
  });
});
