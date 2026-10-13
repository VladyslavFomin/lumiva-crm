import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, LessThanOrEqual, Repository } from 'typeorm';
import axios from 'axios';
import { Hotel } from '../hotels/hotel.entity';
import { User } from '../users/user.entity';
import {
  HotelReview,
  HotelReviewReply,
  HotelReviewSource,
  HotelReviewTopic,
  HotelReviewVersion,
} from './reputation.entities';
import { PLATFORM_REPLY_HOME, REPLY_MODE, REPUTATION_PLATFORMS } from './reputation.constants';
import { ReputationSettingsService } from './reputation-settings.service';
import { GoogleBusinessService } from './google-business.service';
import { ReputationAiService } from './reputation-ai.service';
import { ReputationAlertsService } from './reputation-alerts.service';

export interface FeedQuery {
  brandId?: string;
  hotelId?: string;
  platform?: string;
  from?: string;
  to?: string;
  ratingMin?: string;
  ratingMax?: string;
  lang?: string;
  topic?: string;
  topicSentiment?: string;
  reply?: string; // none | replied
  sentiment?: string;
  status?: string; // active (по умолчанию: без удалённых) | deleted | all
  q?: string;
  sort?: string; // new | priority | rating_asc | rating_desc
  offset?: string;
  limit?: string;
}

/** Google: не больше 10 изменений в минуту на профиль — держим окно отправок по локации. */
const GOOGLE_REPLY_PER_MIN = 9;

@Injectable()
export class ReputationReviewsService {
  private readonly log = new Logger(ReputationReviewsService.name);
  private readonly sendWindow = new Map<string, number[]>();

  constructor(
    @InjectRepository(HotelReview) private readonly reviews: Repository<HotelReview>,
    @InjectRepository(HotelReviewVersion) private readonly versions: Repository<HotelReviewVersion>,
    @InjectRepository(HotelReviewReply) private readonly replies: Repository<HotelReviewReply>,
    @InjectRepository(HotelReviewTopic) private readonly topics: Repository<HotelReviewTopic>,
    @InjectRepository(HotelReviewSource) private readonly sources: Repository<HotelReviewSource>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly settings: ReputationSettingsService,
    private readonly google: GoogleBusinessService,
    private readonly ai: ReputationAiService,
    private readonly alerts: ReputationAlertsService,
  ) {}

  private toRow(r: HotelReview, topics: HotelReviewTopic[], negBelow: number) {
    const r10 = r.rating10 != null ? Number(r.rating10) : null;
    const replyMode = REPLY_MODE[r.platform];
    return {
      id: r.id,
      hotelId: r.hotelId,
      platform: r.platform,
      author: r.author,
      authorPhoto: r.authorPhoto,
      lang: r.lang,
      title: r.title,
      text: r.textOriginal,
      textTranslated: r.textTranslated,
      ratingRaw: r.ratingRaw != null ? Number(r.ratingRaw) : null,
      ratingScale: r.ratingScale,
      rating10: r10,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      travelDate: r.travelDate,
      status: r.status,
      sentiment: r.sentiment,
      hasReply: r.hasReply,
      repliedAt: r.repliedAt?.toISOString() ?? null,
      replyMode,
      /** Подсветка: негатив без ответа. */
      urgent: !r.hasReply && replyMode !== 'none' && r10 != null && r10 < negBelow && r.status !== 'deleted',
      topics: topics.map((t) => ({ topic: t.topic, label: t.otherLabel, sentiment: t.sentiment })),
      reviewUrl: r.reviewUrl,
    };
  }

  async feed(tenantId: string, q: FeedQuery) {
    const cfg = await this.settings.config(tenantId);
    const qb = this.reviews.createQueryBuilder('r').where('r.tenantId = :tenantId', { tenantId });
    if (q.brandId) qb.andWhere('r.hotelId IN (SELECT h.id FROM hotels h WHERE h."brandId" = :brandId)', { brandId: q.brandId });
    if (q.hotelId) qb.andWhere('r.hotelId = :hotelId', { hotelId: q.hotelId });
    if (q.platform && REPUTATION_PLATFORMS.includes(q.platform as any)) qb.andWhere('r.platform = :platform', { platform: q.platform });
    if (q.from) qb.andWhere('r.publishedAt >= :from', { from: new Date(q.from) });
    if (q.to) qb.andWhere('r.publishedAt < :to', { to: new Date(new Date(q.to).getTime() + 864e5) });
    if (q.ratingMin) qb.andWhere('r.rating10 >= :rmin', { rmin: Number(q.ratingMin) });
    if (q.ratingMax) qb.andWhere('r.rating10 <= :rmax', { rmax: Number(q.ratingMax) });
    if (q.lang) qb.andWhere('r.lang = :lang', { lang: q.lang });
    if (q.sentiment) qb.andWhere('r.sentiment = :sent', { sent: q.sentiment });
    if (q.topic) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM hotel_review_topics t WHERE t."reviewId" = r.id AND t.topic = :topic${q.topicSentiment ? ' AND t.sentiment = :tsent' : ''})`,
        { topic: q.topic, tsent: q.topicSentiment },
      );
    }
    if (q.reply === 'none') qb.andWhere(`r.hasReply = false AND r.platform <> 'check24'`);
    if (q.reply === 'replied') qb.andWhere('r.hasReply = true');
    if (q.status === 'deleted') qb.andWhere(`r.status = 'deleted'`);
    else if (q.status !== 'all') qb.andWhere(`r.status <> 'deleted'`);
    if (q.q?.trim()) {
      const s = `%${q.q.trim().slice(0, 100)}%`;
      qb.andWhere(new Brackets((w) => w.where('r.textOriginal ILIKE :s', { s }).orWhere('r.textTranslated ILIKE :s', { s }).orWhere('r.author ILIKE :s', { s })));
    }
    const total = await qb.getCount();
    if (q.sort === 'priority') {
      qb.orderBy(`CASE WHEN r.hasReply = false AND r.platform <> 'check24' AND r.rating10 < ${Number(cfg.thresholds.negativeBelow)} THEN 0 ELSE 1 END`, 'ASC')
        .addOrderBy('r.publishedAt', 'DESC', 'NULLS LAST');
    } else if (q.sort === 'rating_asc') qb.orderBy('r.rating10', 'ASC', 'NULLS LAST').addOrderBy('r.publishedAt', 'DESC');
    else if (q.sort === 'rating_desc') qb.orderBy('r.rating10', 'DESC', 'NULLS LAST').addOrderBy('r.publishedAt', 'DESC');
    else qb.orderBy('r.publishedAt', 'DESC', 'NULLS LAST');
    const limit = Math.min(200, Math.max(1, Number(q.limit) || 50));
    const offset = Math.max(0, Number(q.offset) || 0);
    const rows = await qb.skip(offset).take(limit).getMany();
    const topics = rows.length ? await this.topics.find({ where: { reviewId: In(rows.map((r) => r.id)) } }) : [];
    const negBelow = cfg.thresholds.negativeBelow;
    const unansweredNegative = await this.reviews
      .createQueryBuilder('r')
      .where(`r.tenantId = :tenantId AND r.hasReply = false AND r.platform <> 'check24' AND r.status <> 'deleted' AND r.rating10 < :nb`, { tenantId, nb: negBelow })
      .getCount();
    return {
      total,
      offset,
      limit,
      unansweredNegative,
      ai: await this.aiStatus(tenantId),
      items: rows.map((r) => this.toRow(r, topics.filter((t) => t.reviewId === r.id), negBelow)),
    };
  }

  /** Сколько отзывов ещё ждёт ИИ-разбора и последняя ошибка — чтобы пустые темы не выглядели как «жалоб нет». */
  async aiStatus(tenantId: string) {
    const [row] = await this.reviews.query(
      `SELECT COUNT(*) FILTER (WHERE "analyzedAt" IS NULL)::int AS pending,
              COUNT(*) FILTER (WHERE "analyzedAt" IS NULL AND "analysisError" IS NOT NULL)::int AS failed,
              (SELECT "analysisError" FROM hotel_reviews WHERE "tenantId" = $1 AND "analyzedAt" IS NULL AND "analysisError" IS NOT NULL ORDER BY "updatedAt" DESC LIMIT 1) AS "lastError"
         FROM hotel_reviews WHERE "tenantId" = $1 AND status <> 'deleted'`,
      [tenantId],
    );
    return { pending: row?.pending ?? 0, failed: row?.failed ?? 0, lastError: row?.lastError ?? null };
  }

  /** Языки, встречающиеся в отзывах — для фильтра. */
  async languages(tenantId: string) {
    const rows = await this.reviews.query(
      `SELECT lang, COUNT(*)::int AS n FROM hotel_reviews WHERE "tenantId" = $1 AND lang IS NOT NULL GROUP BY lang ORDER BY n DESC LIMIT 30`,
      [tenantId],
    );
    return rows;
  }

  async card(tenantId: string, id: string) {
    const r = await this.reviews.findOne({ where: { id, tenantId } });
    if (!r) throw new NotFoundException('Review not found');
    const cfg = await this.settings.config(tenantId);
    const [topics, versions, replies, hotel, source] = await Promise.all([
      this.topics.find({ where: { reviewId: r.id } }),
      this.versions.find({ where: { reviewId: r.id }, order: { capturedAt: 'ASC' } }),
      this.replies.find({ where: { reviewId: r.id }, order: { createdAt: 'ASC' } }),
      this.hotels.findOne({ where: { id: r.hotelId } }),
      r.sourceId ? this.sources.findOne({ where: { id: r.sourceId } }) : Promise.resolve(null),
    ]);
    const authorIds = [...new Set(replies.map((x) => x.authorUserId).filter(Boolean))] as string[];
    const authors = authorIds.length ? await this.users.find({ where: { id: In(authorIds) } }) : [];
    const googleApi = r.platform === 'google' && !!source?.externalId && (await this.google.isConnected(tenantId));
    const hcApi = r.platform === 'holidaycheck' && !!cfg.holidaycheck.replyUrlTemplate && !!source?.apiKeyEnc;
    const apiReady = r.platform === 'google' ? googleApi : r.platform === 'holidaycheck' ? hcApi : false;
    return {
      ...this.toRow(r, topics, cfg.thresholds.negativeBelow),
      translatedLang: r.translatedLang,
      subRatings: r.subRatings,
      replyText: r.replyText,
      replyMarkedManually: r.replyMarkedManually,
      aiDraft: r.aiDraft,
      analysisError: r.analysisError,
      deletedAt: r.deletedAt?.toISOString() ?? null,
      hotel: hotel ? { id: hotel.id, name: hotel.name, city: hotel.city, brandId: hotel.brandId } : null,
      sourceUrl: source?.url || null,
      replyHome: PLATFORM_REPLY_HOME[r.platform],
      /** api: отправка из CRM доступна сейчас; иначе — черновик + переход на площадку. */
      replyApiReady: apiReady,
      topics: topics.map((t) => ({ topic: t.topic, label: t.otherLabel, sentiment: t.sentiment, quote: t.quote })),
      versions: versions.map((v) => ({ rating10: v.rating10 != null ? Number(v.rating10) : null, ratingRaw: v.ratingRaw != null ? Number(v.ratingRaw) : null, text: v.text, capturedAt: v.capturedAt.toISOString() })),
      replies: replies.map((x) => ({
        id: x.id,
        text: x.text,
        source: x.source,
        status: x.status,
        error: x.error,
        postedAt: x.postedAt?.toISOString() ?? null,
        createdAt: x.createdAt.toISOString(),
        author: x.authorUserId ? (authors.find((u) => u.id === x.authorUserId) as any)?.name || (authors.find((u) => u.id === x.authorUserId) as any)?.email || null : null,
      })),
    };
  }

  async draft(tenantId: string, id: string, tone?: string) {
    const r = await this.reviews.findOne({ where: { id, tenantId } });
    if (!r) throw new NotFoundException('Review not found');
    if (REPLY_MODE[r.platform] === 'none') throw new BadRequestException('This platform does not publish hotel replies');
    const cfg = await this.settings.config(tenantId);
    const hotel = await this.hotels.findOne({ where: { id: r.hotelId } });
    const sig = cfg.signatures[r.hotelId] || hotel?.name || '';
    const text = await this.ai.draftReply(r, hotel?.name || '', sig, tone ? String(tone).slice(0, 100) : undefined);
    await this.reviews.update({ id: r.id }, { aiDraft: text.slice(0, 5000) });
    return { aiDraft: text };
  }

  async reanalyze(tenantId: string, id: string) {
    const r = await this.reviews.findOne({ where: { id, tenantId } });
    if (!r) throw new NotFoundException('Review not found');
    r.analysisHash = null;
    r.analyzedAt = null;
    await this.ai.analyze(r, await this.settings.config(tenantId));
    return this.card(tenantId, id);
  }

  /** Ответ из CRM (Google, HolidayCheck): в очередь, отправка с учётом лимитов площадки. */
  async reply(tenantId: string, userId: string, id: string, text: string) {
    const r = await this.reviews.findOne({ where: { id, tenantId } });
    if (!r) throw new NotFoundException('Review not found');
    const body = String(text || '').trim();
    if (!body) throw new BadRequestException('Reply text is empty');
    if (body.length > 4000) throw new BadRequestException('Reply is too long (max 4000)');
    if (REPLY_MODE[r.platform] !== 'api') throw new BadRequestException('Replies to this platform are posted on the platform itself');
    const card = await this.card(tenantId, id);
    if (!card.replyApiReady) throw new BadRequestException(r.platform === 'google' ? 'Google Business Profile is not connected for this hotel' : 'HolidayCheck reply API is not configured (key + endpoint)');
    const row = await this.replies.save(
      this.replies.create({ tenantId, reviewId: r.id, text: body, authorUserId: userId, source: 'crm', status: 'queued', nextAttemptAt: new Date() }),
    );
    await this.processReply(row).catch(() => undefined);
    return this.card(tenantId, id);
  }

  /** Отметка «отвечено на площадке» (Tripadvisor, Яндекс, Expedia, Otelpuan) или снятие отметки. */
  async markReplied(tenantId: string, userId: string, id: string, replied: boolean, text?: string) {
    const r = await this.reviews.findOne({ where: { id, tenantId } });
    if (!r) throw new NotFoundException('Review not found');
    if (REPLY_MODE[r.platform] === 'none') throw new BadRequestException('This platform does not publish hotel replies');
    if (replied) {
      r.hasReply = true;
      r.replyMarkedManually = true;
      r.repliedAt = r.repliedAt || new Date();
      if (text?.trim()) r.replyText = text.trim().slice(0, 5000);
      await this.replies.insert({ tenantId, reviewId: r.id, text: (text || r.aiDraft || '').trim() || '—', authorUserId: userId, source: 'manual', status: 'published', postedAt: new Date() } as any);
    } else if (r.replyMarkedManually) {
      r.hasReply = false;
      r.replyMarkedManually = false;
      r.repliedAt = null;
    }
    await this.reviews.save(r);
    return this.card(tenantId, id);
  }

  private allowGoogleSend(location: string): boolean {
    const now = Date.now();
    const w = (this.sendWindow.get(location) || []).filter((t) => now - t < 60_000);
    this.sendWindow.set(location, w);
    if (w.length >= GOOGLE_REPLY_PER_MIN) return false;
    w.push(now);
    return true;
  }

  /** Обработка одного ответа из очереди. Ошибка лимита — повтор позже, остальное — failed + алерт. */
  async processReply(row: HotelReviewReply) {
    const r = await this.reviews.findOne({ where: { id: row.reviewId } });
    if (!r) return;
    const source = r.sourceId ? await this.sources.findOne({ where: { id: r.sourceId } }) : null;
    const cfg = await this.settings.config(r.tenantId);
    const retryLater = async (ms: number, err?: string) => {
      await this.replies.update({ id: row.id }, { status: 'queued', nextAttemptAt: new Date(Date.now() + ms), error: err ?? null, attempts: row.attempts + 1 });
    };
    try {
      if (!source) throw new Error('Source removed');
      if (r.platform === 'google') {
        if (!source.externalId) throw new Error('Google location is not linked');
        if (!this.allowGoogleSend(source.externalId)) return retryLater(65_000);
        await this.replies.update({ id: row.id }, { status: 'sending' });
        const d = await this.google.reply(r.tenantId, source.externalId, r.externalReviewId, row.text);
        const at = d?.updateTime ? new Date(d.updateTime) : new Date();
        await this.replies.update({ id: row.id }, { status: 'sent', postedAt: at, error: null, attempts: row.attempts + 1 });
        await this.reviews.update({ id: r.id }, { hasReply: true, repliedAt: r.hasReply && r.repliedAt ? r.repliedAt : at, replyText: row.text, replyMarkedManually: false });
        return;
      }
      if (r.platform === 'holidaycheck') {
        const key = this.settings.sourceApiKey(source);
        const tpl = cfg.holidaycheck.replyUrlTemplate;
        if (!key || !tpl) throw new Error('HolidayCheck API key or reply endpoint is not configured');
        await this.replies.update({ id: row.id }, { status: 'sending' });
        const url = tpl.replace(/\{reviewId\}/g, encodeURIComponent(r.externalReviewId)).replace(/\{hotelId\}/g, encodeURIComponent(source.externalId || ''));
        await axios.request({
          method: cfg.holidaycheck.method,
          url,
          data: { [cfg.holidaycheck.bodyField || 'text']: row.text },
          headers: { [cfg.holidaycheck.authHeader || 'Authorization']: `${cfg.holidaycheck.authPrefix || ''}${key}`, 'Content-Type': 'application/json' },
          timeout: 30_000,
        });
        await this.replies.update({ id: row.id }, { status: 'sent', postedAt: new Date(), error: null, attempts: row.attempts + 1 });
        await this.reviews.update({ id: r.id }, { hasReply: true, repliedAt: r.repliedAt || new Date(), replyText: row.text, replyMarkedManually: false });
        return;
      }
      throw new Error('Platform does not support replies via API');
    } catch (e: any) {
      const status = e?.getResponse?.()?.httpStatus || e?.httpStatus || e?.response?.status;
      const msg = e?.getResponse?.()?.message || e?.response?.data?.error?.message || e?.response?.data?.message || e?.message || String(e);
      if ((status === 429 || /RATE_LIMIT|429/.test(String(msg))) && row.attempts < 8) return retryLater(90_000 * (row.attempts + 1), String(msg));
      await this.replies.update({ id: row.id }, { status: 'failed', error: String(msg).slice(0, 1000), attempts: row.attempts + 1 });
      await this.alerts.replyFailed(r, `${msg}${status === 401 || status === 403 ? '\nКлюч/доступ недействителен — перевыпустите ключ HolidayCheck в Business Center или переподключите Google.' : ''}`, cfg).catch(() => undefined);
    }
  }

  async retryReply(tenantId: string, replyId: string) {
    const row = await this.replies.findOne({ where: { id: replyId, tenantId } });
    if (!row) throw new NotFoundException('Reply not found');
    if (row.status !== 'failed') throw new BadRequestException('Only failed replies can be retried');
    row.status = 'queued';
    row.nextAttemptAt = new Date();
    await this.replies.save(row);
    await this.processReply(row);
    return this.card(tenantId, row.reviewId);
  }

  /** Очередь ответов: каждую минуту отправляем те, чей срок подошёл. */
  async processQueue() {
    const due = await this.replies.find({ where: { status: 'queued', nextAttemptAt: LessThanOrEqual(new Date()) }, order: { createdAt: 'ASC' }, take: 50 });
    for (const row of due) await this.processReply(row);
    // зависшие «sending» (рестарт контейнера посреди отправки) — вернуть в очередь
    await this.replies
      .createQueryBuilder()
      .update()
      .set({ status: 'queued', nextAttemptAt: new Date() })
      .where(`status = 'sending' AND "createdAt" < now() - interval '10 minutes'`)
      .execute();
  }
}
