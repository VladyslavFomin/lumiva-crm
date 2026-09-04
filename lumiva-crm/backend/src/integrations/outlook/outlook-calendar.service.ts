import { Injectable } from '@nestjs/common';
import axios from 'axios';

const GRAPH = 'https://graph.microsoft.com/v1.0';

export const OUTLOOK_CALENDAR_SCOPES = [
  'offline_access',
  'openid',
  'email',
  'https://graph.microsoft.com/Calendars.ReadWrite',
  'https://graph.microsoft.com/User.Read',
].join(' ');

export function microsoftOAuthClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = (
    process.env.MICROSOFT_OAUTH_CLIENT_ID ||
    process.env.OUTLOOK_OAUTH_CLIENT_ID ||
    ''
  ).trim();
  const clientSecret = (
    process.env.MICROSOFT_OAUTH_CLIENT_SECRET ||
    process.env.OUTLOOK_OAUTH_CLIENT_SECRET ||
    ''
  ).trim();
  return { clientId, clientSecret };
}

/**
 * Microsoft 365 / Outlook — календарь через Microsoft Graph (OAuth access token).
 * @see https://learn.microsoft.com/en-us/graph/api/user-post-events
 */
@Injectable()
export class OutlookCalendarService {
  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresIn?: number; rotatedRefreshToken?: string }> {
    const { clientId, clientSecret } = microsoftOAuthClientCredentials();
    if (!clientId || !clientSecret) {
      throw new Error('Microsoft OAuth не настроен на платформе (MICROSOFT_OAUTH_CLIENT_ID/SECRET)');
    }
    const rt = refreshToken.trim();
    if (!rt) throw new Error('Outlook Calendar: пустой refresh token');
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: rt,
      grant_type: 'refresh_token',
      scope: OUTLOOK_CALENDAR_SCOPES,
    });
    const res = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      body.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 20000,
        validateStatus: () => true,
      },
    );
    if (res.status !== 200) {
      const detail =
        typeof res.data === 'object' && res.data !== null
          ? JSON.stringify(res.data)
          : String(res.data ?? '');
      throw new Error(`Microsoft OAuth refresh: HTTP ${res.status} ${detail}`.slice(0, 500));
    }
    const accessToken = String(res.data?.access_token ?? '').trim();
    if (!accessToken) {
      throw new Error('Microsoft OAuth refresh: нет access_token в ответе');
    }
    const expiresIn =
      typeof res.data?.expires_in === 'number' ? res.data.expires_in : undefined;
    // Microsoft часто ротирует refresh_token при обновлении access-токена (обычная практика
    // для offline_access) — раньше это игнорировалось и сохранялось только при ручном
    // переподключении. В какой-то момент исходный refresh_token инвалидируется политикой
    // ротации, и синхронизация начинает падать invalid_grant без видимой причины.
    const rotatedRefreshToken = String(res.data?.refresh_token ?? '').trim() || undefined;
    return { accessToken, expiresIn, rotatedRefreshToken };
  }

  /**
   * Access token из поля apiToken (ручной ввод) или из oauth refresh (платформенный client).
   */
  async resolveAccessFromConfig(cfg: {
    apiToken?: string;
    oauthRefreshToken?: string;
    calendarId?: string;
  }): Promise<{ accessToken: string; calendarGraphId: string | null; rotatedRefreshToken?: string } | null> {
    const fromField = typeof cfg.calendarId === 'string' ? cfg.calendarId.trim() : '';
    const calendarGraphId = fromField.length > 0 ? fromField : null;

    const rt = typeof cfg.oauthRefreshToken === 'string' ? cfg.oauthRefreshToken.trim() : '';
    if (rt) {
      const { accessToken, rotatedRefreshToken } = await this.refreshAccessToken(rt);
      return {
        accessToken,
        calendarGraphId,
        rotatedRefreshToken: rotatedRefreshToken && rotatedRefreshToken !== rt ? rotatedRefreshToken : undefined,
      };
    }

    const api = typeof cfg.apiToken === 'string' ? cfg.apiToken.trim() : '';
    if (!api) return null;
    return { accessToken: api, calendarGraphId };
  }

  private isoInstantToGraphUtc(iso: string): { dateTime: string; timeZone: 'UTC' } {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      throw new Error('Outlook Calendar: неверная дата начала или окончания');
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      dateTime: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`,
      timeZone: 'UTC',
    };
  }

  async verifyCalendarAccess(accessToken: string): Promise<void> {
    const tok = accessToken.trim();
    if (!tok) {
      throw new Error('Outlook Calendar: пустой access token');
    }
    const res = await axios.get(`${GRAPH}/me/calendar`, {
      headers: { Authorization: `Bearer ${tok}` },
      params: { $select: 'id,name' },
      timeout: 15000,
      validateStatus: () => true,
    });
    if (res.status !== 200) {
      const detail =
        typeof res.data === 'object' && res.data !== null
          ? JSON.stringify(res.data)
          : String(res.data ?? '');
      throw new Error(`Microsoft Graph (календарь): HTTP ${res.status} ${detail}`.slice(0, 500));
    }
  }

  async insertEvent(params: {
    accessToken: string;
    /** Graph id календаря; null / пусто — календарь по умолчанию (/me/events) */
    calendarGraphId: string | null;
    subject: string;
    bodyText?: string;
    startIsoUtc: string;
    endIsoUtc: string;
  }): Promise<{ id?: string }> {
    const tok = params.accessToken.trim();
    if (!tok) {
      throw new Error('Outlook Calendar: пустой access token');
    }
    const calId = params.calendarGraphId?.trim();
    const url = calId
      ? `${GRAPH}/me/calendars/${encodeURIComponent(calId)}/events`
      : `${GRAPH}/me/events`;

    const start = this.isoInstantToGraphUtc(params.startIsoUtc);
    const end = this.isoInstantToGraphUtc(params.endIsoUtc);
    const bodyContent = (params.bodyText || '').slice(0, 32000);

    const res = await axios.post(
      url,
      {
        subject: params.subject.slice(0, 998),
        body: { contentType: 'Text', content: bodyContent },
        start,
        end,
      },
      {
        headers: {
          Authorization: `Bearer ${tok}`,
          'Content-Type': 'application/json',
        },
        timeout: 25000,
        validateStatus: () => true,
      },
    );
    if (res.status !== 200 && res.status !== 201) {
      const detail =
        typeof res.data === 'object' && res.data !== null
          ? JSON.stringify(res.data)
          : String(res.data ?? '');
      throw new Error(`Outlook Calendar: HTTP ${res.status} ${detail}`.slice(0, 500));
    }
    return res.data as { id?: string };
  }
}
