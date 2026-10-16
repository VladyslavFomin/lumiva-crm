import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'node:crypto';
import { IntegrationConnection } from '../integrations/integration-connection.entity';
import { resolveTenantAiOverrideFromRepo } from '../ai/tenant-ai-override.util';
import { HotelReview, HotelReviewTopic } from './reputation.entities';
import { ReputationConfig, ReviewSentiment, TOPIC_KEYS, TOPIC_LABELS_RU, TopicTranslations } from './reputation.constants';

type AiOpenAiService = import('../ai/ai-openai.service').AiOpenAiService;

const SENT = new Set(['positive', 'negative', 'neutral']);
const REVIEW_TRANSLATION_LANGS = new Set(['ru', 'en', 'tr', 'de', 'fr', 'es', 'it', 'uk', 'ar', 'zh']);

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

  async translateTopicLabel(tenantId: string, label: string): Promise<TopicTranslations> {
    const raw = await this.complete(
      tenantId,
      'You translate short hotel review category names. Preserve the exact meaning and return only valid JSON.',
      `Translate this category name into Russian, Turkish, and English. Keep each translation concise. Return exactly {"ru":"...","tr":"...","en":"..."}. Category: ${label.slice(0, 120)}`,
      true,
    );
    const result = this.parseJson(raw);
    const translations = {
      ru: String(result.ru || '').trim().slice(0, 60),
      tr: String(result.tr || '').trim().slice(0, 60),
      en: String(result.en || '').trim().slice(0, 60),
    };
    if (!translations.ru || !translations.tr || !translations.en) {
      throw new Error('AI returned incomplete category translations');
    }
    return translations;
  }

  /**
   * Темы и тональность текста отзыва по справочнику тенанта (без записи) — общий разбор для своих отзывов
   * и отзывов конкурентов. Бросает ошибку провайдера ИИ (кредиты/ключ) — вызывающий решает, что делать.
   */
  async classify(
    tenantId: string,
    cfg: ReputationConfig,
    r: { platform: string; ratingRaw: string | number | null; ratingScale: number | null; r10: number | null; text: string; fallback: ReviewSentiment | null },
  ): Promise<{ lang: string | null; sentiment: ReviewSentiment | null; topics: Array<{ topic: string; label: string | null; sentiment: ReviewSentiment; quote: string | null }> }> {
    const extra = cfg.topicsExtra || [];
    const disabled = new Set(cfg.topicsDisabled || []);
    const keys = [...TOPIC_KEYS.filter((key) => !disabled.has(key)), ...extra.map((x) => x.key)];
    const dict = keys.map((k) => {
      const category = extra.find((x) => x.key === k);
      const label = category?.translations
        ? `ru: ${category.translations.ru || category.label}; tr: ${category.translations.tr || category.label}; en: ${category.translations.en || category.label}`
        : TOPIC_LABELS_RU[k] || category?.label || k;
      return `${k} (${label})`;
    }).join(', ');
    const target = cfg.translateTo === 'en' ? 'English' : 'Russian';
    const raw = await this.complete(
      tenantId,
      'You analyse hotel guest reviews for the hotel management. Use ONLY what the guest actually wrote — never invent topics. Respond with a single JSON object.',
      `Platform: ${r.platform}. Rating: ${r.ratingRaw ?? '—'} of ${r.ratingScale ?? '—'} (${r.r10 ?? '—'}/10).
Review (original language, analyse it in this language): <<<${r.text.slice(0, 5000)}>>>

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
    const sentiment: ReviewSentiment | null = SENT.has(j.sentiment) ? j.sentiment : r.fallback;
    const keySet = new Set<string>(keys);
    const seen = new Set<string>();
    const topics: Array<{ topic: string; label: string | null; sentiment: ReviewSentiment; quote: string | null }> = [];
    for (const t of Array.isArray(j.topics) ? j.topics : []) {
      let topic = String(t?.topic || '').trim().toLowerCase();
      if (!keySet.has(topic)) topic = 'other';
      const label = topic === 'other' ? String(t?.other_label || '').trim().slice(0, 80) || null : null;
      const k = `${topic}|${label || ''}`;
      if (seen.has(k)) continue;
      seen.add(k);
      topics.push({ topic, label, sentiment: SENT.has(t?.sentiment) ? t.sentiment : sentiment || 'neutral', quote: t?.quote ? String(t.quote).slice(0, 300) : null });
    }
    return { lang, sentiment, topics: topics.slice(0, 12) };
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

    try {
      const c = await this.classify(review.tenantId, cfg, { platform: review.platform, ratingRaw: review.ratingRaw, ratingScale: review.ratingScale, r10, text, fallback: byRating });
      const lang = c.lang;
      const sentiment = c.sentiment;
      const rows: Partial<HotelReviewTopic>[] = c.topics.map((t) => ({
        tenantId: review.tenantId,
        reviewId: review.id,
        hotelId: review.hotelId,
        topic: t.topic,
        otherLabel: t.label,
        sentiment: t.sentiment,
        quote: t.quote,
        publishedAt: review.publishedAt,
      }));
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
  async translate(review: HotelReview, target: string): Promise<{ text: string | null; lang: string | null }> {
    if (!REVIEW_TRANSLATION_LANGS.has(target)) throw new Error('Unsupported translation language');
    if (review.textTranslated && review.translatedLang === target) return { text: review.textTranslated, lang: target };
    const text = [review.title, review.textOriginal].filter(Boolean).join('\n').trim();
    if (!text || review.lang === target) return { text: null, lang: null };
    let t = await this.translateOnly(review.tenantId, text, target);
    // модель иногда возвращает «исправленный» оригинал вместо перевода — один повтор
    if (!this.looksTranslated(t, target, text)) t = await this.translateOnly(review.tenantId, text, target);
    if (!this.looksTranslated(t, target, text)) throw new Error('Translation failed');
    await this.reviews.update({ id: review.id }, { textTranslated: t, translatedLang: target });
    return { text: t, lang: target };
  }

  private looksTranslated(t: string | null, target: string, source: string): boolean {
    if (!t) return false;
    const letters = t.replace(/[^\p{L}]/gu, '');
    if (!letters) return false;
    const cyr = (letters.match(/[\u0400-\u04FF]/g) || []).length / letters.length;
    if (target === 'ru' || target === 'uk') return cyr > 0.5;
    if (target === 'en') return cyr < 0.1;
    if (target === 'ar') return /[\u0600-\u06FF]/.test(t);
    if (target === 'zh') return /[\u4E00-\u9FFF]/.test(t);
    return t.trim().toLocaleLowerCase() !== source.trim().toLocaleLowerCase();
  }

  private async translateOnly(tenantId: string, text: string, target: string): Promise<string | null> {
    const lang = langName(target);
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
  async monthlySummary(tenantId: string, lang: string, facts: any): Promise<string | null> {
    try {
      const raw = await this.complete(
        tenantId,
        `You write a short monthly reputation summary for hotel brand management in ${langName(lang)}. Use ONLY the numbers given, never invent.`,
        `Facts (JSON): ${JSON.stringify(facts).slice(0, 12000)}\nWrite 3–5 sentences: rating trend, main complaints, which hotels need attention.`,
        false,
      );
      return raw.trim() || null;
    } catch {
      return null;
    }
  }
}
