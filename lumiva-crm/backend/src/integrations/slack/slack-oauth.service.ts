import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';
import { IntegrationsService } from '../integrations.service';
import {
  decodeThirdPartyOAuthState,
  encodeThirdPartyOAuthState,
  sanitizeThirdPartyRedirectPath,
} from '../third-party-link/generic-oauth-state.util';

const STATE_TYP = 'lumiva_slack_oauth_v1';
const CATALOG_ID = 'slack';

/**
 * Slack OAuth v2 ("Добавить в Slack"): просим только scope incoming-webhook — Slack сам
 * попросит пользователя выбрать канал и вернёт готовый Incoming Webhook URL. Это ровно то же
 * поле (config.webhookUrl), которое использует ручное подключение — SlackWebhookService не
 * видит разницы, откуда взялся URL.
 * @see https://api.slack.com/authentication/oauth-v2
 */
@Injectable()
export class SlackOAuthService {
  private readonly log = new Logger(SlackOAuthService.name);

  constructor(
    private readonly platformSettings: PlatformSettingsService,
    private readonly integrations: IntegrationsService,
  ) {}

  private callbackRedirectUri(): string {
    const base = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    return `${base}/v1/integrations/slack/oauth/callback`;
  }

  async buildAuthorizeUrl(
    tenantId: string,
    userId: string,
    redirectPath: string | undefined,
  ): Promise<string> {
    const { clientId } = await this.platformSettings.getGenericIntegrationOAuthConfig(CATALOG_ID);
    if (!clientId) {
      throw new BadRequestException(
        'Slack OAuth не настроен на платформе — обратитесь к администратору CRM.',
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
      scope: 'incoming-webhook',
      redirect_uri: this.callbackRedirectUri(),
      state,
    });
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /** @returns относительный путь на фронт с query slackOAuth=connected|error */
  async completeRedirect(code: string, state: string): Promise<string> {
    const withError = (path: string) => {
      const sep = path.includes('?') ? '&' : '?';
      return `${path}${sep}slackOAuth=error`;
    };
    const withOk = (path: string) => {
      const sep = path.includes('?') ? '&' : '?';
      return `${path}${sep}slackOAuth=connected`;
    };

    const decoded = decodeThirdPartyOAuthState(STATE_TYP, state);
    if (!decoded) return withError('/integrations-hub?tab=connections');

    const { clientId, clientSecret } =
      await this.platformSettings.getGenericIntegrationOAuthConfig(CATALOG_ID);
    if (!clientId || !clientSecret) return withError(decoded.redirect);

    try {
      const res = await axios.post(
        'https://slack.com/api/oauth.v2.access',
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: this.callbackRedirectUri(),
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20000 },
      );
      const data = res.data as {
        ok?: boolean;
        error?: string;
        team?: { name?: string };
        incoming_webhook?: { url?: string; channel?: string };
      };
      if (!data.ok || !data.incoming_webhook?.url) {
        this.log.warn(`Slack OAuth exchange failed: ${data.error || 'no incoming_webhook'}`);
        return withError(decoded.redirect);
      }

      const label = [data.team?.name, data.incoming_webhook.channel]
        .filter(Boolean)
        .join(' · ') || 'Slack';
      await this.integrations.createForTenant(decoded.tenantId, {
        name: `Slack — ${label}`,
        kind: 'third_party_link',
        config: {
          catalogId: CATALOG_ID,
          webhookUrl: data.incoming_webhook.url,
          label,
        },
        isEnabled: true,
      });
      return withOk(decoded.redirect);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.error(`Slack OAuth callback failed: ${msg}`);
      return withError(decoded.redirect);
    }
  }
}
