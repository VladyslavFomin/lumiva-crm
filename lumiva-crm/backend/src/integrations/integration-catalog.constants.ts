/** Идентификаторы каталога «дорожная карта» + сопоставление с env INTEGRATION_OAUTH_<KEY>_CLIENT_* */

export const THIRD_PARTY_CATALOG_IDS = [
  'slack',
  'ms_teams',
  'google_calendar',
  'outlook',
  'whatsapp',
  'bitrix',
  'amocrm',
  'hubspot',
  'zapier',
  /** Make (Integromat) — visual automation platform */
  'make',
  'google_ads',
  'meta_ads',
  'mailchimp',
  '1c',
  'sap',
  'jira',
  'openai',
  /** WordPress / Contact Form 7 → лиды (входящий вебхук) */
  'wordpress_cf7',
  /** Google Sheets ↔ CRM (экспорт / обмен; в разработке) */
  'google_sheets',
  /** Client Cabinet Pro (WordPress / Lumiva Wizard) — переключатель модуля тенанта */
  'lumiva_client_cabinet',
  /** Онлайн-чат Lumiva (WordPress / Lumiva Wizard) — переключатель модуля тенанта */
  'lumiva_online_chat',
  /** iyzico — приём онлайн-платежей (Турция) */
  'iyzico',
  /** PayTR — приём онлайн-платежей (Турция) */
  'paytr',
  /** ЮKassa — приём онлайн-платежей (Россия) */
  'yookassa',
] as const;

export type ThirdPartyCatalogId = (typeof THIRD_PARTY_CATALOG_IDS)[number];

/** Суффикс для process.env: INTEGRATION_OAUTH_${ENV_SUFFIX}_CLIENT_ID */
export const CATALOG_ID_TO_ENV_SUFFIX: Record<string, string> = {
  slack: 'SLACK',
  ms_teams: 'MS_TEAMS',
  google_calendar: 'GOOGLE_CALENDAR',
  outlook: 'OUTLOOK',
  whatsapp: 'WHATSAPP',
  bitrix: 'BITRIX',
  amocrm: 'AMOCRM',
  hubspot: 'HUBSPOT',
  zapier: 'ZAPIER',
  make: 'MAKE',
  google_ads: 'GOOGLE_ADS',
  meta_ads: 'META_ADS',
  mailchimp: 'MAILCHIMP',
  '1c': 'ONEC',
  sap: 'SAP',
  jira: 'JIRA',
  openai: 'OPENAI',
  wordpress_cf7: 'WORDPRESS_CF7',
  google_sheets: 'GOOGLE_SHEETS',
  lumiva_client_cabinet: 'LUMIVA_CLIENT_CABINET',
  lumiva_online_chat: 'LUMIVA_ONLINE_CHAT',
  iyzico: 'IYZICO',
  paytr: 'PAYTR',
  yookassa: 'YOOKASSA',
};

export function isThirdPartyCatalogId(id: string): id is ThirdPartyCatalogId {
  return (THIRD_PARTY_CATALOG_IDS as readonly string[]).includes(id);
}
