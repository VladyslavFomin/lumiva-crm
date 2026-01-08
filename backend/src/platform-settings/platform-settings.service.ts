import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSettings } from './platform-settings.entity';
import https from 'node:https';

@Injectable()
export class PlatformSettingsService {
  constructor(
    @InjectRepository(PlatformSettings)
    private readonly repo: Repository<PlatformSettings>,
  ) {}

  async getSettings(): Promise<PlatformSettings | null> {
    return this.repo.findOne({ where: {} });
  }

  async getTelegramConfig(): Promise<{ token: string | null; chatId: string | null }> {
    const current = await this.getSettings();
    const token =
      current?.telegramBotToken?.trim() ||
      process.env.TELEGRAM_BOT_TOKEN?.trim() ||
      null;
    const chatId =
      current?.telegramChatId?.trim() ||
      process.env.TELEGRAM_CHAT_ID?.trim() ||
      null;
    return { token, chatId };
  }

  async getGoogleOAuthConfig(): Promise<{ clientId: string | null; clientSecret: string | null }> {
    const current = await this.getSettings();
    const clientId =
      current?.googleOauthClientId?.trim() ||
      process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ||
      null;
    const clientSecret =
      current?.googleOauthClientSecret?.trim() ||
      process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ||
      null;
    return { clientId, clientSecret };
  }

  async getMetaOAuthConfig(): Promise<{ appId: string | null; appSecret: string | null }> {
    const current = await this.getSettings();
    const appId =
      current?.metaOauthAppId?.trim() ||
      process.env.META_OAUTH_APP_ID?.trim() ||
      null;
    const appSecret =
      current?.metaOauthAppSecret?.trim() ||
      process.env.META_OAUTH_APP_SECRET?.trim() ||
      null;
    return { appId, appSecret };
  }

  async getVkOAuthConfig(): Promise<{ clientId: string | null; clientSecret: string | null }> {
    const current = await this.getSettings();
    const clientId =
      current?.vkOauthClientId?.trim() ||
      process.env.VK_OAUTH_CLIENT_ID?.trim() ||
      null;
    const clientSecret =
      current?.vkOauthClientSecret?.trim() ||
      process.env.VK_OAUTH_CLIENT_SECRET?.trim() ||
      null;
    return { clientId, clientSecret };
  }

  async updateSettings(payload: {
    telegramBotToken?: string | null;
    telegramChatId?: string | null;
    googleOauthClientId?: string | null;
    googleOauthClientSecret?: string | null;
    metaOauthAppId?: string | null;
    metaOauthAppSecret?: string | null;
    vkOauthClientId?: string | null;
    vkOauthClientSecret?: string | null;
  }) {
    let current = await this.getSettings();
    if (!current) {
      current = this.repo.create({
        telegramBotToken: payload.telegramBotToken ?? null,
        telegramChatId: payload.telegramChatId ?? null,
        googleOauthClientId: payload.googleOauthClientId ?? null,
        googleOauthClientSecret: payload.googleOauthClientSecret ?? null,
        metaOauthAppId: payload.metaOauthAppId ?? null,
        metaOauthAppSecret: payload.metaOauthAppSecret ?? null,
        vkOauthClientId: payload.vkOauthClientId ?? null,
        vkOauthClientSecret: payload.vkOauthClientSecret ?? null,
      });
    } else {
      if (payload.telegramBotToken !== undefined) {
        current.telegramBotToken = payload.telegramBotToken;
      }
      if (payload.telegramChatId !== undefined) {
        current.telegramChatId = payload.telegramChatId;
      }
      if (payload.googleOauthClientId !== undefined) {
        current.googleOauthClientId = payload.googleOauthClientId;
      }
      if (payload.googleOauthClientSecret !== undefined) {
        current.googleOauthClientSecret = payload.googleOauthClientSecret;
      }
      if (payload.metaOauthAppId !== undefined) {
        current.metaOauthAppId = payload.metaOauthAppId;
      }
      if (payload.metaOauthAppSecret !== undefined) {
        current.metaOauthAppSecret = payload.metaOauthAppSecret;
      }
      if (payload.vkOauthClientId !== undefined) {
        current.vkOauthClientId = payload.vkOauthClientId;
      }
      if (payload.vkOauthClientSecret !== undefined) {
        current.vkOauthClientSecret = payload.vkOauthClientSecret;
      }
    }
    return this.repo.save(current);
  }

  async sendTelegramTest(message?: string) {
    const text =
      message?.trim() ||
      '✅ Тестовое уведомление от Lumiva Platform. Telegram подключен.';
    const sent = await this.sendTelegramMessage(text);
    if (!sent.ok) {
      throw new Error('Telegram is not configured');
    }
    return { ok: true };
  }

  async sendTelegramMessage(
    text: string,
    options?: { replyMarkup?: Record<string, unknown> },
  ): Promise<{ ok: boolean; messageId?: number }> {
    const { chatId } = await this.getTelegramConfig();
    if (!chatId) return { ok: false };
    return this.sendTelegramMessageToChat(chatId, text, options);
  }

  async sendTelegramMessageToChat(
    chatId: string,
    text: string,
    options?: { replyMarkup?: Record<string, unknown> },
  ): Promise<{ ok: boolean; messageId?: number }> {
    const { token } = await this.getTelegramConfig();
    if (!token) return { ok: false };

    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text,
    };
    if (options?.replyMarkup) {
      payload.reply_markup = options.replyMarkup;
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await this.postJson(url, payload);

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Telegram API error: ${response.status} ${response.body}`);
    }

    try {
      const parsed = JSON.parse(response.body) as any;
      const messageId = parsed?.result?.message_id as number | undefined;
      return { ok: true, messageId };
    } catch {
      return { ok: true };
    }
  }

  async editTelegramMessage(
    chatId: string,
    messageId: number,
    text: string,
  ): Promise<void> {
    const { token } = await this.getTelegramConfig();
    if (!token) {
      throw new Error('Telegram is not configured');
    }
    const url = `https://api.telegram.org/bot${token}/editMessageText`;
    const response = await this.postJson(url, {
      chat_id: chatId,
      message_id: messageId,
      text,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Telegram API error: ${response.status} ${response.body}`);
    }
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string) {
    const { token } = await this.getTelegramConfig();
    if (!token) {
      throw new Error('Telegram is not configured');
    }
    const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
    const payload: Record<string, unknown> = { callback_query_id: callbackQueryId };
    if (text) payload.text = text;
    const response = await this.postJson(url, payload);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Telegram API error: ${response.status} ${response.body}`);
    }
  }
  private postJson(url: string, payload: Record<string, unknown>) {
    return new Promise<{ status: number; body: string }>((resolve, reject) => {
      const data = JSON.stringify(payload);
      const target = new URL(url);

      const req = https.request(
        {
          method: 'POST',
          hostname: target.hostname,
          path: `${target.pathname}${target.search}`,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
          },
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => {
            body += chunk;
          });
          res.on('end', () => {
            resolve({ status: res.statusCode || 0, body });
          });
        },
      );

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }
}
