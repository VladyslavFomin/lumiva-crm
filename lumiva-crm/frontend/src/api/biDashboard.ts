// src/api/biDashboard.ts
import { api } from './client';

export interface CurrencyAmount {
  currency: string;
  amount: number;
}

export interface BiTrend {
  pct: number;
  direction: 'up' | 'down' | 'flat';
}

export interface BiDashboardSummary {
  period: { days: number; from: string; to: string };
  totals: {
    touches: number;
    touchesTrend: BiTrend;
    activeClients: number;
    attentionCount: number;
    avgSentiment: number | null;
  };
  leads: {
    total: number;
    won: number;
    lost: number;
    openPipeline: number;
    conversionRate: number;
    trend: BiTrend;
  };
  sales: {
    total: number;
    confirmed: number;
    revenue: CurrencyAmount[];
    avgDeal: CurrencyAmount[];
    trend: BiTrend;
  };
  products: {
    activeCount: number;
    inventoryValue: CurrencyAmount[];
    lowStockCount: number;
  };
  bookings: {
    total: number;
    completed: number;
    cancelled: number;
    revenue: CurrencyAmount[];
    trend: BiTrend;
  };
  hotels: {
    total: number;
    cancelled: number;
    revenue: CurrencyAmount[];
    trend: BiTrend;
  };
  telephony: {
    enabled: boolean;
    calls: number;
    sms: number;
    pickupRate: number;
    trend: BiTrend;
  };
  marketing: {
    connectedChannels: number;
    spend: CurrencyAmount[];
    campaigns: number;
    countries: number;
    topCountries: string[];
    channels: Array<{
      provider: string;
      name: string;
      connected: boolean;
      spend: CurrencyAmount[];
      campaigns: number;
      countries: number;
      topCountries: string[];
      lastDataDate: string | null;
    }>;
  };
  dailyTrend: Array<{
    date: string;
    leads: number;
    sales: number;
    bookings: number;
    hotels: number;
    calls: number;
  }>;
  channels: Array<{ key: string; label: string; count: number }>;
  funnel: Array<{ key: string; label: string; value: number }>;
  topCompanies: Array<{ id: string; name: string; leads: number; projects: number; revenue: number }>;
  team: Array<{ id: string; name: string; leads: number; calls: number; bookings: number; total: number }>;
  alerts: Array<{ module: string; risk: 'ok' | 'warn' | 'bad'; text: string; link: string }>;
}

export function fetchBiDashboardSummary(days?: number): Promise<BiDashboardSummary> {
  return api.get<BiDashboardSummary>('/bi-dashboard/summary', { params: { days } });
}
