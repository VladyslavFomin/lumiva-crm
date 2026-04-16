import { Injectable } from '@nestjs/common';
import { SlackWebhookService } from '../slack/slack-webhook.service';
import { TeamsWebhookService } from '../teams/teams-webhook.service';
import { ZapierHookService } from '../zapier/zapier-hook.service';
import { WhatsappCloudService } from '../whatsapp/whatsapp-cloud.service';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service';
import { OutlookCalendarService } from '../outlook/outlook-calendar.service';
import { BitrixRestService } from '../bitrix/bitrix-rest.service';
import { AmocrmApiService } from '../amocrm/amocrm-api.service';
import { HubspotApiService } from '../hubspot/hubspot-api.service';
import { GoogleAdsApiService } from '../google-ads/google-ads-api.service';
import { MetaAdsGraphService } from '../meta-ads/meta-ads-graph.service';
import { MailchimpApiService } from '../mailchimp/mailchimp-api.service';
import type {
  SalesIntegrationAdapter,
  SyncResult,
  TestConnectionResult,
} from '../sales-integration.adapter';
import type { IntegrationKind } from '../integration-kind.enum';
import { IntegrationConnection } from '../integration-connection.entity';
import { isThirdPartyCatalogId } from '../integration-catalog.constants';

type ThirdPartyConfig = {
  catalogId?: string;
  /** Входящий webhook (Slack и др.); для amoCRM — базовый URL аккаунта; для HubSpot — опционально API host (api-eu1.hubapi.com) */
  webhookUrl?: string;
  /** API / personal access token */
  apiToken?: string;
  /** WhatsApp Cloud: Phone number ID (из Meta) */
  phoneNumberId?: string;
  /** Учётная запись (email и т.п.) */
  accountEmail?: string;
  /** Google Calendar / Outlook (Graph): id календаря */
  calendarId?: string;
  /** Google Calendar: refresh token после OAuth платформы */
  oauthRefreshToken?: string;
  /** Подпись в списке подключений */
  label?: string;
  /** Google Ads API: developer token (из Google Ads API Center) */
  developerToken?: string;
  /** WhatsApp Cloud: verify_token для подтверждения вебхука в Meta */
  webhookVerifyToken?: string;
  /** amoCRM: опциональный секрет для входящего вебхука (?secret= или X-Lumiva-Secret) */
  amoWebhookSecret?: string;
  /** WordPress / CF7: секрет для POST /webhooks/site-forms/:id?secret= */
  webhookInboundSecret?: string;
  /** WordPress / CF7: значение поля source у создаваемого лида */
  defaultLeadSource?: string;
  /** Google Sheets: ID таблицы (из URL) */
  spreadsheetId?: string;
  [key: string]: unknown;
};

function parseConfig(entity: IntegrationConnection): ThirdPartyConfig | null {
  if (!entity.configJson) return null;
  try {
    return JSON.parse(entity.configJson) as ThirdPartyConfig;
  } catch {
    return null;
  }
}

@Injectable()
export class ThirdPartyLinkAdapter implements SalesIntegrationAdapter {
  public readonly kind: IntegrationKind = 'third_party_link';
  public readonly label = 'Внешние сервисы (Slack, календарь, …)';

  constructor(
    private readonly slackWebhook: SlackWebhookService,
    private readonly teamsWebhook: TeamsWebhookService,
    private readonly zapierHook: ZapierHookService,
    private readonly whatsappCloud: WhatsappCloudService,
    private readonly googleCalendar: GoogleCalendarService,
    private readonly outlookCalendar: OutlookCalendarService,
    private readonly bitrixRest: BitrixRestService,
    private readonly amocrmApi: AmocrmApiService,
    private readonly hubspotApi: HubspotApiService,
    private readonly googleAdsApi: GoogleAdsApiService,
    private readonly metaAdsGraph: MetaAdsGraphService,
    private readonly mailchimpApi: MailchimpApiService,
  ) {}

  async testConnection(entity: IntegrationConnection): Promise<TestConnectionResult> {
    const cfg = parseConfig(entity);
    if (!cfg?.catalogId || !isThirdPartyCatalogId(cfg.catalogId)) {
      return { ok: false, message: 'Укажите корректный тип интеграции (catalogId)' };
    }

    if (cfg.catalogId === 'wordpress_cf7') {
      const sec =
        typeof cfg.webhookInboundSecret === 'string' ? cfg.webhookInboundSecret.trim() : '';
      if (sec.length > 0 && sec.length < 6) {
        return {
          ok: false,
          message:
            'WordPress / CF7: webhookInboundSecret не короче 6 символов или оставьте пустым (не рекомендуется)',
        };
      }
      const base = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
      const hookHint =
        base && entity.id
          ? ` URL формы: ${base}/v1/webhooks/site-forms/${entity.id} — добавьте ?secret=… при необходимости.`
          : ' Задайте PUBLIC_API_URL — в карточке подключения появится готовый URL.';
      const wizardHint =
        base && entity.id
          ? ` Lumiva Wizard: адрес приёма заявок см. в карточке подключения; ключ доступа к CRM — тот же, что для публичного API.`
          : '';
      return {
        ok: true,
        message:
          'WordPress / CF7: подключение готово. Укажите этот URL в плагине формы (или CF7 to Webhook).' +
          hookHint +
          wizardHint,
      };
    }

    if (
      cfg.catalogId === 'lumiva_client_cabinet' ||
      cfg.catalogId === 'lumiva_online_chat'
    ) {
      const label =
        cfg.catalogId === 'lumiva_client_cabinet'
          ? 'Client Cabinet Pro'
          : 'Онлайн-чат Lumiva';
      return {
        ok: true,
        message: `${label}: подключение оформлено. Включение в CRM выставляет модуль «вкл» в API тенанта — WordPress (Lumiva Wizard) подхватывает тот же API Key; отключение в CRM выключает модуль на стороне сайта.`,
      };
    }

    if (cfg.catalogId === 'google_sheets') {
      const tok = typeof cfg.apiToken === 'string' ? cfg.apiToken.trim() : '';
      const sid = typeof cfg.spreadsheetId === 'string' ? cfg.spreadsheetId.trim() : '';
      if (!tok || tok.length < 12) {
        return {
          ok: false,
          message:
            'Google Sheets: укажите API token — OAuth access token или JSON service account (поле API token)',
        };
      }
      if (sid && !/^[a-zA-Z0-9-_]{20,}$/.test(sid)) {
        return { ok: false, message: 'Google Sheets: некорректный spreadsheetId' };
      }
      let saOk = false;
      try {
        const j = JSON.parse(tok) as { client_email?: string; private_key?: string };
        saOk = Boolean(j?.client_email && j?.private_key);
      } catch {
        saOk = false;
      }
      return {
        ok: true,
        message: saOk
          ? 'Google Sheets: JSON service account распознан (локально). После сохранения синхронизация подтянет строки в лиды или в объект рабочей области — по выбранной цели импорта.'
          : 'Google Sheets: токен сохранён. Синхронизация подтянет строки в лиды или в объект рабочей области — по настройкам цели импорта и сопоставления колонок.',
      };
    }

    if (cfg.catalogId === 'google_calendar') {
      const oauthRt =
        typeof cfg.oauthRefreshToken === 'string'
          ? cfg.oauthRefreshToken.trim()
          : typeof (cfg as { oauth_refresh_token?: string }).oauth_refresh_token === 'string'
            ? String((cfg as { oauth_refresh_token?: string }).oauth_refresh_token).trim()
            : '';
      const tok = typeof cfg.apiToken === 'string' ? cfg.apiToken.trim() : '';
      if (!oauthRt && tok.length < 8) {
        return {
          ok: false,
          message:
            'Google Calendar: подключитесь через кнопку «Войти в Google» в CRM или вставьте OAuth access token в поле API token.',
        };
      }
      try {
        await this.googleCalendar.verifyThirdPartyGoogleCalendar({
          apiToken: cfg.apiToken,
          oauthRefreshToken: oauthRt || undefined,
          calendarId: cfg.calendarId,
          accountEmail: cfg.accountEmail,
        });
        return {
          ok: true,
          message:
            'Google Calendar: доступ проверен. Встречи из карточек лидов синхронизируются с выбранным календарём; кнопка «Синхронизировать» подтягивает изменения из Google.',
        };
      } catch (e) {
        return { ok: false, message: (e as Error).message };
      }
    }

    const webhook = typeof cfg.webhookUrl === 'string' ? cfg.webhookUrl.trim() : '';
    if (webhook) {
      const googleCustomerDigitsOnly =
        cfg.catalogId === 'google_ads' && /^\d{6,16}$/.test(webhook);
      if (!webhook.startsWith('https://') && !googleCustomerDigitsOnly) {
        return { ok: false, message: 'Webhook должен быть по HTTPS' };
      }
      if (googleCustomerDigitsOnly) {
        const dev =
          typeof cfg.developerToken === 'string' ? cfg.developerToken.trim() : '';
        const tok = typeof cfg.apiToken === 'string' ? cfg.apiToken.trim() : '';
        if (!dev) {
          return {
            ok: false,
            message:
              'Google Ads: укажите developer token (поле developerToken) вместе с Customer ID и OAuth token',
          };
        }
        if (!tok || tok.length < 8) {
          return {
            ok: false,
            message: 'Google Ads: укажите OAuth access token в поле API token',
          };
        }
        try {
          await this.googleAdsApi.verifyAccess(dev, tok);
          return {
            ok: true,
            message: 'Google Ads API: Customer ID сохранён, токены проверены (listAccessibleCustomers)',
          };
        } catch (e) {
          return { ok: false, message: (e as Error).message };
        }
      }
      if (cfg.catalogId === 'slack' && !webhook.includes('hooks.slack.com')) {
        return {
          ok: false,
          message: 'Для Slack используйте Incoming Webhook (домен hooks.slack.com)',
        };
      }
      if (cfg.catalogId === 'slack') {
        try {
          await this.slackWebhook.postIncomingWebhook(webhook, {
            text:
              '✅ *Lumiva CRM*: подключение Slack проверено. Можно использовать действие «Отправить в Slack» в автоматизациях.',
          });
          return { ok: true, message: 'Тестовое сообщение отправлено в Slack' };
        } catch (e) {
          return { ok: false, message: (e as Error).message };
        }
      }
      if (cfg.catalogId === 'ms_teams') {
        try {
          await this.teamsWebhook.postConnectorCard(
            webhook,
            'Lumiva CRM',
            '✅ Подключение Microsoft Teams проверено. Используйте действие «Отправить в Teams».',
          );
          return { ok: true, message: 'Тестовая карточка отправлена в Teams' };
        } catch (e) {
          return { ok: false, message: (e as Error).message };
        }
      }
      if (cfg.catalogId === 'zapier') {
        try {
          await this.zapierHook.postCatchHook(webhook, {
            source: 'lumiva-crm',
            event: 'connection_test',
            text: '✅ Тест подключения Zapier / Make из Lumiva CRM',
            at: new Date().toISOString(),
          });
          return { ok: true, message: 'Тестовый payload отправлен в Zapier Catch Hook' };
        } catch (e) {
          return { ok: false, message: (e as Error).message };
        }
      }
      if (cfg.catalogId === 'bitrix') {
        try {
          await this.bitrixRest.callMethod(webhook, 'user.current', {});
          return {
            ok: true,
            message: 'Битрикс24: входящий вебхук проверен (user.current)',
          };
        } catch (e) {
          return { ok: false, message: (e as Error).message };
        }
      }
      if (cfg.catalogId === 'amocrm') {
        const amoToken = typeof cfg.apiToken === 'string' ? cfg.apiToken.trim() : '';
        if (!amoToken || amoToken.length < 10) {
          return {
            ok: false,
            message:
              'amoCRM: укажите долгоживущий токен доступа (поле API / personal token) вместе с базовым URL',
          };
        }
        try {
          await this.amocrmApi.verifyAccess(webhook, amoToken);
          const base = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
          const amoHookHint =
            base && entity.id
              ? ` Входящие вебхуки amoCRM: URL ${base}/v1/webhooks/amocrm/${entity.id} (при необходимости добавьте ?secret=… из поля «Секрет вебхука»).`
              : ' Задайте PUBLIC_API_URL — в карточке подключения появится URL для вебхуков amoCRM.';
          return {
            ok: true,
            message:
              'amoCRM: доступ к API v4 проверен (GET /api/v4/account).' + amoHookHint,
          };
        } catch (e) {
          return { ok: false, message: (e as Error).message };
        }
      }
      if (cfg.catalogId === 'hubspot') {
        const hsToken = typeof cfg.apiToken === 'string' ? cfg.apiToken.trim() : '';
        if (!hsToken || hsToken.length < 10) {
          return {
            ok: false,
            message:
              'HubSpot: укажите private app access token (поле API token); при необходимости хост API — в поле Webhook URL',
          };
        }
        try {
          await this.hubspotApi.verifyAccess(hsToken, webhook);
          return {
            ok: true,
            message: 'HubSpot: токен проверен (GET /crm/v3/owners)',
          };
        } catch (e) {
          return { ok: false, message: (e as Error).message };
        }
      }
      if (cfg.catalogId === 'google_ads' || cfg.catalogId === 'meta_ads') {
        return {
          ok: false,
          message:
            cfg.catalogId === 'google_ads'
              ? 'Google Ads: в Webhook URL укажите только числовой Customer ID или оставьте пустым; OAuth — в API token, developer token — отдельным полем.'
              : 'Meta Ads: поле Webhook URL не используется; укажите Marketing API access token в поле API token.',
        };
      }
      return { ok: true, message: 'Webhook URL сохранён (тестовая отправка не выполнялась)' };
    }

    const token = typeof cfg.apiToken === 'string' ? cfg.apiToken.trim() : '';
    if (token.length >= 8) {
      if (cfg.catalogId === 'whatsapp') {
        const phoneNumberId =
          (typeof cfg.phoneNumberId === 'string' ? cfg.phoneNumberId.trim() : '') ||
          (typeof (cfg as any).phone_number_id === 'string'
            ? String((cfg as any).phone_number_id).trim()
            : '');
        if (!phoneNumberId) {
          return {
            ok: false,
            message: 'Для WhatsApp укажите Phone number ID (поле phoneNumberId в JSON или в форме)',
          };
        }
        try {
          await this.whatsappCloud.verifyPhoneNumberAccess(phoneNumberId, token);
          const verifyTok =
            typeof cfg.webhookVerifyToken === 'string' ? cfg.webhookVerifyToken.trim() : '';
          const base = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
          const hookHint =
            base && entity.id
              ? ` В Meta укажите Callback URL: ${base}/v1/webhooks/whatsapp/${entity.id} и Verify token из поля при подключении.`
              : ' Задайте PUBLIC_API_URL на сервере API — тогда в карточке подключения появится готовый Callback URL.';
          const verifyHint = verifyTok
            ? ''
            : ' Добавьте «Verify token» при редактировании подключения — без него Meta не подтвердит вебхук.';
          return {
            ok: true,
            message:
              'WhatsApp: токен и Phone number ID проверены через Graph API.' +
              hookHint +
              verifyHint,
          };
        } catch (e) {
          return { ok: false, message: (e as Error).message };
        }
      }
      if (cfg.catalogId === 'outlook') {
        try {
          await this.outlookCalendar.verifyCalendarAccess(token);
          return {
            ok: true,
            message: 'Microsoft 365 / Outlook: токен проверен (доступ к календарю /me/calendar)',
          };
        } catch (e) {
          return { ok: false, message: (e as Error).message };
        }
      }
      if (cfg.catalogId === 'hubspot') {
        try {
          const customBase =
            typeof cfg.webhookUrl === 'string' && cfg.webhookUrl.trim().length > 0
              ? cfg.webhookUrl.trim()
              : undefined;
          await this.hubspotApi.verifyAccess(token, customBase);
          return {
            ok: true,
            message: 'HubSpot: токен проверен (GET /crm/v3/owners)',
          };
        } catch (e) {
          return { ok: false, message: (e as Error).message };
        }
      }
      if (cfg.catalogId === 'mailchimp') {
        try {
          await this.mailchimpApi.verifyAccess(token);
          return {
            ok: true,
            message:
              'Mailchimp: API key проверен (GET /3.0/ping). Дальше в сценарии добавьте действие «Mailchimp / аудитория» и укажите Audience ID.',
          };
        } catch (e) {
          return { ok: false, message: (e as Error).message };
        }
      }
      if (cfg.catalogId === 'google_ads') {
        const dev =
          typeof cfg.developerToken === 'string' ? cfg.developerToken.trim() : '';
        if (!dev) {
          return {
            ok: false,
            message:
              'Google Ads: укажите developer token (поле при подключении или developerToken в JSON)',
          };
        }
        try {
          await this.googleAdsApi.verifyAccess(dev, token);
          return {
            ok: true,
            message:
              'Google Ads API: OAuth и developer token проверены (customers:listAccessibleCustomers)',
          };
        } catch (e) {
          return { ok: false, message: (e as Error).message };
        }
      }
      if (cfg.catalogId === 'meta_ads') {
        try {
          await this.metaAdsGraph.verifyAccess(token);
          return {
            ok: true,
            message: 'Meta Marketing API: токен проверен (GET /me)',
          };
        } catch (e) {
          return { ok: false, message: (e as Error).message };
        }
      }
      if (cfg.catalogId === 'bitrix') {
        return {
          ok: false,
          message:
            'Битрикс24: укажите базовый HTTPS URL входящего вебхука (…/rest/1/…/) в поле Webhook URL',
        };
      }
      if (cfg.catalogId === 'amocrm') {
        return {
          ok: false,
          message:
            'amoCRM: укажите базовый URL аккаунта (https://поддомен.amocrm.ru) в поле Webhook URL и токен в поле API token',
        };
      }
      if (cfg.catalogId === 'jira' || cfg.catalogId === 'sap' || cfg.catalogId === '1c') {
        return {
          ok: true,
          message:
            'Токен сохранён. Отдельного шага сценария под этот каталог пока нет — используйте действие «Вызвать Webhook» на REST вашей системы или связку через Zapier; нативный шаг — в планах.',
        };
      }
      if (cfg.catalogId === 'openai') {
        if (token.length < 20) {
          return {
            ok: false,
            message:
              'OpenAI: укажите полноценный API key в поле API token (проверка вызовом API не выполняется).',
          };
        }
        return {
          ok: true,
          message:
            'API ключ сохранён. В сценарии используйте «Вызвать Webhook» на https://api.openai.com/v1/chat/completions (или другой endpoint) с заголовком Authorization: Bearer и телом JSON.',
        };
      }
      return { ok: true, message: 'Токен сохранён (длина проверена)' };
    }

    const email = typeof cfg.accountEmail === 'string' ? cfg.accountEmail.trim() : '';
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: true, message: 'Учётная запись сохранена' };
    }

    if (cfg.catalogId === 'bitrix') {
      return {
        ok: false,
        message:
          'Битрикс24: укажите HTTPS URL входящего вебхука (…/rest/1/код/) в поле Webhook URL',
      };
    }

    if (cfg.catalogId === 'amocrm') {
      return {
        ok: false,
        message:
          'amoCRM: укажите базовый HTTPS URL (https://поддомен.amocrm.ru) и токен доступа API v4',
      };
    }

    if (cfg.catalogId === 'hubspot') {
      return {
        ok: false,
        message:
          'HubSpot: укажите private app access token (поле API token); при необходимости EU — базовый URL в поле Webhook URL (https://api-eu1.hubapi.com)',
      };
    }

    if (cfg.catalogId === 'google_ads') {
      return {
        ok: false,
        message:
          'Google Ads: укажите OAuth access token (API token) и developer token; опционально Customer ID (только цифры) в Webhook URL',
      };
    }

    if (cfg.catalogId === 'meta_ads') {
      return {
        ok: false,
        message:
          'Meta Ads: укажите Marketing API access token (поле API token) с нужными правами (ads_read / ads_management)',
      };
    }

    if (cfg.catalogId === 'jira' || cfg.catalogId === 'sap' || cfg.catalogId === '1c') {
      return {
        ok: false,
        message:
          'Укажите API-токен (не короче 8 символов) в поле API token — пока нет отдельного шага сценария, см. подсказку «После подключения» в каталоге интеграций.',
      };
    }

    if (cfg.catalogId === 'openai') {
      return {
        ok: false,
        message:
          'OpenAI: укажите API key в поле API token (ожидается полноценный ключ, см. подсказку в каталоге).',
      };
    }

    if (cfg.catalogId === 'mailchimp') {
      return {
        ok: false,
        message:
          'Mailchimp: вставьте полный API key в поле API token (Account → Extras → API keys; ключ заканчивается на -us21 и т.п.).',
      };
    }

    return {
      ok: false,
      message:
        'Укажите HTTPS webhook, API-токен (не короче 8 символов) или рабочий email — в зависимости от сервиса',
    };
  }

  async syncSales(entity: IntegrationConnection): Promise<SyncResult> {
    const cfg = parseConfig(entity);
    if (cfg?.catalogId === 'mailchimp') {
      return {
        ok: true,
        created: 0,
        updated: 0,
        skipped: 0,
        message:
          'Mailchimp: подписчик — шаг «Mailchimp / аудитория»; рассылка всей аудитории — «Mailchimp / рассылка аудитории» (тема, HTML, reply-to с верифицированного домена).',
      };
    }
    if (cfg?.catalogId === 'wordpress_cf7') {
      return {
        ok: true,
        created: 0,
        updated: 0,
        skipped: 0,
        message:
          'WordPress / CF7: заявки создают лиды через входящий вебхук; импорт продаж не используется.',
      };
    }
    if (
      cfg?.catalogId === 'lumiva_client_cabinet' ||
      cfg?.catalogId === 'lumiva_online_chat'
    ) {
      return {
        ok: true,
        created: 0,
        updated: 0,
        skipped: 0,
        message:
          'Модуль тенанта синхронизирован с подключением; отдельного импорта продаж нет.',
      };
    }
    if (cfg?.catalogId === 'google_sheets') {
      const sync = (cfg as { sync?: { targetKind?: string; workspaceObjectId?: string } }).sync;
      const tk = sync?.targetKind;
      let message: string;
      if (tk === 'workspace') {
        const oid = typeof sync?.workspaceObjectId === 'string' ? sync.workspaceObjectId.trim() : '';
        if (!oid) {
          message =
            'Google Sheets: импорт «продаж» из канала не используется. Для рабочей области укажите объект в настройках подключения — иначе фоновый импорт строк не запускается.';
        } else {
          message =
            'Google Sheets: импорт «продаж» из канала не используется. При синхронизации строки листа импортируются в выбранный объект рабочей области (лист, диапазон строк, сопоставление колонок — в настройках подключения).';
        }
      } else if (tk === 'projects' || tk === 'sales') {
        message =
          'Google Sheets: импорт в проекты и продажи пока в разработке — фоновое чтение листа не запускается. Используйте цель «Лиды» или «Рабочая область».';
      } else {
        message =
          'Google Sheets: импорт «продаж» из канала не используется. При синхронизации строки импортируются в лиды (лист, первая/последняя строка данных и сопоставление колонок — в настройках подключения).';
      }
      return {
        ok: true,
        created: 0,
        updated: 0,
        skipped: 0,
        message,
      };
    }
    return {
      ok: true,
      created: 0,
      updated: 0,
      skipped: 0,
      message: 'Для этой интеграции нет импорта продаж; данные хранятся в конфиге подключения',
    };
  }
}
