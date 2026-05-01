import { Injectable } from '@nestjs/common';
import axios, { type Method } from 'axios';

const GRAPH_VER = process.env.META_ADS_GRAPH_API_VERSION || 'v21.0';

/**
 * Meta Marketing API через Graph (access token).
 * @see https://developers.facebook.com/docs/marketing-apis
 */
@Injectable()
export class MetaAdsGraphService {
  private graphRoot(): string {
    return `https://graph.facebook.com/${GRAPH_VER}`;
  }

  async verifyAccess(accessToken: string): Promise<void> {
    await this.request({
      accessToken,
      method: 'GET',
      path: 'me',
      body: undefined,
    });
  }

  async request(params: {
    accessToken: string;
    method: string;
    /** Например me/adaccounts или act_123/campaigns */
    path: string;
    body?: unknown;
  }): Promise<unknown> {
    const tok = params.accessToken.trim();
    if (!tok) throw new Error('Meta Ads: пустой access token');
    let p = params.path.trim().replace(/^\/+/, '');
    if (!p) throw new Error('Meta Ads: укажите path (например me/adaccounts)');
    const url = `${this.graphRoot()}/${p}`;
    const upper = String(params.method || 'GET').trim().toUpperCase();
    if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(upper)) {
      throw new Error(`Meta Ads: недопустимый HTTP-метод ${upper}`);
    }
    const method = upper as Method;
    const isGet = method === 'GET' || method === 'HEAD';
    const res = await axios.request({
      url,
      method,
      params: { access_token: tok },
      data: !isGet && params.body !== undefined ? params.body : undefined,
      headers: !isGet ? { 'Content-Type': 'application/json' } : {},
      timeout: 45000,
      validateStatus: () => true,
    });
    const data = res.data;
    if (res.status < 200 || res.status >= 300) {
      const detail =
        typeof data === 'object' && data !== null
          ? JSON.stringify(data)
          : String(data ?? '');
      throw new Error(`Meta Graph: HTTP ${res.status} ${detail}`.slice(0, 600));
    }
    if (data && typeof data === 'object' && 'error' in (data as object)) {
      const err = (data as { error?: { message?: string; type?: string } }).error;
      if (err && typeof err === 'object' && (err.message || err.type)) {
        throw new Error(`Meta Graph: ${err.type || 'error'} ${err.message || ''}`.trim());
      }
    }
    return data;
  }

  /**
   * Дневные insights по кампаниям для импорта в рабочую область (превью / синк).
   */
  async fetchCampaignInsightsDaily(
    accessToken: string,
    actPath: string,
    opts?: { limit?: number; maxPages?: number },
  ): Promise<Array<Record<string, unknown>>> {
    const raw = actPath.replace(/^\/+/, '').trim();
    const base = raw.startsWith('act_') ? raw : `act_${raw.replace(/^act_/i, '')}`;
    const limit = Math.min(Math.max(1, opts?.limit ?? 100), 500);
    const maxPages = Math.min(Math.max(1, opts?.maxPages ?? 10), 50);
    const fields =
      'impressions,clicks,spend,date_start,campaign_name,campaign_id';
    const out: Array<Record<string, unknown>> = [];
    let nextUrl: string | null = null;

    for (let page = 0; page < maxPages; page++) {
      const isFirst = page === 0;
      const res = await axios.get(
        isFirst ? `${this.graphRoot()}/${base}/insights` : (nextUrl as string),
        {
          params: isFirst
            ? {
                fields,
                level: 'campaign',
                time_increment: 1,
                date_preset: 'last_30d',
                limit,
                access_token: accessToken.trim(),
              }
            : undefined,
          timeout: 60000,
          validateStatus: () => true,
        },
      );
      const body = res.data as {
        data?: unknown[];
        paging?: { next?: string };
        error?: { message?: string };
      };
      if (res.status < 200 || res.status >= 300) {
        const msg =
          body?.error?.message ||
          (typeof res.data === 'object' ? JSON.stringify(res.data).slice(0, 300) : String(res.data));
        throw new Error(`Meta Ads insights: HTTP ${res.status} ${msg}`);
      }
      if (body?.error?.message) {
        throw new Error(`Meta Ads insights: ${body.error.message}`);
      }
      const chunk = Array.isArray(body?.data) ? body.data : [];
      for (const row of chunk) {
        if (row && typeof row === 'object') {
          out.push(row as Record<string, unknown>);
        }
      }
      nextUrl = body?.paging?.next || null;
      if (!nextUrl) break;
    }
    return out;
  }
}
