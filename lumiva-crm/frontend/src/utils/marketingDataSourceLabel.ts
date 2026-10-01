import type { TFunction } from 'i18next';

/**
 * Название провайдера без номера аккаунта (google_ads_8009704244 → «Google Ads») — для подзаголовков
 * вместо технического ключа: по номеру никто не поймёт, что это за кабинет.
 */
export function marketingProviderFamilyLabel(value: string): string {
  const v = (value || '').trim();
  if (v === 'google_ads' || v.startsWith('google_ads_')) return 'Google Ads';
  if (v === 'meta_ads' || v.startsWith('meta_ads_')) return 'Meta Ads';
  if (v.startsWith('ga4_') || v === 'ga4') return 'Google Analytics 4';
  if (v.startsWith('yandex_direct')) return 'Яндекс.Директ';
  if (v.startsWith('yandex_metrika')) return 'Яндекс.Метрика';
  if (v.startsWith('vk_ads')) return 'VK Ads';
  if (v === 'unknown') return '—';
  return v;
}

/** Подпись для значения dataSource: кастомные ключи, затем провайдер интеграции, иначе как есть. */
export function marketingDataSourceLabel(
  t: TFunction,
  value: string,
  labels?: Record<string, string>,
): string {
  const v = value.trim();
  if (v === 'google_ads') {
    const key = 'crm.marketingTraffic.dataSources.googleAdsLegacyBundle';
    const tr = t(key);
    if (tr !== key) return tr;
    return 'Google Ads · legacy aggregate (no per-account tag)';
  }
  const fromApi = labels?.[v]?.trim();
  if (fromApi) return fromApi;
  const ga4Prop = /^ga4_(\d+)$/.exec(v);
  if (ga4Prop) {
    const key = 'crm.marketingTraffic.dataSources.ga4Property';
    const tr = t(key, { id: ga4Prop[1] });
    if (tr !== key) return tr;
    return `Google Analytics 4 · ${ga4Prop[1]}`;
  }
  const gadsAcct = /^google_ads_(\d{6,15})$/.exec(v);
  if (gadsAcct) {
    const key = 'crm.marketingTraffic.dataSources.googleAdsAccount';
    const tr = t(key, { id: gadsAcct[1] });
    if (tr !== key) return tr;
    return `Google Ads · ${gadsAcct[1]}`;
  }
  const specific = `crm.marketingTraffic.dataSources.${value}`;
  const tr = t(specific);
  if (tr !== specific) return tr;
  const prov = `crm.marketingIntegrations.providers.${value}`;
  const tp = t(prov);
  if (tp !== prov) return tp;
  return value;
}
