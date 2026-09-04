// src/api/payments.ts
import { api } from './client';

export type PaymentProvider = 'iyzico' | 'paytr' | 'yookassa';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled';

export type PaymentDto = {
  id: string;
  provider: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  saleId: string | null;
  source: string;
  paymentPageUrl: string | null;
  failReason: string | null;
  createdAt: string;
  paidAt: string | null;
};

export type PaymentListItemDto = PaymentDto & {
  saleOrderNo: string | null;
  buyerName: string | null;
};

export type PaymentsAnalytics = {
  totalCount: number;
  paidCount: number;
  failedCount: number;
  pendingCount: number;
  successRate: number;
  byProvider: Array<{
    provider: string;
    totalCount: number;
    paidCount: number;
    failedCount: number;
    successRate: number;
  }>;
  byCurrency: Array<{ currency: string; paidAmount: number; paidCount: number }>;
  dailySeries: Array<{ date: string; created: number; paid: number; failed: number }>;
  recentFailures: Array<{
    id: string;
    provider: string;
    amount: number;
    currency: string;
    failReason: string | null;
    createdAt: string;
  }>;
};

export type CreateSalePaymentLinkPayload = {
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  city: string;
  address: string;
  provider?: PaymentProvider;
};

export async function createSalePaymentLink(
  saleId: string,
  payload: CreateSalePaymentLinkPayload,
): Promise<PaymentDto> {
  return api.post<PaymentDto>(`/payments/sales/${saleId}/link`, payload);
}

export async function getPayment(id: string): Promise<PaymentDto> {
  return api.get<PaymentDto>(`/payments/${id}`);
}

export async function listPayments(params?: {
  status?: string;
  provider?: string;
  source?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: PaymentListItemDto[]; total: number }> {
  return api.get<{ items: PaymentListItemDto[]; total: number }>('/payments', { params });
}

export async function fetchPaymentsAnalytics(days = 30): Promise<PaymentsAnalytics> {
  return api.get<PaymentsAnalytics>('/payments/analytics', { params: { days } });
}
