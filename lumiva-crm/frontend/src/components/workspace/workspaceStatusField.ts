import type { CustomObjectField } from '../../api/customObjects';

/**
 * Определяет поле «статуса» для таблицы/канбана/drawer.
 * Поддерживает type status | select | multiselect и ключи/лейблы вроде status, state, стадия.
 */
export function pickStatusLikeField(
  fields: CustomObjectField[],
  objectMeta?: Record<string, any> | null,
): CustomObjectField | null {
  const fromMeta = String(objectMeta?.kanban?.statusFieldKey || '').trim();
  if (fromMeta) {
    const f = fields.find((x) => x.key === fromMeta);
    if (f && (f.type === 'status' || f.type === 'select' || f.type === 'multiselect')) {
      return f;
    }
  }

  const byType = fields.find((f) => f.type === 'status');
  if (byType) return byType;

  const byKey = fields.find((f) => f.key === 'status');
  if (byKey && (byKey.type === 'status' || byKey.type === 'select' || byKey.type === 'multiselect')) {
    return byKey;
  }

  for (const f of fields) {
    const lk = f.key.toLowerCase();
    const ll = (f.label || '').toLowerCase();
    const looksLikeStatus =
      lk === 'state' ||
      lk.includes('status') ||
      lk.includes('stage') ||
      ll.includes('status') ||
      ll.includes('статус') ||
      ll.includes('стадия') ||
      ll.includes('этап');
    if (
      looksLikeStatus &&
      (f.type === 'status' || f.type === 'select' || f.type === 'multiselect')
    ) {
      return f;
    }
  }

  return null;
}

/** Собрать все встречающиеся значения статуса из записей (строка или multiselect CSV). */
export function collectStatusValuesFromRecords(
  records: Array<{ values?: Record<string, any> }>,
  fieldKey: string,
): string[] {
  const out = new Set<string>();
  for (const r of records) {
    const raw = r.values?.[fieldKey];
    if (raw === undefined || raw === null || raw === '') continue;
    if (Array.isArray(raw)) {
      raw.forEach((v) => {
        const s = String(v || '').trim();
        if (s) out.add(s);
      });
      continue;
    }
    String(raw)
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .forEach((s) => out.add(s));
  }
  return Array.from(out);
}
