// src/integrations/integrations.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IntegrationConnection } from './integration-connection.entity';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { ExternalLinksController } from './external-links.controller';
import { IntegrationRegistryService } from './integration-registry.service';

// адаптеры интеграций
import { WooCommerceAdapter } from './woocommerce/woocommerce.adapter';
import { ShopifyAdapter } from './shopify/shopify.adapter';
import { ShopifyApiService } from './shopify/shopify-api.service';
import { ShopifySyncScheduler } from './shopify/shopify-sync.scheduler';
import { ThirdPartyLinkAdapter } from './third-party-link/third-party-link.adapter';
import { SlackWebhookService } from './slack/slack-webhook.service';
import { SlackOAuthService } from './slack/slack-oauth.service';
import { TeamsWebhookService } from './teams/teams-webhook.service';
import { ZapierHookService } from './zapier/zapier-hook.service';
import { MakeWebhookService } from './make/make-webhook.service';
import { WhatsappCloudService } from './whatsapp/whatsapp-cloud.service';
import { GoogleCalendarService } from './google-calendar/google-calendar.service';
import { OutlookCalendarService } from './outlook/outlook-calendar.service';
import { BitrixRestService } from './bitrix/bitrix-rest.service';
import { AmocrmApiService } from './amocrm/amocrm-api.service';
import { HubspotApiService } from './hubspot/hubspot-api.service';
import { HubspotOAuthService } from './hubspot/hubspot-oauth.service';
import { GoogleAdsApiService } from './google-ads/google-ads-api.service';
import { MetaAdsGraphService } from './meta-ads/meta-ads-graph.service';
import { MailchimpApiService } from './mailchimp/mailchimp-api.service';
import { MailchimpOAuthService } from './mailchimp/mailchimp-oauth.service';
import { LegacyHttpInboundCleanupService } from './legacy-http-inbound-cleanup.service';
import { IntegrationHubCatalogService } from './catalog/integration-hub-catalog.service';
import { RbacModule } from '../rbac/rbac.module';
import { GoogleSheetsSyncModule } from './google-sheets/google-sheets-sync.module';
import { Lead } from '../leads/lead.entity';
import { GoogleCalendarOAuthService } from './google-calendar/google-calendar-oauth.service';
import { OutlookCalendarOAuthService } from './outlook/outlook-calendar-oauth.service';
import { OpenAiApiService } from './openai/openai-api.service';
import { OneCApiService } from './onec/onec-api.service';
import { SapApiService } from './sap/sap-api.service';
import { JiraApiService } from './jira/jira-api.service';
import { JiraOAuthService } from './jira/jira-oauth.service';
import { IyzicoApiService } from './iyzico/iyzico-api.service';
import { PaytrApiService } from './paytr/paytr-api.service';
import { YookassaApiService } from './yookassa/yookassa-api.service';

// сущности из других модулей
import { Sale } from '../sales/sale.entity';
import { SalesChannel } from '../sales-channels/sales-channel.entity';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { TenantsModule } from '../tenants/tenants.module';
import { CustomObjectsModule } from '../custom-objects/custom-objects.module';
import { WorkspaceAreasModule } from '../workspace-areas/workspace-areas.module';
import { WorkspaceAreaActivityLogModule } from '../workspace-areas/workspace-area-activity-log.module';
import { MarketingModule } from '../marketing/marketing.module';
import { LeadsModule } from '../leads/leads.module';

@Module({
  imports: [
    PlatformSettingsModule,
    forwardRef(() => TenantsModule),
    forwardRef(() => GoogleSheetsSyncModule),
    CustomObjectsModule,
    WorkspaceAreasModule,
    WorkspaceAreaActivityLogModule,
    MarketingModule,
    forwardRef(() => LeadsModule),
    TypeOrmModule.forFeature([
      IntegrationConnection,
      Sale,
      SalesChannel,
      Lead,
    ]),
    RbacModule,
  ],
  providers: [
    IntegrationsService,
    IntegrationRegistryService,
    SlackWebhookService,
    TeamsWebhookService,
    ZapierHookService,
    MakeWebhookService,
    ShopifyApiService,
    ShopifyAdapter,
    ShopifySyncScheduler,
    WhatsappCloudService,
    GoogleCalendarService,
    OutlookCalendarService,
    BitrixRestService,
    AmocrmApiService,
    HubspotApiService,
    GoogleAdsApiService,
    MetaAdsGraphService,
    MailchimpApiService,
    WooCommerceAdapter,
    ThirdPartyLinkAdapter,
    LegacyHttpInboundCleanupService,
    IntegrationHubCatalogService,
    GoogleCalendarOAuthService,
    OutlookCalendarOAuthService,
    SlackOAuthService,
    HubspotOAuthService,
    MailchimpOAuthService,
    JiraOAuthService,
    OpenAiApiService,
    OneCApiService,
    SapApiService,
    JiraApiService,
    IyzicoApiService,
    PaytrApiService,
    YookassaApiService,
  ],
  controllers: [IntegrationsController, ExternalLinksController],
  exports: [IntegrationsService, JiraApiService],
})
export class IntegrationsModule {}