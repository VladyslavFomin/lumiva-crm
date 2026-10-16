import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { AiAgent } from '../ai-employees/ai-agent.entity';
import { AiAgentReport } from '../ai-employees/ai-agent-report.entity';
import { readAiAgentConfig } from '../ai-employees/ai-employee-triggers';
import { Hotel } from '../hotels/hotel.entity';
import { MailService } from '../mail/mail.service';
import { escapeMailHtml } from '../mail/mail-template.util';
import { HotelBrand, HotelReview, HotelReviewAlert, HotelReviewSource } from './reputation.entities';
import { REPLY_MODE, ReputationConfig, TOPIC_LABELS_RU, activeTopicSql, reviewHasTextSql } from './reputation.constants';
import { ReputationSettingsService } from './reputation-settings.service';
import { ReputationReviewsService } from './reputation-reviews.service';
import { ReputationAlertsService } from './reputation-alerts.service';
import { ReputationReservationsService } from './reputation-reservations.service';
import { PLATFORM_LABEL } from './reputation-events.service';

type AiEmployeesService = import('../ai-employees/ai-employees.service').AiEmployeesService;
type Lang = 'ru' | 'en' | 'tr';

/** Настройки работы ИИ-менеджера отзывов (agent.settings.reviewsWork). */
export type ReviewsWorkConfig = {
  digest: { enabled: boolean; time: string; weekdays: number[]; recipients: string[]; telegram: string[]; inApp: boolean; lastSentDate: string | null };
  reminders: { enabled: boolean; firstHours: number; escalateHours: number; negativeOnly: boolean };
  drafts: { mode: 'off' | 'negative' | 'all' };
  insights: { enabled: boolean; weekday: number; time: string; createTasks: boolean; lastSentDate: string | null };
  scope: { brandIds: string[]; hotelIds: string[] };
};

export function defaultReviewsWork(): ReviewsWorkConfig {
  return {
    digest: { enabled: true, time: '09:00', weekdays: [0, 1, 2, 3, 4, 5, 6], recipients: [], telegram: [], inApp: true, lastSentDate: null },
    reminders: { enabled: true, firstHours: 24, escalateHours: 72, negativeOnly: false },
    drafts: { mode: 'negative' },
    insights: { enabled: true, weekday: 1, time: '10:00', createTasks: true, lastSentDate: null },
    scope: { brandIds: [], hotelIds: [] },
  };
}

function mergeWork(s: any): ReviewsWorkConfig {
  const d = defaultReviewsWork();
  const x = s && typeof s === 'object' ? s : {};
  return {
    digest: { ...d.digest, ...(x.digest || {}) },
    reminders: { ...d.reminders, ...(x.reminders || {}) },
    drafts: { ...d.drafts, ...(x.drafts || {}) },
    insights: { ...d.insights, ...(x.insights || {}) },
    scope: { brandIds: Array.isArray(x.scope?.brandIds) ? x.scope.brandIds : [], hotelIds: Array.isArray(x.scope?.hotelIds) ? x.scope.hotelIds : [] },
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = 864e5;

/** Локальная дата/минуты/день недели в часовом поясе сотрудника. */
function tzParts(tz: string, at: Date) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' });
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  return {
    ymd: `${p.year}-${p.month}-${p.day}`,
    minutes: (Number(p.hour) % 24) * 60 + Number(p.minute),
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday),
  };
}
function tzOffsetMs(tz: string, at: Date): number {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - at.getTime();
}
function dayStart(tz: string, ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  return new Date(guess.getTime() - tzOffsetMs(tz, guess));
}
function shiftYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY).toISOString().slice(0, 10);
}
const r2 = (v: unknown) => (v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 100) / 100);
const topicName = (t: string, label?: string | null) => (t === 'other' ? label || 'прочее' : TOPIC_LABELS_RU[t] || t);

const L10N: Record<Lang, Record<string, string>> = {
  ru: {
    digest: 'Сводка по отзывам', insights: 'Инсайты по отзывам за неделю', main: 'Главное', recs: 'Рекомендации', hotels: 'Отели',
    open: 'Без ответа сейчас', complaints: 'Жалобы вчера', none: 'Новых отзывов за день нет.', openFeed: 'Открыть ленту отзывов',
    allHotels: 'все отели', remind: 'Отзывы ждут ответа', escalate: 'Ответить на отзыв', reviews: 'отз.', avg: 'средняя', neg: 'негатив', replied: 'отвечено',
    issues: 'Проблемы сбора', week: 'Растущие жалобы', by: 'Подготовил(а)',
  },
  en: {
    digest: 'Reviews digest', insights: 'Weekly review insights', main: 'Highlights', recs: 'Recommendations', hotels: 'Hotels',
    open: 'Unanswered now', complaints: 'Complaints yesterday', none: 'No new reviews yesterday.', openFeed: 'Open the review feed',
    allHotels: 'all hotels', remind: 'Reviews waiting for a reply', escalate: 'Reply to review', reviews: 'reviews', avg: 'avg', neg: 'negative', replied: 'replied',
    issues: 'Collection problems', week: 'Rising complaints', by: 'Prepared by',
  },
  tr: {
    digest: 'Yorum özeti', insights: 'Haftalık yorum içgörüleri', main: 'Öne çıkanlar', recs: 'Öneriler', hotels: 'Oteller',
    open: 'Şu an yanıtsız', complaints: 'Dünkü şikâyetler', none: 'Dün yeni yorum yok.', openFeed: 'Yorum akışını aç',
    allHotels: 'tüm oteller', remind: 'Yanıt bekleyen yorumlar', escalate: 'Yoruma yanıt ver', reviews: 'yorum', avg: 'ort.', neg: 'olumsuz', replied: 'yanıtlandı',
    issues: 'Toplama sorunları', week: 'Artan şikâyetler', by: 'Hazırlayan',
  },
};

/**
 * ИИ-менеджер отзывов (роль reviews_manager) поверх модуля «Отели → Отзывы»: ежедневная сводка, напоминания
 * о неотвеченных отзывах с эскалацией задачей, черновики ответов, ответы через согласование (Google/HolidayCheck),
 * еженедельные инсайты с рекомендациями и задачами, блок данных в снапшоте сотрудника.
 * Всё от имени сотрудника — через движок ИИ-сотрудников (права, согласования, журнал, отчёты).
 */
@Injectable()
export class ReputationAgentService implements OnApplicationBootstrap {
  private readonly log = new Logger(ReputationAgentService.name);

  constructor(
    @InjectRepository(AiAgent) private readonly agents: Repository<AiAgent>,
    @InjectRepository(AiAgentReport) private readonly reports: Repository<AiAgentReport>,
    @InjectRepository(HotelReview) private readonly reviewsRepo: Repository<HotelReview>,
    @InjectRepository(HotelReviewSource) private readonly sources: Repository<HotelReviewSource>,
    @InjectRepository(HotelReviewAlert) private readonly marks: Repository<HotelReviewAlert>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(HotelBrand) private readonly brands: Repository<HotelBrand>,
    private readonly settings: ReputationSettingsService,
    private readonly reviews: ReputationReviewsService,
    private readonly alerts: ReputationAlertsService,
    private readonly mail: MailService,
    private readonly moduleRef: ModuleRef,
    private readonly stays: ReputationReservationsService,
  ) {}

  private employeesCache: AiEmployeesService | null = null;
  private async employees(): Promise<AiEmployeesService> {
    if (this.employeesCache) return this.employeesCache;
    const { AiEmployeesService } = await import('../ai-employees/ai-employees.service.js');
    this.employeesCache = this.moduleRef.get(AiEmployeesService, { strict: false });
    return this.employeesCache!;
  }

  /** Регистрируем блок снапшота hotelReputation в движке ИИ-сотрудников. Действий ответа нет: отвечает всегда человек. */
  async onApplicationBootstrap() {
    try {
      const e = await this.employees();
      e.registerModuleHooks({
        key: 'hotel-reputation',
        actions: [],
        dispatch: async () => undefined,
        snapshot: (tenantId, perms) => (perms.read_reviews ? this.snapshotBlock(tenantId) : Promise.resolve(null)),
        taskRole: 'reviews_manager',
        taskProject: (tenantId, payload, text) => this.taskProjectFor(tenantId, payload, text),
      });
    } catch (e: any) {
      this.log.warn(`reviews agent hooks not registered: ${e?.message || e}`);
    }
  }

  // ---------------------------------------------------------------- сотрудник и настройки

  private lang(agent: AiAgent): Lang {
    return agent.language === 'Russian' ? 'ru' : agent.language === 'Turkish' ? 'tr' : agent.language === 'English' ? 'en' : 'ru';
  }

  private langName(l: Lang) {
    return { ru: 'Russian', en: 'English', tr: 'Turkish' }[l];
  }

  async agentFor(tenantId: string): Promise<AiAgent | null> {
    const list = await this.agents.find({ where: { tenantId, role: 'reviews_manager' as any, status: Not('disabled') as any }, order: { createdAt: 'ASC' } });
    return list.find((a) => a.status === 'active') || list[0] || null;
  }

  work(agent: AiAgent): ReviewsWorkConfig {
    return mergeWork((agent.settings as any)?.reviewsWork);
  }

  private async saveWork(agent: AiAgent, w: ReviewsWorkConfig) {
    agent.settings = { ...(agent.settings || {}), reviewsWork: w } as any;
    await this.agents.update({ id: agent.id }, { settings: agent.settings as any });
  }

  /** Для страницы настроек: сотрудник (если нанят), его настройки и последние отчёты. */
  async getState(tenantId: string) {
    const agent = await this.agentFor(tenantId);
    if (!agent) return { agent: null, work: defaultReviewsWork(), reports: [] };
    const reports = await this.reports.find({
      where: { tenantId, agentId: agent.id, reportType: In(['reviews_daily', 'reviews_insights']) },
      order: { createdAt: 'DESC' },
      take: 10,
    });
    return {
      agent: { id: agent.id, name: agent.name, status: agent.status, avatarUrl: agent.avatarUrl, autonomyMode: agent.autonomyMode, timezone: readAiAgentConfig(agent.settings).timezone },
      work: this.work(agent),
      reports: reports.map((r) => ({ id: r.id, type: r.reportType, title: r.title, createdAt: r.createdAt, sentTo: r.sentTo })),
    };
  }

  async updateWork(tenantId: string, body: any) {
    const agent = await this.agentFor(tenantId);
    if (!agent) throw new NotFoundException({ code: 'REVIEWS_NO_AGENT', message: 'Hire an AI Reviews Manager first' });
    const cur = this.work(agent);
    const b = body || {};
    const num = (v: unknown, min: number, max: number, def: number) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Math.round(Number(v)))) : def);
    if (b.digest) {
      const d = b.digest;
      cur.digest = {
        ...cur.digest,
        enabled: d.enabled !== undefined ? !!d.enabled : cur.digest.enabled,
        time: d.time && TIME_RE.test(d.time) ? d.time : cur.digest.time,
        weekdays: Array.isArray(d.weekdays) ? [...new Set(d.weekdays.map(Number).filter((x: number) => x >= 0 && x <= 6))] as number[] : cur.digest.weekdays,
        recipients: Array.isArray(d.recipients) ? [...new Set(d.recipients.map((x: any) => String(x).trim().toLowerCase()).filter((x: string) => EMAIL_RE.test(x)))].slice(0, 20) as string[] : cur.digest.recipients,
        telegram: Array.isArray(d.telegram) ? d.telegram.map(String).slice(0, 20) : cur.digest.telegram,
        inApp: d.inApp !== undefined ? !!d.inApp : cur.digest.inApp,
      };
    }
    if (b.reminders) {
      const r = b.reminders;
      cur.reminders = {
        enabled: r.enabled !== undefined ? !!r.enabled : cur.reminders.enabled,
        firstHours: num(r.firstHours, 1, 720, cur.reminders.firstHours),
        escalateHours: num(r.escalateHours, 2, 1440, cur.reminders.escalateHours),
        negativeOnly: r.negativeOnly !== undefined ? !!r.negativeOnly : cur.reminders.negativeOnly,
      };
      if (cur.reminders.escalateHours <= cur.reminders.firstHours) cur.reminders.escalateHours = cur.reminders.firstHours + 24;
    }
    if (b.drafts && ['off', 'negative', 'all'].includes(b.drafts.mode)) cur.drafts = { mode: b.drafts.mode };
    if (b.insights) {
      const i = b.insights;
      cur.insights = {
        ...cur.insights,
        enabled: i.enabled !== undefined ? !!i.enabled : cur.insights.enabled,
        weekday: i.weekday !== undefined ? num(i.weekday, 0, 6, cur.insights.weekday) : cur.insights.weekday,
        time: i.time && TIME_RE.test(i.time) ? i.time : cur.insights.time,
        createTasks: i.createTasks !== undefined ? !!i.createTasks : cur.insights.createTasks,
      };
    }
    if (b.scope) {
      cur.scope = {
        brandIds: Array.isArray(b.scope.brandIds) ? b.scope.brandIds.map(String).slice(0, 50) : cur.scope.brandIds,
        hotelIds: Array.isArray(b.scope.hotelIds) ? b.scope.hotelIds.map(String).slice(0, 200) : cur.scope.hotelIds,
      };
    }
    await this.saveWork(agent, cur);
    return this.getState(tenantId);
  }

  /** Отели в зоне ответственности сотрудника (пустые списки — все отели). */
  private async scopeHotelIds(tenantId: string, w: ReviewsWorkConfig): Promise<string[]> {
    const all = await this.hotels.find({ where: { tenantId }, select: ['id', 'brandId'] as any });
    return all
      .filter((h) => (!w.scope.brandIds.length || (h.brandId && w.scope.brandIds.includes(h.brandId))) && (!w.scope.hotelIds.length || w.scope.hotelIds.includes(h.id)))
      .map((h) => h.id);
  }

  private async mark(tenantId: string, key: string, kind = 'agent'): Promise<boolean> {
    const ins = await this.marks
      .createQueryBuilder()
      .insert()
      .values({ tenantId, kind, dedupKey: key.slice(0, 300), title: null, body: null })
      .orIgnore()
      .returning(['id'])
      .execute();
    return !!ins.raw?.[0]?.id;
  }

  // ---------------------------------------------------------------- снапшот сотрудника

  /** Блок «голова» сотрудника: цифры за 7/30 дней по отелям, негатив без ответа с id, темы и их динамика, сбои. */
  async snapshotBlock(tenantId: string) {
    const agent = await this.agentFor(tenantId);
    const w = agent ? this.work(agent) : defaultReviewsWork();
    const hotelIds = await this.scopeHotelIds(tenantId, w);
    if (!hotelIds.length) return null;
    const topicCfg = await this.settings.config(tenantId);
    const q = (sql: string, p: unknown[]) => this.reviewsRepo.query(sql, p);
    const perHotel = await q(
      `SELECT h.name AS hotel, r.platform,
              COUNT(*) FILTER (WHERE r."publishedAt" > now() - interval '7 days')::int AS n7,
              ROUND(AVG(r."rating10") FILTER (WHERE r."publishedAt" > now() - interval '7 days'), 2) AS avg7,
              COUNT(*) FILTER (WHERE r."publishedAt" > now() - interval '30 days')::int AS n30,
              ROUND(AVG(r."rating10") FILTER (WHERE r."publishedAt" > now() - interval '30 days'), 2) AS avg30,
              COUNT(*) FILTER (WHERE NOT r."hasReply" AND r.platform <> 'check24' AND ${reviewHasTextSql('r')} AND r."publishedAt" > now() - interval '30 days')::int AS open30
         FROM hotel_reviews r JOIN hotels h ON h.id = r."hotelId"
        WHERE r."tenantId" = $1 AND r."hotelId" = ANY($2) AND r.status <> 'deleted'
        GROUP BY h.name, r.platform HAVING COUNT(*) FILTER (WHERE r."publishedAt" > now() - interval '30 days') > 0
        ORDER BY h.name, n30 DESC`,
      [tenantId, hotelIds],
    );
    const openNeg = await q(
      `SELECT r.id, h.name AS hotel, r.platform, r."rating10", r.author, r.lang, r."publishedAt"::date AS date,
              LEFT(COALESCE(r."textTranslated", r."textOriginal", ''), 240) AS excerpt
         FROM hotel_reviews r JOIN hotels h ON h.id = r."hotelId"
        WHERE r."tenantId" = $1 AND r."hotelId" = ANY($2) AND r.status <> 'deleted' AND NOT r."hasReply" AND ${reviewHasTextSql('r')}
          AND r.platform <> 'check24' AND r."rating10" < 6 AND r."publishedAt" > now() - interval '30 days'
        ORDER BY r."publishedAt" DESC LIMIT 12`,
      [tenantId, hotelIds],
    );
    const topics = await q(
      `SELECT h.name AS hotel, t.topic, COALESCE(t."otherLabel", '') AS label,
              COUNT(*) FILTER (WHERE t."publishedAt" > now() - interval '7 days')::int AS week,
              COUNT(*) FILTER (WHERE t."publishedAt" > now() - interval '35 days' AND t."publishedAt" <= now() - interval '7 days')::int AS prev4w,
              (array_agg(t.quote ORDER BY t."publishedAt" DESC) FILTER (WHERE t.quote IS NOT NULL))[1:2] AS quotes
         FROM hotel_review_topics t JOIN hotels h ON h.id = t."hotelId"
        WHERE t."tenantId" = $1 AND t."hotelId" = ANY($2) AND ${activeTopicSql(topicCfg)} AND t.sentiment = 'negative' AND t."publishedAt" > now() - interval '35 days'
        GROUP BY h.name, t.topic, COALESCE(t."otherLabel", '')
        HAVING COUNT(*) FILTER (WHERE t."publishedAt" > now() - interval '7 days') > 0
        ORDER BY week DESC LIMIT 15`,
      [tenantId, hotelIds],
    );
    const failing = await this.sources.find({ where: { tenantId, active: true, lastError: Not(IsNull()) }, take: 10 });
    const cfg = await this.settings.config(tenantId);
    return {
      hotelReputation: {
        scale: '0–10 (all platforms normalised); negative < 6',
        perHotelPlatform: perHotel.map((x: any) => ({ hotel: x.hotel, platform: PLATFORM_LABEL[x.platform] || x.platform, n7: x.n7, avg7: r2(x.avg7), n30: x.n30, avg30: r2(x.avg30), unanswered30: x.open30 })),
        unansweredNegative: openNeg.map((x: any) => ({
          reviewId: x.id, hotel: x.hotel, platform: PLATFORM_LABEL[x.platform] || x.platform, replyMode: REPLY_MODE[x.platform as keyof typeof REPLY_MODE],
          rating10: r2(x.rating10), author: x.author, lang: x.lang, date: x.date, excerpt: x.excerpt,
        })),
        complaintTopicsLast7d: topics.map((x: any) => ({ hotel: x.hotel, topic: topicName(x.topic, x.label), week: x.week, avgPerWeekPrev4w: r2(x.prev4w / 4), quotes: (x.quotes || []).filter(Boolean) })),
        collectionProblems: [
          ...failing.map((s) => ({ platform: s.platform, error: (s.lastError || '').slice(0, 160) })),
          ...(cfg.apifyPause.reason ? [{ platform: 'apify', error: 'Apify monthly budget exhausted — collection paused' }] : []),
        ],
      },
    };
  }

  // ---------------------------------------------------------------- черновики и предложения ответов

  /** Новые отзывы: черновик ответа от имени сотрудника. Публикует ответ всегда человек (кнопки в карточке отзыва). */
  async processNewReviews(agent: AiAgent, w: ReviewsWorkConfig) {
    if (w.drafts.mode === 'off') return;
    const hotelIds = await this.scopeHotelIds(agent.tenantId, w);
    if (!hotelIds.length) return;
    const cfg = await this.settings.config(agent.tenantId);
    const qb = this.reviewsRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :t AND r.hotelId IN (:...h)', { t: agent.tenantId, h: hotelIds })
      .andWhere(`r.status <> 'deleted' AND NOT r."hasReply" AND ${reviewHasTextSql('r')} AND r."aiDraft" IS NULL AND r.platform <> 'check24'`)
      .andWhere(`r."firstSeenAt" > now() - interval '3 days' AND r."publishedAt" > now() - interval '10 days'`)
      .andWhere('r."analyzedAt" IS NOT NULL')
      .orderBy('r.publishedAt', 'DESC')
      .take(20);
    if (w.drafts.mode === 'negative') qb.andWhere('r."rating10" < :nb', { nb: cfg.thresholds.negativeBelow });
    const rows = await qb.getMany();
    for (const r of rows) {
      try {
        await this.draftReview(agent.tenantId, r.id, undefined, 'auto', agent);
      } catch (err: any) {
        this.log.warn(`review draft failed ${r.id}: ${err?.message || err}`);
        break; // скорее всего нет кредитов/ключа — не долбим каждые 5 минут
      }
    }
  }

  /**
   * Единственная точка подготовки черновика ответа: всегда от имени ИИ-менеджера отзывов (без нанятого и
   * активного сотрудника — нельзя). Пишется в журнал сотрудника, в отзыве — пометка, кто подготовил.
   * Публикует ответ всегда человек.
   */
  async draftReview(tenantId: string, reviewId: string, tone?: string, via: 'auto' | 'card' | 'chat' = 'card', agentIn?: AiAgent) {
    const agent = agentIn || (await this.agentFor(tenantId));
    if (!agent || agent.status !== 'active') {
      throw new BadRequestException({ code: 'REVIEWS_NO_AGENT', message: 'AI reply drafts are prepared by the AI Reviews Manager — hire and activate one in AI Employees' });
    }
    const r = await this.reviewsRepo.findOne({ where: { id: reviewId, tenantId } });
    if (!r) throw new NotFoundException('Review not found');
    if (REPLY_MODE[r.platform] === 'none') throw new BadRequestException('This platform does not publish hotel replies');
    if (![r.title, r.textOriginal].some((text) => !!text?.trim())) throw new BadRequestException('A rating-only review does not require a reply');
    const cfg = await this.settings.config(tenantId);
    const hotel = await this.hotels.findOne({ where: { id: r.hotelId } });
    const signature = cfg.signatures[r.hotelId] || hotel?.name || '';
    const lang = this.languageName(r.lang || 'en');
    const text = [r.title, r.textOriginal].filter(Boolean).join('\n').trim();
    const e = await this.employees();
    const res = await e.completeForAgent(
      tenantId,
      agent,
      `You are ${agent.name}, the AI Reviews Manager of "${hotel?.name || 'the hotel'}". You write public replies to guest reviews. You ALWAYS write in ${lang}.`,
      `${tone ? `Tone: ${String(tone).slice(0, 100)}\n` : ''}Review on ${PLATFORM_LABEL[r.platform]} (${r.rating10 ?? '—'}/10) by ${r.author || 'a guest'}: <<<${(text || 'rating only, no text').slice(0, 3000)}>>>
Write the reply in ${lang} only: ${text ? '3–6 sentences' : '1–2 sentences'}, warm and specific to what the guest wrote. For complaints: apologise without excuses, say what the team will check, invite them to contact the hotel directly. No invented facts, no promises of compensation, no private data, never argue. No signature. Output only the reply text.`,
    );
    let draft = String(res.text || '').trim();
    if (!draft) throw new BadRequestException('Empty AI reply');
    if (signature && !draft.toLowerCase().endsWith(signature.toLowerCase())) draft = `${draft}\n\n${signature}`;
    await this.reviewsRepo.update({ id: r.id }, { aiDraft: draft.slice(0, 5000), aiDraftAgentId: agent.id });
    await e.logAgentEvent({
      tenantId, agentId: agent.id, eventType: 'review_draft', targetType: 'hotel_review', targetId: r.id,
      inputSummary: `${via} · ${PLATFORM_LABEL[r.platform]} · ${hotel?.name || ''} · ${r.rating10 ?? '—'}/10 · ${r.author || '—'}`,
      outputSummary: draft.slice(0, 300), status: 'success', tokensUsed: res.tokensUsed || 0,
    } as any);
    return { aiDraft: draft, agentId: agent.id, agentName: agent.name };
  }

  private languageName(code: string) {
    try {
      return new Intl.DisplayNames(['en'], { type: 'language' }).of(code.split('-')[0]) || code;
    } catch {
      return code;
    }
  }

  // ---------------------------------------------------------------- напоминания и эскалация

  /** Напоминание через N часов (сообщение отелю), эскалация через M часов (задача от сотрудника). */
  async remind(agent: AiAgent, w: ReviewsWorkConfig) {
    if (!w.reminders.enabled) return { reminded: 0, escalated: 0 };
    const hotelIds = await this.scopeHotelIds(agent.tenantId, w);
    if (!hotelIds.length) return { reminded: 0, escalated: 0 };
    const cfg = await this.settings.config(agent.tenantId);
    const L = L10N[this.lang(agent)];
    const qb = this.reviewsRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :t AND r.hotelId IN (:...h)', { t: agent.tenantId, h: hotelIds })
      .andWhere(`r.status <> 'deleted' AND NOT r."hasReply" AND ${reviewHasTextSql('r')} AND r.platform <> 'check24'`)
      .andWhere(`r."firstSeenAt" > now() - interval '14 days' AND r."firstSeenAt" - r."publishedAt" < interval '4 days'`)
      .andWhere(`r."publishedAt" < now() - (:h1 || ' hours')::interval`, { h1: String(w.reminders.firstHours) })
      .orderBy('r.publishedAt', 'ASC')
      .take(200);
    if (w.reminders.negativeOnly) qb.andWhere('r."rating10" < :nb', { nb: cfg.thresholds.negativeBelow });
    const rows = await qb.getMany();
    const frontend = (process.env.FRONTEND_URL || 'https://crm.lumiva.agency').replace(/\/$/, '');
    let reminded = 0;
    let escalated = 0;

    // 1) напоминание — одним сообщением на отель
    const byHotel = new Map<string, HotelReview[]>();
    for (const r of rows) {
      if (!(await this.mark(agent.tenantId, `agent_r1:${r.id}`))) continue;
      byHotel.set(r.hotelId, [...(byHotel.get(r.hotelId) || []), r]);
    }
    for (const [hotelId, list] of byHotel) {
      const hotel = await this.hotels.findOne({ where: { id: hotelId } });
      const lines = list.slice(0, 12).map((r) => {
        const hrs = Math.round((Date.now() - (r.publishedAt?.getTime() ?? Date.now())) / 36e5);
        return `• ${PLATFORM_LABEL[r.platform]} · ${r.rating10 ?? '—'}/10 · ${r.author || '—'} · ${hrs} h\n  ${frontend}/hotels/reviews?review=${r.id}`;
      });
      await this.alerts.deliver(agent.tenantId, cfg, {
        key: `agent_r1_batch:${hotelId}:${Date.now()}`,
        hotelId,
        title: `⏰ ${L.remind}: ${list.length} · ${hotel?.name || ''}`,
        body: `${lines.join('\n')}${list.length > 12 ? `\n+${list.length - 12}` : ''}\n\n— ${agent.name}`,
        path: `/hotels/reviews?hotelId=${hotelId}&reply=none`,
        to: ['hotel'],
        channels: ['telegram', 'email', 'inapp'],
      });
      reminded += list.length;
    }

    // 2) эскалация — задача на ответ, после escalateHours
    const e = await this.employees();
    const late = rows.filter((r) => r.publishedAt && Date.now() - r.publishedAt.getTime() > w.reminders.escalateHours * 36e5).slice(0, 20);
    for (const r of late) {
      if (!(await this.mark(agent.tenantId, `agent_r2:${r.id}`))) continue;
      const hotel = await this.hotels.findOne({ where: { id: r.hotelId } });
      const projectId = await this.ensureProject(agent.tenantId, r.hotelId, hotel?.name || '');
      if (!projectId) continue;
      const recips = cfg.recipients.hotels[r.hotelId];
      // номер и даты проживания (если отзыв связан с бронью) — службе номеров не нужно искать гостя
      const room = await this.stays.roomLine(agent.tenantId, r).catch(() => null);
      const title = `${L.escalate}: ${PLATFORM_LABEL[r.platform]} ${r.rating10 ?? '—'}/10 — ${r.author || '—'} (${hotel?.name || ''})`.slice(0, 250);
      await e
        .proposeModuleAction(agent.tenantId, agent.id, {
          actionType: 'create_task',
          title,
          reason: `No reply for ${w.reminders.escalateHours}+ hours`,
          targetType: 'project',
          targetId: projectId,
          payload: {
            projectId,
            title,
            description: `${room ? `${room}\n\n` : ''}${(r.textOriginal || '').slice(0, 1500)}${r.textTranslated ? `\n\n— ${r.textTranslated.slice(0, 1500)}` : ''}${r.aiDraft ? `\n\nDraft:\n${r.aiDraft}` : ''}\n\n${frontend}/hotels/reviews?review=${r.id}`,
            priority: r.rating10 != null && Number(r.rating10) < cfg.thresholds.negativeBelow ? 'high' : 'medium',
            dueDate: new Date(Date.now() + DAY).toISOString().slice(0, 10),
            ...(recips?.userIds?.[0] ? { assignedUserId: recips.userIds[0] } : {}),
            source: 'reviews_agent',
          },
        })
        .catch(() => undefined);
      escalated++;
    }
    if (reminded || escalated) {
      await e.logAgentEvent({
        tenantId: agent.tenantId, agentId: agent.id, eventType: 'review_reminders', inputSummary: 'unanswered reviews',
        outputSummary: `reminded ${reminded}, escalated ${escalated}`, status: 'success',
      } as any);
    }
    return { reminded, escalated };
  }

  /** Задачи по отзывам этого отеля (проект «Отзывы · <отель>») + предложения сотрудника, ждущие одобрения. */
  async hotelTasks(tenantId: string, hotelId: string) {
    const cfg = await this.settings.config(tenantId);
    const projectId = ((cfg as any).taskProjects?.[hotelId] as string | undefined) || null;
    const empty = { projectId: null as string | null, open: [] as any[], done: 0, total: 0, pending: [] as any[], agentId: null as string | null };
    const agent = await this.agentFor(tenantId);
    if (!projectId) return { ...empty, agentId: agent?.id ?? null };
    const [proj] = await this.reviewsRepo
      .query(`SELECT id, tasks FROM crm_projects WHERE id = $1 AND tenant_id = $2 AND NOT is_deleted`, [projectId, tenantId])
      .catch(() => []);
    if (!proj) return { ...empty, agentId: agent?.id ?? null };
    let tasks: any[] = [];
    try {
      tasks = JSON.parse(proj.tasks || '[]');
    } catch {
      tasks = [];
    }
    const open = tasks
      .filter((t) => t && t.status !== 'Готово')
      .map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, deadline: t.deadline ?? null, byAi: !!t.createdByAi }))
      .sort((a, b) => String(a.deadline || '9999').localeCompare(String(b.deadline || '9999')));
    const pending = await this.reviewsRepo
      .query(
        `SELECT id, title, created_at AS "createdAt" FROM ai_agent_actions
          WHERE tenant_id = $1 AND status = 'pending' AND action_type = 'create_task' AND payload->>'projectId' = $2
          ORDER BY created_at DESC LIMIT 20`,
        [tenantId, projectId],
      )
      .catch(() => []);
    return { projectId, open: open.slice(0, 30), done: tasks.length - open.length, total: tasks.length, pending, agentId: agent?.id ?? null };
  }

  /**
   * Куда положить задачу сотрудника (в т.ч. придуманную моделью): отель по отзыву → по hotelId → по названию
   * отеля в тексте (самое длинное совпадение); не понять — общий проект «Отзывы · все отели».
   */
  async taskProjectFor(tenantId: string, payload: Record<string, any>, text: string): Promise<string | null> {
    const reviewId = String(payload.reviewId || (payload.focusType === 'hotel_review' ? payload.focusId : '') || '');
    let hotelId = String(payload.hotelId || (payload.focusType === 'hotel' ? payload.focusId : '') || '');
    if (!hotelId && /^[0-9a-f-]{36}$/i.test(reviewId)) {
      hotelId = (await this.reviewsRepo.findOne({ where: { id: reviewId, tenantId }, select: ['id', 'hotelId'] as any }))?.hotelId || '';
    }
    const hotels = await this.hotels.find({ where: { tenantId } as any, select: ['id', 'name'] as any });
    let hotel = hotelId ? hotels.find((h) => h.id === hotelId) : undefined;
    if (!hotel) {
      const low = text.toLowerCase();
      hotel = hotels
        .filter((h) => h.name && low.includes(h.name.toLowerCase()))
        .sort((a, b) => b.name.length - a.name.length)[0];
    }
    return hotel ? this.ensureProject(tenantId, hotel.id, hotel.name) : this.ensureProject(tenantId, '_all', L10N.ru.allHotels);
  }

  /** Проект «Отзывы · <отель>» для задач по отзывам (создаётся один раз, id хранится в настройках модуля). */
  private async ensureProject(tenantId: string, hotelId: string, hotelName: string): Promise<string | null> {
    const cfg = await this.settings.config(tenantId);
    const known = (cfg as any).taskProjects?.[hotelId] as string | undefined;
    if (known) {
      const [row] = await this.reviewsRepo.query(`SELECT id FROM crm_projects WHERE id = $1 AND tenant_id = $2 AND NOT is_deleted`, [known, tenantId]).catch(() => []);
      if (row?.id) return row.id;
    }
    try {
      const { ProjectsService } = await import('../projects/projects.service.js');
      const { ProjectStatusesService } = await import('../projects/project-statuses.service.js');
      const projects = this.moduleRef.get(ProjectsService, { strict: false });
      const statuses = await this.moduleRef.get(ProjectStatusesService, { strict: false }).findAll(tenantId);
      const status = (statuses.find((s: any) => s.value === 'Новый') || statuses[0])?.value || 'Новый';
      const proj = await projects.createForTenant(tenantId, {
        name: `Отзывы · ${hotelName}`.slice(0, 250),
        description: `Задачи ИИ-менеджера отзывов по отелю ${hotelName}: ответы на отзывы, разбор жалоб.`,
        amount: '0',
        currency: 'EUR',
        status,
      } as any);
      await this.settings.patchConfig(tenantId, { taskProjects: { ...((cfg as any).taskProjects || {}), [hotelId]: proj.id } } as any);
      return proj.id;
    } catch (e: any) {
      this.log.warn(`reviews project failed: ${e?.message || e}`);
      return null;
    }
  }

  // ---------------------------------------------------------------- ежедневная сводка

  /** Сводка «за вчера» по часовому поясу сотрудника: наши цифры + «Главное» и рекомендации от ИИ. */
  async runDigest(tenantId: string, opts: { deliver: boolean }) {
    const agent = await this.agentFor(tenantId);
    if (!agent) throw new NotFoundException({ code: 'REVIEWS_NO_AGENT', message: 'Hire an AI Reviews Manager first' });
    const w = this.work(agent);
    const cfg = await this.settings.config(tenantId);
    const lang = this.lang(agent);
    const L = L10N[lang];
    const tz = readAiAgentConfig(agent.settings).timezone;
    const today = tzParts(tz, new Date()).ymd;
    const day = shiftYmd(today, -1);
    const start = dayStart(tz, day);
    const end = dayStart(tz, today);
    const hotelIds = await this.scopeHotelIds(tenantId, w);
    const q = (sql: string, p: unknown[]) => this.reviewsRepo.query(sql, p);
    const nb = cfg.thresholds.negativeBelow;

    const perHotel = hotelIds.length
      ? await q(
          `SELECT h.id, h.name,
                  COUNT(r.id) FILTER (WHERE r."publishedAt" >= $3 AND r."publishedAt" < $4)::int AS n,
                  ROUND(AVG(r."rating10") FILTER (WHERE r."publishedAt" >= $3 AND r."publishedAt" < $4), 2) AS avg,
                  COUNT(r.id) FILTER (WHERE r."publishedAt" >= $3 AND r."publishedAt" < $4 AND r."rating10" < $5)::int AS neg,
                  COUNT(r.id) FILTER (WHERE r."repliedAt" >= $3 AND r."repliedAt" < $4)::int AS replied,
                  COUNT(r.id) FILTER (WHERE NOT r."hasReply" AND r.platform <> 'check24' AND ${reviewHasTextSql('r')} AND r."publishedAt" > now() - interval '30 days')::int AS open,
                  COUNT(r.id) FILTER (WHERE NOT r."hasReply" AND r.platform <> 'check24' AND ${reviewHasTextSql('r')} AND r."rating10" < $5 AND r."publishedAt" > now() - interval '30 days')::int AS open_neg,
                  ROUND(AVG(r."rating10") FILTER (WHERE r."publishedAt" > now() - interval '7 days'), 2) AS avg7,
                  ROUND(AVG(r."rating10") FILTER (WHERE r."publishedAt" > now() - interval '14 days' AND r."publishedAt" <= now() - interval '7 days'), 2) AS avg_prev7
             FROM hotels h LEFT JOIN hotel_reviews r ON r."hotelId" = h.id AND r.status <> 'deleted'
            WHERE h."tenantId" = $1 AND h.id = ANY($2)
            GROUP BY h.id, h.name ORDER BY n DESC, h.name`,
          [tenantId, hotelIds, start, end, nb],
        )
      : [];
    const byPlatform = hotelIds.length
      ? await q(
          `SELECT r.platform, COUNT(*)::int AS n, ROUND(AVG(r."rating10"), 2) AS avg FROM hotel_reviews r
            WHERE r."tenantId" = $1 AND r."hotelId" = ANY($2) AND r.status <> 'deleted' AND r."publishedAt" >= $3 AND r."publishedAt" < $4
            GROUP BY r.platform ORDER BY n DESC`,
          [tenantId, hotelIds, start, end],
        )
      : [];
    const complaints = hotelIds.length
      ? await q(
          `SELECT h.name AS hotel, t.topic, COALESCE(t."otherLabel", '') AS label, COUNT(*)::int AS n,
                  (array_agg(t.quote ORDER BY t."publishedAt" DESC) FILTER (WHERE t.quote IS NOT NULL))[1:2] AS quotes
             FROM hotel_review_topics t JOIN hotels h ON h.id = t."hotelId"
            WHERE t."tenantId" = $1 AND t."hotelId" = ANY($2) AND ${activeTopicSql(cfg)} AND t.sentiment = 'negative' AND t."publishedAt" >= $3 AND t."publishedAt" < $4
            GROUP BY h.name, t.topic, COALESCE(t."otherLabel", '') ORDER BY n DESC LIMIT 8`,
          [tenantId, hotelIds, start, end],
        )
      : [];
    const oldestOpen = hotelIds.length
      ? await q(
          `SELECT r.id, h.name AS hotel, r.platform, r."rating10", r.author, EXTRACT(EPOCH FROM (now() - r."publishedAt")) / 3600 AS hours
             FROM hotel_reviews r JOIN hotels h ON h.id = r."hotelId"
            WHERE r."tenantId" = $1 AND r."hotelId" = ANY($2) AND r.status <> 'deleted' AND NOT r."hasReply" AND ${reviewHasTextSql('r')} AND r.platform <> 'check24'
              AND r."rating10" < $3 AND r."publishedAt" > now() - interval '30 days'
            ORDER BY r."publishedAt" ASC LIMIT 8`,
          [tenantId, hotelIds, nb],
        )
      : [];
    const failing = await this.sources.find({ where: { tenantId, active: true, lastError: Not(IsNull()) }, take: 10 });
    const totals = perHotel.reduce(
      (a: any, h: any) => ({ n: a.n + h.n, neg: a.neg + h.neg, replied: a.replied + h.replied, open: a.open + h.open, openNeg: a.openNeg + h.open_neg }),
      { n: 0, neg: 0, replied: 0, open: 0, openNeg: 0 },
    );
    const avgAll = totals.n ? r2(perHotel.reduce((a: number, h: any) => a + (h.avg ? Number(h.avg) * h.n : 0), 0) / totals.n) : null;
    const facts = {
      day,
      scale: '0–10, negative < ' + nb,
      totals: { ...totals, avg: avgAll },
      hotels: perHotel.map((h: any) => ({ hotel: h.name, newReviews: h.n, avg: r2(h.avg), negative: h.neg, repliedYesterday: h.replied, unanswered30d: h.open, unansweredNegative: h.open_neg, avg7d: r2(h.avg7), avgPrev7d: r2(h.avg_prev7) })),
      platforms: byPlatform.map((p: any) => ({ platform: PLATFORM_LABEL[p.platform] || p.platform, n: p.n, avg: r2(p.avg) })),
      complaintsYesterday: complaints.map((c: any) => ({ hotel: c.hotel, topic: topicName(c.topic, c.label), n: c.n, quotes: (c.quotes || []).filter(Boolean) })),
      oldestUnansweredNegative: oldestOpen.map((o: any) => ({ hotel: o.hotel, platform: PLATFORM_LABEL[o.platform], rating10: r2(o.rating10), author: o.author, hours: Math.round(Number(o.hours)) })),
      collectionProblems: [...failing.map((s) => `${PLATFORM_LABEL[s.platform]}: ${(s.lastError || '').slice(0, 100)}`), ...(cfg.apifyPause.reason ? ['Apify budget exhausted'] : [])],
    };

    let summary = '';
    let tokensUsed = 0;
    try {
      const e = await this.employees();
      const res = await e.completeForAgent(
        tenantId,
        agent,
        `You are ${agent.name}, the AI Reviews Manager of a hotel group. You write a short daily digest about guest reviews in ${this.langName(lang)}. Use ONLY the numbers and quotes given; never invent numbers.`,
        `Facts for ${day} (JSON): ${JSON.stringify(facts).slice(0, 14000)}

Write two short blocks in ${this.langName(lang)}:
"${L.main}:" — 3–5 bullets: what happened yesterday, which hotels stand out (good or bad), what is waiting for a reply.
"${L.recs}:" — 2–4 concrete bullets: what to do today (which reviews to answer first, which complaint to check with which department, based on the quotes).
Plain text, bullets start with "• ". Copy numbers exactly.`,
      );
      summary = String(res.text || '').trim().slice(0, 3000);
      if (res.unverifiedNumbers?.length) {
        summary = summary
          .split('\n')
          .filter((line: string) => !res.unverifiedNumbers.some((n: string) => line.replace(/\s/g, '').includes(n.replace(/\s/g, ''))))
          .join('\n');
      }
      tokensUsed = res.tokensUsed || 0;
    } catch (err: any) {
      this.log.warn(`reviews digest summary failed: ${err?.message || err}`);
    }

    const frontend = (process.env.FRONTEND_URL || 'https://crm.lumiva.agency').replace(/\/$/, '');
    const md = this.digestMarkdown(L, day, facts, summary);
    const report = await this.reports.save(
      this.reports.create({
        tenantId,
        agentId: agent.id,
        reportType: 'reviews_daily',
        title: `${L.digest} · ${day}`,
        contentMd: md,
        contentJson: { day, facts },
        periodStart: start,
        periodEnd: end,
        status: 'generated',
      }),
    );
    const sentTo: string[] = [];
    if (opts.deliver) {
      const headline = `${L.digest} · ${day}`;
      const html = this.digestHtml(L, agent.name, day, facts, summary, `${frontend}/hotels/reviews`);
      for (const to of w.digest.recipients) {
        try {
          await this.mail.sendMail({ to, subject: `${headline} — ${agent.name}`, html });
          sentTo.push(to);
        } catch (err: any) {
          this.log.warn(`reviews digest email failed: ${err?.message || err}`);
        }
      }
      if (w.digest.telegram.length && cfg.telegramBotId) {
        const n = await this.sendTelegram(tenantId, cfg, w.digest.telegram, `📊 ${headline}\n\n${this.digestText(L, facts, summary)}\n\n${frontend}/hotels/reviews`);
        if (n) sentTo.push(`telegram:${n}`);
      }
      if (w.digest.inApp) {
        const e = await this.employees();
        await e.notifyOwners(tenantId, headline, (summary || md).slice(0, 500), { link: '/hotels/reviews', kind: 'reviews_digest' }).catch(() => undefined);
        sentTo.push('in_app');
      }
      if (sentTo.length) await this.reports.update({ id: report.id }, { status: 'sent', sentTo } as any);
    }
    const e = await this.employees();
    await e.logAgentEvent({
      tenantId, agentId: agent.id, eventType: 'report_generated', targetType: 'report', targetId: report.id,
      inputSummary: 'reviews_daily', outputSummary: report.title, status: 'success', tokensUsed,
    } as any);
    return { ok: true, reportId: report.id, day, sentTo, contentMd: md };
  }

  private async sendTelegram(tenantId: string, cfg: ReputationConfig, ids: string[], text: string): Promise<number> {
    try {
      const [bot] = await this.reviewsRepo.query(`SELECT "botToken", meta FROM telegram_bots WHERE id = $1 AND "tenantId" = $2`, [cfg.telegramBotId, tenantId]);
      if (!bot) return 0;
      const list: any[] = (bot.meta?.recipients as any[]) || [];
      const axios = (await import('axios')).default;
      let n = 0;
      for (const r of list.filter((x) => ids.includes(x.id))) {
        await axios
          .post(`https://api.telegram.org/bot${bot.botToken}/sendMessage`, { chat_id: String(r.telegramChatId), text: text.slice(0, 4000), disable_web_page_preview: true }, { timeout: 15_000 })
          .then(() => n++)
          .catch(() => undefined);
      }
      return n;
    } catch {
      return 0;
    }
  }

  private digestText(L: Record<string, string>, f: any, summary: string) {
    if (!f.totals.n && !f.totals.openNeg) return `${L.none}\n${summary}`.trim();
    const hotels = f.hotels
      .filter((h: any) => h.newReviews || h.unansweredNegative)
      .slice(0, 12)
      .map((h: any) => `• ${h.hotel}: ${h.newReviews} ${L.reviews}${h.avg != null ? `, ${L.avg} ${h.avg}` : ''}${h.negative ? `, ${L.neg} ${h.negative}` : ''}${h.unansweredNegative ? ` · ⏳ ${h.unansweredNegative}` : ''}`)
      .join('\n');
    return `${f.totals.n} ${L.reviews} · ${L.avg} ${f.totals.avg ?? '—'} · ${L.neg} ${f.totals.neg} · ${L.replied} ${f.totals.replied}\n${hotels}${summary ? `\n\n${summary}` : ''}`;
  }

  private digestMarkdown(L: Record<string, string>, day: string, f: any, summary: string) {
    const lines = [`# ${L.digest} · ${day}`, ''];
    if (summary) lines.push(summary, '');
    lines.push(`**${f.totals.n}** ${L.reviews} · ${L.avg} **${f.totals.avg ?? '—'}** · ${L.neg} **${f.totals.neg}** · ${L.replied} **${f.totals.replied}** · ${L.open}: **${f.totals.open}** (${L.neg} ${f.totals.openNeg})`, '');
    lines.push(`## ${L.hotels}`, '', `| | ${L.reviews} | ${L.avg} | ${L.neg} | ${L.open} | 7d |`, '|---|---|---|---|---|---|');
    for (const h of f.hotels) lines.push(`| ${h.hotel} | ${h.newReviews} | ${h.avg ?? '—'} | ${h.negative} | ${h.unanswered30d} (${h.unansweredNegative}) | ${h.avg7d ?? '—'} / ${h.avgPrev7d ?? '—'} |`);
    if (f.complaintsYesterday.length) {
      lines.push('', `## ${L.complaints}`);
      for (const c of f.complaintsYesterday) lines.push(`- **${c.topic}** · ${c.hotel} · ${c.n}${c.quotes.length ? ` — «${c.quotes[0]}»` : ''}`);
    }
    if (f.collectionProblems.length) lines.push('', `## ${L.issues}`, ...f.collectionProblems.map((x: string) => `- ${x}`));
    return lines.join('\n');
  }

  private digestHtml(L: Record<string, string>, agentName: string, day: string, f: any, summary: string, link: string) {
    const e = escapeMailHtml;
    const rows = f.hotels
      .map(
        (h: any) =>
          `<tr><td style="padding:6px 8px;border-bottom:1px solid #f0f0f0">${e(h.hotel)}</td><td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right">${h.newReviews}</td><td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right">${h.avg ?? '—'}</td><td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right;color:${h.negative ? '#cc2f47' : '#888'}">${h.negative}</td><td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right">${h.unansweredNegative}</td></tr>`,
      )
      .join('');
    return `<div style="font-family:Inter,Arial,sans-serif;max-width:660px;color:#222">
<h2 style="margin:0 0 4px;font-size:20px">${e(L.digest)} · ${e(day)}</h2>
<p style="margin:0 0 14px;color:#888;font-size:13px">${e(L.by)}: ${e(agentName)}</p>
<p style="font-size:14px;margin:0 0 12px"><b>${f.totals.n}</b> ${e(L.reviews)} · ${e(L.avg)} <b>${f.totals.avg ?? '—'}</b>/10 · ${e(L.neg)} <b>${f.totals.neg}</b> · ${e(L.open)}: <b>${f.totals.open}</b></p>
${summary ? `<div style="font-size:14px;line-height:1.6;background:#fafafa;border-radius:10px;padding:12px 14px;white-space:pre-line;margin-bottom:14px">${e(summary)}</div>` : ''}
<table style="width:100%;border-collapse:collapse;font-size:13px"><tr style="color:#888;font-size:11px;text-transform:uppercase"><td style="padding:6px 8px">${e(L.hotels)}</td><td style="padding:6px 8px;text-align:right">${e(L.reviews)}</td><td style="padding:6px 8px;text-align:right">${e(L.avg)}</td><td style="padding:6px 8px;text-align:right">${e(L.neg)}</td><td style="padding:6px 8px;text-align:right">⏳</td></tr>${rows}</table>
${f.complaintsYesterday.length ? `<h3 style="font-size:15px;margin:18px 0 8px">${e(L.complaints)}</h3><ul style="font-size:13px;padding-left:18px;margin:0">${f.complaintsYesterday.map((c: any) => `<li><b>${e(c.topic)}</b> · ${e(c.hotel)} · ${c.n}${c.quotes[0] ? ` — «${e(c.quotes[0])}»` : ''}</li>`).join('')}</ul>` : ''}
<p style="margin:20px 0 0"><a href="${link}" style="display:inline-block;padding:11px 22px;background:#222;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px">${e(L.openFeed)}</a></p></div>`;
  }

  // ---------------------------------------------------------------- еженедельные инсайты

  /** Растущие жалобы за неделю против среднего за 4 предыдущие, рекомендации по отделам и задачи. */
  async runInsights(tenantId: string, opts: { deliver: boolean }) {
    const agent = await this.agentFor(tenantId);
    if (!agent) throw new NotFoundException({ code: 'REVIEWS_NO_AGENT', message: 'Hire an AI Reviews Manager first' });
    const w = this.work(agent);
    const cfg = await this.settings.config(tenantId);
    const lang = this.lang(agent);
    const L = L10N[lang];
    const hotelIds = await this.scopeHotelIds(tenantId, w);
    const q = (sql: string, p: unknown[]) => this.reviewsRepo.query(sql, p);
    const rising = hotelIds.length
      ? await q(
          `SELECT t."hotelId", h.name AS hotel, t.topic, COALESCE(t."otherLabel", '') AS label,
                  COUNT(*) FILTER (WHERE t."publishedAt" > now() - interval '7 days')::int AS week,
                  COUNT(*) FILTER (WHERE t."publishedAt" > now() - interval '35 days' AND t."publishedAt" <= now() - interval '7 days')::int AS prev,
                  (array_agg(t.quote ORDER BY t."publishedAt" DESC) FILTER (WHERE t.quote IS NOT NULL AND t."publishedAt" > now() - interval '7 days'))[1:3] AS quotes
             FROM hotel_review_topics t JOIN hotels h ON h.id = t."hotelId"
            WHERE t."tenantId" = $1 AND t."hotelId" = ANY($2) AND ${activeTopicSql(cfg)} AND t.sentiment = 'negative' AND t."publishedAt" > now() - interval '35 days'
            GROUP BY t."hotelId", h.name, t.topic, COALESCE(t."otherLabel", '')
           HAVING COUNT(*) FILTER (WHERE t."publishedAt" > now() - interval '7 days') >= 2`,
          [tenantId, hotelIds],
        )
      : [];
    const items = rising
      .map((x: any) => ({ hotelId: x.hotelId, hotel: x.hotel, topic: topicName(x.topic, x.label), week: x.week, avgPrev: r2(x.prev / 4) ?? 0, quotes: (x.quotes || []).filter(Boolean) }))
      .filter((x: any) => x.week >= Math.max(2, (x.avgPrev || 0) * 1.5))
      .sort((a: any, b: any) => b.week - b.avgPrev - (a.week - a.avgPrev))
      .slice(0, 12);
    const praise = hotelIds.length
      ? await q(
          `SELECT h.name AS hotel, t.topic, COUNT(*)::int AS n FROM hotel_review_topics t JOIN hotels h ON h.id = t."hotelId"
            WHERE t."tenantId" = $1 AND t."hotelId" = ANY($2) AND ${activeTopicSql(cfg)} AND t.sentiment = 'positive' AND t."publishedAt" > now() - interval '7 days'
            GROUP BY h.name, t.topic ORDER BY n DESC LIMIT 8`,
          [tenantId, hotelIds],
        )
      : [];

    let recs: Array<{ hotel: string; topic: string; department: string; action: string; why: string }> = [];
    let summary = '';
    let tokensUsed = 0;
    if (items.length) {
      try {
        const e = await this.employees();
        const res = await e.completeForAgent(
          tenantId,
          agent,
          `You are ${agent.name}, the AI Reviews Manager of a hotel group. You turn guest complaints into concrete operational recommendations in ${this.langName(lang)}. Use only the data given.`,
          `Complaint topics that grew this week vs the average of the 4 previous weeks (JSON): ${JSON.stringify(items)}
Top praise this week: ${JSON.stringify(praise)}
Return JSON: {"summary":"2–3 sentences in ${this.langName(lang)}","recommendations":[{"hotel":"exact hotel name","topic":"exact topic","department":"housekeeping|F&B|front office|maintenance|animation|management|…","action":"one concrete thing to check or change, based on the quotes","why":"short reason with the numbers"}]} — at most one recommendation per item, max 8.`,
          undefined,
          { json: true },
        );
        tokensUsed = res.tokensUsed || 0;
        const raw = String(res.text || '');
        const j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1) || '{}');
        summary = String(j.summary || '').slice(0, 1500);
        recs = (Array.isArray(j.recommendations) ? j.recommendations : [])
          .filter((r: any) => r?.hotel && r?.action)
          .slice(0, 8)
          .map((r: any) => ({ hotel: String(r.hotel), topic: String(r.topic || ''), department: String(r.department || ''), action: String(r.action).slice(0, 400), why: String(r.why || '').slice(0, 300) }));
      } catch (err: any) {
        this.log.warn(`reviews insights failed: ${err?.message || err}`);
      }
    }
    const weekKey = new Date().toISOString().slice(0, 10);
    const md = [
      `# ${L.insights} · ${weekKey}`,
      '',
      summary || (items.length ? '' : '—'),
      '',
      `## ${L.week}`,
      ...items.map((i: any) => `- **${i.topic}** · ${i.hotel}: ${i.week} (≈${i.avgPrev}/wk before)${i.quotes[0] ? ` — «${i.quotes[0]}»` : ''}`),
      '',
      `## ${L.recs}`,
      ...recs.map((r) => `- **${r.hotel}** · ${r.topic} → *${r.department}*: ${r.action} (${r.why})`),
    ].join('\n');
    const report = await this.reports.save(
      this.reports.create({
        tenantId, agentId: agent.id, reportType: 'reviews_insights', title: `${L.insights} · ${weekKey}`, contentMd: md,
        contentJson: { items, recs, praise }, periodStart: new Date(Date.now() - 7 * DAY), periodEnd: new Date(), status: 'generated',
      }),
    );
    let tasks = 0;
    if (opts.deliver) {
      const e = await this.employees();
      if (w.insights.createTasks) {
        for (const rec of recs) {
          const item = items.find((i: any) => i.hotel === rec.hotel);
          if (!item) continue;
          if (!(await this.mark(tenantId, `agent_insight:${item.hotelId}:${rec.topic}:${weekKey.slice(0, 7)}`))) continue;
          const projectId = await this.ensureProject(tenantId, item.hotelId, item.hotel);
          if (!projectId) continue;
          const title = `${rec.topic} · ${rec.hotel}: ${rec.action}`.slice(0, 250);
          await e
            .proposeModuleAction(tenantId, agent.id, {
              actionType: 'create_task', title, reason: rec.why, targetType: 'project', targetId: projectId,
              payload: { projectId, title, description: `${rec.department}\n${rec.why}\n\n${item.quotes.map((q2: string) => `«${q2}»`).join('\n')}`, priority: 'medium', source: 'reviews_agent' },
            })
            .catch(() => undefined);
          tasks++;
        }
      }
      await e.notifyOwners(tenantId, `${L.insights} · ${weekKey}`, (summary || md).slice(0, 500), { link: '/hotels/reviews/dashboard', kind: 'reviews_insights' }).catch(() => undefined);
      const recipients = w.digest.recipients;
      for (const to of recipients) {
        await this.mail
          .sendMail({ to, subject: `${L.insights} · ${weekKey} — ${agent.name}`, html: `<div style="font-family:Inter,Arial,sans-serif;max-width:660px;white-space:pre-line;font-size:14px;line-height:1.6">${escapeMailHtml(md)}</div>` })
          .catch(() => undefined);
      }
      if (w.digest.telegram.length && cfg.telegramBotId) await this.sendTelegram(tenantId, cfg, w.digest.telegram, `💡 ${L.insights}\n\n${md.replace(/[#*]/g, '').slice(0, 3500)}`);
      await this.reports.update({ id: report.id }, { status: 'sent', sentTo: ['in_app', ...recipients] } as any);
    }
    const e = await this.employees();
    await e.logAgentEvent({
      tenantId, agentId: agent.id, eventType: 'report_generated', targetType: 'report', targetId: report.id,
      inputSummary: 'reviews_insights', outputSummary: `${report.title} · tasks ${tasks}`, status: 'success', tokensUsed,
    } as any);
    return { ok: true, reportId: report.id, items: items.length, recommendations: recs.length, tasks, contentMd: md };
  }

  // ---------------------------------------------------------------- расписание

  /** Каждые 5 минут: черновики/предложения ответов, напоминания (раз в 30 мин), сводка и инсайты по времени сотрудника. */
  async tick(minute: number) {
    const list = await this.agents.find({ where: { role: 'reviews_manager' as any, status: 'active' as any } });
    for (const agent of list) {
      const has = await this.hotels.count({ where: { tenantId: agent.tenantId } });
      if (!has) continue;
      const w = this.work(agent);
      try {
        await this.processNewReviews(agent, w);
        if (minute % 30 < 5) await this.remind(agent, w);
        const tz = readAiAgentConfig(agent.settings).timezone;
        const now = tzParts(tz, new Date());
        const due = (time: string) => {
          const [hh, mm] = time.split(':').map(Number);
          return now.minutes >= hh * 60 + mm && now.minutes <= hh * 60 + mm + 30;
        };
        if (w.digest.enabled && w.digest.weekdays.includes(now.weekday) && w.digest.lastSentDate !== now.ymd && due(w.digest.time)) {
          w.digest.lastSentDate = now.ymd;
          await this.saveWork(agent, w);
          await this.runDigest(agent.tenantId, { deliver: true });
        }
        if (w.insights.enabled && now.weekday === w.insights.weekday && w.insights.lastSentDate !== now.ymd && due(w.insights.time)) {
          w.insights.lastSentDate = now.ymd;
          await this.saveWork(agent, w);
          await this.runInsights(agent.tenantId, { deliver: true });
        }
      } catch (e: any) {
        this.log.warn(`reviews agent tick ${agent.id}: ${e?.message || e}`);
      }
    }
  }
}
