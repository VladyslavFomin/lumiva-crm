// src/api/payments.ts
import { api } from './client';

export type PaymentDto = {
  id: string;
  provider: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  amount: number;
  currency: string;
  saleId: string | null;
  source: string;
  paymentPageUrl: string | null;
  createdAt: string;
  paidAt: string | null;
};

export type CreateSalePaymentLinkPayload = {
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  city: string;
  address: string;
  provider?: 'iyzico' | 'paytr';
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
