import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import type { ChatMessage } from './ai-openai.service';

const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-5';

type AnthropicTextBlock = { type: 'text'; text: string };
type AnthropicToolUseBlock = { type: 'tool_use'; id: string; name: string; input: unknown };
type AnthropicToolResultBlock = { type: 'tool_result'; tool_use_id: string; content: string };
type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock | AnthropicToolResultBlock;
type AnthropicMessage = { role: 'user' | 'assistant'; content: string | AnthropicContentBlock[] };

/**
 * Переводит OpenAI-образный chat/completions протокол (ChatMessage[], function-tools, tool_calls),
 * которым говорит весь остальной код (ai-assistant.service.ts, ai-employees.service.ts), в
 * Anthropic Messages API и обратно — чтобы вызывающий код не знал, какой провайдер выбрал тенант.
 * @see https://docs.anthropic.com/en/api/messages
 */
@Injectable()
export class AiAnthropicService {
  private readonly log = new Logger(AiAnthropicService.name);

  /** system-сообщения OpenAI-истории Anthropic принимает отдельным полем, не в messages[]. */
  private extractSystem(messages: ChatMessage[]): { system: string; rest: ChatMessage[] } {
    const systemParts: string[] = [];
    const rest: ChatMessage[] = [];
    for (const m of messages) {
      if (m.role === 'system') {
        if (m.content) systemParts.push(m.content);
      } else {
        rest.push(m);
      }
    }
    return { system: systemParts.join('\n\n'), rest };
  }

  /**
   * OpenAI шлёт результат каждого tool-вызова отдельным сообщением role:'tool'. Anthropic
   * требует все tool_result одного раунда одним user-сообщением со списком блоков — здесь
   * соседние 'tool' сообщения схлопываются в одно.
   */
  private toAnthropicMessages(messages: ChatMessage[]): AnthropicMessage[] {
    const out: AnthropicMessage[] = [];
    for (const m of messages) {
      if (m.role === 'user') {
        out.push({ role: 'user', content: m.content || '' });
        continue;
      }
      if (m.role === 'assistant') {
        const blocks: AnthropicContentBlock[] = [];
        if (m.content) blocks.push({ type: 'text', text: m.content });
        for (const tc of m.tool_calls || []) {
          let input: unknown = {};
          try {
            input = JSON.parse(tc.function.arguments || '{}');
          } catch {
            input = {};
          }
          blocks.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input });
        }
        out.push({ role: 'assistant', content: blocks.length ? blocks : m.content || '' });
        continue;
      }
      if (m.role === 'tool') {
        const block: AnthropicToolResultBlock = {
          type: 'tool_result',
          tool_use_id: m.tool_call_id || '',
          content: m.content || '',
        };
        const last = out[out.length - 1];
        if (last && last.role === 'user' && Array.isArray(last.content)) {
          (last.content as AnthropicContentBlock[]).push(block);
        } else {
          out.push({ role: 'user', content: [block] });
        }
      }
    }
    return out;
  }

  private toAnthropicTools(
    tools: unknown[],
  ): Array<{ name: string; description?: string; input_schema: unknown }> {
    const out: Array<{ name: string; description?: string; input_schema: unknown }> = [];
    for (const t of tools) {
      const tool = t as { type?: string; function?: { name?: string; description?: string; parameters?: unknown } };
      const fn = tool.function;
      if (!fn?.name) continue;
      out.push({
        name: fn.name,
        description: fn.description,
        input_schema: fn.parameters || { type: 'object', properties: {} },
      });
    }
    return out;
  }

  async chatCompletion(
    input: {
      messages: ChatMessage[];
      tools?: unknown[];
      toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
    },
    config: { apiKey: string; baseUrl?: string; model?: string },
  ): Promise<{
    message: ChatMessage;
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  }> {
    const base = (config.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
    const model = config.model || DEFAULT_MODEL;
    const { system, rest } = this.extractSystem(input.messages);
    const anthropicMessages = this.toAnthropicMessages(rest);

    const body: Record<string, unknown> = {
      model,
      max_tokens: 4096,
      messages: anthropicMessages,
    };
    if (system) body.system = system;
    if (input.tools?.length && input.toolChoice !== 'none') {
      body.tools = this.toAnthropicTools(input.tools);
    }

    try {
      const res = await axios.post(`${base}/v1/messages`, body, {
        headers: {
          'x-api-key': config.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        timeout: 120_000,
      });
      const blocks = (res.data?.content || []) as Array<
        { type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: unknown }
      >;
      const text = blocks
        .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
        .map((b) => b.text)
        .join('');
      const toolCalls = blocks
        .filter((b): b is { type: 'tool_use'; id: string; name: string; input: unknown } => b.type === 'tool_use')
        .map((b) => ({
          id: b.id,
          type: 'function' as const,
          function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
        }));
      const usageIn = res.data?.usage?.input_tokens || 0;
      const usageOut = res.data?.usage?.output_tokens || 0;
      return {
        message: {
          role: 'assistant',
          content: text || null,
          tool_calls: toolCalls.length ? toolCalls : undefined,
        },
        usage: {
          prompt_tokens: usageIn,
          completion_tokens: usageOut,
          total_tokens: usageIn + usageOut,
        },
      };
    } catch (e) {
      const ax = e as AxiosError;
      const data = ax.response?.data as any;
      this.log.error(`Anthropic error: ${ax.response?.status} ${JSON.stringify(data || ax.message)}`);
      throw new BadRequestException({
        code: 'AI_PROVIDER_ERROR',
        message: data?.error?.message || 'Ошибка провайдера Anthropic. Проверьте ключ и лимиты.',
      });
    }
  }
}
