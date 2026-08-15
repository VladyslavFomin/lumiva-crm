import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import axios from 'axios';

const GET_TOKEN_URL = 'https://www.paytr.com/odeme/api/get-token';

export type PaytrCredentials = {
  merchantId: string;
  merchantKey: string;
  merchantSalt: string;
  testMode: boolean;
};

export type PaytrBasketItem = { name: string; price: string; qty: number };

export type PaytrGetTokenResult = {
  status: string;
  token?: string;
  reason?: string;
};

/**
 * PayTR — оплата через iFrame (Direct API): merchant_oid + подпись HMAC-SHA256(merchant_key,
 * hash_str + merchant_salt). Официального Node SDK у PayTR нет (только сторонние пакеты с
 * недостаточным сопровождением) — запросы собираются напрямую по документированному алгоритму.
 * @see https://dev.paytr.com/iframe-api
 */
@Injectable()
export class PaytrApiService {
  private computeGetTokenHash(
    creds: PaytrCredentials,
    parts: {
      userIp: string;
      merchantOid: string;
      email: string;
      paymentAmount: number;
      userBasketB64: string;
      noInstallment: 0 | 1;
      maxInstallment: number;
      currency: string;
      testMode: 0 | 1;
    },
  ): string {
    const hashStr =
      `${creds.merchantId}${parts.userIp}${parts.merchantOid}${parts.email}` +
      `${parts.paymentAmount}${parts.userBasketB64}${parts.noInstallment}` +
      `${parts.maxInstallment}${parts.currency}${parts.testMode}`;
    return crypto
      .createHmac('sha256', creds.merchantKey)
      .update(hashStr + creds.merchantSalt)
      .digest('base64');
  }

  private currencyCode(c: string): 'TL' | 'USD' | 'EUR' | 'GBP' {
    const u = c.toUpperCase();
    if (u === 'TRY' || u === 'TL') return 'TL';
    if (u === 'USD' || u === 'EUR' || u === 'GBP') return u;
    return 'TL';
  }

  async getToken(
    creds: PaytrCredentials,
    params: {
      userIp: string;
      merchantOid: string;
      email: string;
      /** Сумма в валюте (не в куруш) — например 25.5 */
      amount: number;
      currency: string;
      userName: string;
      userAddress: string;
      userPhone: string;
      basket: PaytrBasketItem[];
      okUrl: string;
      failUrl: string;
      lang?: 'tr' | 'en';
    },
  ): Promise<PaytrGetTokenResult> {
    const currency = this.currencyCode(params.currency);
    const paymentAmountKurus = Math.round(params.amount * 100);
    const userBasketB64 = Buffer.from(
      JSON.stringify(params.basket.map((b) => [b.name, b.price, b.qty])),
      'utf8',
    ).toString('base64');
    const noInstallment: 0 | 1 = 0;
    const maxInstallment = 0;
    const testMode: 0 | 1 = creds.testMode ? 1 : 0;

    const token = this.computeGetTokenHash(creds, {
      userIp: params.userIp,
      merchantOid: params.merchantOid,
      email: params.email,
      paymentAmount: paymentAmountKurus,
      userBasketB64,
      noInstallment,
      maxInstallment,
      currency,
      testMode,
    });

    const form = new URLSearchParams({
      merchant_id: creds.merchantId,
      user_ip: params.userIp,
      merchant_oid: params.merchantOid,
      email: params.email,
      payment_amount: String(paymentAmountKurus),
      paytr_token: token,
      user_basket: userBasketB64,
      debug_on: '0',
      no_installment: String(noInstallment),
      max_installment: String(maxInstallment),
      user_name: params.userName,
      user_address: params.userAddress,
      user_phone: params.userPhone,
      merchant_ok_url: params.okUrl,
      merchant_fail_url: params.failUrl,
      timeout_limit: '30',
      currency,
      test_mode: String(testMode),
      lang: params.lang || 'tr',
    });

    const res = await axios.post(GET_TOKEN_URL, form.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 20000,
      validateStatus: () => true,
    });
    if (res.status !== 200 || typeof res.data !== 'object') {
      throw new Error(`PayTR: HTTP ${res.status} — ${JSON.stringify(res.data).slice(0, 300)}`);
    }
    return res.data as PaytrGetTokenResult;
  }

  paymentPageUrl(token: string): string {
    return `https://www.paytr.com/odeme/guvenli/${token}`;
  }

  /** Проверка credentials: создаёт короткоживущий (неиспользуемый) токен сессии — оплата не проходит, деньги не двигаются. */
  async verifyAccess(creds: PaytrCredentials): Promise<void> {
    const result = await this.getToken(creds, {
      userIp: '127.0.0.1',
      merchantOid: `verify${Date.now()}`,
      email: 'verify@lumiva.agency',
      amount: 1,
      currency: 'TRY',
      userName: 'Verify Test',
      userAddress: 'Test',
      userPhone: '05000000000',
      basket: [{ name: 'Verify', price: '1.00', qty: 1 }],
      okUrl: 'https://lumiva.agency/pay/result?status=paid',
      failUrl: 'https://lumiva.agency/pay/result?status=failed',
    });
    if (result.status !== 'success') {
      throw new Error(`PayTR: ${result.reason || 'ошибка авторизации'}`);
    }
  }

  verifyNotificationHash(
    creds: PaytrCredentials,
    body: { merchant_oid: string; status: string; total_amount: string; hash: string },
  ): boolean {
    const hashStr = `${body.merchant_oid}${creds.merchantSalt}${body.status}${body.total_amount}`;
    const expected = crypto.createHmac('sha256', creds.merchantKey).update(hashStr).digest('base64');
    const a = Buffer.from(expected);
    const b = Buffer.from(body.hash || '');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
}
