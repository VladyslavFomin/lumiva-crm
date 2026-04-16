import { Injectable } from '@nestjs/common';
import axios from 'axios';

/**
 * Slack Incoming Webhooks (https://api.slack.com/messaging/webhooks)
 */
@Injectable()
export class SlackWebhookService {
  /**
   * @returns тело ответа Slack (обычно "ok" или JSON с ok: true)
   */
  async postIncomingWebhook(
    webhookUrl: string,
    payload: { text: string; blocks?: unknown[]; attachments?: unknown[] },
  ): Promise<{ status: number; body: string }> {
    const url = webhookUrl.trim();
    if (!url.startsWith('https://')) {
      throw new Error('Slack webhook URL must use HTTPS');
    }
    if (!url.includes('hooks.slack.com')) {
      throw new Error('Slack Incoming Webhook must use hooks.slack.com');
    }

    const res = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
      validateStatus: () => true,
    });

    const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Slack webhook HTTP ${res.status}: ${body.slice(0, 500)}`);
    }

    // Slack иногда возвращает тело "invalid_payload" при 200 — проверяем
    const lower = body.toLowerCase();
    if (lower.includes('invalid_payload') || lower.includes('user_not_found')) {
      throw new Error(`Slack отклонил запрос: ${body.slice(0, 500)}`);
    }

    return { status: res.status, body };
  }
}
