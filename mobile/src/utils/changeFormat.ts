import type { CustomFieldDef } from '../api/customFields';
import { normalizeRange, formatRange, formatDay, parseIsoDate, formatDateTime } from './dateValues';

type T = (key: string) => string;

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
}

/** Human text for one side of a history change. Never `[object Object]`: ranges, arrays and plain objects get proper wording. */
export function formatChangeValue(value: unknown, t: T, def?: CustomFieldDef): string {
  if (isEmpty(value)) return '—';
  if (typeof value === 'boolean') return value ? t('cf.yes') : t('cf.no');
  const range = normalizeRange(value);
  if (range) return formatRange(range, t('cf.rangeFrom'), t('cf.rangeTo'));
  if (Array.isArray(value)) {
    return value.map((v) => (def?.options?.find((o) => o.value === String(v))?.label ?? formatChangeValue(v, t))).join(', ');
  }
  if (typeof value === 'object') {
    const parts = Object.values(value as Record<string, unknown>).filter((v) => !isEmpty(v) && typeof v !== 'object');
    return parts.length ? parts.join(' – ') : '—';
  }
  if (def?.type === 'select') return def.options?.find((o) => o.value === String(value))?.label ?? String(value);
  if (def?.type === 'date') { const d = parseIsoDate(value); return d ? formatDay(d) : String(value); }
  if (def?.type === 'datetime') { const d = parseIsoDate(value); return d ? formatDateTime(d) : String(value); }
  return String(value);
}

export interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

// Internal duplicates of another displayed change (owner name vs ids) — hide so the list isn't doubled.
const HIDDEN_FIELDS = new Set(['ownerUserId', 'ownerUserIds']);

/** "Label: from → to" lines for the backend's `{changes:[{field, from, to}]}` payload; custom-field keys are labelled from the schema. */
export function describeChanges(changes: FieldChange[], t: T, defs: CustomFieldDef[] = []): string[] {
  return changes
    .filter((c) => !HIDDEN_FIELDS.has(c.field))
    .map((c) => {
      const cfKey = c.field.startsWith('customFields.') ? c.field.slice('customFields.'.length) : null;
      const def = cfKey ? defs.find((d) => d.key === cfKey) : undefined;
      const key = `history.field.${c.field}`;
      const translated = t(key);
      const label = def?.label ?? (translated !== key ? translated : cfKey ?? c.field);
      // Links and counters: ids/lengths carry no reading value on their own.
      if (['leadId', 'companyId', 'contactId'].includes(c.field)) return label;
      return `${label}: ${formatChangeValue(c.from, t, def)} → ${formatChangeValue(c.to, t, def)}`;
    });
}
