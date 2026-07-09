// src/api/ccp.ts
import { api } from './client';

export type Money = string;

export type CcpFinancialSummary = {
  currency?: string | null;
  balance?: number | string | null;
  displayBalance?: number | string | null;
  totalBalance?: number | string | null;
  totalEquity?: number | string | null;
  balanceOperational?: number | string | null;
  profitBalance?: number | string | null;
  creditBalance?: number | string | null;
  availableProfit?: number | string | null;
  invested?: number | string | null;
  investmentTotal?: number | string | null;
  profitAccrued?: number | string | null;
  profitAccrualTotal?: number | string | null;
  accountFee?: number | string | null;
  accountWriteOff?: number | string | null;
  withdrawn?: number | string | null;
  transfers?: number | string | null;
  creditLeverage?: number | string | null;
  creditLeverageTotal?: number | string | null;
  manualAdjustments?: number | string | null;
  expectedProfit?: number | string | null;
};

export type CcpAccountFinancial = CcpFinancialSummary & {
  availableProfit?: number | string | null;
  expectedProfitDetails?: any[];
};

export type CcpAccount = {
  id?: string | number | null;
  externalId?: string | null;
  externalAccountId?: string | null;
  wpUserId?: string | number | null;
  externalUserId?: string | number | null;
  number?: string | null;
  currency?: string | null;
  currencySign?: string | null;
  contractSum?: number | string | null;
  depositSum?: number | string | null;
  balance?: number | string | null;
  displayBalance?: number | string | null;
  totalBalance?: number | string | null;
  totalEquity?: number | string | null;
  profit?: number | string | null;
  credit?: number | string | null;
  balanceOperational?: number | string | null;
  profitBalance?: number | string | null;
  creditBalance?: number | string | null;
  status?: string | null;
  createdAt?: string | null;
  financial?: CcpAccountFinancial | null;
};

export type CcpInvestment = {
  transactionId?: string | number | null;
  accountId?: string | number | null;
  assetId?: string | number | null;
  assetName?: string | null;
  assetExcerpt?: string | null;
  assetCategory?: string | null;
  assetCalculation?: string | null;
  assetProfitRate?: number | string | null;
  currency?: string | null;
  currencySign?: string | null;
  invested?: number | string | null;
  expectedProfit?: number | string | null;
  createdAt?: string | null;
};

export type CcpClientMeta = Record<string, any> & {
  accounts?: CcpAccount[];
  financialSummary?: CcpFinancialSummary[];
  investments?: CcpInvestment[];
};

export type CcpSite = {
  id: string;
  tenantId?: string;
  siteUrl?: string;
  siteHost?: string | null;
  wpRestBase?: string;
  wpToken?: string | null;
  isActive?: boolean;
  updatedAt?: string;
  createdAt?: string;
};

export type CcpClient = {
  id: string;
  tenantId?: string;
  siteId: string;
  wpUserId: number;

  email: string;
  name?: string | null;
  phone?: string | null;

  balanceEur: Money;
  balanceUsd: Money;

  accountEur?: string | null;
  accountUsd?: string | null;

  analyticsUrl?: string | null;
  filesList?: string | null;
  tgChatId?: string | null;
  meta?: CcpClientMeta | null;

  investmentStyle?: string | null;
  investmentAnnualPercent?: Money | null;
  creditLeverage?: Money | null;
  creditRepayMonthlyPercent?: Money | null;
  investmentProfitMonthlyPercent?: Money | null;
  accountDebitMonthlyPercent?: Money | null;

  ibanEur?: string | null;
  ibanUsd?: string | null;

  wpUpdatedAt?: string;
  updatedAt?: string;
  createdAt?: string;
};

export type CcpTxn = {
  id: string;
  tenantId?: string;
  siteId: string;
  wpPostId: number;
  title?: string | null;
  status?: string | null;
  wpUserId?: number | null;
  spendEur?: Money | null;
  spendUsd?: Money | null;
  date?: string | null;
  desc?: string | null;
  ccpStatus?: string | null;
  meta?: Record<string, any> | null;
  updatedAt?: string;
  createdAt?: string;
};

export type CcpTransfer = {
  id: string;
  tenantId?: string;
  siteId: string;
  wpPostId: number;
  title?: string | null;
  status?: string | null;
  amount?: Money | null;

  currency?: 'EUR' | 'USD' | string | null;

  fromCurrency?: 'EUR' | 'USD' | string | null;
  toCurrency?: 'EUR' | 'USD' | string | null;
  rate?: Money | null;
  credited?: Money | null;
  desc?: string | null;

  fromUserId?: number | null;
  toUserId?: number | null;
  date?: string | null;

  note?: string | null;

  ccpStatus?: string | null;
  meta?: Record<string, any> | null;
  updatedAt?: string;
  createdAt?: string;
};

export type ApiList<T> = {
  items: T[];
  page: number;
  per: number;
  total: number;
};

export type CcpClientAnalytics = {
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
};

export type CreateCcpTxnDto = {
  wpUserId: number;
  title?: string | null;
  desc?: string | null;
  date?: string | null;        // YYYY-MM-DD
  currency?: 'EUR' | 'USD';    // для UI удобно
  amount?: number | string;    // сумма списания
  status?: string | null;      // "publish" / "draft" если нужно (опционально)
  ccpStatus?: string | null;   // "Done" / "In progress" / ...
};

export type CreateCcpClientDto = {
  email: string;
  name?: string | null;
  password: string;
  balanceEur?: number | string;
  balanceUsd?: number | string;
};

export type CreateCcpTransferDto = {
  fromUserId: number;
  toUserId: number;
  fromCurrency?: 'EUR' | 'USD';
  toCurrency?: 'EUR' | 'USD';
  amount: number | string;
  rate?: number | string;      // по умолчанию 1
  date?: string | null;        // YYYY-MM-DD
  desc?: string | null;        // описание
  ccpStatus?: string | null;   // "In progress" по умолчанию
};

function qs(params: Record<string, any>) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const ccpApi = {
  // GET /ccp/sites
  sites: () => api.get<CcpSite[]>('/ccp/sites'),

  // POST /ccp/sites  (если используешь)
  addSite: (body: { siteUrl: string }) => api.post<CcpSite>('/ccp/sites', body),

  updateSite: (
    id: string,
    body: {
      siteUrl?: string;
      wpRestBase?: string | null;
      wpToken?: string | null;
      isActive?: boolean;
    },
  ) => api.patch<CcpSite>(`/ccp/sites/${encodeURIComponent(id)}`, body),

  deleteSite: (id: string) => api.delete<{ ok: boolean; id: string }>(`/ccp/sites/${encodeURIComponent(id)}`),

  connectSite: (body: { siteId: string; wpRestBase: string; wpToken: string }) =>
    api.post<CcpSite>('/ccp/sites/connect', body),

  // GET /ccp/clients?...
  clients: (params: { siteId?: string; search?: string; page?: number; per?: number; fresh?: 0 | 1 } = {}) =>
    api.get<ApiList<CcpClient>>(`/ccp/clients${qs(params)}`),

  // GET /ccp/clients/:id
  client: (id: string) => api.get<CcpClient>(`/ccp/clients/${encodeURIComponent(id)}`),

  clientAnalytics: (id: string, params: { fresh?: 0 | 1 } = {}) =>
    api.get<CcpClientAnalytics>(`/ccp/clients/${encodeURIComponent(id)}/analytics${qs(params)}`),

  // PATCH /ccp/clients/:id
  updateClient: (id: string, body: any) =>
    api.patch<CcpClient>(`/ccp/clients/${encodeURIComponent(id)}`, body),

  // POST /ccp/clients?siteId=
  createClient: (siteId: string, body: CreateCcpClientDto) =>
    api.post<CcpClient>(`/ccp/clients${qs({ siteId })}`, body),

  // GET /ccp/txns?...
  txns: (params: { siteId: string; wpUserId?: number; page?: number; per?: number; fresh?: 0 | 1 } ) =>
    api.get<ApiList<CcpTxn>>(`/ccp/txns${qs(params)}`),

  // GET /ccp/transfers?...
  transfers: (params: { siteId: string; wpUserId?: number; page?: number; per?: number; fresh?: 0 | 1 }) =>
    api.get<ApiList<CcpTransfer>>(`/ccp/transfers${qs(params)}`),

  // PATCH /ccp/txns/:siteId/:wpPostId
  updateTxn: (siteId: string, wpPostId: number | string, body: any) =>
    api.patch<any>(
      `/ccp/txns/${encodeURIComponent(siteId)}/${encodeURIComponent(String(wpPostId))}`,
      body,
    ),

  // PATCH /ccp/transfers/:siteId/:wpPostId
  updateTransfer: (siteId: string, wpPostId: number | string, body: any) =>
    api.patch<any>(
      `/ccp/transfers/${encodeURIComponent(siteId)}/${encodeURIComponent(String(wpPostId))}`,
      body,
    ),

  // ✅ POST /ccp/txns  (создание операции в WP через CRM backend)
  createTxn: (siteId: string, body: CreateCcpTxnDto) =>
    api.post<CcpTxn>(`/ccp/txns${qs({ siteId })}`, body),

  // ✅ POST /ccp/transfers (создание трансфера в WP через CRM backend)
  createTransfer: (siteId: string, body: CreateCcpTransferDto) =>
    api.post<CcpTransfer>(`/ccp/transfers${qs({ siteId })}`, body),
};
