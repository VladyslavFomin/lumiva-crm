// src/modules/ccp/ccp.wp-client.ts
import { BadRequestException } from '@nestjs/common';

type Json = any;

export class CcpWpClient {
  constructor(
    private readonly base: string,
    private readonly token: string,
  ) {}

  private cleanBase() {
    const b = String(this.base || '').trim().replace(/\/+$/, '');
    if (!b) throw new BadRequestException('WP base URL is empty');
    return b;
  }

  private url(path: string) {
    const p = String(path || '').trim();
    const base = this.cleanBase();
    if (!p.startsWith('/')) return `${base}/${p}`;
    return `${base}${p}`;
  }

  private headers(extra?: Record<string, string>) {
    const t = String(this.token || '').trim();
    if (!t) throw new BadRequestException('WP token is empty');

    return {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-CCP-Token': t,
      ...extra,
    };
  }

  private async parse(res: Response) {
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private async request(method: string, path: string, body?: any): Promise<Json> {
    const res = await fetch(this.url(path), {
      method,
      headers: this.headers(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const data = await this.parse(res);

    if (!res.ok) {
      // отдаём максимально понятную ошибку
      const msg =
        typeof data === 'string'
          ? data
          : (data?.message || data?.error || `WP request failed (${res.status})`);
      throw new BadRequestException(`WP ${method} ${path} -> ${res.status}: ${msg}`);
    }

    return data;
  }

  get(path: string): Promise<Json> {
    return this.request('GET', path);
  }

  put(path: string, body: any): Promise<Json> {
    return this.request('PUT', path, body);
  }

  post(path: string, body: any): Promise<Json> {
    return this.request('POST', path, body);
  }

  /**
   * ✅ Вариант 1 (боевой): починить wpUserId по email
   * Требует WP endpoint: GET /users/resolve?email=...
   */
  async resolveWpUserIdByEmail(email: string): Promise<number | null> {
    const e = String(email || '').trim().toLowerCase();
    if (!e) return null;

    const res = await fetch(this.url(`/users/resolve?email=${encodeURIComponent(e)}`), {
      method: 'GET',
      headers: this.headers({ 'Accept': 'application/json' }),
    });

    const data = await this.parse(res);
    if (!res.ok) return null;

    if (data?.found === true) {
      const id = Number(data?.id);
      return Number.isFinite(id) && id > 0 ? id : null;
    }

    // допускаем формат: { id: 123 } тоже
    const id = Number(data?.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  }
}