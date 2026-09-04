import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';
import { IntegrationsService } from '../integrations.service';
import {
  decodeThirdPartyOAuthState,
  encodeThirdPartyOAuthState,
  sanitizeThirdPartyRedirectPath,
} from '../third-party-link/generic-oauth-state.util';

const STATE_TYP = 'lumiva_hubspot_oauth_v1';
const CATALOG_ID = 'hubspot';
const SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.deals.read',
  'crm.objects.deals.write',
  'crm.objects.owners.read',
].join(' ');

/**
 * HubSpot OAuth ("Войти через HubSpot"): access_token живёт ~30 минут, поэтому в
 * config сохраняем oauthRefreshToken — свежий access_token добывается на лету через
 * HubspotApiService.resolveAccessFromConfig (тот же паттерн, что и Google Calendar).
 * @see https://developers.hubspot.com/docs/api/oauth-quickstart-guide
 */
@Injectable()
export class HubspotOAuthService {
  private readonly log = new Logger(HubspotOAuthService.name);

  constructor(
    private readonly platformSettings: PlatformSettingsService,
    private readonly integrations: IntegrationsService,
  ) {}

  private callbackRedirectUri(): string {
    const base = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    return `${base}/v1/integrations/hubspot/oauth/callback`;
  }

  async buildAuthorizeUrl(
    tenantId: string,
    userId: string,
    redirectPath: string | undefined,
  ): Promise<string> {
    const { clientId } = await this.platformSettings.getGenericIntegrationOAuthConfig(CATALOG_ID);
    if (!clientId) {
      throw new BadRequestException(
        'HubSpot OAuth не настроен на платформе — обратитесь к администратору CRM.',
      );
    }
    const apiBase = (process.env.PUBLIC_API_URL || '').trim();
    if (!apiBase) {
      throw new BadRequestException('PUBLIC_API_URL не задан на сервере');
    }
    const redirect = sanitizeThirdPartyRedirectPath(redirectPath);
    const state = encodeThirdPartyOAuthState(STATE_TYP, { tenantId, userId, redirect });
    const params = new URLSearchParams({
      client_id: clientId,
      scope: SCOPES,
      redirect_uri: this.callbackRedirectUri(),
      state,
    });
    return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
  }

  /** @returns относительный путь на фронт с query hubspotOAuth=connected|error */
  async completeRedirect(code: string, state: string): Promise<string> {
    const withError = (path: string) => {
      const sep = path.includes('?') ? '&' : '?';
      return `${path}${sep}hubspotOAuth=error`;
    };
    const withOk = (path: string) => {
      const sep = path.includes('?') ? '&' : '?';
      return `${path}${sep}hubspotOAuth=connected`;
    };

    const decoded = decodeThirdPartyOAuthState(STATE_TYP, state);
    if (!decoded) return withError('/integrations-hub?tab=connections');

    const { clientId, clientSecret } =
      await this.platformSettings.getGenericIntegrationOAuthConfig(CATALOG_ID);
    if (!clientId || !clientSecret) return withError(decoded.redirect);

    try {
      const tokenRes = await axios.post(
        'https://api.hubapi.com/oauth/v1/token',
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: this.callbackRedirectUri(),
          code,
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 20000,
          validateStatus: () => true,
        },
      );
      const tokenData = tokenRes.data as {
        access_token?: string;
        refresh_token?: string;
        error?: string;
        error_description?: string;
      };
      if (tokenRes.status !== 200 || !tokenData.access_token || !tokenData.refresh_token) {
        this.log.warn(
          `HubSpot OAuth exchange failed: HTTP ${tokenRes.status} ${tokenData.error || ''} ${tokenData.error_description || ''}`,
        );
        return withError(decoded.redirect);
      }

      let label = 'HubSpot';
      try {
        const infoRes = await axios.get(
          `https://api.hubapi.com/oauth/v1/access-tokens/${encodeURIComponent(tokenData.access_token)}`,
          { timeout: 15000, validateStatus: () => true },
        );
        const hubDomain = (infoRes.data as { hub_domain?: string })?.hub_domain;
        if (hubDomain) label = hubDomain;
      } catch {
        // некритично — используем дефолтную метку
      }

      await this.integrations.createForTenant(decoded.tenantId, {
        name: `HubSpot — ${label}`,
        kind: 'third_party_link',
        config: {
          catalogId: CATALOG_ID,
          apiToken: tokenData.access_token,
          oauthRefreshToken: tokenData.refresh_token,
          label,
        },
        isEnabled: true,
      });
      return withOk(decoded.redirect);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.error(`HubSpot OAuth callback failed: ${msg}`);
      return withError(decoded.redirect);
    }
  }
}
