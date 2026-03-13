import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { PlatformSettingsService } from './platform-settings.service';

@Controller('platform/settings')
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
        billingPlans: null,
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
      billingPlans?: Array<{
        code: 'standard' | 'professional' | 'enterprise' | 'ultimate';
        title: string;
        price: string;
        subtitle: string;
        description: string;
        features: string[];
        highlighted?: boolean;
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
