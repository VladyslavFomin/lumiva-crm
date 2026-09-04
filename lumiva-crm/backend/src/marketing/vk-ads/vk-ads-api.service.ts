import { Injectable } from '@nestjs/common';
import axios from 'axios';

const BASE = 'https://ads.vk.ru/api/v2';

export type VkAdsCredentials = {
  clientId: string;
  clientSecret: string;
};

export type VkAdsCampaignRow = {
  date: string;
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  cost: number;
};

type VkAdsErrorBody = { error_description?: string; error?: string };

/**
 * VK Реклама (ads.vk.ru) API v2 — OAuth2 client_credentials (без пользовательского редиректа,
 * client_id+client_secret сразу дают токен) + ad_plans (кампании) + statistics/ad_plans/day
 * (дневная статистика). Официального Node SDK нет — запросы собираются напрямую по REST.
 * @see https://ads.vk.ru/doc/api/info/Authorization
 */
@Injectable()
export class VkAdsApiService {
  private parseErrorBody(raw: unknown): string | null {
    const body = raw as VkAdsErrorBody | undefined;
    return body?.error_description || body?.error || null;
  }

  private async getAccessToken(creds: VkAdsCredentials): Promise<string> {
    const res = await axios.post(
      `${BASE}/oauth2/token.json`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 20000,
        validateStatus: () => true,
      },
    );
    if (res.status !== 200 || !res.data?.access_token) {
      throw new Error(`VK Реклама: ${this.parseErrorBody(res.data) || `HTTP ${res.status}`}`);
    }
    return res.data.access_token as string;
  }

  async verifyAccess(creds: VkAdsCredentials): Promise<void> {
    const token = await this.getAccessToken(creds);
    const res = await axios.get(`${BASE}/ad_plans.json`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { limit: 1, offset: 0 },
      timeout: 20000,
      validateStatus: () => true,
    });
    if (res.status !== 200) {
      throw new Error(`VK Реклама: ${this.parseErrorBody(res.data) || `HTTP ${res.status}`}`);
    }
  }

  private async listCampaigns(
    token: string,
  ): Promise<Array<{ id: string; name: string }>> {
    const out: Array<{ id: string; name: string }> = [];
    let offset = 0;
    const limit = 50;
    const maxPages = 40; // до 2000 кампаний — разумный потолок для v1
    for (let page = 0; page < maxPages; page++) {
      const res = await axios.get(`${BASE}/ad_plans.json`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit, offset, fields: 'id,name' },
        timeout: 30000,
        validateStatus: () => true,
      });
      if (res.status !== 200) {
        throw new Error(`VK Реклама: ${this.parseErrorBody(res.data) || `HTTP ${res.status}`}`);
      }
      const items = (res.data?.items ?? []) as Array<{ id: number | string; name?: string }>;
      for (const it of items) {
        out.push({ id: String(it.id), name: it.name?.trim() || `Campaign ${it.id}` });
      }
      if (items.length < limit) break;
      offset += limit;
    }
    return out;
  }

  async fetchCampaignReport(
    creds: VkAdsCredentials,
    dateFrom: string,
    dateTo: string,
  ): Promise<VkAdsCampaignRow[]> {
    const token = await this.getAccessToken(creds);
    const campaigns = await this.listCampaigns(token);
    if (!campaigns.length) return [];

    const nameById = new Map(campaigns.map((c) => [c.id, c.name]));
    const rows: VkAdsCampaignRow[] = [];
    const chunkSize = 200;
    for (let i = 0; i < campaigns.length; i += chunkSize) {
      const chunk = campaigns.slice(i, i + chunkSize);
      const res = await axios.get(`${BASE}/statistics/ad_plans/day.json`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          id: chunk.map((c) => c.id).join(','),
          date_from: dateFrom,
          date_to: dateTo,
          metrics: 'base',
        },
        timeout: 60000,
        validateStatus: () => true,
      });
      if (res.status !== 200) {
        throw new Error(`VK Реклама: ${this.parseErrorBody(res.data) || `HTTP ${res.status}`}`);
      }
      const items = (res.data?.items ?? []) as Array<{
        id: number | string;
        rows?: Array<{ date: string; base?: { spent?: string | number; shows?: number; clicks?: number } }>;
      }>;
      for (const item of items) {
        const campaignId = String(item.id);
        const campaignName = nameById.get(campaignId) || `Campaign ${campaignId}`;
        for (const row of item.rows ?? []) {
          if (!row.date) continue;
          rows.push({
            date: row.date,
            campaignId,
            campaignName,
            impressions: Number(row.base?.shows ?? 0) || 0,
            clicks: Number(row.base?.clicks ?? 0) || 0,
            cost: parseFloat(String(row.base?.spent ?? 0)) || 0,
          });
        }
      }
    }
    return rows;
  }
}
