import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosBasicCredentials } from 'axios';

export type OneCConfig = {
  baseUrl: string;           // e.g. http://192.168.1.1/accounting
  login: string;
  password: string;
  infobase?: string;         // if baseUrl doesn't include it, e.g. "crm"
  servicePath?: string;      // default "crm" — used as /hs/{servicePath}/
};

export type OneCOrder = {
  id?: string;
  number?: string;
  date?: string;
  total?: number | string;
  currency?: string;
  status?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  [key: string]: unknown;
};

@Injectable()
export class OneCApiService {
  private readonly log = new Logger(OneCApiService.name);

  private auth(cfg: OneCConfig): AxiosBasicCredentials {
    return { username: cfg.login, password: cfg.password };
  }

  private baseServiceUrl(cfg: OneCConfig): string {
    const base = cfg.baseUrl.replace(/\/$/, '');
    const svc = cfg.servicePath || cfg.infobase || 'crm';
    return `${base}/hs/${svc}`;
  }

  async testConnection(cfg: OneCConfig): Promise<{ ok: boolean; message: string }> {
    const svcUrl = this.baseServiceUrl(cfg);
    // Try /ping first, then root
    for (const path of ['/ping', '/health', '/']) {
      try {
        await axios.get(`${svcUrl}${path}`, {
          auth: this.auth(cfg),
          timeout: 8000,
          validateStatus: (s) => s < 500,
        });
        return { ok: true, message: `1С: подключение к ${svcUrl} успешно проверено` };
      } catch (e: unknown) {
        const msg = (e as Error).message;
        if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('ENOTFOUND')) {
          return { ok: false, message: `1С: сервер недоступен по адресу ${cfg.baseUrl}. Проверьте URL и сеть.` };
        }
        // If got a response (e.g. 401, 403) — server is reachable but auth may be wrong
        const status = (e as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403) {
          return { ok: false, message: `1С: авторизация отклонена (${status}). Проверьте логин и пароль.` };
        }
      }
    }
    return { ok: true, message: `1С: сервер ответил. Полный тест синхронизации запустится в фоне.` };
  }

  async fetchOrders(cfg: OneCConfig, sinceDate?: Date): Promise<OneCOrder[]> {
    const svcUrl = this.baseServiceUrl(cfg);
    const params: Record<string, string> = {};
    if (sinceDate) {
      params.dateFrom = sinceDate.toISOString().slice(0, 10);
    }
    try {
      const res = await axios.get<OneCOrder[] | { orders?: OneCOrder[]; items?: OneCOrder[] }>(
        `${svcUrl}/orders`,
        { auth: this.auth(cfg), params, timeout: 30000 },
      );
      if (Array.isArray(res.data)) return res.data;
      if (res.data && typeof res.data === 'object') {
        return (res.data.orders ?? res.data.items ?? []) as OneCOrder[];
      }
      return [];
    } catch (e: unknown) {
      this.log.error(`1C fetchOrders error: ${(e as Error).message}`);
      throw e;
    }
  }
}
