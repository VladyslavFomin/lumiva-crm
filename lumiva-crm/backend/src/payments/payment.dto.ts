import type { Payment } from './payment.entity';

export type PaymentDto = {
  id: string;
  provider: string;
  status: string;
  amount: number;
  currency: string;
  saleId: string | null;
  source: string;
  paymentPageUrl: string | null;
  failReason: string | null;
  createdAt: string;
  paidAt: string | null;
};

export function toPaymentDto(p: Payment): PaymentDto {
  return {
    id: p.id,
    provider: p.provider,
    status: p.status,
    amount: p.amount,
    currency: p.currency,
    saleId: p.saleId,
    source: p.source,
    paymentPageUrl: p.paymentPageUrl,
    failReason: p.failReason,
    createdAt: p.createdAt.toISOString(),
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
  };
}

export type PaymentListItemDto = PaymentDto & {
  saleOrderNo: string | null;
  buyerName: string | null;
};

export type PaymentsAnalyticsDto = {
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
