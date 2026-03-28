import type { TFunction } from 'i18next';

/** Подпись для значения dataSource: кастомные ключи, затем провайдер интеграции, иначе как есть. */
export function marketingDataSourceLabel(t: TFunction, value: string): string {
  const specific = `crm.marketingTraffic.dataSources.${value}`;
  const tr = t(specific);
  if (tr !== specific) return tr;
  const prov = `crm.marketingIntegrations.providers.${value}`;
  const tp = t(prov);
  if (tp !== prov) return tp;
  return value;
}
