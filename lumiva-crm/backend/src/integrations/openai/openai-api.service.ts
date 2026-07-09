import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class OpenAiApiService {
  async verifyApiKey(
    apiKey: string,
    baseUrl?: string,
  ): Promise<{ ok: boolean; modelCount?: number; message: string }> {
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
}
