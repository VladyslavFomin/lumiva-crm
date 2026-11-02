import type { HotelEInvoiceDocType, HotelEInvoiceLine, HotelEInvoiceRecipient, HotelEInvoiceSettings } from './hotel-einvoice.entities';

/** Доступы к кабинету интегратора (расшифрованные) и сохранённый токен */
export interface EInvoiceCredentials {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  companyId: string;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
}

/** Новый токен — сервис сохранит его в подключении зашифрованным */
export interface EInvoiceTokenUpdate {
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date;
}

export interface EInvoiceIssueInput {
  issueDate: string;
  currency: string;
  exchangeRate: number | null;
  recipient: HotelEInvoiceRecipient;
  lines: HotelEInvoiceLine[];
  description: string;
  note: string | null;
  settings: HotelEInvoiceSettings;
}

export interface EInvoiceIssueResult {
  externalInvoiceId: string;
  docType: HotelEInvoiceDocType;
  jobId: string | null;
  /** настройки, которые адаптер дополнил (например id услуги «Konaklama») */
  settings?: Partial<HotelEInvoiceSettings>;
}

export type EInvoiceJobState = { state: 'running' } | { state: 'done'; docId: string | null; invoiceNo: string | null } | { state: 'error'; error: string };

/** Ошибка интегратора с понятным текстом для пользователя */
export class EInvoiceProviderError extends Error {
  constructor(message: string, readonly code = 'HOTEL_EINVOICE_PROVIDER', readonly status?: number) {
    super(message);
  }
}

/**
 * Адаптер интегратора e-Fatura. Общий слой (HotelEInvoiceService) строит счёт из фолио и хранит документы,
 * адаптер только переводит его в API конкретного интегратора. onToken вызывается, когда токен обновился.
 */
export interface EInvoiceProviderAdapter {
  testConnection(c: EInvoiceCredentials, onToken: (t: EInvoiceTokenUpdate) => Promise<void>): Promise<{ companyName: string | null }>;
  /** e-Fatura получателя: адрес «posta kutusu», если номер подключён к e-Fatura, иначе null (тогда e-Arşiv) */
  lookupInbox(c: EInvoiceCredentials, onToken: (t: EInvoiceTokenUpdate) => Promise<void>, taxNumber: string): Promise<string | null>;
  issue(c: EInvoiceCredentials, onToken: (t: EInvoiceTokenUpdate) => Promise<void>, input: EInvoiceIssueInput): Promise<EInvoiceIssueResult>;
  poll(c: EInvoiceCredentials, onToken: (t: EInvoiceTokenUpdate) => Promise<void>, externalInvoiceId: string, jobId: string | null): Promise<EInvoiceJobState>;
  pdfUrl(c: EInvoiceCredentials, onToken: (t: EInvoiceTokenUpdate) => Promise<void>, docType: HotelEInvoiceDocType, docId: string): Promise<string | null>;
  cancel(c: EInvoiceCredentials, onToken: (t: EInvoiceTokenUpdate) => Promise<void>, externalInvoiceId: string): Promise<void>;
}
