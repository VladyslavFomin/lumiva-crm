import { api } from './client';

export type PaymentProvider = 'iyzico' | 'paytr' | 'yookassa';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled';
export type PaymentSource = 'sale_link' | 'storefront';

export interface Payment {
  id: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: number;
  currency: string;
  saleId: string | null;
  source: PaymentSource;
  paymentPageUrl: string | null;
  failReason: string | null;
  createdAt: string;
  paidAt: string | null;
  saleOrderNo: string | null;
  buyerName: string | null;
}

export interface PaymentsAnalytics {
  totalCount: number;
  paidCount: number;
  failedCount: number;
  pendingCount: number;
  successRate: number;
  byProvider: Array<{ provider: string; totalCount: number; paidCount: number; failedCount: number; successRate: number }>;
  byCurrency: Array<{ currency: string; paidAmount: number; paidCount: number }>;
  dailySeries: Array<{ date: string; created: number; paid: number; failed: number }>;
  recentFailures: Array<{ id: string; provider: string; amount: number; currency: string; failReason: string | null; createdAt: string }>;
}

export interface PaymentFilters {
  status?: PaymentStatus;
  provider?: PaymentProvider;
  source?: PaymentSource;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function fetchPayments(filters: PaymentFilters = {}): Promise<{ items: Payment[]; total: number }> {
  const res = await api.get<{ items: Payment[]; total: number }>('/payments', { params: filters });
  return res.data;
}

export async function fetchPayment(id: string): Promise<Payment> {
  const res = await api.get<Payment>(`/payments/${id}`);
  return res.data;
}

export async function fetchPaymentsAnalytics(days?: number): Promise<PaymentsAnalytics> {
  const res = await api.get<PaymentsAnalytics>('/payments/analytics', { params: days ? { days } : undefined });
  return res.data;
}
