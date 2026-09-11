import { api } from './client';

export type Money = string;

export interface CcpSite {
  id: string;
  siteUrl?: string;
  siteHost?: string | null;
  isActive?: boolean;
  createdAt?: string;
}

export interface CcpClient {
  id: string;
  siteId: string;
  wpUserId: number;
  email: string;
  name?: string | null;
  phone?: string | null;
  balanceEur: Money;
  balanceUsd: Money;
  investmentStyle?: string | null;
  createdAt?: string;
}

export interface CcpTxn {
  id: string;
  siteId: string;
  wpPostId: number;
  title?: string | null;
  status?: string | null;
  spendEur?: Money | null;
  spendUsd?: Money | null;
  date?: string | null;
  desc?: string | null;
  ccpStatus?: string | null;
}

export interface CcpTransfer {
  id: string;
  siteId: string;
  wpPostId: number;
  title?: string | null;
  amount?: Money | null;
  currency?: string | null;
  fromCurrency?: string | null;
  toCurrency?: string | null;
  rate?: Money | null;
  credited?: Money | null;
  date?: string | null;
  ccpStatus?: string | null;
}

export interface CcpClientAnalytics {
  client: CcpClient;
  txns: CcpTxn[];
  transfers: CcpTransfer[];
  sync: { fresh: boolean; errors: string[] };
  metrics: {
    balances: { eur: number; usd: number; total: number };
    counts: { txns: number; transfers: number };
    spending: { eur: number; usd: number; total: number };
    transfers: { incoming: number; outgoing: number; net: number };
    investments: {
      amount: number;
      byKind: Record<string, number>;
      style: string | null;
      annualPercent: number | null;
      profitMonthlyPercent: number | null;
      expectedAnnualProfit: number | null;
      expectedMonthlyProfit: number | null;
    };
    accountCosts: { monthlyPercent: number | null; expectedMonthlyDebit: number | null };
    credit: { leverage: number | null; repayMonthlyPercent: number | null; expectedMonthlyRepay: number | null };
    expected: { netMonthly: number | null; netAnnual: number | null };
  };
}

export interface ApiList<T> {
  items: T[];
  page: number;
  per: number;
  total: number;
}

function qs(params: Record<string, any>) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    p.append(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const ccpApi = {
  sites: () => api.get<CcpSite[]>('/ccp/sites').then((r) => r.data),
  clients: (params: { siteId?: string; search?: string; page?: number; per?: number } = {}) =>
    api.get<ApiList<CcpClient>>(`/ccp/clients${qs(params)}`).then((r) => r.data),
  client: (id: string) => api.get<CcpClient>(`/ccp/clients/${encodeURIComponent(id)}`).then((r) => r.data),
  clientAnalytics: (id: string) => api.get<CcpClientAnalytics>(`/ccp/clients/${encodeURIComponent(id)}/analytics`).then((r) => r.data),
};
