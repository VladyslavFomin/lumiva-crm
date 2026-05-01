import type { CustomObjectField } from '../api/customObjects';

/**
 * Рендерить date/datetime input только для настоящих дат.
 * Раньше key.endsWith('id') отсекал «date_paid» (окончание …paid → …id).
 */
export function isRenderableWorkspaceDateField(field: CustomObjectField): boolean {
  const type = String(field.type || '').toLowerCase();
  if (type !== 'date' && type !== 'datetime') return false;
  const kl = String(field.key || '').toLowerCase();
  const ll = String(field.label || '').toLowerCase();
  if (kl === 'id' || kl.endsWith('_id') || kl.includes('id_') || ll.endsWith(' id')) {
    return false;
  }
  return true;
}
