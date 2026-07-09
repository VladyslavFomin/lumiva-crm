// src/integrations/integrations.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IntegrationConnection } from './integration-connection.entity';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationRegistryService } from './integration-registry.service';

// адаптеры интеграций
import { WooCommerceAdapter } from './woocommerce/woocommerce.adapter';
import { ShopifyAdapter } from './shopify/shopify.adapter';
import { ShopifyApiService } from './shopify/shopify-api.service';
import { ShopifySyncScheduler } from './shopify/shopify-sync.scheduler';
import { ThirdPartyLinkAdapter } from './third-party-link/third-party-link.adapter';
import { SlackWebhookService } from './slack/slack-webhook.service';
import { TeamsWebhookService } from './teams/teams-webhook.service';
import { ZapierHookService } from './zapier/zapier-hook.service';
import { MakeWebhookService } from './make/make-webhook.service';
import { WhatsappCloudService } from './whatsapp/whatsapp-cloud.service';
import { GoogleCalendarService } from './google-calendar/google-calendar.service';
import { OutlookCalendarService } from './outlook/outlook-calendar.service';
import { BitrixRestService } from './bitrix/bitrix-rest.service';
import { AmocrmApiService } from './amocrm/amocrm-api.service';
import { HubspotApiService } from './hubspot/hubspot-api.service';
import { GoogleAdsApiService } from './google-ads/google-ads-api.service';
import { MetaAdsGraphService } from './meta-ads/meta-ads-graph.service';
import { MailchimpApiService } from './mailchimp/mailchimp-api.service';
import { LegacyHttpInboundCleanupService } from './legacy-http-inbound-cleanup.service';
import { IntegrationHubCatalogService } from './catalog/integration-hub-catalog.service';
import { GoogleSheetsSyncModule } from './google-sheets/google-sheets-sync.module';
import { Lead } from '../leads/lead.entity';
import { GoogleCalendarOAuthService } from './google-calendar/google-calendar-oauth.service';
import { OpenAiApiService } from './openai/openai-api.service';
import { OneCApiService } from './onec/onec-api.service';
import { SapApiService } from './sap/sap-api.service';
import { JiraApiService } from './jira/jira-api.service';

// сущности из других модулей
import { Sale } from '../sales/sale.entity';
import { SalesChannel } from '../sales-channels/sales-channel.entity';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { TenantsModule } from '../tenants/tenants.module';
import { CustomObjectsModule } from '../custom-objects/custom-objects.module';
import { WorkspaceAreasModule } from '../workspace-areas/workspace-areas.module';
import { MarketingModule } from '../marketing/marketing.module';
import { LeadsModule } from '../leads/leads.module';

@Module({
  imports: [
    PlatformSettingsModule,
    forwardRef(() => TenantsModule),
    forwardRef(() => GoogleSheetsSyncModule),
    CustomObjectsModule,
    WorkspaceAreasModule,
    MarketingModule,
    forwardRef(() => LeadsModule),
    TypeOrmModule.forFeature([
      IntegrationConnection,
      Sale,
      SalesChannel,
      Lead,
    ]),
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
    OpenAiApiService,
    OneCApiService,
    SapApiService,
    JiraApiService,
  ],
  controllers: [IntegrationsController],
  exports: [IntegrationsService, JiraApiService],
})
export class IntegrationsModule {}