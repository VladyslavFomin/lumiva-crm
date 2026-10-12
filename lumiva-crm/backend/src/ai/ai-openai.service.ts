import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { AiAnthropicService } from './ai-anthropic.service';

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

  constructor(
    private readonly platformSettings: PlatformSettingsService,
    private readonly anthropic: AiAnthropicService,
  ) {}

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
      /** Overrides just the model name while still using the resolved (platform or tenant) apiKey/base — e.g. a
       * per-feature model preference (Telegram AI connector) that doesn't have its own API key to hand. */
      modelOverride?: string;
      /** Overrides the fixed 0.6 default sampling temperature — same "use resolved key, override one field" case.
       * null omits the parameter entirely: reasoning models (o-series, gpt-5…) reject any value except the default. */
      temperatureOverride?: number | null;
      /** Long prompts on slower (reasoning) models need more than the default 120s. */
      timeoutMs?: number;
      /** Строгий JSON-ответ (response_format json_object) — промпт обязан упоминать JSON. */
      jsonMode?: boolean;
    },
    overrideConfig?: { apiKey: string; baseUrl?: string; model?: string; provider?: 'openai' | 'anthropic' },
  ): Promise<{
    message: ChatMessage;
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  }> {
    if (overrideConfig?.provider === 'anthropic') {
      return this.anthropic.chatCompletion(input, overrideConfig);
    }
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
    if (input.modelOverride?.trim()) model = input.modelOverride.trim();
    const url = `${base}/chat/completions`;
    const body: Record<string, unknown> = {
      model,
      messages: input.messages,
    };
    if (input.temperatureOverride !== null) body.temperature = input.temperatureOverride ?? 0.6;
    if (input.jsonMode && !input.tools?.length) body.response_format = { type: 'json_object' };
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
        timeout: input.timeoutMs ?? 120_000,
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

  /**
   * Эмбеддинги платформенным ключом (поиск по смыслу в «Мозге» ИИ-офиса). Размерность урезана
   * (dimensions) — векторы хранятся в real[] без pgvector и сравниваются в Node, короткие дешевле.
   */
  async embed(
    texts: string[],
    dimensions = 256,
  ): Promise<{ vectors: number[][]; tokens: number; costCents: number }> {
    if (!texts.length) return { vectors: [], tokens: 0, costCents: 0 };
    const { apiKey, base } = await this.resolveConfig();
    try {
      const res = await axios.post(
        `${base}/embeddings`,
        { model: 'text-embedding-3-small', input: texts.map((t) => t.slice(0, 8000)), dimensions },
        { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 60_000 },
      );
      const rows = (res.data?.data ?? []) as Array<{ index: number; embedding: number[] }>;
      const vectors = rows.sort((a, b) => a.index - b.index).map((r) => r.embedding);
      if (vectors.length !== texts.length) throw new Error('Embedding count mismatch');
      const tokens = Number(res.data?.usage?.total_tokens ?? 0);
      // text-embedding-3-small: $0.02 / 1M токенов
      return { vectors, tokens, costCents: this.estimateCostCents(tokens, 0, 0.02, 0) };
    } catch (e) {
      const ax = e as AxiosError;
      const data = ax.response?.data as any;
      this.log.warn(`Embeddings error: ${ax.response?.status} ${JSON.stringify(data?.error?.message || ax.message)}`);
      throw new BadRequestException({ code: 'AI_PROVIDER_ERROR', message: data?.error?.message || 'Embeddings failed' });
    }
  }

  /** Описание изображения (vision) — чтобы картинки в «Мозге» тоже находились поиском. */
  async describeImage(dataUrl: string, hint: string): Promise<{ text: string; promptTokens: number; completionTokens: number }> {
    const { message, usage } = await this.chatCompletionWithConfig({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `Describe this image for a company knowledge base: all visible text verbatim, then what it shows. Context: ${hint}` },
            { type: 'image_url', image_url: { url: dataUrl } },
          ] as any,
        },
      ],
      temperatureOverride: 0.2,
    });
    return { text: message.content || '', promptTokens: usage.prompt_tokens || 0, completionTokens: usage.completion_tokens || 0 };
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

  /**
   * Whisper с автоопределением языка и длительностью (verbose_json). `override` — свой ключ
   * OpenAI тенанта; у Anthropic нет распознавания речи, поэтому для него — платформенный ключ.
   */
  async transcribeAudioVerbose(
    audioBuffer: Buffer,
    filename: string,
    override?: { apiKey: string; baseUrl?: string; provider?: 'openai' | 'anthropic' },
  ): Promise<{ text: string; language: string | null; durationSec: number | null }> {
    let apiKey: string;
    let base: string;
    if (override?.apiKey && override.provider !== 'anthropic') {
      apiKey = override.apiKey;
      base = (override.baseUrl?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '');
    } else {
      ({ apiKey, base } = await this.resolveConfig());
    }
    const safeName = filename.replace(/["\r\n]/g, '_') || 'audio.mp3';
    const boundary = `----lumivaaudio${Date.now()}`;
    const crlf = '\r\n';
    const field = (name: string, value: string) =>
      Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="${name}"${crlf}${crlf}${value}${crlf}`, 'utf8');
    const body = Buffer.concat([
      field('model', 'whisper-1'),
      field('response_format', 'verbose_json'),
      Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="file"; filename="${safeName}"${crlf}Content-Type: application/octet-stream${crlf}${crlf}`, 'utf8'),
      audioBuffer,
      Buffer.from(`${crlf}--${boundary}--${crlf}`, 'utf8'),
    ]);
    try {
      const res = await axios.post(`${base}/audio/transcriptions`, body, {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        timeout: 180_000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });
      const d = res.data || {};
      const duration = Number(d.duration);
      return {
        text: String(d.text || '').trim(),
        language: d.language ? String(d.language).toLowerCase() : null,
        durationSec: Number.isFinite(duration) ? Math.round(duration) : null,
      };
    } catch (e) {
      const ax = e as AxiosError;
      const data = ax.response?.data as any;
      throw new BadRequestException(data?.error?.message || 'Whisper transcription failed');
    }
  }

  async generateImage(
    input: {
      prompt: string;
      size?: '1024x1024' | '1792x1024' | '1024x1792';
    },
    // BYOK: DALL-E — OpenAI-only API, ключ Anthropic сюда не годится, тогда игнорируем override
    // и используем платформенный (со списанием квоты — иначе тенант получил бы бесплатную
    // генерацию только потому, что подключил не тот провайдер под чат).
    overrideConfig?: { apiKey: string; baseUrl?: string; provider?: 'openai' | 'anthropic' },
  ): Promise<{ url: string; revised_prompt?: string }> {
    const useOverride = overrideConfig && overrideConfig.provider !== 'anthropic';
    const cfg = useOverride ? null : await this.platformSettings.getSettings();
    const apiKey = useOverride
      ? overrideConfig!.apiKey
      : cfg?.openAiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim() || '';
    if (!apiKey) {
      throw new BadRequestException({
        code: 'AI_NOT_CONFIGURED',
        message: 'AI не настроен.',
      });
    }
    const base = useOverride
      ? (overrideConfig!.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')
      : (cfg?.openAiBaseUrl?.trim() || 'https://api.openai.com/v1').replace(
          /\/+$/,
          '',
        );
    // Модель для чата (overrideConfig.model) может быть не image-моделью — для картинок
    // всегда используем dall-e-3/платформенный дефолт независимо от BYOK.
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
