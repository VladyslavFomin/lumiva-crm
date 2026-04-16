import { Injectable } from '@nestjs/common';
import axios from 'axios';

/** Zapier Catch Hook (hooks.zapier.com) — POST JSON */
@Injectable()
export class ZapierHookService {
  async postCatchHook(
    webhookUrl: string,
    payload: Record<string, unknown>,
  ): Promise<{ status: number; body: string }> {
    const url = webhookUrl.trim();
    if (!url.startsWith('https://')) {
      throw new Error('Zapier hook URL must use HTTPS');
    }
    if (!url.includes('hooks.zapier.com')) {
      throw new Error('Ожидается Zapier Catch Hook (домен hooks.zapier.com)');
    }

    const res = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
      validateStatus: () => true,
    });

    const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Zapier HTTP ${res.status}: ${body.slice(0, 500)}`);
    }

    return { status: res.status, body };
  }
}
