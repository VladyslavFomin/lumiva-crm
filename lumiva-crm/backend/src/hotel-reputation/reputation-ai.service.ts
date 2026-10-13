import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'node:crypto';
import { IntegrationConnection } from '../integrations/integration-connection.entity';
import { resolveTenantAiOverrideFromRepo } from '../ai/tenant-ai-override.util';
import { HotelReview, HotelReviewTopic } from './reputation.entities';
import { ReputationConfig, ReviewSentiment, TOPIC_KEYS, TOPIC_LABELS_RU } from './reputation.constants';

type AiOpenAiService = import('../ai/ai-openai.service').AiOpenAiService;

const SENT = new Set(['positive', 'negative', 'neutral']);

export function analysisHashOf(r: Pick<HotelReview, 'textOriginal' | 'title' | 'ratingRaw'>): string {
  return createHash('sha1').update(`${r.title || ''}|${r.textOriginal || ''}|${r.ratingRaw ?? ''}`).digest('hex');
}

function langName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code;
  } catch {
    return code;
  }
}

/**
 * ИИ по отзывам: темы из фиксированного справочника + тональность + цитата (один раз при поступлении и при
 * правке гостем), перевод по кнопке, черновик ответа на языке отзыва. Свой ключ LLM тенанта (BYOK)
 * используется, если подключён.
 */
@Injectable()
export class ReputationAiService {
  private readonly log = new Logger(ReputationAiService.name);

  constructor(
    @InjectRepository(HotelReview) private readonly reviews: Repository<HotelReview>,
    @InjectRepository(HotelReviewTopic) private readonly topics: Repository<HotelReviewTopic>,
    @InjectRepository(IntegrationConnection) private readonly integrationRepo: Repository<IntegrationConnection>,
    private readonly moduleRef: ModuleRef,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  private oai(): AiOpenAiService { return this.moduleRef.get(require('../ai/ai-openai.service').AiOpenAiService, { strict: false }); }

  private async complete(tenantId: string, system: string, user: string, json: boolean): Promise<string> {
    const override = await resolveTenantAiOverrideFromRepo(this.integrationRepo, tenantId);
    const { message } = await this.oai().chatCompletionWithConfig(
      { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperatureOverride: 0.2, jsonMode: json },
      override,
    );
    return String(message?.content || '');
  }

  private parseJson(raw: string): any {
    const s = raw.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '');
    const a = s.indexOf('{');
    const b = s.lastIndexOf('}');
    return a >= 0 && b > a ? JSON.parse(s.slice(a, b + 1)) : {};
  }

  /**
   * Разбор одного отзыва. Без текста — только тональность по оценке (в тематическом анализе пропускаем).
   * Возвращает true, если разбор выполнен (для счётчиков).
   */
  async analyze(review: HotelReview, cfg: ReputationConfig): Promise<boolean> {
    const hash = analysisHashOf(review);
    if (review.analysisHash === hash && review.analyzedAt) return false;
    const r10 = review.rating10 != null ? Number(review.rating10) : null;
    const byRating: ReviewSentiment | null = r10 == null ? null : r10 < cfg.thresholds.negativeBelow ? 'negative' : r10 >= 8 ? 'positive' : 'neutral';
    // темы — только по тексту гостя: один заголовок (или его отсутствие) не повод придумывать жалобы
    const text = review.textOriginal?.trim() ? [review.title, review.textOriginal].filter(Boolean).join('\n').trim() : '';

    if (!text) {
      await this.topics.delete({ reviewId: review.id });
      await this.reviews.update({ id: review.id }, { sentiment: byRating, analyzedAt: new Date(), analysisHash: hash, analysisError: null, textTranslated: null });
      return true;
    }

    const extra = cfg.topicsExtra || [];
    const keys = [...TOPIC_KEYS, ...extra.map((x) => x.key)];
    const dict = keys.map((k) => `${k} (${TOPIC_LABELS_RU[k] || extra.find((x) => x.key === k)?.label || k})`).join(', ');
    const target = cfg.translateTo === 'en' ? 'English' : 'Russian';
    try {
      const raw = await this.complete(
        review.tenantId,
        'You analyse hotel guest reviews for the hotel management. Use ONLY what the guest actually wrote — never invent topics. Respond with a single JSON object.',
        `Platform: ${review.platform}. Rating: ${review.ratingRaw ?? '—'} of ${review.ratingScale ?? '—'} (${r10 ?? '—'}/10).
Review (original language, analyse it in this language): <<<${text.slice(0, 5000)}>>>

Topic dictionary (use these exact keys): ${dict}.
Return JSON:
{"lang":"ISO 639-1 code of the ORIGINAL text",
 "sentiment":"positive|negative|neutral — overall, consider rating and text",
 "topics":[{"topic":"dictionary key, or \\"other\\" if nothing fits","other_label":"short ${target} label, only for other","sentiment":"positive|negative|neutral","quote":"short verbatim quote (max 140 chars) from the original text"}]}
Each topic at most once; only topics the guest really mentions.`,
        true,
      );
      const j = this.parseJson(raw);
      const lang = typeof j.lang === 'string' && /^[a-z]{2}$/i.test(j.lang) ? j.lang.toLowerCase() : null;
      const sentiment: ReviewSentiment | null = SENT.has(j.sentiment) ? j.sentiment : byRating;
      const keySet = new Set<string>(keys);
      const seen = new Set<string>();
      const rows: Partial<HotelReviewTopic>[] = [];
      for (const t of Array.isArray(j.topics) ? j.topics : []) {
        let topic = String(t?.topic || '').trim().toLowerCase();
        if (!keySet.has(topic)) topic = 'other';
        const label = topic === 'other' ? String(t?.other_label || '').trim().slice(0, 80) || null : null;
        const k = `${topic}|${label || ''}`;
        if (seen.has(k)) continue;
        seen.add(k);
        rows.push({
          tenantId: review.tenantId,
          reviewId: review.id,
          hotelId: review.hotelId,
          topic,
          otherLabel: label,
          sentiment: SENT.has(t?.sentiment) ? t.sentiment : sentiment || 'neutral',
          quote: t?.quote ? String(t.quote).slice(0, 300) : null,
          publishedAt: review.publishedAt,
        });
      }
      await this.topics.delete({ reviewId: review.id });
      if (rows.length) await this.topics.insert(rows.slice(0, 12) as any);
      // перевод здесь не делаем — только по кнопке в карточке (translate); гость изменил текст → старый перевод неактуален
      const textChanged = !!review.analysisHash && review.analysisHash !== hash;
      await this.reviews.update(
        { id: review.id },
        {
          sentiment,
          lang: review.lang || lang,
          ...(textChanged ? { textTranslated: null, translatedLang: null } : {}),
          analyzedAt: new Date(),
          analysisHash: hash,
          analysisError: null,
        },
      );
      return true;
    } catch (e: any) {
      this.log.warn(`review ${review.id} analysis failed: ${e?.message || e}`);
      await this.reviews.update({ id: review.id }, { sentiment: review.sentiment || byRating, analysisError: String(e?.message || e).slice(0, 300) });
      return false;
    }
  }

  /**
   * Перевод одного отзыва по запросу пользователя (не массово: история за годы почти никому не нужна в переводе).
   * Результат кэшируется в textTranslated — повторное открытие бесплатно.
   */
  async translate(review: HotelReview, target: 'ru' | 'en'): Promise<{ text: string | null; lang: string | null }> {
    if (review.textTranslated && review.translatedLang === target) return { text: review.textTranslated, lang: target };
    const text = [review.title, review.textOriginal].filter(Boolean).join('\n').trim();
    if (!text || review.lang === target) return { text: null, lang: null };
    let t = await this.translateOnly(review.tenantId, text, target);
    // модель иногда возвращает «исправленный» оригинал вместо перевода — один повтор
    if (!this.looksTranslated(t, target)) t = await this.translateOnly(review.tenantId, text, target);
    if (!this.looksTranslated(t, target)) throw new Error('Translation failed');
    await this.reviews.update({ id: review.id }, { textTranslated: t, translatedLang: target });
    return { text: t, lang: target };
  }

  private looksTranslated(t: string | null, target: 'ru' | 'en'): boolean {
    if (!t) return false;
    const letters = t.replace(/[^\p{L}]/gu, '');
    if (!letters) return false;
    const cyr = (letters.match(/[\u0400-\u04FF]/g) || []).length / letters.length;
    return target === 'ru' ? cyr > 0.5 : cyr < 0.1 && !/[ğışçöü]{2,}/i.test(t);
  }

  private async translateOnly(tenantId: string, text: string, target: 'ru' | 'en'): Promise<string | null> {
    const lang = target === 'en' ? 'English' : 'Russian';
    const raw = await this.complete(
      tenantId,
      `You are a translator. Translate the user's text into ${lang}. Output only the ${lang} translation, nothing else.`,
      text.slice(0, 5000),
      false,
    );
    return raw.trim() ? raw.trim().slice(0, 10000) : null;
  }

  /** Черновик ответа на языке отзыва (подпись — отдельной строкой). */
  async draftReply(review: HotelReview, hotelName: string, signature: string, tone?: string): Promise<string> {
    const lang = langName(review.lang || 'en');
    const text = [review.title, review.textOriginal].filter(Boolean).join('\n').trim();
    const raw = await this.complete(
      review.tenantId,
      `You write public replies to hotel guest reviews on behalf of "${hotelName}". You ALWAYS write in ${lang}, whatever language these instructions are in.`,
      `${tone ? `Tone: ${tone}\n` : ''}Review on ${review.platform} (${review.rating10 ?? '—'}/10) by ${review.author || 'a guest'}: <<<${(text || 'rating only, no text').slice(0, 3000)}>>>

Write the reply in ${lang} only: ${text ? '3–6 sentences' : '1–2 sentences'}, warm and specific to what they wrote. For complaints: apologise without excuses, say what the team will check, invite them to contact the hotel directly. No invented facts, no promises of compensation, no private data, never argue. No signature — it is added automatically.
Output only the reply text.`,
      false,
    );
    const body = raw.trim();
    if (!body) throw new Error('Empty AI reply');
    const sig = signature.trim();
    return sig && !body.toLowerCase().endsWith(sig.toLowerCase()) ? `${body}\n\n${sig}` : body;
  }

  /** Тексты для месячного отчёта: короткий вывод по бренду на рабочем языке. */
  async monthlySummary(tenantId: string, lang: 'ru' | 'en', facts: any): Promise<string | null> {
    try {
      const raw = await this.complete(
        tenantId,
        `You write a short monthly reputation summary for hotel brand management in ${lang === 'en' ? 'English' : 'Russian'}. Use ONLY the numbers given, never invent.`,
        `Facts (JSON): ${JSON.stringify(facts).slice(0, 12000)}\nWrite 3–5 sentences: rating trend, main complaints, which hotels need attention.`,
        false,
      );
      return raw.trim() || null;
    } catch {
      return null;
    }
  }
}
