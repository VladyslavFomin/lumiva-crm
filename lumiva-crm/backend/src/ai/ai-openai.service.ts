import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
};

@Injectable()
export class AiOpenAiService {
  private readonly log = new Logger(AiOpenAiService.name);

  constructor(private readonly platformSettings: PlatformSettingsService) {}

  private async resolveConfig() {
    const cfg = await this.platformSettings.getSettings();
    const apiKey =
      cfg?.openAiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim() || '';
    if (!apiKey) {
      throw new BadRequestException({
        code: 'AI_NOT_CONFIGURED',
        message:
          'AI не настроен: добавьте API-ключ ассистента в панели PL1 (настройки платформы).',
      });
    }
    const base =
      (cfg?.openAiBaseUrl?.trim() || 'https://api.openai.com/v1').replace(
        /\/+$/,
        '',
      );
    const model =
      cfg?.openAiModel?.trim() || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const inPrice = parseFloat(
      cfg?.aiPriceInputPerMtokUsd?.trim() || '0.15',
    );
    const outPrice = parseFloat(
      cfg?.aiPriceOutputPerMtokUsd?.trim() || '0.6',
    );
    return { apiKey, base, model, inPrice, outPrice };
  }

  estimateCostCents(
    promptTokens: number,
    completionTokens: number,
    inPricePerM: number,
    outPricePerM: number,
  ): number {
    const usd =
      (promptTokens / 1_000_000) * inPricePerM +
      (completionTokens / 1_000_000) * outPricePerM;
    return Math.max(1, Math.ceil(usd * 100));
  }

  async chatCompletionWithConfig(
    input: {
      messages: ChatMessage[];
      tools?: unknown[];
      toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
    },
    overrideConfig?: { apiKey: string; baseUrl?: string; model?: string },
  ): Promise<{
    message: ChatMessage;
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  }> {
    let apiKey: string;
    let base: string;
    let model: string;
    if (overrideConfig) {
      apiKey = overrideConfig.apiKey;
      base = (overrideConfig.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
      model = overrideConfig.model || 'gpt-4o-mini';
    } else {
      const cfg = await this.resolveConfig();
      apiKey = cfg.apiKey;
      base = cfg.base;
      model = cfg.model;
    }
    const url = `${base}/chat/completions`;
    const body: Record<string, unknown> = {
      model,
      messages: input.messages,
      temperature: 0.6,
    };
    if (input.tools?.length) {
      body.tools = input.tools;
      body.tool_choice = input.toolChoice ?? 'auto';
    }
    try {
      const res = await axios.post(url, body, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120_000,
      });
      const choice = res.data?.choices?.[0];
      const msg = choice?.message;
      if (!msg) {
        throw new Error('Empty completion');
      }
      const usage = res.data?.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      };
      return {
        message: {
          role: 'assistant',
          content: msg.content ?? null,
          tool_calls: msg.tool_calls,
        },
        usage,
      };
    } catch (e) {
      const ax = e as AxiosError;
      const data = ax.response?.data as any;
      this.log.error(
        `OpenAI error: ${ax.response?.status} ${JSON.stringify(data || ax.message)}`,
      );
      throw new BadRequestException({
        code: 'AI_PROVIDER_ERROR',
        message:
          data?.error?.message ||
          'Ошибка провайдера AI. Проверьте ключ и лимиты.',
      });
    }
  }

  async chatCompletion(input: {
    messages: ChatMessage[];
    tools?: unknown[];
    toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  }): Promise<{
    message: ChatMessage;
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  }> {
    const { apiKey, base, model } = await this.resolveConfig();
    const url = `${base}/chat/completions`;
    const body: Record<string, unknown> = {
      model,
      messages: input.messages,
      temperature: 0.6,
    };
    if (input.tools?.length) {
      body.tools = input.tools;
      body.tool_choice = input.toolChoice ?? 'auto';
    }
    try {
      const res = await axios.post(url, body, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120_000,
      });
      const choice = res.data?.choices?.[0];
      const msg = choice?.message;
      if (!msg) {
        throw new Error('Empty completion');
      }
      const usage = res.data?.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      };
      return {
        message: {
          role: 'assistant',
          content: msg.content ?? null,
          tool_calls: msg.tool_calls,
        },
        usage,
      };
    } catch (e) {
      const ax = e as AxiosError;
      const data = ax.response?.data as any;
      this.log.error(
        `OpenAI error: ${ax.response?.status} ${JSON.stringify(data || ax.message)}`,
      );
      throw new BadRequestException({
        code: 'AI_PROVIDER_ERROR',
        message:
          data?.error?.message ||
          'Ошибка провайдера AI. Проверьте ключ и лимиты.',
      });
    }
  }

  /** Transcribe audio buffer via Whisper */
  async transcribeAudio(audioBuffer: Buffer, filename: string): Promise<string> {
    const { apiKey, base } = await this.resolveConfig();
    const url = `${base}/audio/transcriptions`;
    const boundary = `----lumivaaudio${Date.now()}`;
    const crlf = '\r\n';
    const parts: Buffer[] = [
      Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="model"${crlf}${crlf}whisper-1${crlf}`, 'utf8'),
      Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="language"${crlf}${crlf}ru${crlf}`, 'utf8'),
      Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="file"; filename="${filename}"${crlf}Content-Type: application/octet-stream${crlf}${crlf}`, 'utf8'),
      audioBuffer,
      Buffer.from(`${crlf}--${boundary}--${crlf}`, 'utf8'),
    ];
    const body = Buffer.concat(parts);
    try {
      const res = await axios.post(url, body, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        timeout: 60_000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });
      return String(res.data?.text || '').trim();
    } catch (e) {
      const ax = e as AxiosError;
      const data = ax.response?.data as any;
      throw new BadRequestException(data?.error?.message || 'Whisper transcription failed');
    }
  }

  async generateImage(input: {
    prompt: string;
    size?: '1024x1024' | '1792x1024' | '1024x1792';
  }): Promise<{ url: string; revised_prompt?: string }> {
    const cfg = await this.platformSettings.getSettings();
    const apiKey =
      cfg?.openAiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim() || '';
    if (!apiKey) {
      throw new BadRequestException({
        code: 'AI_NOT_CONFIGURED',
        message: 'AI не настроен.',
      });
    }
    const base =
      (cfg?.openAiBaseUrl?.trim() || 'https://api.openai.com/v1').replace(
        /\/+$/,
        '',
      );
    const model =
      cfg?.openAiImageModel?.trim() ||
      process.env.OPENAI_IMAGE_MODEL ||
      'dall-e-3';
    const url = `${base}/images/generations`;
    try {
      const res = await axios.post(
        url,
        {
          model,
          prompt: input.prompt,
          n: 1,
          size: input.size || '1024x1024',
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 180_000,
        },
      );
      const d = res.data?.data?.[0];
      if (!d?.url) throw new Error('No image url');
      return { url: d.url, revised_prompt: d.revised_prompt };
    } catch (e) {
      const ax = e as AxiosError;
      const data = ax.response?.data as any;
      this.log.error(
        `OpenAI image error: ${ax.response?.status} ${JSON.stringify(data || ax.message)}`,
      );
      throw new BadRequestException({
        code: 'AI_IMAGE_ERROR',
        message: data?.error?.message || 'Не удалось сгенерировать изображение.',
      });
    }
  }
}
