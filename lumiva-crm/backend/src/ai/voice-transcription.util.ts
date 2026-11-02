import { Logger } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { IntegrationConnection } from '../integrations/integration-connection.entity';
import { resolveTenantAiOverrideFromRepo } from './tenant-ai-override.util';

type AiOpenAiService = import('./ai-openai.service').AiOpenAiService;
type AiQuotaService = import('./ai-quota.service').AiQuotaService;

/** Whisper verbose_json отдаёт язык полным английским названием. */
export const WHISPER_LANG: Record<string, string> = {
  russian: 'ru', english: 'en', turkish: 'tr', ukrainian: 'uk', german: 'de', french: 'fr',
  spanish: 'es', italian: 'it', arabic: 'ar', kazakh: 'kk', polish: 'pl', dutch: 'nl',
};

/** Whisper принимает до 25 МБ; голосовые обычно — десятки КБ. */
const MAX_BYTES = 24 * 1024 * 1024;
/** Whisper ≈ $0.006/мин — списываем 1 цент за начатую минуту с платформенного ключа. */
const CENTS_PER_MINUTE = 1;

const log = new Logger('VoiceTranscription');

export type VoiceTranscript = { text: string; language: string | null };

/**
 * Голосовое клиента из мессенджера → текст. Язык определяется автоматически (ru/tr/en…),
 * свой ключ OpenAI тенанта (BYOK) используется, если подключён, — тогда платформенную квоту
 * не трогаем; без него — платформенный ключ и списание квоты, а при пустой квоте не
 * распознаём вовсе. Никогда не бросает: null — голосовое остаётся просто аудио.
 */
export async function transcribeInboundVoice(
  moduleRef: ModuleRef,
  tenantId: string,
  buffer: Buffer,
  filename: string,
): Promise<VoiceTranscript | null> {
  if (!buffer?.length || buffer.length > MAX_BYTES) return null;
  try {
    const ds = moduleRef.get(DataSource, { strict: false });
    const override = await resolveTenantAiOverrideFromRepo(ds.getRepository(IntegrationConnection), tenantId);
    const byok = !!override && override.provider !== 'anthropic';
    const quota: AiQuotaService = moduleRef.get(require('./ai-quota.service').AiQuotaService, { strict: false });
    if (!byok) {
      const snap = await quota.getQuotaSnapshot(tenantId);
      if (snap.totalAvailableCents <= 0) {
        log.warn(`tenant ${tenantId}: voice transcription skipped — AI quota is empty`);
        return null;
      }
    }
    const oai: AiOpenAiService = moduleRef.get(require('./ai-openai.service').AiOpenAiService, { strict: false });
    const res = await oai.transcribeAudioVerbose(buffer, filename, byok ? override : undefined);
    if (!byok) {
      const minutes = Math.max(1, Math.ceil((res.durationSec || 60) / 60));
      await quota
        .chargeCents(tenantId, minutes * CENTS_PER_MINUTE, { kind: 'audio', model: 'whisper-1', promptTokens: 0, completionTokens: 0 })
        .catch((e) => log.warn(`tenant ${tenantId}: voice quota charge failed: ${(e as Error).message}`));
    }
    const text = res.text.trim();
    if (!text) return null;
    const lang = res.language ? WHISPER_LANG[res.language] || (res.language.length === 2 ? res.language : null) : null;
    return { text: text.slice(0, 8000), language: lang };
  } catch (e) {
    log.warn(`tenant ${tenantId}: voice transcription failed: ${(e as Error).message}`);
    return null;
  }
}
