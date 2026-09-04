import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import axios from 'axios';

const API_BASE = 'https://api.yookassa.ru/v3';

export type YookassaCredentials = {
  shopId: string;
  secretKey: string;
};

export type YookassaPayment = {
  id: string;
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';
  paid: boolean;
  amount: { value: string; currency: string };
  confirmation?: { type: string; confirmation_url?: string };
  description?: string;
  metadata?: Record<string, string>;
};

/**
 * ЮKassa (бывш. Яндекс.Касса) — Payment API v3, редирект-оплата (confirmation.type = redirect).
 * Официального Node SDK у ЮKassa нет — REST достаточно прост (Basic Auth + Idempotence-Key),
 * запросы собираются напрямую.
 * @see https://yookassa.ru/developers/api
 */
@Injectable()
export class YookassaApiService {
  private auth(creds: YookassaCredentials) {
    return { username: creds.shopId, password: creds.secretKey };
  }

  async createPayment(
    creds: YookassaCredentials,
    params: {
      amount: number;
      currency: string;
      description: string;
      returnUrl: string;
      metadata?: Record<string, string>;
    },
  ): Promise<YookassaPayment> {
    const res = await axios.post(
      `${API_BASE}/payments`,
      {
        amount: { value: params.amount.toFixed(2), currency: params.currency },
        confirmation: { type: 'redirect', return_url: params.returnUrl },
        capture: true,
        description: params.description.slice(0, 128),
        metadata: params.metadata,
      },
      {
        auth: this.auth(creds),
        headers: {
          'Content-Type': 'application/json',
          'Idempotence-Key': randomUUID(),
        },
        timeout: 20000,
        validateStatus: () => true,
      },
    );
    if (res.status >= 300) {
      const msg = res.data?.description || res.data?.type || JSON.stringify(res.data).slice(0, 300);
      throw new Error(`ЮKassa: ${msg}`);
    }
    return res.data as YookassaPayment;
  }

  /**
   * Никогда не доверяем телу вебхука напрямую (у ЮKassa нет встроенной подписи по умолчанию) —
   * перезапрашиваем актуальный статус платежа по его id, как рекомендует сама ЮKassa.
   */
  async getPayment(creds: YookassaCredentials, paymentId: string): Promise<YookassaPayment> {
    const res = await axios.get(`${API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
      auth: this.auth(creds),
      timeout: 20000,
      validateStatus: () => true,
    });
    if (res.status >= 300) {
      throw new Error(`ЮKassa: не удалось получить статус платежа (HTTP ${res.status})`);
    }
    return res.data as YookassaPayment;
  }

  /** Проверка credentials: список платежей (1 запись) — операция только на чтение. */
  async verifyAccess(creds: YookassaCredentials): Promise<void> {
    const res = await axios.get(`${API_BASE}/payments`, {
      auth: this.auth(creds),
      params: { limit: 1 },
      timeout: 20000,
      validateStatus: () => true,
    });
    if (res.status >= 300) {
      const msg = res.data?.description || res.data?.type || `HTTP ${res.status}`;
      throw new Error(`ЮKassa: ${msg}`);
    }
  }
}
