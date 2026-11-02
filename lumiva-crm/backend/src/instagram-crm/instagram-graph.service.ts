import { Injectable } from '@nestjs/common';

const GRAPH_VERSION = process.env.INSTAGRAM_GRAPH_API_VERSION || 'v23.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** Ошибка Graph API с кодом Meta — по нему отличаем «токен отозван» от «окно 24 ч закрыто». */
export class InstagramGraphError extends Error {
  constructor(
    message: string,
    readonly code: number | null,
    readonly subcode: number | null,
  ) {
    super(message);
  }

  /** Токен страницы отозван / пароль сменён / приложение удалено со страницы */
  get tokenInvalid(): boolean {
    return this.code === 190 || this.code === 102;
  }

  /** Директ вне 24-часового окна или ответ на старый комментарий */
  get outsideWindow(): boolean {
    return this.code === 10 || this.subcode === 2018278 || this.subcode === 2534022;
  }
}

export type PageWithInstagram = {
  pageId: string;
  pageName: string | null;
  pageAccessToken: string;
  igUserId: string;
  igUsername: string | null;
  profilePictureUrl: string | null;
};

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok || json?.error) {
    const e = json?.error || {};
    throw new InstagramGraphError(
      String(e.error_user_msg || e.message || `Instagram API: HTTP ${res.status}`),
      typeof e.code === 'number' ? e.code : null,
      typeof e.error_subcode === 'number' ? e.error_subcode : null,
    );
  }
  return json as T;
}

const qs = (p: Record<string, string>) => new URLSearchParams(p).toString();

@Injectable()
export class InstagramGraphService {
  /** code → долгоживущий токен пользователя (из него токены страниц выходят бессрочными). */
  async exchangeCode(appId: string, appSecret: string, redirectUri: string, code: string): Promise<string> {
    const short = await call<{ access_token?: string }>(
      `${GRAPH}/oauth/access_token?${qs({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code })}`,
    );
    if (!short.access_token) throw new InstagramGraphError('Meta не вернула access_token', null, null);
    const long = await call<{ access_token?: string }>(
      `${GRAPH}/oauth/access_token?${qs({
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: short.access_token,
      })}`,
    );
    return long.access_token || short.access_token;
  }

  /** Страницы пользователя, к которым привязан Instagram Business / Creator аккаунт. */
  async listPagesWithInstagram(userToken: string): Promise<PageWithInstagram[]> {
    const out: PageWithInstagram[] = [];
    let url: string | null = `${GRAPH}/me/accounts?${qs({
      fields: 'id,name,access_token,instagram_business_account{id,username,profile_picture_url}',
      limit: '100',
      access_token: userToken,
    })}`;
    for (let guard = 0; url && guard < 10; guard++) {
      const page: { data?: any[]; paging?: { next?: string } } = await call(url);
      for (const p of page.data || []) {
        const ig = p?.instagram_business_account;
        if (!ig?.id || !p?.access_token) continue;
        out.push({
          pageId: String(p.id),
          pageName: p.name ? String(p.name) : null,
          pageAccessToken: String(p.access_token),
          igUserId: String(ig.id),
          igUsername: ig.username ? String(ig.username) : null,
          profilePictureUrl: ig.profile_picture_url ? String(ig.profile_picture_url) : null,
        });
      }
      url = page.paging?.next || null;
    }
    return out;
  }

  /** Без подписки приложения на страницу Meta не шлёт вебхуки директа и комментариев этого аккаунта. */
  async subscribePage(pageId: string, pageToken: string): Promise<void> {
    await call(`${GRAPH}/${encodeURIComponent(pageId)}/subscribed_apps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: qs({ subscribed_fields: 'messages,feed', access_token: pageToken }),
    });
  }

  async unsubscribePage(pageId: string, pageToken: string): Promise<void> {
    await call(`${GRAPH}/${encodeURIComponent(pageId)}/subscribed_apps?${qs({ access_token: pageToken })}`, { method: 'DELETE' });
  }

  async getUserProfile(igsid: string, pageToken: string): Promise<{ name: string | null; username: string | null; profilePic: string | null }> {
    const p = await call<{ name?: string; username?: string; profile_pic?: string }>(
      `${GRAPH}/${encodeURIComponent(igsid)}?${qs({ fields: 'name,username,profile_pic', access_token: pageToken })}`,
    );
    return { name: p.name || null, username: p.username || null, profilePic: p.profile_pic || null };
  }

  async getMediaPermalink(mediaId: string, pageToken: string): Promise<string | null> {
    const m = await call<{ permalink?: string }>(
      `${GRAPH}/${encodeURIComponent(mediaId)}?${qs({ fields: 'permalink', access_token: pageToken })}`,
    );
    return m.permalink || null;
  }

  /**
   * Сообщение в директ. recipient.id — IGSID собеседника (окно 24 ч после его последнего сообщения),
   * recipient.comment_id — «личный ответ» автору комментария (один раз, в течение 7 дней).
   */
  async sendMessage(pageToken: string, recipient: { id: string } | { comment_id: string }, text: string): Promise<{ messageId: string | null }> {
    const r = await call<{ message_id?: string }>(`${GRAPH}/me/messages?${qs({ access_token: pageToken })}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient, message: { text } }),
    });
    return { messageId: r.message_id || null };
  }
}
