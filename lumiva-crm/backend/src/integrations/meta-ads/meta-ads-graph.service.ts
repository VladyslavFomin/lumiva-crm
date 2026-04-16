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
}
