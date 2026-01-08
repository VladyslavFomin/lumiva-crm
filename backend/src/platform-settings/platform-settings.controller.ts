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
    },
  ) {
    return this.settings.updateSettings(body);
  }

  @Post('telegram-test')
  async telegramTest(@Body() body: { message?: string }) {
    return this.settings.sendTelegramTest(body?.message);
  }
}
