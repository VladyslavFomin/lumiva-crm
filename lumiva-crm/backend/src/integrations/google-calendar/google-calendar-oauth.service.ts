import * as crypto from 'crypto';

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';

import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';
import { IntegrationsService } from '../integrations.service';
import { IntegrationConnection } from '../integration-connection.entity';
import type { GoogleCalendarOAuthStartDto } from '../dto/google-calendar-oauth-start.dto';

const STATE_TYP = 'lumiva_gcal_oauth_v1' as const;
const TTL_SEC = 900;

type GcalOauthState = {
  typ: typeof STATE_TYP;
  exp: number;
  tenantId: string;
  userId: string;
  redirect: string;
  intent: 'create' | 'reconnect';
  integrationId?: string;
  draft?: {
    name: string;
    calendarId: string;
  };
};

@Injectable()
export class GoogleCalendarOAuthService {
  private readonly log = new Logger(GoogleCalendarOAuthService.name);

  constructor(
    private readonly platformSettings: PlatformSettingsService,
    private readonly integrations: IntegrationsService,
    @InjectRepository(IntegrationConnection)
    private readonly integrationRepo: Repository<IntegrationConnection>,
  ) {}

  private secret(): string {
    return process.env.JWT_SECRET || 'changeme';
  }

  private callbackRedirectUri(): string {
    const apiBase = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    return `${apiBase}/v1/integrations/google-calendar/oauth/callback`;
  }

  private sanitizeFrontendPath(raw: string | undefined): string {
    const fallback = '/integrations-hub?tab=connections';
    const s = (raw ?? '').trim();
    if (!s) return fallback;
    if (!s.startsWith('/') || s.startsWith('//') || s.includes('://')) {
      throw new BadRequestException(
        'redirectPath должен быть относительным путём, начинающимся с /',
      );
    }
    if (s.length > 400) return fallback;
    return s;
  }

  private encodeState(inner: Omit<GcalOauthState, 'typ' | 'exp'>): string {
    const exp = Math.floor(Date.now() / 1000) + TTL_SEC;
    const body: GcalOauthState = { typ: STATE_TYP, exp, ...inner };
    const payload = Buffer.from(JSON.stringify(body), 'utf8').toString('base64url');
    const sig = crypto
      .createHmac('sha256', this.secret())
      .update(payload)
      .digest('base64url');
    return `${payload}.${sig}`;
  }

  decodeState(state: string): GcalOauthState | null {
    try {
      const dot = state.indexOf('.');
      if (dot <= 0) return null;
      const payloadB64 = state.slice(0, dot);
      const sig = state.slice(dot + 1);
      const expected = crypto
        .createHmac('sha256', this.secret())
        .update(payloadB64)
        .digest('base64url');
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
      const data = JSON.parse(
        Buffer.from(payloadB64, 'base64url').toString('utf8'),
      ) as GcalOauthState;
      if (data?.typ !== STATE_TYP) return null;
      if (!data?.tenantId || typeof data.redirect !== 'string') return null;
      if (data.intent !== 'create' && data.intent !== 'reconnect') return null;
      if (typeof data.exp !== 'number' || !Number.isFinite(data.exp)) return null;
      return data;
    } catch {
      return null;
    }
  }

  async buildAuthorizeUrl(
    tenantId: string,
    userId: string,
    dto: GoogleCalendarOAuthStartDto,
  ): Promise<string> {
    const { clientId, clientSecret } = await this.platformSettings.getGoogleOAuthConfig();
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'Google OAuth не настроен на платформе (client id / secret). Укажите GOOGLE_OAUTH_CLIENT_*.',
      );
    }
    const apiBase = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    if (!apiBase) {
      throw new BadRequestException(
        'PUBLIC_API_URL не задан — без него нельзя зарегистрировать redirect_uri в Google Cloud.',
      );
    }
    const redirect = this.sanitizeFrontendPath(dto.redirectPath);

    if (dto.intent === 'reconnect') {
      const iid = dto.integrationId?.trim();
      if (!iid) {
        throw new BadRequestException('Для переподключения укажите integrationId');
      }
      const row = await this.integrationRepo.findOne({
        where: { id: iid, tenantId, isDeleted: false } as any,
      });
      if (!row || row.kind !== 'third_party_link' || !row.configJson) {
        throw new NotFoundException('Подключение не найдено');
      }
      let catalogId = '';
      try {
        catalogId = String(
          (JSON.parse(row.configJson) as { catalogId?: string }).catalogId || '',
        );
      } catch {
        catalogId = '';
      }
      if (catalogId !== 'google_calendar') {
        throw new BadRequestException('Подключение не является Google Calendar');
      }
      const state = this.encodeState({
        tenantId,
        userId,
        redirect,
        intent: 'reconnect',
        integrationId: iid,
      });
      return this.authorizeUrlWithState(clientId, state);
    }

    const name =
      (dto.name && dto.name.trim()) ||
      `Google Calendar — ${new Date().toISOString().slice(0, 10)}`;
    const calendarId = (dto.calendarId && dto.calendarId.trim()) || 'primary';

    const state = this.encodeState({
      tenantId,
      userId,
      redirect,
      intent: 'create',
      draft: { name, calendarId },
    });
    return this.authorizeUrlWithState(clientId, state);
  }

  private authorizeUrlWithState(clientId: string, state: string): string {
    const redirectUri = this.callbackRedirectUri();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: 'https://www.googleapis.com/auth/calendar.events',
      include_granted_scopes: 'true',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  private async exchangeCodeForRefreshToken(
    code: string,
    redirectUri: string,
  ): Promise<string> {
    const { clientId, clientSecret } = await this.platformSettings.getGoogleOAuthConfig();
    if (!clientId || !clientSecret) {
      throw new BadRequestException('Google OAuth is not configured');
    }
    const params = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    const res = await axios.post(
      'https://oauth2.googleapis.com/token',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    const rt = res.data?.refresh_token as string | undefined;
    if (!rt) {
      throw new BadRequestException('No refresh_token from Google (try prompt=consent)');
    }
    return rt;
  }

  /**
   * @returns относительный путь на фронт с query googleCalendarOAuth=connected|error
   */
  async completeRedirect(code: string, state: string): Promise<string> {
    const withError = (path: string) => {
      const sep = path.includes('?') ? '&' : '?';
      return `${path}${sep}googleCalendarOAuth=error`;
    };
    const withOk = (path: string) => {
      const sep = path.includes('?') ? '&' : '?';
      return `${path}${sep}googleCalendarOAuth=connected`;
    };

    const decoded = this.decodeState(state);
    if (!decoded) {
      return withError('/integrations-hub?tab=connections');
    }
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp < now - 60) {
      return withError(decoded.redirect);
    }

    const redirectUri = this.callbackRedirectUri();
    let refreshToken: string;
    try {
      refreshToken = await this.exchangeCodeForRefreshToken(code, redirectUri);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.warn(`Google Calendar OAuth code exchange failed: ${msg}`);
      return withError(decoded.redirect);
    }

    try {
      if (decoded.intent === 'reconnect' && decoded.integrationId) {
        await this.integrations.patchGoogleCalendarOAuthTokens(
          decoded.tenantId,
          decoded.integrationId,
          refreshToken,
        );
        return withOk(decoded.redirect);
      }

      if (decoded.intent === 'create' && decoded.draft) {
        const d = decoded.draft;
        await this.integrations.createGoogleCalendarOAuthConnection(decoded.tenantId, {
          name: d.name,
          calendarId: d.calendarId,
          oauthRefreshToken: refreshToken,
        });
        return withOk(decoded.redirect);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.error(`Google Calendar OAuth finalize failed: ${msg}`);
      return withError(decoded.redirect);
    }

    return withError(decoded.redirect);
  }
}
