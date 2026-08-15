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
    createdAt: p.createdAt.toISOString(),
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
  };
}
