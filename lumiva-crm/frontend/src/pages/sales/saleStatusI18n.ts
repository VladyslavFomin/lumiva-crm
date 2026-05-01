import type { i18n as I18n } from 'i18next';
import type { TFunction } from 'i18next';

const KEY_PREFIX = 'crm.sales.status.';

/** Resolves Woo / raw sale status codes to a label; unknown codes fall back to "other". */
export function translateSaleStatus(
  t: TFunction,
  i18n: I18n,
  status: string | null | undefined,
): string {
  const code = (status ?? '').trim() || 'other';
  const key = `${KEY_PREFIX}${code}`;
  if (!i18n.exists(key)) return t(`${KEY_PREFIX}other`);
  return t(key);
}
