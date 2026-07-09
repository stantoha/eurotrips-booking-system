// =============================================================================
// EUROTRIPS — CORS origin matching
// Точне порівняння origin (НЕ startsWith/includes-як-substring) — інакше
// https://eurotrips.ua.evil.com або http://localhost:5173.evil.com проходять
// перевірку, бо це префіксні збіги дозволених origin-ів.
// =============================================================================

/** Прибирає кінцевий(і) слеш(і), щоб 'https://x.com/' і 'https://x.com' збігались. */
export function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, '');
}

/** Точне порівняння (після нормалізації слешу) — НЕ префіксне/substring-збігання. */
export function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  const normalized = normalizeOrigin(origin);
  return allowedOrigins.some((allowed) => normalizeOrigin(allowed) === normalized);
}
