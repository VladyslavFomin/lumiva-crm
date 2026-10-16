import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hotel } from '../hotels/hotel.entity';
import { HotelBrand, HotelReview, HotelReviewAlert, HotelReviewTopic } from './reputation.entities';
import { REPLY_MODE, TOPIC_LABELS_RU, activeTopicKeys, mergeConfig } from './reputation.constants';
import { reservationsComponentOn } from './reputation-reservations.service';
import { tenantFrontend } from './reputation-tenant.util';

type AutomationsService = import('../automations/automations.service').AutomationsService;

export const PLATFORM_LABEL: Record<string, string> = {
  google: 'Google', booking: 'Booking.com', holidaycheck: 'HolidayCheck', tripadvisor: 'Tripadvisor', yandex: 'Яндекс',
  expedia: 'Expedia', check24: 'Check24', otelpuan: 'Otelpuan',
};

/** События по отзывам старше этого срока не шлём: первая загрузка истории не должна запускать тысячи автоматизаций. */
const FRESH_DAYS = 7;

/**
 * События модуля отзывов → «Автоматизации» и ИИ-сотрудники (AutomationsService.triggerAutomation делает и то,
 * и другое). Данные — плоские токены для шаблонов и условий: {{hotel_name}}, {{rating10}}, {{text}}…
 */
@Injectable()
export class ReputationEventsService {
  private readonly log = new Logger(ReputationEventsService.name);

  constructor(
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(HotelBrand) private readonly brands: Repository<HotelBrand>,
    @InjectRepository(HotelReviewTopic) private readonly topics: Repository<HotelReviewTopic>,
    @InjectRepository(HotelReviewAlert) private readonly marks: Repository<HotelReviewAlert>,
    private readonly moduleRef: ModuleRef,
  ) {}

  private async automations(): Promise<AutomationsService | null> {
    try {
      // динамически: automations → ai-employees → … — статический импорт дал бы цикл модулей
      const { AutomationsService } = await import('../automations/automations.service.js');
      return this.moduleRef.get(AutomationsService, { strict: false });
    } catch {
      return null;
    }
  }

  isFresh(r: Pick<HotelReview, 'publishedAt'>): boolean {
    return !!r.publishedAt && Date.now() - r.publishedAt.getTime() < FRESH_DAYS * 864e5;
  }

  /** Плоские токены отзыва для шаблонов автоматизаций. */
  async tokens(r: HotelReview, extra: Record<string, unknown> = {}) {
    const hotel = await this.hotels.findOne({ where: { id: r.hotelId } });
    const brand = hotel?.brandId ? await this.brands.findOne({ where: { id: hotel.brandId } }) : null;
    // удалённые из справочника темы в токены не идут
    const [cfgRow] = await this.topics.query(`SELECT config FROM hotel_reputation_settings WHERE "tenantId" = $1`, [r.tenantId]);
    const active = new Set(activeTopicKeys(mergeConfig(cfgRow?.config)));
    const topics = (await this.topics.find({ where: { reviewId: r.id } })).filter((t) => active.has(t.topic));
    const frontend = await tenantFrontend((sql, p) => this.topics.query(sql, p), r.tenantId);
    const r10 = r.rating10 != null ? Number(r.rating10) : null;
    return {
      entityType: 'hotel_review',
      entityId: r.id,
      review_id: r.id,
      hotel_id: r.hotelId,
      hotel_name: hotel?.name || '',
      brand_name: brand?.name || '',
      platform: r.platform,
      platform_label: PLATFORM_LABEL[r.platform] || r.platform,
      rating10: r10,
      rating_raw: r.ratingRaw != null ? Number(r.ratingRaw) : null,
      rating_scale: r.ratingScale,
      rating_text: r10 == null ? '—' : `${r10.toFixed(1)}/10`,
      author: r.author || '',
      title: r.title || '',
      text: (r.textOriginal || '').slice(0, 1500),
      text_translated: (r.textTranslated || '').slice(0, 1500),
      lang: r.lang || '',
      sentiment: r.sentiment || '',
      topics: topics.map((t) => (t.topic === 'other' ? t.otherLabel || 'прочее' : TOPIC_LABELS_RU[t.topic] || t.topic)).join(', '),
      complaints: topics
        .filter((t) => t.sentiment === 'negative')
        .map((t) => (t.topic === 'other' ? t.otherLabel || 'прочее' : TOPIC_LABELS_RU[t.topic] || t.topic))
        .join(', '),
      published_at: r.publishedAt ? r.publishedAt.toISOString().slice(0, 10) : '',
      has_reply: r.hasReply,
      reply_mode: REPLY_MODE[r.platform],
      review_url: r.reviewUrl || '',
      crm_url: `${frontend}/hotels/reviews?review=${r.id}`,
      // номер и даты проживания, если отзыв связан с бронью
      room: r.reservationId && r.reservationMatch !== 'rejected' && r.reservationMatch !== 'suggested' && (await reservationsComponentOn((sql, p) => this.topics.query(sql, p), r.tenantId))
        ? ((await this.topics.query(
            `SELECT u.label FROM hotel_reservations x LEFT JOIN hotel_room_units u ON u.id = x."roomUnitId" WHERE x.id = $1`,
            [r.reservationId],
          ))[0]?.label ?? '')
        : '',
      ...extra,
    };
  }

  /** Отправить событие; при dedupKey — не чаще одного раза на ключ (метка в hotel_review_alerts). */
  async emit(tenantId: string, event: string, data: Record<string, unknown>, dedupKey?: string) {
    try {
      if (dedupKey) {
        const ins = await this.marks
          .createQueryBuilder()
          .insert()
          .values({ tenantId, kind: 'event', dedupKey: `evt:${dedupKey}`.slice(0, 300), title: event, body: null })
          .orIgnore()
          .returning(['id'])
          .execute();
        if (!ins.raw?.[0]?.id) return;
      }
      const a = await this.automations();
      if (a) await a.triggerAutomation(tenantId, event as any, data);
    } catch (e: any) {
      this.log.warn(`review event ${event} failed: ${e?.message || e}`);
    }
  }

  /** Новый отзыв: review.created (+ review.negative, если ниже порога) — только по свежим. */
  async reviewCreated(r: HotelReview, negBelow: number) {
    if (!this.isFresh(r)) return;
    const data = await this.tokens(r);
    await this.emit(r.tenantId, 'review.created', data, `created:${r.id}`);
    if (r.rating10 != null && Number(r.rating10) < negBelow) await this.emit(r.tenantId, 'review.negative', data, `negative:${r.id}`);
  }

  async ratingLowered(r: HotelReview, from: number, to: number) {
    await this.emit(r.tenantId, 'review.rating_lowered', await this.tokens(r, { old_rating10: from, new_rating10: to }), `lowered:${r.id}:${to}`);
  }

  async replied(r: HotelReview, text: string, source: 'crm' | 'platform' | 'manual') {
    if (!this.isFresh(r) && source === 'platform') return;
    await this.emit(r.tenantId, 'review.replied', await this.tokens(r, { reply_text: text.slice(0, 1500), reply_source: source }), `replied:${r.id}`);
  }

  async noReply(r: HotelReview, hours: number) {
    await this.emit(r.tenantId, 'review.no_reply', await this.tokens(r, { hours_without_reply: Math.round(hours) }), `no_reply:${r.id}`);
  }

  async topicSpike(tenantId: string, hotelId: string, topic: string, label: string, count: number, days: number, quotes: string[], bucket: number) {
    const hotel = await this.hotels.findOne({ where: { id: hotelId } });
    await this.emit(
      tenantId,
      'review.topic_spike',
      { entityType: 'hotel', entityId: hotelId, hotel_id: hotelId, hotel_name: hotel?.name || '', topic, topic_label: label, count, days, quotes: quotes.join(' | ') },
      `spike:${hotelId}:${topic}:${label}:${bucket}`,
    );
  }

  async ratingDrop(tenantId: string, hotelId: string, now: number, prev: number, week: number) {
    const hotel = await this.hotels.findOne({ where: { id: hotelId } });
    await this.emit(
      tenantId,
      'review.rating_drop',
      {
        entityType: 'hotel', entityId: hotelId, hotel_id: hotelId, hotel_name: hotel?.name || '',
        avg_now: Math.round(now * 100) / 100, avg_prev: Math.round(prev * 100) / 100, drop: Math.round((prev - now) * 100) / 100,
      },
      `drop:${hotelId}:${week}`,
    );
  }
}
