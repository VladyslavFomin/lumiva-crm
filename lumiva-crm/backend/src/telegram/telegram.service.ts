import { Injectable, Logger } from '@nestjs/common';
import { DemoRequestsService } from '../demo-requests/demo-requests.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { TenantsService } from '../tenants/tenants.service';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly demoRequests: DemoRequestsService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly tenants: TenantsService,
  ) {}

  async handleUpdate(update: any) {
    if (update?.callback_query) {
      await this.handleCallback(update.callback_query);
      return;
    }
    if (update?.message?.text) {
      await this.handleMessage(update.message);
    }
  }

  private async handleCallback(callbackQuery: any) {
    const data = String(callbackQuery.data || '');
    if (!data.startsWith('create_tenant:')) {
      await this.safeAnswerCallback(callbackQuery.id);
      return;
    }

    const requestId = data.replace('create_tenant:', '').trim();
    const chatId = callbackQuery.message?.chat?.id;
    const userId = callbackQuery.from?.id;

    if (!requestId || !chatId || !userId) {
      await this.safeAnswerCallback(callbackQuery.id, 'Не удалось обработать запрос.');
      return;
    }

    try {
      const req = await this.demoRequests.startTenantProvisionFlow(requestId, {
        chatId: String(chatId),
        userId: String(userId),
      });

      await this.platformSettings.sendTelegramMessageToChat(
        String(chatId),
        `Введите tenant ID (client key) для заявки ${req.email}.\nПример: demo-client`,
      );
      await this.safeAnswerCallback(callbackQuery.id, 'Ожидаю tenant ID');
    } catch (err) {
      this.logger.warn(`Callback error: ${String(err)}`);
      await this.safeAnswerCallback(callbackQuery.id, 'Ошибка обработки');
    }
  }

  private async handleMessage(message: any) {
    const chatId = message.chat?.id;
    if (!chatId) return;

    const text = String(message.text || '').trim();
    if (!text) return;

    const userId = message.from?.id ? String(message.from.id) : null;
    const pending = await this.demoRequests.findPendingByChat(
      String(chatId),
      userId,
    );
    if (!pending) return;

    const clientKey = this.normalizeClientKey(text);
    if (!clientKey) {
      await this.platformSettings.sendTelegramMessageToChat(
        String(chatId),
        'Неверный tenant ID. Используйте латиницу, цифры и дефис.',
      );
      return;
    }

    const exists = await this.tenants.findByClientKey(clientKey);
    if (exists) {
      await this.platformSettings.sendTelegramMessageToChat(
        String(chatId),
        `Tenant ID уже занят: ${clientKey}. Введите другой.`,
      );
      return;
    }

    const tenant = await this.demoRequests.provisionTenantForRequest(
      pending,
      clientKey,
    );

    if (pending.telegramChatId && pending.telegramMessageId) {
      await this.platformSettings.editTelegramMessage(
        pending.telegramChatId,
        pending.telegramMessageId,
        `✅ Создан тенант для ${pending.email}\nclientKey: ${tenant.clientKey}`,
      );
    }

    await this.platformSettings.sendTelegramMessageToChat(
      String(chatId),
      `Готово. Создан тенант ${tenant.clientKey} для ${pending.email}.`,
    );
  }

  private normalizeClientKey(value: string) {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    return normalized || null;
  }

  private async safeAnswerCallback(id?: string, text?: string) {
    if (!id) return;
    try {
      await this.platformSettings.answerCallbackQuery(id, text);
    } catch (err) {
      this.logger.warn(`Answer callback failed: ${String(err)}`);
    }
  }
}
