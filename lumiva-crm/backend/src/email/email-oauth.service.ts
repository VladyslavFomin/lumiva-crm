import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { EmailAccount } from './email-account.entity';
import {
  decodeEmailOAuthState,
  encodeEmailOAuthState,
  type EmailOAuthStatePayload,
} from './email-oauth-state.util';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
].join(' ');

const OUTLOOK_SCOPES = [
  'offline_access',
  'openid',
  'email',
  'https://graph.microsoft.com/Mail.ReadWrite',
  'https://graph.microsoft.com/Mail.Send',
  'https://graph.microsoft.com/User.Read',
].join(' ');

@Injectable()
export class EmailOAuthService {
  private readonly log = new Logger(EmailOAuthService.name);

  constructor(
    @InjectRepository(EmailAccount)
    private readonly accountRepo: Repository<EmailAccount>,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  apiPublicBase(): string {
    const base = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    if (!base) {
      throw new BadRequestException(
        'PUBLIC_API_URL is not configured (needed for OAuth redirect_uri)',
      );
    }
    return base;
  }

  googleRedirectUri(): string {
    return `${this.apiPublicBase()}/v1/email/oauth/google/callback`;
  }

  outlookRedirectUri(): string {
    return `${this.apiPublicBase()}/v1/email/oauth/microsoft/callback`;
  }

  async buildGoogleAuthUrl(payload: EmailOAuthStatePayload): Promise<string> {
    const { clientId } = await this.platformSettings.getGoogleOAuthConfig();
    if (!clientId?.trim()) {
      throw new BadRequestException(
        'Google OAuth client id is not configured (platform settings or GOOGLE_OAUTH_CLIENT_ID)',
      );
    }
    const state = encodeEmailOAuthState(payload);
    const params = new URLSearchParams({
      client_id: clientId.trim(),
      redirect_uri: this.googleRedirectUri(),
      response_type: 'code',
      scope: GMAIL_SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async buildMicrosoftAuthUrl(payload: EmailOAuthStatePayload): Promise<string> {
    const clientId = (
      process.env.MICROSOFT_OAUTH_CLIENT_ID ||
      process.env.OUTLOOK_OAUTH_CLIENT_ID ||
      ''
    ).trim();
    if (!clientId) {
      throw new BadRequestException(
        'Microsoft OAuth is not configured (MICROSOFT_OAUTH_CLIENT_ID)',
      );
    }
    const state = encodeEmailOAuthState(payload);
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: this.outlookRedirectUri(),
      response_mode: 'query',
      scope: OUTLOOK_SCOPES,
      state,
    });
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async handleGoogleCallback(
    code: string,
    state: string,
  ): Promise<{ redirect: string }> {
    const decoded = decodeEmailOAuthState(state);
    if (!decoded || decoded.provider !== 'gmail') {
      throw new BadRequestException('Invalid OAuth state');
    }
    const { clientId, clientSecret } =
      await this.platformSettings.getGoogleOAuthConfig();
    if (!clientId?.trim() || !clientSecret?.trim()) {
      throw new BadRequestException('Google OAuth client credentials missing');
    }
    const tokenRes = await axios.post<{
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    }>(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        code,
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        redirect_uri: this.googleRedirectUri(),
        grant_type: 'authorization_code',
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    const access = tokenRes.data.access_token;
    const refresh = tokenRes.data.refresh_token;
    if (!access) {
      throw new BadRequestException('No access_token from Google');
    }
    const userRes = await axios.get<{ email?: string }>(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      { headers: { Authorization: `Bearer ${access}` } },
    );
    const email = (userRes.data.email || '').trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Could not read Google account email');
    }
    const expiresAt = new Date(
      Date.now() + (tokenRes.data.expires_in || 3600) * 1000,
    );
    await this.upsertOAuthAccount({
      tenantId: decoded.tenantId,
      email,
      provider: 'gmail',
      accessToken: access,
      refreshToken: refresh || null,
      expiresAt,
      userId: decoded.userId,
    });
    const path = decoded.redirect.startsWith('/')
      ? decoded.redirect
      : `/${decoded.redirect || 'app/email'}`;
    return { redirect: path };
  }

  async handleMicrosoftCallback(
    code: string,
    state: string,
  ): Promise<{ redirect: string }> {
    const decoded = decodeEmailOAuthState(state);
    if (!decoded || decoded.provider !== 'outlook') {
      throw new BadRequestException('Invalid OAuth state');
    }
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
    if (!clientId || !clientSecret) {
      throw new BadRequestException('Microsoft OAuth credentials missing');
    }
    const tokenRes = await axios.post<{
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    }>(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: this.outlookRedirectUri(),
        grant_type: 'authorization_code',
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    const access = tokenRes.data.access_token;
    const refresh = tokenRes.data.refresh_token;
    if (!access) {
      throw new BadRequestException('No access_token from Microsoft');
    }
    const me = await axios.get<{ mail?: string; userPrincipalName?: string }>(
      'https://graph.microsoft.com/v1.0/me',
      { headers: { Authorization: `Bearer ${access}` } },
    );
    const email = (
      me.data.mail ||
      me.data.userPrincipalName ||
      ''
    )
      .trim()
      .toLowerCase();
    if (!email) {
      throw new BadRequestException('Could not read Microsoft account email');
    }
    const expiresAt = new Date(
      Date.now() + (tokenRes.data.expires_in || 3600) * 1000,
    );
    await this.upsertOAuthAccount({
      tenantId: decoded.tenantId,
      email,
      provider: 'outlook',
      accessToken: access,
      refreshToken: refresh || null,
      expiresAt,
      userId: decoded.userId,
    });
    const path = decoded.redirect.startsWith('/')
      ? decoded.redirect
      : `/${decoded.redirect || 'app/email'}`;
    return { redirect: path };
  }

  private async upsertOAuthAccount(params: {
    tenantId: string;
    email: string;
    provider: 'gmail' | 'outlook';
    accessToken: string;
    refreshToken: string | null;
    expiresAt: Date;
    userId: string;
  }): Promise<EmailAccount> {
    const existing = await this.accountRepo.findOne({
      where: { tenantId: params.tenantId, email: params.email },
    });
    const metaBase =
      existing?.meta && typeof existing.meta === 'object' && !Array.isArray(existing.meta)
        ? { ...(existing.meta as Record<string, unknown>) }
        : {};
    metaBase.connectedViaOAuth = true;
    metaBase.connectedByUserId = params.userId;
    metaBase.leadIngestion = {
      autoCreateFromUnknown:
        (metaBase.leadIngestion as any)?.autoCreateFromUnknown !== false,
      skipDomains: Array.isArray((metaBase.leadIngestion as any)?.skipDomains)
        ? (metaBase.leadIngestion as any).skipDomains
        : [],
    };
    if (existing) {
      existing.userId = params.userId || existing.userId;
      existing.oauthProvider = params.provider;
      existing.oauthAccessToken = params.accessToken;
      if (params.refreshToken) {
        existing.oauthRefreshToken = params.refreshToken;
      }
      existing.oauthExpiresAt = params.expiresAt;
      existing.status = 'active';
      existing.lastError = null;
      existing.syncIncoming = true;
      existing.syncOutgoing = true;
      existing.imapHost = null;
      existing.imapPort = null;
      existing.imapUsername = null;
      existing.imapPassword = null;
      existing.smtpHost = null;
      existing.smtpPort = null;
      existing.smtpUsername = null;
      existing.smtpPassword = null;
      existing.meta = metaBase;
      return this.accountRepo.save(existing);
    }
    const acc = this.accountRepo.create({
      tenantId: params.tenantId,
      userId: params.userId || null,
      email: params.email,
      name: params.email,
      oauthProvider: params.provider,
      oauthAccessToken: params.accessToken,
      oauthRefreshToken: params.refreshToken,
      oauthExpiresAt: params.expiresAt,
      status: 'active',
      syncIncoming: true,
      syncOutgoing: true,
      syncFolder: 'INBOX',
      meta: metaBase,
    });
    return this.accountRepo.save(acc);
  }

  /**
   * Обновляет access_token у аккаунта при необходимости. Возвращает актуальный токен.
   */
  async ensureAccessToken(account: EmailAccount): Promise<string> {
    if (!account.oauthRefreshToken) {
      throw new BadRequestException('Account has no refresh token');
    }
    const skewMs = 120_000;
    if (
      account.oauthAccessToken &&
      account.oauthExpiresAt &&
      account.oauthExpiresAt.getTime() > Date.now() + skewMs
    ) {
      return account.oauthAccessToken;
    }
    if (account.oauthProvider === 'gmail') {
      return this.refreshGoogle(account);
    }
    if (account.oauthProvider === 'outlook') {
      return this.refreshMicrosoft(account);
    }
    throw new BadRequestException('Unknown oauth provider');
  }

  private async refreshGoogle(account: EmailAccount): Promise<string> {
    const { clientId, clientSecret } =
      await this.platformSettings.getGoogleOAuthConfig();
    if (!clientId?.trim() || !clientSecret?.trim()) {
      throw new BadRequestException('Google OAuth credentials missing');
    }
    try {
      const res = await axios.post<{
        access_token: string;
        expires_in: number;
      }>(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({
          client_id: clientId.trim(),
          client_secret: clientSecret.trim(),
          refresh_token: account.oauthRefreshToken!,
          grant_type: 'refresh_token',
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      const access = res.data.access_token;
      if (!access) throw new Error('no access_token');
      account.oauthAccessToken = access;
      account.oauthExpiresAt = new Date(
        Date.now() + (res.data.expires_in || 3600) * 1000,
      );
      account.status = 'active';
      account.lastError = null;
      await this.accountRepo.save(account);
      return access;
    } catch (e: any) {
      this.log.warn(`Google token refresh failed: ${e?.message || e}`);
      account.status = 'error';
      account.lastError = e?.response?.data?.error_description || e?.message || 'refresh_failed';
      await this.accountRepo.save(account);
      throw e;
    }
  }

  private async refreshMicrosoft(account: EmailAccount): Promise<string> {
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
    if (!clientId || !clientSecret) {
      throw new BadRequestException('Microsoft OAuth credentials missing');
    }
    try {
      const res = await axios.post<{
        access_token: string;
        expires_in: number;
      }>(
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: account.oauthRefreshToken!,
          grant_type: 'refresh_token',
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      const access = res.data.access_token;
      if (!access) throw new Error('no access_token');
      account.oauthAccessToken = access;
      account.oauthExpiresAt = new Date(
        Date.now() + (res.data.expires_in || 3600) * 1000,
      );
      account.status = 'active';
      account.lastError = null;
      await this.accountRepo.save(account);
      return access;
    } catch (e: any) {
      this.log.warn(`Microsoft token refresh failed: ${e?.message || e}`);
      account.status = 'error';
      account.lastError = e?.response?.data?.error_description || e?.message || 'refresh_failed';
      await this.accountRepo.save(account);
      throw e;
    }
  }
}
