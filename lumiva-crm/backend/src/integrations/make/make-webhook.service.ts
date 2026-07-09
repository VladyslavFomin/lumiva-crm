// src/integrations/make/make-webhook.service.ts
import { Injectable } from '@nestjs/common';
import axios from 'axios';

const MAKE_HOOK_DOMAINS = [
  'hook.eu1.make.com',
  'hook.eu2.make.com',
  'hook.us1.make.com',
  'hook.us2.make.com',
  'hook.make.com',
  'hook.integromat.com', // legacy domain
];

/** Make (Integromat) Custom Webhook — POST JSON */
@Injectable()
export class MakeWebhookService {
  isMakeWebhookUrl(url: string): boolean {
    try {
      const u = new URL(url.trim());
      return MAKE_HOOK_DOMAINS.some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`));
    } catch {
      return false;
    }
  }

  async postWebhook(
    webhookUrl: string,
    payload: Record<string, unknown>,
  ): Promise<{ status: number; body: string }> {
    const url = webhookUrl.trim();
    if (!url.startsWith('https://')) {
      throw new Error('Make webhook URL должен использовать HTTPS');
    }
    if (!this.isMakeWebhookUrl(url)) {
      throw new Error(
        `Ожидается Make (Integromat) Custom Webhook URL (домен: hook.make.com, hook.eu1.make.com и т.п.)`,
      );
    }

    const res = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
      validateStatus: () => true,
    });

    const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Make HTTP ${res.status}: ${body.slice(0, 500)}`);
    }
    return { status: res.status, body };
  }
}
