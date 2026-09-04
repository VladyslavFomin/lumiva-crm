import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { PlatformSettingsService } from './platform-settings.service';
import { PlatformAdminGuard } from '../platform-admin/platform-admin.guard';

@Controller('platform/settings')
@UseGuards(PlatformAdminGuard)
export class PlatformSettingsController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get()
  async get() {
    const current = await this.settings.getSettings();
    return (
      current || {
        telegramBotToken: null,
        telegramChatId: null,
        googleOauthClientId: null,
        googleOauthClientSecret: null,
        metaOauthAppId: null,
        metaOauthAppSecret: null,
        vkOauthClientId: null,
        vkOauthClientSecret: null,
        stripeSecretKey: null,
        stripePublishableKey: null,
        stripeWebhookSecret: null,
        stripePriceStandard: null,
        stripePriceProfessional: null,
        stripePriceEnterprise: null,
        stripePriceUltimate: null,
        iyzicoApiKey: null,
        iyzicoSecretKey: null,
        iyzicoSandbox: true,
        yookassaShopId: null,
        yookassaSecretKey: null,
        billingPlans: null,
        openAiApiKey: null,
        openAiBaseUrl: null,
        openAiModel: null,
        openAiImageModel: null,
        aiPriceInputPerMtokUsd: null,
        aiPriceOutputPerMtokUsd: null,
        aiImageCostCents: null,
        stripePriceAiCredits: null,
        stripePriceStoragePack: null,
        stripePriceTelephonyAddon: null,
        aiCreditsPackAmountCents: null,
        storagePackBytes: null,
        integrationOAuthApps: null,
      }
    );
  }

  @Patch()
  async update(
    @Body()
    body: {
      telegramBotToken?: string | null;
      telegramChatId?: string | null;
      googleOauthClientId?: string | null;
      googleOauthClientSecret?: string | null;
      metaOauthAppId?: string | null;
      metaOauthAppSecret?: string | null;
      vkOauthClientId?: string | null;
      vkOauthClientSecret?: string | null;
      stripeSecretKey?: string | null;
      stripePublishableKey?: string | null;
      stripeWebhookSecret?: string | null;
      stripePriceStandard?: string | null;
      stripePriceProfessional?: string | null;
      stripePriceEnterprise?: string | null;
      stripePriceUltimate?: string | null;
      iyzicoApiKey?: string | null;
      iyzicoSecretKey?: string | null;
      iyzicoSandbox?: boolean;
      yookassaShopId?: string | null;
      yookassaSecretKey?: string | null;
      openAiApiKey?: string | null;
      openAiBaseUrl?: string | null;
      openAiModel?: string | null;
      openAiImageModel?: string | null;
      aiPriceInputPerMtokUsd?: string | null;
      aiPriceOutputPerMtokUsd?: string | null;
      aiImageCostCents?: number | null;
      stripePriceAiCredits?: string | null;
      stripePriceStoragePack?: string | null;
      stripePriceTelephonyAddon?: string | null;
      aiCreditsPackAmountCents?: number | null;
      storagePackBytes?: string | null;
      integrationOAuthApps?: Record<
        string,
        { clientId?: string | null; clientSecret?: string | null }
      > | null;
      billingPlans?: Array<{
        code: 'standard' | 'professional' | 'enterprise' | 'ultimate';
        title: string;
        price: string;
        subtitle: string;
        description: string;
        features: string[];
        highlighted?: boolean;
        monthlyAmounts?: { eur?: number; rub?: number; try?: number };
        i18n?: {
          en?: {
            subtitle?: string;
            description?: string;
            features?: string[];
          };
          tr?: {
            subtitle?: string;
            description?: string;
            features?: string[];
          };
        };
      }> | null;
    },
  ) {
    return this.settings.updateSettings(body);
  }

  @Get('billing-health')
  async billingHealth() {
    return this.settings.getBillingHealth();
  }

  @Post('telegram-test')
  async telegramTest(@Body() body: { message?: string }) {
    return this.settings.sendTelegramTest(body?.message);
  }

  @Post('stripe-test')
  async stripeTest() {
    return this.settings.sendStripeTest();
  }
}
