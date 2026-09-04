import { Injectable } from '@nestjs/common';
import axios from 'axios';

const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_VERIFY_MODEL = 'claude-haiku-4-5-20251001';

@Injectable()
export class OpenAiApiService {
  async verifyApiKey(
    apiKey: string,
    baseUrl?: string,
    provider?: 'openai' | 'anthropic',
  ): Promise<{ ok: boolean; modelCount?: number; message: string }> {
    if (provider === 'anthropic') {
      return this.verifyAnthropicKey(apiKey, baseUrl);
    }
    const base = (baseUrl?.trim() || 'https://api.openai.com').replace(/\/$/, '');
    try {
      const res = await axios.get<{ data?: unknown[] }>(`${base}/v1/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 10000,
      });
      const count = Array.isArray(res.data?.data) ? res.data.data.length : undefined;
      return {
        ok: true,
        modelCount: count,
        message: `OpenAI API key verified. ${count !== undefined ? `${count} models available.` : ''}`,
      };
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 401) return { ok: false, message: 'OpenAI: invalid API key (401 Unauthorized)' };
      if (status === 429) return { ok: false, message: 'OpenAI: rate limited (429). Key is valid but quota exceeded.' };
      return { ok: false, message: `OpenAI API error: ${(e as Error).message}` };
    }
  }

  /** Anthropic не отдаёт общедоступный /v1/models без биллинг-скоупа — проверяем минимальным сообщением. */
  private async verifyAnthropicKey(
    apiKey: string,
    baseUrl?: string,
  ): Promise<{ ok: boolean; message: string }> {
    const base = (baseUrl?.trim() || 'https://api.anthropic.com').replace(/\/$/, '');
    try {
      await axios.post(
        `${base}/v1/messages`,
        { model: ANTHROPIC_VERIFY_MODEL, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
            'content-type': 'application/json',
          },
          timeout: 10000,
        },
      );
      return { ok: true, message: 'Anthropic API key verified.' };
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 401) return { ok: false, message: 'Anthropic: invalid API key (401 Unauthorized)' };
      if (status === 429) return { ok: false, message: 'Anthropic: rate limited (429). Key is valid but quota exceeded.' };
      const data = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data;
      return { ok: false, message: `Anthropic API error: ${data?.error?.message || (e as Error).message}` };
    }
  }
}
