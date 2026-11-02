import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { Hotel } from './hotel.entity';
import { HotelReservation } from './hotel-reservation.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelRoomUnit } from './hotel-room-unit.entity';
import { HotelGuestFeedback, HotelFeedbackStage, HotelJourneySend } from './hotel-guest-journey.entities';
import { HotelFolioService, hotelToday } from './hotel-folio.service';
import { HotelReservationsService } from './hotel-reservations.service';
import { HotelPrecheckinService } from './hotel-precheckin.service';
import { HotelPaymentLinksService } from './hotel-payment-links.service';
import { HotelReviewSource } from '../hotel-reputation/reputation.entities';
import { Automation, TriggerEvent } from '../automations/automation.entity';
import { AutomationExecution } from '../automations/automation-execution.entity';
import { AutomationsService } from '../automations/automations.service';
import { tenantFrontend } from '../common/tenant-branding.util';
import { HOTEL_JOURNEY_PRESETS } from './hotel-guest-journey.presets';

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const r2 = (n: number) => Math.round(n * 100) / 100;
const bad = (code: string, message: string) => new BadRequestException({ code, message });

/** Триггеры «по времени»: проверяются здесь (по часам отеля), каждой брони — один раз на автоматизацию */
export const JOURNEY_EVENTS = [
  TriggerEvent.HOTEL_GUEST_BEFORE_ARRIVAL,
  TriggerEvent.HOTEL_GUEST_ARRIVAL_DAY,
  TriggerEvent.HOTEL_GUEST_IN_STAY,
  TriggerEvent.HOTEL_GUEST_AFTER_DEPARTURE,
  TriggerEvent.HOTEL_DEPOSIT_DUE,
] as const;
type JourneyEvent = (typeof JOURNEY_EVENTS)[number];

const STAGE: Partial<Record<string, HotelFeedbackStage>> = {
  [TriggerEvent.HOTEL_GUEST_IN_STAY]: 'in_stay',
  [TriggerEvent.HOTEL_GUEST_AFTER_DEPARTURE]: 'after_stay',
};

const PLATFORM_ORDER = ['google', 'tripadvisor', 'booking', 'holidaycheck', 'expedia', 'hotels', 'yandex', 'trustyou', 'zoover', 'otelpuan', 'tatilsepeti'];

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const localHM = (tz: string | null | undefined) => {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: tz || 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  } catch {
    return new Date().toISOString().slice(11, 16);
  }
};

export interface JourneyMeta {
  offsetDays?: number;
  sendTime?: string;
  hotelIds?: string[];
}

/**
 * «Путь гостя» в автоматизациях: сам ничего не отправляет и текстов не хранит — только решает, КОГДА какой брони
 * сработать автоматизации (до заезда / день заезда / N-й день проживания / после выезда / срок предоплаты), и даёт
 * ей данные брони и ссылки. Текст, канал, язык, журнал и отчёт — в «Инструменты → Автоматизации».
 * Плюс опрос гостя (/fb/:token) и события оплаты / отзыва гостя.
 */
@Injectable()
export class HotelGuestJourneyService implements OnModuleInit {
  private readonly log = new Logger(HotelGuestJourneyService.name);

  constructor(
    @InjectRepository(Automation) private readonly automations: Repository<Automation>,
    @InjectRepository(AutomationExecution) private readonly executions: Repository<AutomationExecution>,
    @InjectRepository(HotelJourneySend) private readonly sends: Repository<HotelJourneySend>,
    @InjectRepository(HotelGuestFeedback) private readonly feedback: Repository<HotelGuestFeedback>,
    @InjectRepository(HotelReservation) private readonly reservations: Repository<HotelReservation>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(HotelRoomType) private readonly roomTypes: Repository<HotelRoomType>,
    @InjectRepository(HotelRoomUnit) private readonly units: Repository<HotelRoomUnit>,
    @InjectRepository(HotelReviewSource) private readonly reviewSources: Repository<HotelReviewSource>,
    private readonly folio: HotelFolioService,
    private readonly precheckin: HotelPrecheckinService,
    private readonly payLinks: HotelPaymentLinksService,
    private readonly automationsService: AutomationsService,
  ) {}

  onModuleInit() {
    // онлайн-оплата брони → событие для автоматизаций («спасибо, оплата получена» и т. п.)
    this.payLinks.onApplied(async (tenantId, reservationId, amount, currency, provider) => {
      const r = await this.reservations.findOne({ where: { id: reservationId, tenantId } });
      if (!r) return;
      const tokens = await this.tokens(r, '');
      await this.automationsService.triggerAutomation(tenantId, TriggerEvent.HOTEL_PAYMENT_RECEIVED, {
        entityType: 'hotel_reservation', entityId: r.id, reservation: r, ...tokens,
        payment_amount: String(amount), payment_currency: currency, payment_provider: provider,
      });
    });
  }

  private async base(tenantId: string) {
    return tenantFrontend((sql, params) => this.sends.manager.query(sql, params), tenantId);
  }

  /**
   * Плоские токены брони для текстов автоматизаций. Ссылки создаются только если они есть в тексте автоматизации
   * (needs — строка шагов): иначе не плодим запросы оплаты / опросы впустую.
   */
  async tokens(r: HotelReservation, needs: string, opts: { automationId?: string | null; event?: string; payKind?: 'deposit' | 'balance' } = {}) {
    const [hotel, rt, unit] = await Promise.all([
      this.hotels.findOne({ where: { id: r.hotelId, tenantId: r.tenantId } }),
      r.roomTypeId ? this.roomTypes.findOne({ where: { id: r.roomTypeId } }) : Promise.resolve(null),
      r.roomUnitId ? this.units.findOne({ where: { id: r.roomUnitId, tenantId: r.tenantId } }) : Promise.resolve(null),
    ]);
    const f = await this.folio.folio(r.tenantId, r.id).catch(() => null);
    const paidGuest = f?.summary.folios.guest.payments ?? 0;
    const depositLeft = r2(Math.max(0, num(r.depositAmount) - paidGuest));
    const nights = Math.max(1, Math.round((Date.parse(`${r.checkOut}T00:00:00Z`) - Date.parse(`${r.checkIn}T00:00:00Z`)) / 86_400_000));
    const lang = HotelReservationsService.guestLang(r.guestCountry);
    const out: Record<string, string> = {
      guest_name: r.guestName || '',
      guest_first_name: String(r.guestName || '').trim().split(/\s+/)[0] || '',
      guest_email: r.guestEmail || '',
      guest_phone: r.guestPhone || '',
      guest_lang: lang,
      recipient_lang: lang,
      room_type: rt?.name || '',
      room_number: unit?.label || '',
      check_in: r.checkIn,
      check_out: r.checkOut,
      nights: String(nights),
      guests: String(r.pax || ''),
      board: r.boardType || '',
      hotel_name: hotel?.name || '',
      hotel_city: hotel?.city || '',
      hotel_address: hotel?.address || '',
      checkin_time: hotel?.checkInTime || '',
      checkout_time: hotel?.checkOutTime || '',
      booking_id: r.id,
      booking_code: r.bookingCode || '',
      status: r.status,
      total: String(num(r.total)),
      currency: (hotel?.currency || '').toUpperCase(),
      balance: String(f?.summary.folios.guest.balance ?? ''),
      deposit_amount: String(num(r.depositAmount)),
      deposit_left: String(depositLeft),
      deposit_due: r.depositDueDate || '',
      precheckin_link: '',
      pay_link: '',
      guest_care_link: '',
      survey_link: '',
    };
    const base = needs ? await this.base(r.tenantId) : '';
    if (needs.includes('precheckin_link')) {
      out.precheckin_link = await this.precheckin.link(r.tenantId, r.id).then((x) => x.url).catch(() => '');
    }
    if (needs.includes('guest_care_link') && unit) {
      if (!unit.guestToken) {
        unit.guestToken = randomBytes(12).toString('base64url');
        await this.units.update({ id: unit.id }, { guestToken: unit.guestToken });
      }
      out.guest_care_link = `${base}/g/${unit.guestToken}`;
    }
    if (needs.includes('pay_link')) {
      out.pay_link = await this.payLinks.forAutomation(r.tenantId, r.id, opts.payKind || (depositLeft > 0 ? 'deposit' : 'balance')).then((q) => q?.url || '').catch(() => '');
    }
    if (needs.includes('survey_link')) {
      const fb = await this.feedback.save(this.feedback.create({
        tenantId: r.tenantId, hotelId: r.hotelId, reservationId: r.id, token: randomBytes(18).toString('hex'),
        stage: (opts.event && STAGE[opts.event]) || 'other', automationId: opts.automationId ?? null,
      }));
      out.survey_link = `${base}/fb/${fb.token}`;
    }
    return out;
  }

  private meta(a: Automation): Required<JourneyMeta> {
    const m = (a.meta || {}) as JourneyMeta;
    const t = /^\d{2}:\d{2}$/.test(String(m.sendTime || '')) ? String(m.sendTime) : '10:00';
    const def = a.triggerEvent === TriggerEvent.HOTEL_GUEST_IN_STAY ? 1 : a.triggerEvent === TriggerEvent.HOTEL_GUEST_AFTER_DEPARTURE ? 1 : a.triggerEvent === TriggerEvent.HOTEL_GUEST_ARRIVAL_DAY ? 0 : 3;
    const off = Number.isFinite(Number(m.offsetDays)) ? Math.min(365, Math.max(0, Math.round(Number(m.offsetDays)))) : def;
    return { offsetDays: off, sendTime: t, hotelIds: Array.isArray(m.hotelIds) ? m.hotelIds.filter(Boolean) : [] };
  }

  /** Брони, которым эта автоматизация должна сработать сегодня (по дате отеля) */
  private async candidates(a: Automation, hotel: Hotel, today: string) {
    const { offsetDays } = this.meta(a);
    const qb = this.reservations
      .createQueryBuilder('r')
      .where('r.tenantId = :t AND r.hotelId = :h', { t: a.tenantId, h: hotel.id })
      .andWhere('r.roomingPending = false')
      .andWhere(`NOT EXISTS (SELECT 1 FROM hotel_journey_sends s WHERE s."automationId" = :a AND s."reservationId" = r.id)`, { a: a.id });
    switch (a.triggerEvent as JourneyEvent) {
      case TriggerEvent.HOTEL_GUEST_BEFORE_ARRIVAL:
        qb.andWhere('r.checkIn = :d', { d: addDays(today, offsetDays) }).andWhere('r.status IN (:...st)', { st: ['pending', 'confirmed'] });
        break;
      case TriggerEvent.HOTEL_GUEST_ARRIVAL_DAY:
        qb.andWhere('r.checkIn = :d', { d: today }).andWhere('r.status IN (:...st)', { st: ['pending', 'confirmed', 'checked_in'] });
        break;
      case TriggerEvent.HOTEL_GUEST_IN_STAY:
        qb.andWhere('r.checkIn = :d', { d: addDays(today, -Math.max(1, offsetDays)) }).andWhere('r.checkOut > :today', { today }).andWhere('r.status = :st', { st: 'checked_in' });
        break;
      case TriggerEvent.HOTEL_GUEST_AFTER_DEPARTURE:
        qb.andWhere('r.checkOut = :d', { d: addDays(today, -offsetDays) }).andWhere('r.status = :st', { st: 'checked_out' });
        break;
      case TriggerEvent.HOTEL_DEPOSIT_DUE:
        qb.andWhere('r.depositDueDate = :d', { d: addDays(today, offsetDays) }).andWhere('r.status IN (:...st)', { st: ['pending', 'confirmed'] }).andWhere('r.depositAmount > 0');
        break;
      default:
        return [];
    }
    return qb.orderBy('r.createdAt', 'ASC').take(200).getMany();
  }

  /** Крон: раз в 5 минут — все активные автоматизации «пути гостя» всех клиентов */
  async run() {
    const list = await this.automations.find({ where: { isActive: true, triggerEvent: In([...JOURNEY_EVENTS]) } });
    let fired = 0;
    for (const a of list) {
      try {
        fired += await this.runAutomation(a);
      } catch (e) {
        this.log.warn(`journey ${a.id}: ${(e as Error).message}`);
      }
    }
    return fired;
  }

  private async runAutomation(a: Automation) {
    const { sendTime, hotelIds } = this.meta(a);
    const hotels = await this.hotels.find({ where: { tenantId: a.tenantId, ...(hotelIds.length ? { id: In(hotelIds) } : {}) } });
    const needs = JSON.stringify(a.actions || []);
    let fired = 0;
    for (const h of hotels) {
      if (localHM(h.timezone) < sendTime) continue;
      const today = hotelToday(h);
      for (const r of await this.candidates(a, h, today)) {
        if (a.triggerEvent === TriggerEvent.HOTEL_DEPOSIT_DUE) {
          const f = await this.folio.folio(r.tenantId, r.id);
          if (f.summary.folios.guest.payments + 0.009 >= num(r.depositAmount)) continue;
        }
        // «застолбить» до отправки: два процесса не отправят дважды (уникальный индекс)
        const claimed: Array<{ id: string }> = await this.sends.manager.query(
          `INSERT INTO hotel_journey_sends ("tenantId", "automationId", "reservationId", "triggerEvent") VALUES ($1, $2, $3, $4)
           ON CONFLICT ("automationId", "reservationId") DO NOTHING RETURNING id`,
          [a.tenantId, a.id, r.id, a.triggerEvent],
        );
        if (!claimed.length) continue;
        const exec = await this.fire(a, r, needs);
        if (exec) await this.sends.update({ id: claimed[0].id }, { executionId: exec.id });
        fired += 1;
      }
    }
    return fired;
  }

  private async fire(a: Automation, r: HotelReservation, needs: string) {
    const tokens = await this.tokens(r, needs, { automationId: a.id, event: a.triggerEvent, payKind: a.triggerEvent === TriggerEvent.HOTEL_DEPOSIT_DUE ? 'deposit' : undefined });
    return this.automationsService.triggerOne(a.id, a.triggerEvent as TriggerEvent, { entityType: 'hotel_reservation', entityId: r.id, reservation: r, ...tokens });
  }

  /** «Проверить на брони»: запуск автоматизации пути гостя для выбранной брони сейчас, мимо журнала «уже отправлено» */
  async test(tenantId: string, automationId: string, reservationId: string) {
    const a = await this.automations.findOne({ where: { id: automationId, tenantId } });
    if (!a) throw new NotFoundException('Автоматизация не найдена');
    if (!(JOURNEY_EVENTS as readonly string[]).includes(a.triggerEvent)) throw bad('HOTEL_JOURNEY_NOT_JOURNEY', 'Это не автоматизация пути гостя');
    if (!a.isActive) throw bad('HOTEL_JOURNEY_INACTIVE', 'Включите автоматизацию, чтобы проверить её');
    const r = await this.reservations.findOne({ where: { id: reservationId, tenantId } });
    if (!r) throw new NotFoundException('Бронь не найдена');
    const exec = await this.fire(a, r, JSON.stringify(a.actions || []));
    if (!exec) throw bad('HOTEL_JOURNEY_SKIPPED', 'Автоматизация не запустилась: не прошли условия, лимит или пауза между запусками');
    return { executionId: exec.id, status: exec.status, error: exec.errorMessage };
  }

  /** Сколько броней получат автоматизацию сегодня / уже получили — подсказка в конструкторе */
  async preview(tenantId: string, automationId: string) {
    const a = await this.automations.findOne({ where: { id: automationId, tenantId } });
    if (!a) throw new NotFoundException('Автоматизация не найдена');
    const { hotelIds, sendTime } = this.meta(a);
    const hotels = await this.hotels.find({ where: { tenantId, ...(hotelIds.length ? { id: In(hotelIds) } : {}) } });
    let today = 0;
    const sample: Array<{ id: string; guestName: string; checkIn: string; checkOut: string; hotel: string }> = [];
    for (const h of hotels) {
      const rows = await this.candidates(a, h, hotelToday(h));
      today += rows.length;
      for (const r of rows.slice(0, 5 - sample.length)) sample.push({ id: r.id, guestName: r.guestName, checkIn: r.checkIn, checkOut: r.checkOut, hotel: h.name });
    }
    const sent = await this.sends.count({ where: { automationId: a.id } });
    return { today, sendTime, sent, sample };
  }

  /** Готовые сценарии отеля → обычные автоматизации, выключенные (уже поставленные по presetKey не дублируем) */
  async installPresets(tenantId: string, lang: string, keys?: string[]) {
    const l = (lang === 'en' || lang === 'tr' ? lang : 'ru') as 'ru' | 'en' | 'tr';
    const existing = await this.automations.find({ where: { tenantId } });
    const have = new Set(existing.map((a) => (a.meta as any)?.presetKey).filter(Boolean));
    const created: Array<{ id: string; name: string; key: string }> = [];
    for (const p of HOTEL_JOURNEY_PRESETS) {
      if (keys?.length && !keys.includes(p.key)) continue;
      if (have.has(`hotel:${p.key}`)) continue;
      const a = await this.automations.save(this.automations.create({
        tenantId, name: p.name[l], description: null, triggerEvent: p.triggerEvent, conditions: p.conditions ?? null,
        actions: p.actions as any, isActive: false, meta: { ...p.meta, presetKey: `hotel:${p.key}` },
      }));
      created.push({ id: a.id, name: a.name, key: p.key });
    }
    return { created, total: HOTEL_JOURNEY_PRESETS.length, alreadyInstalled: HOTEL_JOURNEY_PRESETS.length - created.length - (keys?.length ? HOTEL_JOURNEY_PRESETS.length - keys.length : 0) };
  }

  presetList(lang: string) {
    const l = (lang === 'en' || lang === 'tr' ? lang : 'ru') as 'ru' | 'en' | 'tr';
    return HOTEL_JOURNEY_PRESETS.map((p) => ({ key: p.key, name: p.name[l], triggerEvent: p.triggerEvent, meta: p.meta }));
  }

  // ─── опрос гостя /fb/:token ───

  private async byToken(token: string) {
    const fb = /^[a-f0-9]{36}$/.test(String(token || '')) ? await this.feedback.findOne({ where: { token } }) : null;
    if (!fb) throw new NotFoundException('Опрос не найден');
    return fb;
  }

  private async reviewLinks(tenantId: string, hotelId: string) {
    const rows = await this.reviewSources.find({ where: { tenantId, hotelId, active: true } });
    return rows
      .filter((s) => /^https?:\/\//.test(String(s.url || '')))
      .sort((a, b) => (PLATFORM_ORDER.indexOf(a.platform) + 99) % 99 - (PLATFORM_ORDER.indexOf(b.platform) + 99) % 99)
      .map((s) => ({ platform: s.platform, url: s.url as string }));
  }

  async publicGet(token: string) {
    const fb = await this.byToken(token);
    const [r, h] = await Promise.all([
      this.reservations.findOne({ where: { id: fb.reservationId, tenantId: fb.tenantId } }),
      this.hotels.findOne({ where: { id: fb.hotelId, tenantId: fb.tenantId } }),
    ]);
    if (!r || !h) throw new NotFoundException('Опрос не найден');
    if (!fb.openedAt) await this.feedback.update({ id: fb.id }, { openedAt: new Date() });
    return {
      hotel: h.name, guestFirstName: String(r.guestName || '').trim().split(/\s+/)[0] || '', stage: fb.stage, lang: HotelReservationsService.guestLang(r.guestCountry),
      score: fb.score, comment: fb.comment, answered: !!fb.answeredAt,
      reviewLinks: fb.score && fb.score >= 4 ? (await this.reviewLinks(fb.tenantId, fb.hotelId)).map((x) => ({ platform: x.platform })) : [],
    };
  }

  async publicSubmit(token: string, dto: { score?: number; comment?: string }) {
    const fb = await this.byToken(token);
    const score = Math.round(Number(dto?.score));
    if (!(score >= 1 && score <= 5)) throw bad('HOTEL_FEEDBACK_SCORE', 'Поставьте оценку от 1 до 5');
    // ответ можно поправить в течение суток — событие для автоматизаций только по первому ответу
    if (fb.answeredAt && Date.now() - fb.answeredAt.getTime() > 86_400_000) throw bad('HOTEL_FEEDBACK_CLOSED', 'Ответ уже принят');
    const first = !fb.answeredAt;
    fb.score = score;
    fb.comment = String(dto?.comment || '').trim().slice(0, 3000) || null;
    fb.answeredAt = fb.answeredAt || new Date();
    await this.feedback.save(fb);
    if (first) {
      const r = await this.reservations.findOne({ where: { id: fb.reservationId, tenantId: fb.tenantId } });
      if (r) {
        const tokens = await this.tokens(r, '');
        const base = await this.base(fb.tenantId);
        const data = {
          entityType: 'hotel_reservation', entityId: r.id, reservation: r, ...tokens, score: String(score), score_stars: '★'.repeat(score) + '☆'.repeat(5 - score),
          comment: fb.comment || '', feedback_stage: fb.stage, is_negative: score <= 3 ? 'yes' : 'no', crm_url: `${base}/hotels/reservations?reservation=${r.id}`,
        };
        void this.automationsService.triggerAutomation(fb.tenantId, TriggerEvent.HOTEL_GUEST_FEEDBACK, data).catch((e) => this.log.warn(`feedback trigger: ${(e as Error).message}`));
        if (score <= 3) void this.automationsService.triggerAutomation(fb.tenantId, TriggerEvent.HOTEL_GUEST_FEEDBACK_NEGATIVE, data).catch((e) => this.log.warn(`feedback negative trigger: ${(e as Error).message}`));
      }
    }
    return this.publicGet(token);
  }

  /** Гость нажал «Оставить отзыв»: отмечаем площадку и отдаём ссылку (только довольным) */
  async publicReview(token: string, platform: string) {
    const fb = await this.byToken(token);
    if (!fb.score || fb.score < 4) throw bad('HOTEL_FEEDBACK_NO_REVIEW', 'Ссылки на отзывы — после оценки 4 и выше');
    const link = (await this.reviewLinks(fb.tenantId, fb.hotelId)).find((x) => x.platform === platform);
    if (!link) throw new NotFoundException('Площадка не найдена');
    await this.feedback.update({ id: fb.id }, { reviewPlatform: platform.slice(0, 24), reviewClickedAt: new Date() });
    return { url: link.url };
  }

  // ─── отчёт для «Автоматизаций» ───

  async report(tenantId: string, days = 30) {
    const since = new Date(Date.now() - Math.min(365, Math.max(1, days)) * 86_400_000);
    const autos = await this.automations.find({
      where: { tenantId, triggerEvent: In([...JOURNEY_EVENTS, TriggerEvent.HOTEL_PAYMENT_RECEIVED, TriggerEvent.HOTEL_GUEST_FEEDBACK, TriggerEvent.HOTEL_GUEST_FEEDBACK_NEGATIVE]) },
      order: { createdAt: 'ASC' },
    });
    const ids = autos.map((a) => a.id);
    const stats: Array<{ automationId: string; status: string; cnt: string; last: Date }> = ids.length
      ? await this.executions
          .createQueryBuilder('e')
          .select('e.automationId', 'automationId').addSelect('e.status', 'status').addSelect('COUNT(*)', 'cnt').addSelect('MAX(e.createdAt)', 'last')
          .where('e.tenantId = :tenantId AND e.automationId IN (:...ids) AND e.createdAt >= :since', { tenantId, ids, since })
          .groupBy('e.automationId').addGroupBy('e.status')
          .getRawMany()
      : [];
    const scenarios = autos.map((a) => {
      const mine = stats.filter((s) => s.automationId === a.id);
      const by = (st: string) => mine.filter((s) => s.status === st).reduce((x, s) => x + Number(s.cnt), 0);
      const last = mine.reduce<Date | null>((m, s) => (!m || new Date(s.last) > m ? new Date(s.last) : m), null);
      return {
        automationId: a.id, name: a.name, triggerEvent: a.triggerEvent, isActive: a.isActive, presetKey: String((a.meta as any)?.presetKey || '').replace(/^hotel:/, '') || null, meta: (JOURNEY_EVENTS as readonly string[]).includes(a.triggerEvent) ? this.meta(a) : null,
        runs: mine.reduce((x, s) => x + Number(s.cnt), 0), success: by('success'), errors: by('error'), waiting: by('paused_delay') + by('paused_approval'), lastRunAt: last,
        lastError: a.lastError,
      };
    });
    const fb = await this.feedback.find({ where: { tenantId, createdAt: MoreThanOrEqual(since) }, order: { createdAt: 'DESC' }, take: 2000 });
    const answered = fb.filter((x) => x.score);
    const resIds = [...new Set(answered.filter((x) => x.score! <= 3).slice(0, 20).map((x) => x.reservationId))];
    const guests = resIds.length ? await this.reservations.find({ where: { tenantId, id: In(resIds) }, select: ['id', 'guestName', 'hotelId', 'checkIn', 'checkOut'] }) : [];
    return {
      days, scenarios,
      feedback: {
        sent: fb.length, opened: fb.filter((x) => x.openedAt).length, answered: answered.length,
        avg: answered.length ? r2(answered.reduce((s, x) => s + (x.score || 0), 0) / answered.length) : null,
        negative: answered.filter((x) => x.score! <= 3).length, reviewClicks: fb.filter((x) => x.reviewClickedAt).length,
        byScore: [1, 2, 3, 4, 5].map((n) => answered.filter((x) => x.score === n).length),
        recentNegative: answered.filter((x) => x.score! <= 3).slice(0, 10).map((x) => {
          const g = guests.find((r) => r.id === x.reservationId);
          return { reservationId: x.reservationId, guestName: g?.guestName || '', score: x.score, comment: x.comment, answeredAt: x.answeredAt, stage: x.stage };
        }),
      },
    };
  }
}
