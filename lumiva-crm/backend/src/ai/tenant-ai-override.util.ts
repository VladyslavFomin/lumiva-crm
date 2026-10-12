import { Repository } from 'typeorm';
import type { IntegrationConnection } from '../integrations/integration-connection.entity';

export type TenantAiOverride = {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  provider?: 'openai' | 'anthropic';
};

/**
 * Свой ключ LLM тенанта (Интеграции → OpenAI / LLM) — та же логика, что
 * AiAssistantService.resolveTenantOpenAiOverride, но читает подключение напрямую из таблицы,
 * чтобы модули вне AiModule/IntegrationsModule (телефония) могли использовать BYOK без
 * циклического импорта модулей.
 */
export async function resolveTenantAiOverrideFromRepo(
  repo: Repository<IntegrationConnection>,
  tenantId: string,
): Promise<TenantAiOverride | undefined> {
  try {
    const rows = await repo.find({
      where: { tenantId, kind: 'third_party_link', isEnabled: true, isDeleted: false } as any,
    });
    for (const row of rows) {
      if (!row.configJson) continue;
      let cfg: Record<string, any>;
      try {
        cfg = JSON.parse(row.configJson);
      } catch {
        continue;
      }
      if (cfg.catalogId !== 'openai' || !cfg.apiToken) continue;
      return {
        apiKey: String(cfg.apiToken),
        baseUrl: cfg.webhookUrl ? String(cfg.webhookUrl) : undefined,
        model: cfg.model ? String(cfg.model) : undefined,
        provider: cfg.provider === 'anthropic' ? 'anthropic' : undefined,
      };
    }
  } catch {
    /* нет ключа тенанта — используем платформенный */
  }
  return undefined;
}
