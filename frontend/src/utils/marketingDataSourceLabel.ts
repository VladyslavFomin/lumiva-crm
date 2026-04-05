import type { TFunction } from 'i18next';

/** Подпись для значения dataSource: кастомные ключи, затем провайдер интеграции, иначе как есть. */
export function marketingDataSourceLabel(
  t: TFunction,
  value: string,
  labels?: Record<string, string>,
): string {
  const v = value.trim();
  const fromApi = labels?.[v]?.trim();
  if (fromApi) return fromApi;
  const ga4Prop = /^ga4_(\d+)$/.exec(v);
  if (ga4Prop) {
    const key = 'crm.marketingTraffic.dataSources.ga4Property';
    const tr = t(key, { id: ga4Prop[1] });
    if (tr !== key) return tr;
    return `Google Analytics 4 · ${ga4Prop[1]}`;
  }
  const specific = `crm.marketingTraffic.dataSources.${value}`;
  const tr = t(specific);
  if (tr !== specific) return tr;
  const prov = `crm.marketingIntegrations.providers.${value}`;
  const tp = t(prov);
  if (tp !== prov) return tp;
  return value;
}
