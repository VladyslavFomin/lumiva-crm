import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';
import { IntegrationsService } from '../integrations.service';
import {
  decodeThirdPartyOAuthState,
  encodeThirdPartyOAuthState,
  sanitizeThirdPartyRedirectPath,
} from '../third-party-link/generic-oauth-state.util';
import { MailchimpApiService } from './mailchimp-api.service';

const STATE_TYP = 'lumiva_mailchimp_oauth_v1';
const CATALOG_ID = 'mailchimp';

/**
 * Mailchimp OAuth2 ("Войти через Mailchimp"): access_token у Mailchimp не истекает
 * (нет refresh_token в ответе) — но датацентр (dc) для API-вызовов известен только
 * через отдельный /oauth2/metadata, а не зашит в сам токен, как в classic API key.
 * Поэтому сохраняем синтетический apiKey `oauth:<token>:<dc>` — см. MailchimpApiService.
 * @see https://mailchimp.com/developer/marketing/guides/access-user-data-oauth-2/
 */
@Injectable()
export class MailchimpOAuthService {
  private readonly log = new Logger(MailchimpOAuthService.name);

  constructor(
    private readonly platformSettings: PlatformSettingsService,
    private readonly integrations: IntegrationsService,
    private readonly mailchimpApi: MailchimpApiService,
  ) {}

  private callbackRedirectUri(): string {
    const base = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    return `${base}/v1/integrations/mailchimp/oauth/callback`;
  }

  async buildAuthorizeUrl(
    tenantId: string,
    userId: string,
    redirectPath: string | undefined,
  ): Promise<string> {
    const { clientId } = await this.platformSettings.getGenericIntegrationOAuthConfig(CATALOG_ID);
    if (!clientId) {
      throw new BadRequestException(
        'Mailchimp OAuth не настроен на платформе — обратитесь к администратору CRM.',
      );
    }
    const apiBase = (process.env.PUBLIC_API_URL || '').trim();
    if (!apiBase) {
      throw new BadRequestException('PUBLIC_API_URL не задан на сервере');
    }
    const redirect = sanitizeThirdPartyRedirectPath(redirectPath);
    const state = encodeThirdPartyOAuthState(STATE_TYP, { tenantId, userId, redirect });
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: this.callbackRedirectUri(),
      state,
    });
    return `https://login.mailchimp.com/oauth2/authorize?${params.toString()}`;
  }

  /** @returns относительный путь на фронт с query mailchimpOAuth=connected|error */
  async completeRedirect(code: string, state: string): Promise<string> {
    const withError = (path: string) => {
      const sep = path.includes('?') ? '&' : '?';
      return `${path}${sep}mailchimpOAuth=error`;
    };
    const withOk = (path: string) => {
      const sep = path.includes('?') ? '&' : '?';
      return `${path}${sep}mailchimpOAuth=connected`;
    };

    const decoded = decodeThirdPartyOAuthState(STATE_TYP, state);
    if (!decoded) return withError('/integrations-hub?tab=connections');

    const { clientId, clientSecret } =
      await this.platformSettings.getGenericIntegrationOAuthConfig(CATALOG_ID);
    if (!clientId || !clientSecret) return withError(decoded.redirect);

    try {
      const tokenRes = await axios.post(
        'https://login.mailchimp.com/oauth2/token',
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
      const accessToken = String(
        (tokenRes.data as { access_token?: string })?.access_token ?? '',
      ).trim();
      if (tokenRes.status !== 200 || !accessToken) {
        this.log.warn(`Mailchimp OAuth exchange failed: HTTP ${tokenRes.status}`);
        return withError(decoded.redirect);
      }

      const metaRes = await axios.get('https://login.mailchimp.com/oauth2/metadata', {
        headers: { Authorization: `OAuth ${accessToken}` },
        timeout: 15000,
        validateStatus: () => true,
      });
      const meta = metaRes.data as { dc?: string; accountname?: string; login?: { email?: string } };
      const dc = String(meta?.dc || '').trim().toLowerCase();
      if (metaRes.status !== 200 || !dc) {
        this.log.warn(`Mailchimp OAuth metadata failed: HTTP ${metaRes.status}`);
        return withError(decoded.redirect);
      }

      const label = meta.accountname || meta.login?.email || 'Mailchimp';
      await this.integrations.createForTenant(decoded.tenantId, {
        name: `Mailchimp — ${label}`,
        kind: 'third_party_link',
        config: {
          catalogId: CATALOG_ID,
          apiToken: MailchimpApiService.buildOAuthApiKey(accessToken, dc),
          label,
        },
        isEnabled: true,
      });
      return withOk(decoded.redirect);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.error(`Mailchimp OAuth callback failed: ${msg}`);
      return withError(decoded.redirect);
    }
  }
}
