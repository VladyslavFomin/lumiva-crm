import React, { useState } from 'react';

/** Simple Icons CDN slug (cdn.simpleicons.org) — при ошибке загрузки показываем монограмму */
const CATALOG_TO_SLUG: Record<string, string> = {
  slack: 'slack',
  ms_teams: 'microsoftteams',
  google_calendar: 'googlecalendar',
  outlook: 'microsoftoutlook',
  whatsapp: 'whatsapp',
  mailchimp: 'mailchimp',
  bitrix: 'bitrix24',
  amocrm: 'amocrm',
  hubspot: 'hubspot',
  zapier: 'zapier',
  google_ads: 'googleads',
  google_analytics: 'googleanalytics',
  meta_ads: 'meta',
  '1c': '1c',
  sap: 'sap',
  jira: 'jira',
  openai: 'openai',
  webhooks: 'postman',
  email: 'gmail',
  telegram: 'telegram',
  woocommerce: 'woocommerce',
  marketing_api: 'n8n',
  stripe: 'stripe',
  wordpress_cf7: 'wordpress',
  google_sheets: 'googlesheets',
  lumiva_client_cabinet: 'wordpress',
  lumiva_online_chat: 'rocketdotchat',
};

export const IntegrationBrandIcon: React.FC<{
  catalogId: string;
  label: string;
  size?: number;
  className?: string;
}> = ({ catalogId, label, size = 36, className = '' }) => {
  const [broken, setBroken] = useState(false);
  const slug = CATALOG_TO_SLUG[catalogId] || 'dots-horizontal';
  const mono = (label || catalogId).slice(0, 1).toUpperCase();

  if (broken) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-[13px] font-bold text-slate-700 ${className}`}
        style={{ width: size, height: size }}
        aria-hidden
      >
        {mono}
      </div>
    );
  }

  const src = `https://cdn.simpleicons.org/${slug}/222222`;

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt=""
      className={`shrink-0 rounded-xl border border-slate-200 bg-white object-contain object-left p-1.5 ${className}`}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  );
};
