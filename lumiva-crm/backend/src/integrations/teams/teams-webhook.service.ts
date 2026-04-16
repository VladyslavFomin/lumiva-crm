import { Injectable } from '@nestjs/common';
import axios from 'axios';

/**
 * Microsoft Teams / Office 365 Incoming Webhook (MessageCard)
 * @see https://learn.microsoft.com/microsoftteams/platform/webhooks-and-connectors/how-to/connectors-using
 */
@Injectable()
export class TeamsWebhookService {
  async postConnectorCard(
    webhookUrl: string,
    title: string,
    text: string,
  ): Promise<{ status: number; body: string }> {
    const url = webhookUrl.trim();
    if (!url.startsWith('https://')) {
      throw new Error('Teams webhook URL must use HTTPS');
    }
    if (
      !url.includes('webhook.office.com') &&
      !url.includes('outlook.office.com/webhook')
    ) {
      throw new Error(
        'Ожидается URL Incoming Webhook Teams (webhook.office.com или outlook.office.com/webhook)',
      );
    }

    const payload = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: '0076D7',
      summary: title,
      sections: [
        {
          activityTitle: title,
          markdown: true,
          text,
        },
      ],
    };

    const res = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
      validateStatus: () => true,
    });

    const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Teams webhook HTTP ${res.status}: ${body.slice(0, 500)}`);
    }

    if (body && body.toLowerCase().includes('error')) {
      throw new Error(`Teams ответил ошибкой: ${body.slice(0, 500)}`);
    }

    return { status: res.status, body };
  }
}
