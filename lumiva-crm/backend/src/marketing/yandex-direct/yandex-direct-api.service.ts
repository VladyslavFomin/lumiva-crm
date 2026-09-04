import { Injectable } from '@nestjs/common';
import axios from 'axios';

const REPORTS_URL = 'https://api.direct.yandex.com/json/v5/reports';
const CAMPAIGNS_URL = 'https://api.direct.yandex.com/json/v5/campaigns';

export type YandexDirectCredentials = {
  token: string;
  /** Логин клиента для агентских OAuth-токенов — не нужен для обычного рекламодателя */
  clientLogin?: string;
};

export type YandexDirectCampaignRow = {
  date: string;
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  cost: number;
};

type YandexDirectErrorBody = {
  error?: { error_string?: string; error_detail?: string; error_code?: number };
};

/**
 * Яндекс.Директ API v5 — Campaigns (лёгкая проверка доступа) и Reports (асинхронная выгрузка
 * статистики: запрос → ждём готовности отчёта по заголовку Retry-In → скачиваем TSV).
 * Официального Node SDK у API v5 нет (только устаревшие пакеты под API v4) — запросы собираются
 * напрямую по документированному REST-протоколу.
 * @see https://yandex.ru/dev/direct/doc/reports/
 */
@Injectable()
export class YandexDirectApiService {
  private headers(creds: YandexDirectCredentials): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${creds.token}`,
      'Accept-Language': 'ru',
    };
    if (creds.clientLogin?.trim()) h['Client-Login'] = creds.clientLogin.trim();
    return h;
  }

  private parseErrorBody(raw: unknown): string | null {
    try {
      const parsed = (typeof raw === 'string' ? JSON.parse(raw) : raw) as YandexDirectErrorBody;
      return parsed?.error?.error_string || parsed?.error?.error_detail || null;
    } catch {
      return null;
    }
  }

  /** Лёгкая проверка credentials — список кампаний, 1 запись, минимум полей. */
  async verifyAccess(creds: YandexDirectCredentials): Promise<void> {
    const res = await axios.post(
      CAMPAIGNS_URL,
      { method: 'get', params: { SelectionCriteria: {}, FieldNames: ['Id', 'Name'], Page: { Limit: 1 } } },
      {
        headers: { ...this.headers(creds), 'Content-Type': 'application/json; charset=utf-8' },
        timeout: 20000,
        validateStatus: () => true,
      },
    );
    if (res.status !== 200 || res.data?.error) {
      const msg = res.data?.error?.error_string || res.data?.error?.error_detail || `HTTP ${res.status}`;
      throw new Error(`Яндекс.Директ: ${msg}`);
    }
  }

  /**
   * CAMPAIGN_PERFORMANCE_REPORT за диапазон дат (включительно), с поллингом до готовности.
   * returnMoneyInMicros=false — API сразу отдаёт Cost в валюте аккаунта, без ручного деления.
   */
  async fetchCampaignReport(
    creds: YandexDirectCredentials,
    dateFrom: string,
    dateTo: string,
  ): Promise<YandexDirectCampaignRow[]> {
    const body = {
      params: {
        SelectionCriteria: { DateFrom: dateFrom, DateTo: dateTo },
        FieldNames: ['Date', 'CampaignId', 'CampaignName', 'Impressions', 'Clicks', 'Cost'],
        ReportName: `lumiva-crm-sync-${Date.now()}`,
        ReportType: 'CAMPAIGN_PERFORMANCE_REPORT',
        DateRangeType: 'CUSTOM_DATE',
        Format: 'TSV',
        IncludeVAT: 'YES',
        IncludeDiscount: 'NO',
      },
    };
    const headers: Record<string, string> = {
      ...this.headers(creds),
      'Content-Type': 'application/json; charset=utf-8',
      processingMode: 'auto',
      returnMoneyInMicros: 'false',
      skipReportHeader: 'true',
      skipReportSummary: 'true',
    };

    const maxAttempts = 20;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res = await axios.post<string>(REPORTS_URL, body, {
        headers,
        timeout: 60000,
        responseType: 'text',
        validateStatus: () => true,
        transformResponse: [(d: string) => d],
      });

      if (res.status === 200) {
        return this.parseTsv(res.data);
      }
      if (res.status === 201 || res.status === 202) {
        const retryHeader = res.headers['retryin'] ?? res.headers['Retry-In'] ?? 5;
        const retrySec = Math.min(Math.max(Number(retryHeader) || 5, 1), 30);
        await new Promise((r) => setTimeout(r, retrySec * 1000));
        continue;
      }
      const msg = this.parseErrorBody(res.data) || `HTTP ${res.status}`;
      throw new Error(`Яндекс.Директ: ${msg}`);
    }
    throw new Error('Яндекс.Директ: отчёт не был готов за отведённое время — повторите синхронизацию позже');
  }

  private parseTsv(tsv: string): YandexDirectCampaignRow[] {
    const lines = tsv.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const rows: YandexDirectCampaignRow[] = [];
    for (const line of lines) {
      const cols = line.split('\t');
      if (cols.length < 6) continue;
      const [date, campaignId, campaignName, impressions, clicks, cost] = cols;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      rows.push({
        date,
        campaignId: campaignId.trim(),
        campaignName: campaignName.trim() || `Campaign ${campaignId.trim()}`,
        impressions: parseInt(impressions, 10) || 0,
        clicks: parseInt(clicks, 10) || 0,
        cost: parseFloat(cost) || 0,
      });
    }
    return rows;
  }
}
