import { randomUUID } from 'crypto';

import { Injectable } from '@nestjs/common';
import axios from 'axios';

import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';

const CAL_BASE = 'https://www.googleapis.com/calendar/v3';

export type GoogleCalendarEventItem = {
  id?: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; timeZone?: string; date?: string };
  end?: { dateTime?: string; timeZone?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
};

/**
 * Google Calendar API — проверка доступа, CRUD событий (OAuth access / refresh token).
 * @see https://developers.google.com/calendar/api/v3/reference
 */
@Injectable()
export class GoogleCalendarService {
  constructor(private readonly platformSettings: PlatformSettingsService) {}

  /** Не создаём второй Meet, если в CRM уже явная ссылка на Zoom/Teams/Webex/Meet. */
  static suppressAutoGoogleMeet(meetingUrl: string): boolean {
    const u = meetingUrl.trim().toLowerCase();
    if (!u) return false;
    return (
      u.includes('zoom.us') ||
      u.includes('teams.microsoft.com') ||
      u.includes('webex.com') ||
      u.includes('meet.google.com')
    );
  }

  private meetConferenceCreateBody(): Record<string, unknown> {
    return {
      conferenceData: {
        createRequest: {
          requestId: randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };
  }

  private pathCal(calendarId: string): string {
    const cal = (calendarId || 'primary').trim() || 'primary';
    return cal === 'primary' ? 'primary' : encodeURIComponent(cal);
  }

  async refreshAccessToken(params: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  }): Promise<{ accessToken: string; expiresIn?: number }> {
    const { clientId, clientSecret, refreshToken } = params;
    const rt = refreshToken.trim();
    if (!rt) throw new Error('Google Calendar: пустой refresh token');
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: rt,
      grant_type: 'refresh_token',
    });
    const res = await axios.post('https://oauth2.googleapis.com/token', body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 20000,
      validateStatus: () => true,
    });
    if (res.status !== 200) {
      const detail =
        typeof res.data === 'object' && res.data !== null
          ? JSON.stringify(res.data)
          : String(res.data ?? '');
      throw new Error(`Google OAuth refresh: HTTP ${res.status} ${detail}`.slice(0, 500));
    }
    const accessToken = String(res.data?.access_token ?? '').trim();
    if (!accessToken) {
      throw new Error('Google OAuth refresh: нет access_token в ответе');
    }
    const expiresIn =
      typeof res.data?.expires_in === 'number' ? res.data.expires_in : undefined;
    return { accessToken, expiresIn };
  }

  /**
   * Access token из поля apiToken (ручной ввод) или из oauth refresh (платформенный client).
   */
  async resolveAccessFromConfig(cfg: {
    apiToken?: string;
    oauthRefreshToken?: string;
    calendarId?: string;
    accountEmail?: string;
  }): Promise<{ accessToken: string; calendarId: string } | null> {
    const fromField =
      (typeof cfg.calendarId === 'string' ? cfg.calendarId.trim() : '') ||
      (typeof cfg.accountEmail === 'string' ? cfg.accountEmail.trim() : '');
    const calendarId = fromField.length > 0 ? fromField : 'primary';

    const rt = typeof cfg.oauthRefreshToken === 'string' ? cfg.oauthRefreshToken.trim() : '';
    if (rt) {
      const { clientId, clientSecret } = await this.platformSettings.getGoogleOAuthConfig();
      if (!clientId || !clientSecret) return null;
      const { accessToken } = await this.refreshAccessToken({
        clientId,
        clientSecret,
        refreshToken: rt,
      });
      return { accessToken, calendarId };
    }

    const api = typeof cfg.apiToken === 'string' ? cfg.apiToken.trim() : '';
    if (!api) return null;
    return { accessToken: api, calendarId };
  }

  async verifyThirdPartyGoogleCalendar(cfg: {
    apiToken?: string;
    oauthRefreshToken?: string;
    calendarId?: string;
    accountEmail?: string;
  }): Promise<void> {
    const resolved = await this.resolveAccessFromConfig(cfg);
    if (!resolved) {
      throw new Error(
        'Google Calendar: укажите OAuth-подключение или access token в поле API token',
      );
    }
    await this.verifyCalendarAccess(resolved.accessToken);
  }

  async verifyCalendarAccess(accessToken: string): Promise<void> {
    const tok = accessToken.trim();
    if (!tok) {
      throw new Error('Google Calendar: пустой access token');
    }
    const res = await axios.get(`${CAL_BASE}/users/me/calendarList`, {
      headers: { Authorization: `Bearer ${tok}` },
      params: { maxResults: 1 },
      timeout: 15000,
      validateStatus: () => true,
    });
    if (res.status !== 200) {
      const detail =
        typeof res.data === 'object' && res.data !== null
          ? JSON.stringify(res.data)
          : String(res.data ?? '');
      throw new Error(`Google Calendar API: HTTP ${res.status} ${detail}`.slice(0, 500));
    }
  }

  async insertEvent(params: {
    accessToken: string;
    calendarId: string;
    summary: string;
    description?: string;
    startIso: string;
    endIso: string;
    timeZone: string;
    extendedProperties?: { private?: Record<string, string> };
    /** Создать Google Meet (если false или уже есть Zoom/Teams в meetingUrl — не передаём conferenceData). */
    createMeetConference?: boolean;
  }): Promise<{ id?: string }> {
    const {
      accessToken,
      calendarId,
      summary,
      description,
      startIso,
      endIso,
      timeZone,
      extendedProperties,
      createMeetConference = true,
    } = params;
    const tok = accessToken.trim();
    if (!tok) {
      throw new Error('Google Calendar: пустой access token');
    }
    const pathCal = this.pathCal(calendarId);

    const baseBody: Record<string, unknown> = {
      summary: summary.slice(0, 1024),
      ...(description ? { description: description.slice(0, 8000) } : {}),
      start: { dateTime: startIso, timeZone: timeZone || 'UTC' },
      end: { dateTime: endIso, timeZone: timeZone || 'UTC' },
      ...(extendedProperties?.private && Object.keys(extendedProperties.private).length
        ? { extendedProperties }
        : {}),
    };

    const tryPost = async (body: Record<string, unknown>, withConference: boolean) => {
      const q = withConference ? '?conferenceDataVersion=1' : '';
      return axios.post(`${CAL_BASE}/calendars/${pathCal}/events${q}`, body, {
        headers: {
          Authorization: `Bearer ${tok}`,
          'Content-Type': 'application/json',
        },
        timeout: 25000,
        validateStatus: () => true,
      });
    };

    let withMeet = Boolean(createMeetConference);
    let body: Record<string, unknown> = withMeet
      ? { ...baseBody, ...this.meetConferenceCreateBody() }
      : baseBody;
    let res = await tryPost(body, withMeet);
    if ((res.status !== 200 && res.status !== 201) && withMeet) {
      res = await tryPost(baseBody, false);
      withMeet = false;
    }
    if (res.status !== 200 && res.status !== 201) {
      const detail =
        typeof res.data === 'object' && res.data !== null
          ? JSON.stringify(res.data)
          : String(res.data ?? '');
      throw new Error(`Google Calendar: HTTP ${res.status} ${detail}`.slice(0, 500));
    }
    return res.data as { id?: string };
  }

  async patchEvent(params: {
    accessToken: string;
    calendarId: string;
    eventId: string;
    summary: string;
    description?: string;
    startIso: string;
    endIso: string;
    timeZone: string;
    extendedProperties?: { private?: Record<string, string> };
    /** Добавить Meet к существующему событию (повторный синк без ссылки). */
    createMeetConference?: boolean;
  }): Promise<void> {
    const tok = params.accessToken.trim();
    if (!tok) throw new Error('Google Calendar: пустой access token');
    const pathCal = this.pathCal(params.calendarId);
    const eid = encodeURIComponent(params.eventId);
    const baseBody: Record<string, unknown> = {
      summary: params.summary.slice(0, 1024),
      ...(params.description ? { description: params.description.slice(0, 8000) } : {}),
      start: { dateTime: params.startIso, timeZone: params.timeZone || 'UTC' },
      end: { dateTime: params.endIso, timeZone: params.timeZone || 'UTC' },
    };
    if (
      params.extendedProperties?.private &&
      Object.keys(params.extendedProperties.private).length
    ) {
      baseBody.extendedProperties = params.extendedProperties;
    }

    const tryPatch = async (body: Record<string, unknown>, withConference: boolean) => {
      const q = withConference ? '?conferenceDataVersion=1' : '';
      return axios.patch(`${CAL_BASE}/calendars/${pathCal}/events/${eid}${q}`, body, {
        headers: {
          Authorization: `Bearer ${tok}`,
          'Content-Type': 'application/json',
        },
        timeout: 25000,
        validateStatus: () => true,
      });
    };

    let withMeet = params.createMeetConference === true;
    let body: Record<string, unknown> = withMeet
      ? { ...baseBody, ...this.meetConferenceCreateBody() }
      : baseBody;
    let res = await tryPatch(body, withMeet);
    if (res.status !== 200 && withMeet) {
      res = await tryPatch(baseBody, false);
      withMeet = false;
    }
    if (res.status !== 200) {
      const detail =
        typeof res.data === 'object' && res.data !== null
          ? JSON.stringify(res.data)
          : String(res.data ?? '');
      throw new Error(`Google Calendar patch: HTTP ${res.status} ${detail}`.slice(0, 500));
    }
  }

  async deleteEvent(params: {
    accessToken: string;
    calendarId: string;
    eventId: string;
  }): Promise<void> {
    const tok = params.accessToken.trim();
    if (!tok) throw new Error('Google Calendar: пустой access token');
    const pathCal = this.pathCal(params.calendarId);
    const eid = encodeURIComponent(params.eventId);
    const res = await axios.delete(`${CAL_BASE}/calendars/${pathCal}/events/${eid}`, {
      headers: { Authorization: `Bearer ${tok}` },
      timeout: 20000,
      validateStatus: () => true,
    });
    if (res.status !== 204 && res.status !== 200 && res.status !== 410) {
      const detail =
        typeof res.data === 'object' && res.data !== null
          ? JSON.stringify(res.data)
          : String(res.data ?? '');
      throw new Error(`Google Calendar delete: HTTP ${res.status} ${detail}`.slice(0, 500));
    }
  }

  /**
   * Полное событие (conferenceData, attendees, description) — для деталей в CRM.
   * @see https://developers.google.com/calendar/api/v3/reference/events/get
   */
  async getEventRaw(params: {
    accessToken: string;
    calendarId: string;
    eventId: string;
  }): Promise<Record<string, unknown>> {
    const tok = params.accessToken.trim();
    if (!tok) throw new Error('Google Calendar: пустой access token');
    const pathCal = this.pathCal(params.calendarId);
    const eid = encodeURIComponent(params.eventId);
    const res = await axios.get(`${CAL_BASE}/calendars/${pathCal}/events/${eid}`, {
      headers: { Authorization: `Bearer ${tok}` },
      params: { conferenceDataVersion: 1 },
      timeout: 25000,
      validateStatus: () => true,
    });
    if (res.status !== 200) {
      const detail =
        typeof res.data === 'object' && res.data !== null
          ? JSON.stringify(res.data)
          : String(res.data ?? '');
      throw new Error(`Google Calendar get: HTTP ${res.status} ${detail}`.slice(0, 500));
    }
    return (res.data && typeof res.data === 'object' ? res.data : {}) as Record<string, unknown>;
  }

  async listEvents(params: {
    accessToken: string;
    calendarId: string;
    timeMinIso: string;
    timeMaxIso: string;
    privateExtendedProperty?: string;
  }): Promise<GoogleCalendarEventItem[]> {
    const tok = params.accessToken.trim();
    if (!tok) throw new Error('Google Calendar: пустой access token');
    const pathCal = this.pathCal(params.calendarId);
    const q: Record<string, string> = {
      singleEvents: 'true',
      orderBy: 'startTime',
      timeMin: params.timeMinIso,
      timeMax: params.timeMaxIso,
      maxResults: '250',
    };
    if (params.privateExtendedProperty) {
      q.privateExtendedProperty = params.privateExtendedProperty;
    }
    const res = await axios.get(`${CAL_BASE}/calendars/${pathCal}/events`, {
      headers: { Authorization: `Bearer ${tok}` },
      params: q,
      timeout: 30000,
      validateStatus: () => true,
    });
    if (res.status !== 200) {
      const detail =
        typeof res.data === 'object' && res.data !== null
          ? JSON.stringify(res.data)
          : String(res.data ?? '');
      throw new Error(`Google Calendar list: HTTP ${res.status} ${detail}`.slice(0, 500));
    }
    const items = (res.data as { items?: GoogleCalendarEventItem[] })?.items;
    return Array.isArray(items) ? items : [];
  }
}
