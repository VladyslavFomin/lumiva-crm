import { Injectable } from '@nestjs/common';
import axios from 'axios';

/**
 * Битрикс24 — вызов метода REST через входящий вебхук.
 * Базовый URL вида: https://&lt;портал&gt;.bitrix24.ru/rest/1/&lt;код&gt;/
 * @see https://apidocs.bitrix24.ru/rest_help/
 */
@Injectable()
export class BitrixRestService {
  normalizeWebhookBase(url: string): string {
    let u = url.trim();
    if (!u.endsWith('/')) u += '/';
    return u;
  }

  private validateBaseUrl(url: string): void {
    const u = url.trim().toLowerCase();
    if (!u.startsWith('https://')) {
      throw new Error('Битрикс24: вебхук должен быть по HTTPS');
    }
    if (!u.includes('/rest/')) {
      throw new Error('Битрикс24: ожидается URL входящего вебхука (…/rest/1/…/)');
    }
  }

  private assertNoBitrixError(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const d = data as Record<string, unknown>;
    const err = d.error;
    if (err !== undefined && err !== '' && err !== null && err !== false) {
      const desc =
        typeof d.error_description === 'string' ? d.error_description : '';
      throw new Error(`Битрикс24: ${String(err)} ${desc}`.trim());
    }
  }

  async callMethod(
    webhookBaseUrl: string,
    method: string,
    payload: Record<string, unknown>,
  ): Promise<unknown> {
    this.validateBaseUrl(webhookBaseUrl);
    const base = this.normalizeWebhookBase(webhookBaseUrl);
    const m = method.trim().replace(/^\//, '');
    if (!m || !/^[\w.]+$/.test(m)) {
      throw new Error(
        'Битрикс24: укажите корректное имя метода REST (например crm.lead.add, user.current)',
      );
    }
    const url = `${base}${m}`;
    const res = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
      validateStatus: () => true,
    });
    const data = res.data;
    if (res.status !== 200) {
      const detail =
        typeof data === 'object' && data !== null
          ? JSON.stringify(data)
          : String(data ?? '');
      throw new Error(`Битрикс24: HTTP ${res.status} ${detail}`.slice(0, 500));
    }
    this.assertNoBitrixError(data);
    return data;
  }
}
