import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

export type MailchimpMemberStatus = 'subscribed' | 'pending';

@Injectable()
export class MailchimpApiService {
  /**
   * Mailchimp ожидает строки в merge_fields; числа/булевы из JSON приводим к строке.
   * Вложенные объекты и массивы пропускаем.
   */
  normalizeMergeFields(raw: unknown): Record<string, string> {
    if (raw == null) return {};
    if (typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(
        'Mailchimp: merge_fields должны быть JSON-объектом с парами тег → значение',
      );
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const key = String(k).trim();
      if (!key) continue;
      if (v === undefined || v === null) continue;
      if (typeof v === 'object') continue;
      out[key] = typeof v === 'string' ? v : String(v);
    }
    return out;
  }

  /**
   * OAuth-подключения хранятся как синтетический "apiKey" вида `oauth:<accessToken>:<dc>`
   * (см. MailchimpOAuthService) — так все существующие методы этого сервиса и все места,
   * которые читают cfg.apiToken как строку, работают без изменений и для OAuth, и для
   * classic API key.
   */
  private parseOAuthToken(apiKey: string): { accessToken: string; dc: string } | null {
    const t = apiKey.trim();
    if (!t.startsWith('oauth:')) return null;
    const rest = t.slice('oauth:'.length);
    const i = rest.lastIndexOf(':');
    if (i <= 0 || i >= rest.length - 1) return null;
    return { accessToken: rest.slice(0, i), dc: rest.slice(i + 1).toLowerCase() };
  }

  static buildOAuthApiKey(accessToken: string, dc: string): string {
    return `oauth:${accessToken.trim()}:${dc.trim().toLowerCase()}`;
  }

  /** Суффикс дата-центра в конце ключа, напр. …-us21 (или dc из OAuth-подключения) */
  extractDc(apiKey: string): string | null {
    const oauth = this.parseOAuthToken(apiKey);
    if (oauth) return oauth.dc;
    const t = apiKey.trim();
    const i = t.lastIndexOf('-');
    if (i <= 0 || i >= t.length - 1) return null;
    const dc = t.slice(i + 1).toLowerCase();
    if (!/^[a-z0-9]+$/.test(dc)) return null;
    return dc;
  }

  private authHeader(apiKey: string): string {
    const oauth = this.parseOAuthToken(apiKey);
    if (oauth) return `Bearer ${oauth.accessToken}`;
    const auth = Buffer.from(`lumiva:${apiKey.trim()}`, 'utf8').toString('base64');
    return `Basic ${auth}`;
  }

  async verifyAccess(apiKey: string): Promise<void> {
    const dc = this.extractDc(apiKey);
    if (!dc) {
      throw new Error(
        'Mailchimp: вставьте полный API key из аккаунта (заканчивается на -us21, -eu1 и т.п.)',
      );
    }
    const url = `https://${dc}.api.mailchimp.com/3.0/ping`;
    const res = await fetch(url, {
      headers: { Authorization: this.authHeader(apiKey) },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `Mailchimp API: ${res.status} ${text?.slice(0, 240) || res.statusText}`,
      );
    }
  }

  /**
   * Подписать контакт в аудитории (list / audience id из Mailchimp).
   * Идемпотентно по email: PUT …/lists/{id}/members/{hash}.
   */
  async upsertListMember(
    apiKey: string,
    listId: string,
    emailAddress: string,
    mergeFields: Record<string, unknown> | Record<string, string>,
    memberStatus: MailchimpMemberStatus = 'subscribed',
  ): Promise<void> {
    const dc = this.extractDc(apiKey);
    if (!dc) {
      throw new Error('Mailchimp: неверный формат API key');
    }
    const email = String(emailAddress).trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new Error('Mailchimp: укажите корректный email подписчика');
    }
    const lid = String(listId).trim();
    if (!lid) {
      throw new Error('Mailchimp: укажите Audience / List ID');
    }
    const st: MailchimpMemberStatus =
      memberStatus === 'pending' ? 'pending' : 'subscribed';
    const normalizedMerge = this.normalizeMergeFields(mergeFields);
    const hash = createHash('md5').update(email).digest('hex');
    const url = `https://${dc}.api.mailchimp.com/3.0/lists/${encodeURIComponent(lid)}/members/${hash}`;
    const body: Record<string, unknown> = {
      email_address: email,
      status_if_new: st,
      status: st,
    };
    if (Object.keys(normalizedMerge).length) {
      body.merge_fields = normalizedMerge;
    }
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: this.authHeader(apiKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Mailchimp: ${res.status} ${text?.slice(0, 400)}`);
    }
  }

  private baseUrl(apiKey: string): string {
    const dc = this.extractDc(apiKey);
    if (!dc) {
      throw new Error('Mailchimp: неверный формат API key');
    }
    return `https://${dc}.api.mailchimp.com/3.0`;
  }

  private async jsonRequest<T = unknown>(
    apiKey: string,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl(apiKey)}${path.startsWith('/') ? path : `/${path}`}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: this.authHeader(apiKey),
        ...(body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text().catch(() => '');
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = null;
      }
    }
    if (!res.ok) {
      const p = parsed as Record<string, unknown> | null;
      const detail =
        (typeof p?.detail === 'string' && p.detail) ||
        (typeof p?.title === 'string' && p.title) ||
        text?.slice(0, 400) ||
        res.statusText;
      throw new Error(`Mailchimp API ${res.status}: ${detail}`);
    }
    return parsed as T;
  }

  /**
   * Создать regular-кампанию на всю аудиторию list_id, задать HTML и сразу отправить.
   * reply_to должен быть с верифицированного в Mailchimp домена.
   */
  async createRegularCampaignAndSend(
    apiKey: string,
    params: {
      listId: string;
      subjectLine: string;
      campaignTitle: string;
      fromName: string;
      replyTo: string;
      html: string;
      plainText?: string;
    },
  ): Promise<{ id: string }> {
    const listId = String(params.listId || '').trim();
    if (!listId) {
      throw new Error('Mailchimp: укажите Audience / List ID');
    }
    const subjectLine = String(params.subjectLine || '').trim();
    const html = String(params.html || '').trim();
    if (!subjectLine) {
      throw new Error('Mailchimp: пустая тема письма (subject_line)');
    }
    if (!html) {
      throw new Error('Mailchimp: пустое HTML тело кампании');
    }
    const replyTo = String(params.replyTo || '').trim().toLowerCase();
    if (!replyTo || !replyTo.includes('@')) {
      throw new Error(
        'Mailchimp: укажите reply_to — email с домена, верифицированного в Mailchimp',
      );
    }
    const fromName = String(params.fromName || 'Lumiva CRM').trim().slice(0, 100);
    const title = String(params.campaignTitle || subjectLine)
      .trim()
      .slice(0, 100);

    const created = await this.jsonRequest<{ id?: string }>(apiKey, 'POST', '/campaigns', {
      type: 'regular',
      recipients: { list_id: listId },
      settings: {
        subject_line: subjectLine.slice(0, 998),
        title,
        from_name: fromName,
        reply_to: replyTo,
      },
    });
    const id = created?.id;
    if (!id || typeof id !== 'string') {
      throw new Error('Mailchimp: не получен id созданной кампании');
    }
    const enc = encodeURIComponent(id);
    const contentBody: Record<string, string> = { html };
    const pt = params.plainText?.trim();
    if (pt) {
      contentBody.plain_text = pt;
    }
    await this.jsonRequest(apiKey, 'PUT', `/campaigns/${enc}/content`, contentBody);
    await this.jsonRequest(apiKey, 'POST', `/campaigns/${enc}/actions/send`, {});
    return { id };
  }
}
