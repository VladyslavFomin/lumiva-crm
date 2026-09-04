import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';
import { IntegrationsService } from '../integrations.service';
import {
  decodeThirdPartyOAuthState,
  encodeThirdPartyOAuthState,
  sanitizeThirdPartyRedirectPath,
} from '../third-party-link/generic-oauth-state.util';
import { JiraApiService } from './jira-api.service';

const STATE_TYP = 'lumiva_jira_oauth_v1';
const CATALOG_ID = 'jira';
const SCOPES = ['read:jira-work', 'write:jira-work', 'offline_access'].join(' ');

/**
 * Atlassian OAuth 2.0 (3LO): access_token живёт ~1 час, refresh_token РОТИРУЕТСЯ на каждый
 * обмен (см. JiraApiService.resolveConfigAndPersist — там же и сохранение нового refresh
 * token). API-вызовы после подключения идут через api.atlassian.com/ex/jira/{cloudId}/...,
 * а не напрямую в {jiraUrl} — cloudId получаем через accessible-resources.
 * @see https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
 */
@Injectable()
export class JiraOAuthService {
  private readonly log = new Logger(JiraOAuthService.name);

  constructor(
    private readonly platformSettings: PlatformSettingsService,
    private readonly integrations: IntegrationsService,
    private readonly jiraApi: JiraApiService,
  ) {}

  private callbackRedirectUri(): string {
    const base = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    return `${base}/v1/integrations/jira/oauth/callback`;
  }

  async buildAuthorizeUrl(
    tenantId: string,
    userId: string,
    redirectPath: string | undefined,
  ): Promise<string> {
    const { clientId } = await this.platformSettings.getGenericIntegrationOAuthConfig(CATALOG_ID);
    if (!clientId) {
      throw new BadRequestException(
        'Jira OAuth не настроен на платформе — обратитесь к администратору CRM.',
      );
    }
    const apiBase = (process.env.PUBLIC_API_URL || '').trim();
    if (!apiBase) {
      throw new BadRequestException('PUBLIC_API_URL не задан на сервере');
    }
    const redirect = sanitizeThirdPartyRedirectPath(redirectPath);
    const state = encodeThirdPartyOAuthState(STATE_TYP, { tenantId, userId, redirect });
    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: clientId,
      scope: SCOPES,
      redirect_uri: this.callbackRedirectUri(),
      state,
      response_type: 'code',
      prompt: 'consent',
    });
    return `https://auth.atlassian.com/authorize?${params.toString()}`;
  }

  /** @returns относительный путь на фронт с query jiraOAuth=connected|error */
  async completeRedirect(code: string, state: string): Promise<string> {
    const withError = (path: string) => {
      const sep = path.includes('?') ? '&' : '?';
      return `${path}${sep}jiraOAuth=error`;
    };
    const withOk = (path: string) => {
      const sep = path.includes('?') ? '&' : '?';
      return `${path}${sep}jiraOAuth=connected`;
    };

    const decoded = decodeThirdPartyOAuthState(STATE_TYP, state);
    if (!decoded) return withError('/integrations-hub?tab=connections');

    const { clientId, clientSecret } =
      await this.platformSettings.getGenericIntegrationOAuthConfig(CATALOG_ID);
    if (!clientId || !clientSecret) return withError(decoded.redirect);

    try {
      const tokenRes = await axios.post(
        'https://auth.atlassian.com/oauth/token',
        {
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: this.callbackRedirectUri(),
          code,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 20000,
          validateStatus: () => true,
        },
      );
      const accessToken = String((tokenRes.data as { access_token?: string })?.access_token ?? '').trim();
      const refreshToken = String((tokenRes.data as { refresh_token?: string })?.refresh_token ?? '').trim();
      if (tokenRes.status !== 200 || !accessToken || !refreshToken) {
        this.log.warn(`Jira OAuth exchange failed: HTTP ${tokenRes.status}`);
        return withError(decoded.redirect);
      }

      const sites = await this.jiraApi.getAccessibleResources(accessToken);
      const site = sites[0];
      if (!site?.id || !site?.url) {
        this.log.warn('Jira OAuth: no accessible Jira sites for this account');
        return withError(decoded.redirect);
      }

      await this.integrations.createForTenant(decoded.tenantId, {
        name: `Jira — ${site.name || site.url}`,
        kind: 'third_party_link',
        config: {
          catalogId: CATALOG_ID,
          jiraUrl: site.url,
          oauthRefreshToken: refreshToken,
          oauthCloudId: site.id,
          label: site.name || site.url,
        },
        isEnabled: true,
      });
      return withOk(decoded.redirect);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.error(`Jira OAuth callback failed: ${msg}`);
      return withError(decoded.redirect);
    }
  }
}
