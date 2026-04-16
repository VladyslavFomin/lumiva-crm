// backend/src/marketing/dto/marketing-traffic.dto.ts
export interface MarketingTrafficRow {
  channel: string;       // Google Ads / Meta / Yandex / unknown
  utmCampaign: string;   // UTM-кампания или (none)
  utmSource: string | null;
  utmMedium: string | null;

  impressions: number;
  clicks: number;
  cost: number;
  currency: string;

  leads: number;
  projects: number;
  revenue: number;

  cpc: number;   // cost / clicks
  cpl: number;   // cost / leads
  roas: number;  // revenue / cost
}

export interface MarketingTrafficStats {
  from?: string | null;
  to?: string | null;
  currency: string;

  totals: {
    impressions: number;
    clicks: number;
    cost: number;
    leads: number;
    projects: number;
    revenue: number;
    cpc: number;
    cpl: number;
    roas: number;
  };

  items: MarketingTrafficRow[];
}