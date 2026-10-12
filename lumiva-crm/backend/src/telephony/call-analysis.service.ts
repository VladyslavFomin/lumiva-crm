// src/telephony/call-analysis.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { Call, CallAiAnalysis } from './call.entity';
import { Tenant } from '../tenants/tenant.entity';
import { Lead } from '../leads/lead.entity';
import { IntegrationConnection } from '../integrations/integration-connection.entity';
import { resolveTenantAiOverrideFromRepo, TenantAiOverride } from '../ai/tenant-ai-override.util';
import { getUploadsRoot } from '../common/uploads-root.util';

type AiOpenAiService = import('../ai/ai-openai.service').AiOpenAiService;
type LeadActivityService = import('../leads/lead-activity.service').LeadActivityService;

const SENTIMENTS = new Set(['positive', 'neutral', 'negative']);
const TOPICS = new Set(['pricing', 'scheduling', 'service_quality', 'technical_issue', 'wait_time', 'other']);
const INTENTS = new Set(['hot', 'warm', 'cold']);

/** Whisper verbose_json отдаёт язык полным английским названием. */
const WHISPER_LANG: Record<string, string> = {
  russian: 'ru', english: 'en', turkish: 'tr', ukrainian: 'uk', german: 'de', french: 'fr',
  spanish: 'es', italian: 'it', arabic: 'ar', kazakh: 'kk', polish: 'pl', dutch: 'nl',
};

const OUT_LANG: Record<string, string> = { ru: 'русском', en: 'английском (English)', tr: 'турецком (Türkçe)' };

const HISTORY_TITLE: Record<string, string> = {
  ru: 'Разбор звонка',
  en: 'Call analysis',
  tr: 'Arama analizi',
};

const strList = (v: unknown, max: number): string[] =>
  Array.isArray(v) ? v.map((x) => String(x ?? '').trim()).filter(Boolean).slice(0, max) : [];

/**
 * AI-разбор звонков: транскрипт → резюме, договорённости, возражения клиента, «температура»
 * клиента и оценка работы менеджера. Работает и для звонков Twilio, и для записей, загруженных
 * вручную в карточку лида. Свой ключ LLM тенанта (BYOK) используется, если подключён.
 */
@Injectable()
export class CallAnalysisService {
  private readonly log = new Logger(CallAnalysisService.name);

  constructor(
    @InjectRepository(Call)
    private readonly callRepo: Repository<Call>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    @InjectRepository(IntegrationConnection)
    private readonly integrationRepo: Repository<IntegrationConnection>,
    private readonly moduleRef: ModuleRef,
  ) {}

  // Ленивые ссылки — как в telephony.service.ts: без циклического импорта AiModule/LeadsModule.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  private oai(): AiOpenAiService { return this.moduleRef.get(require('../ai/ai-openai.service').AiOpenAiService, { strict: false }); }
  private leadActivity(): LeadActivityService | null {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return this.moduleRef.get(require('../leads/lead-activity.service').LeadActivityService, { strict: false });
    } catch {
      return null;
    }
  }

  resolveOverride(tenantId: string): Promise<TenantAiOverride | undefined> {
    return resolveTenantAiOverrideFromRepo(this.integrationRepo, tenantId);
  }

  /** Распознать речь (с автоопределением языка) и сразу разобрать. Для загруженных записей. */
  async processUploaded(callId: string): Promise<void> {
    const call = await this.callRepo.findOne({ where: { id: callId } });
    if (!call?.recordingPath) return;
    call.analysisStatus = 'transcribing';
    call.transcriptStatus = 'pending';
    call.analysisError = null;
    await this.callRepo.save(call);
    try {
      const buffer = await readFile(join(getUploadsRoot(), call.recordingPath));
      const override = await this.resolveOverride(call.tenantId);
      const res = await this.oai().transcribeAudioVerbose(buffer, call.originalFilename || 'call.mp3', override);
      call.transcript = res.text || null;
      call.transcriptStatus = 'done';
      if (res.durationSec && !call.durationSeconds) call.durationSeconds = res.durationSec;
      await this.callRepo.save(call);
      await this.analyze(call, res.language);
    } catch (e: any) {
      this.log.warn(`Call ${call.id} transcription failed: ${e?.message}`);
      call.transcriptStatus = 'failed';
      call.analysisStatus = 'failed';
      call.analysisError = String(e?.message || 'Transcription failed').slice(0, 500);
      await this.callRepo.save(call);
    }
  }

  /** Полный разбор по готовому транскрипту. Не бросает исключений — статус пишется в звонок. */
  async analyze(call: Call, whisperLanguage: string | null = null): Promise<void> {
    const spokenLanguage = whisperLanguage
      ? WHISPER_LANG[whisperLanguage] || (whisperLanguage.length === 2 ? whisperLanguage : null)
      : null;
    const transcript = call.transcript?.trim();
    if (!transcript) {
      call.analysisStatus = 'failed';
      call.analysisError = 'Empty transcript';
      await this.callRepo.save(call);
      return;
    }
    call.analysisStatus = 'analyzing';
    call.sentimentStatus = 'pending';
    call.analysisError = null;
    await this.callRepo.save(call);

    const tenant = await this.tenantRepo.findOne({ where: { id: call.tenantId } });
    const outLang = ['ru', 'en', 'tr'].includes(String(tenant?.uiLanguage)) ? String(tenant!.uiLanguage) : 'ru';
    const lead = call.linkedLeadId
      ? await this.leadRepo.findOne({ where: { id: call.linkedLeadId, tenantId: call.tenantId } })
      : null;

    const system =
      'Ты — руководитель отдела продаж и разбираешь телефонный разговор менеджера с клиентом. ' +
      'Транскрипт не размечен по говорящим — определи реплики менеджера и клиента по смыслу. ' +
      'Используй ТОЛЬКО то, что реально прозвучало в разговоре: не придумывай договорённостей, сроков, цен и возражений. ' +
      'Если чего-то в разговоре не было — верни пустой массив. ' +
      'nextSteps: каждая договорённость — ОТДЕЛЬНЫМ пунктом (например, «прислать подборку» и «перезвонить» — два пункта), ' +
      'с исполнителем в формулировке («Менеджер: …» / «Клиент: …»); dueInDays считай от дня звонка: «сегодня» = 0, «завтра» = 1, ' +
      'день недели — число дней до ближайшего такого дня (если точный день неизвестен — null). ' +
      'objections: любые сомнения и тормоза покупки — цена, сравнение с конкурентами, «надо подумать», «посоветуюсь с мужем/руководителем», «не сейчас». ' +
      `Все тексты в ответе пиши на ${OUT_LANG[outLang]} языке, даже если разговор шёл на другом языке. ` +
      'Ответь СТРОГО одним JSON-объектом без пояснений и без markdown:\n' +
      '{"summary":"2–4 предложения: о чём разговор и чем закончился",' +
      '"nextSteps":[{"text":"конкретный следующий шаг или договорённость","dueInDays":число дней или null}],' +
      '"objections":["возражение или сомнение клиента"],' +
      '"clientIntent":"hot|warm|cold",' +
      '"sentiment":"positive|neutral|negative",' +
      '"topic":"pricing|scheduling|service_quality|technical_issue|wait_time|other",' +
      '"managerScore":число 0–100,' +
      '"strengths":["что менеджер сделал хорошо"],' +
      '"improvements":["что менеджеру стоило сделать иначе"]}\n' +
      'managerScore оценивает: выявил ли менеджер потребность, ответил ли на возражения, договорился ли о конкретном следующем шаге, был ли вежлив. ' +
      'clientIntent: hot — клиент готов покупать/бронировать, warm — интерес есть, но решение не принято, cold — интереса нет. ' +
      'sentiment — тональность со стороны клиента.';
    const context = lead
      ? `Контекст лида: имя «${lead.name || '—'}», статус «${lead.status || '—'}»${lead.amount ? `, сумма ${lead.amount} ${lead.currency || ''}` : ''}.\n\n`
      : '';

    try {
      const override = await this.resolveOverride(call.tenantId);
      const { message } = await this.oai().chatCompletionWithConfig(
        {
          messages: [
            { role: 'system', content: system },
            {
              role: 'user',
              content: `${context}Звонок состоялся: ${new Date(call.startedAt || call.createdAt).toISOString().slice(0, 10)} (${['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'][new Date(call.startedAt || call.createdAt).getUTCDay()]}).\n\nТранскрипт разговора:\n${transcript.slice(0, 24000)}`,
            },
          ],
          temperatureOverride: 0.2,
        },
        override,
      );
      const raw = String(message.content || '');
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('AI returned no JSON');
      const p = JSON.parse(m[0]);

      const analysis: CallAiAnalysis = {
        summary: String(p.summary || '').trim().slice(0, 2000),
        nextSteps: (Array.isArray(p.nextSteps) ? p.nextSteps : [])
          .map((s: any) => ({
            text: String(typeof s === 'string' ? s : s?.text || '').trim(),
            dueInDays: Number.isFinite(Number(s?.dueInDays)) && s?.dueInDays !== null ? Math.max(0, Math.round(Number(s.dueInDays))) : null,
          }))
          .filter((s: { text: string }) => s.text)
          .slice(0, 6),
        objections: strList(p.objections, 6),
        clientIntent: INTENTS.has(p.clientIntent) ? p.clientIntent : 'warm',
        managerScore: Math.min(100, Math.max(0, Math.round(Number(p.managerScore) || 0))),
        strengths: strList(p.strengths, 5),
        improvements: strList(p.improvements, 5),
        language: spokenLanguage,
      };
      if (!analysis.summary) throw new Error('AI returned empty summary');

      call.aiAnalysis = analysis;
      call.sentiment = SENTIMENTS.has(p.sentiment) ? p.sentiment : 'neutral';
      call.sentimentTopic = TOPICS.has(p.topic) ? p.topic : 'other';
      call.sentimentStatus = 'done';
      call.analysisStatus = 'done';
      call.analyzedAt = new Date();
      await this.callRepo.save(call);

      if (call.linkedLeadId) {
        const steps = analysis.nextSteps.map((s) => `• ${s.text}`).join('\n');
        await this.leadActivity()
          ?.add({
            tenantId: call.tenantId,
            leadId: call.linkedLeadId,
            type: 'call_analyzed',
            userId: call.uploadedByStaffId || call.staffUserId || null,
            comment: `${HISTORY_TITLE[outLang]}: ${analysis.summary}${steps ? `\n${steps}` : ''}`.slice(0, 4000),
          })
          .catch((e: any) => this.log.warn(`Lead activity for call ${call.id} failed: ${e?.message}`));
      }
    } catch (e: any) {
      this.log.warn(`Call ${call.id} analysis failed: ${e?.message}`);
      call.analysisStatus = 'failed';
      call.sentimentStatus = 'failed';
      call.analysisError = String(e?.response?.message || e?.message || 'Analysis failed').slice(0, 500);
      await this.callRepo.save(call);
    }
  }
}
