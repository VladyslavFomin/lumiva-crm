/** Компактное представление записи CRM для промпта ИИ-сотрудника. */

const DROP_KEYS = new Set([
  'rawPayload',
  'rawData',
  'meta',
  'password',
  'token',
  'accessToken',
  'botToken',
  'adminEmails',
  'tenant',
  'activity',
  'comments',
  'customFields',
]);

/** Только примитивы, длинные строки обрезаны, служебные/секретные ключи выброшены. */
export function compactRecord(input: unknown, maxString = 300): Record<string, unknown> {
  if (!input || typeof input !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (DROP_KEYS.has(k) || /token|secret|password/i.test(k)) continue;
    if (v == null) continue;
    if (typeof v === 'string') out[k] = v.length > maxString ? `${v.slice(0, maxString)}…` : v;
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else if (v instanceof Date) out[k] = v.toISOString();
    else if (Array.isArray(v) && v.every((x) => typeof x === 'string' || typeof x === 'number')) {
      out[k] = v.slice(0, 20);
    }
  }
  return out;
}

export function clipText(value: unknown, max: number): string | null {
  if (value == null) return null;
  const s = String(value);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
