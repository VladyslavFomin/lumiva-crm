import type { TFunction } from 'i18next';

/** Built-in vs roadmap entries; all user-facing copy lives in i18n (`integrationsCatalog.items.<id>`). */

export type IntegrationCatalogStatus = 'live' | 'beta' | 'planned' | 'in_development';

export type IntegrationCatalogItem = {
  id: string;
  status: IntegrationCatalogStatus;
  /** In-app route when the integration has a dedicated CRM screen */
  href?: string;
  /**
   * Roadmap only: show badge when platform OAuth for this catalog is not ready
   * (reserved for future one-click OAuth).
   */
  prefersPlatformOAuth?: boolean;
};

const ITEM = 'crm.automations.integrationsCatalog.items';

export function integrationCatalogName(id: string, t: TFunction): string {
  return t(`${ITEM}.${id}.name`);
}

export function integrationCatalogDescription(id: string, t: TFunction): string {
  return t(`${ITEM}.${id}.description`);
}

export function integrationCatalogNextStep(id: string, t: TFunction): string {
  return t(`${ITEM}.${id}.nextStep`, { defaultValue: '' });
}

export function integrationCatalogLinkLabel(id: string, t: TFunction): string {
  return t(`${ITEM}.${id}.linkLabel`, { defaultValue: '' });
}

/** Already in the product — real links inside the CRM */
export const BUILT_IN_INTEGRATIONS: IntegrationCatalogItem[] = [
  { id: 'webhooks', status: 'live' },
  { id: 'email', status: 'live', href: '/app/email' },
  { id: 'telegram', status: 'live' },
  { id: 'woocommerce', status: 'live' },
  { id: 'marketing_api', status: 'live', href: '/app/integrations-hub?tab=marketing' },
  { id: 'ms_teams', status: 'live' },
];

/** Connect-from-library + roadmap (honest status in badges) */
export const ROADMAP_INTEGRATIONS: IntegrationCatalogItem[] = [
  {
    id: 'slack',
    status: 'in_development',
    prefersPlatformOAuth: false,
  },
  {
    id: 'google_calendar',
    status: 'beta',
    prefersPlatformOAuth: false,
  },
  {
    id: 'outlook',
    status: 'beta',
    prefersPlatformOAuth: false,
  },
  {
    id: 'whatsapp',
    status: 'beta',
    prefersPlatformOAuth: false,
  },
  {
    id: 'mailchimp',
    status: 'beta',
    prefersPlatformOAuth: false,
  },
  {
    id: 'bitrix',
    status: 'beta',
    prefersPlatformOAuth: false,
  },
  {
    id: 'amocrm',
    status: 'beta',
    prefersPlatformOAuth: false,
  },
  {
    id: 'hubspot',
    status: 'beta',
    prefersPlatformOAuth: false,
  },
  {
    id: 'zapier',
    status: 'in_development',
    prefersPlatformOAuth: false,
  },
  {
    id: 'google_ads',
    status: 'beta',
    prefersPlatformOAuth: false,
    href: '/app/integrations-hub?tab=marketing',
  },
  {
    id: 'google_analytics',
    status: 'beta',
    prefersPlatformOAuth: false,
    href: '/app/integrations-hub?tab=marketing',
  },
  {
    id: 'meta_ads',
    status: 'beta',
    prefersPlatformOAuth: false,
    href: '/app/integrations-hub?tab=marketing',
  },
  {
    id: '1c',
    status: 'in_development',
    prefersPlatformOAuth: false,
  },
  {
    id: 'sap',
    status: 'in_development',
    prefersPlatformOAuth: false,
  },
  {
    id: 'jira',
    status: 'in_development',
    prefersPlatformOAuth: false,
  },
  {
    id: 'openai',
    status: 'in_development',
    prefersPlatformOAuth: false,
  },
  {
    id: 'wordpress_cf7',
    status: 'live',
    prefersPlatformOAuth: false,
  },
  {
    id: 'lumiva_client_cabinet',
    status: 'live',
    prefersPlatformOAuth: false,
  },
  {
    id: 'lumiva_online_chat',
    status: 'live',
    prefersPlatformOAuth: false,
  },
  {
    id: 'google_sheets',
    status: 'live',
    prefersPlatformOAuth: false,
  },
];
