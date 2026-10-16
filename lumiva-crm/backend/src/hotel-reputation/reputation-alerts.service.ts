import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import axios from 'axios';
import { Hotel } from '../hotels/hotel.entity';
import { TelegramBot } from '../telegram-crm/telegram-bot.entity';
import { User } from '../users/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { escapeMailHtml } from '../mail/mail-template.util';
import { HotelReview, HotelReviewAlert, HotelReviewSource } from './reputation.entities';
import { AlertKind, REPLY_MODE, ReputationConfig, Recipients, TOPIC_LABELS_RU, activeTopicSql, reviewHasTextSql } from './reputation.constants';
import { ReputationEventsService } from './reputation-events.service';

const PLATFORM_LABEL: Record<string, string> = {
  google: 'Google', holidaycheck: 'HolidayCheck', tripadvisor: 'Tripadvisor', yandex: 'Яндекс', expedia: 'Expedia', check24: 'Check24', otelpuan: 'Otelpuan', booking: 'Booking.com',
};

type Audience = 'hotel' | 'brand' | 'developer';
type Channel = 'telegram' | 'email' | 'inapp';

/**
 * Алерты модуля отзывов. Кому и каким каналом — по таблице ТЗ; пороги — в настройках.
 * Каждый алерт пишется в hotel_review_alerts с уникальным ключом, повтор не отправляется.
 */
@Injectable()
export class ReputationAlertsService {
  private readonly log = new Logger(ReputationAlertsService.name);

  constructor(
    @InjectRepository(HotelReviewAlert) private readonly alerts: Repository<HotelReviewAlert>,
    @InjectRepository(HotelReview) private readonly reviews: Repository<HotelReview>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(TelegramBot) private readonly bots: Repository<TelegramBot>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly events: ReputationEventsService,
  ) {}

  private link(path: string) {
    return `${(process.env.FRONTEND_URL || 'https://crm.lumiva.agency').replace(/\/$/, '')}${path}`;
  }

  /** Записать алерт (если такого ключа ещё не было) и разослать. */
  private async send(
    tenantId: string,
    cfg: ReputationConfig,
    a: { kind: AlertKind | 'agent'; key: string; hotelId?: string | null; reviewId?: string | null; title: string; body: string; path: string; to: Audience[]; channels: Channel[] },
  ) {
    // сообщения ИИ-сотрудника (сводка, напоминания) не зависят от переключателей алертов
    if (a.kind !== 'agent' && !cfg.alerts[a.kind]) return;
    const ins = await this.alerts
      .createQueryBuilder()
      .insert()
      .values({ tenantId, kind: a.kind, dedupKey: a.key.slice(0, 300), hotelId: a.hotelId || null, reviewId: a.reviewId || null, title: a.title, body: a.body })
      .orIgnore()
      .returning(['id'])
      .execute();
    const id = ins.raw?.[0]?.id;
    if (!id) return; // уже отправляли

    const hotel = a.hotelId ? await this.hotels.findOne({ where: { id: a.hotelId } }) : null;
    const rec: Recipients = { emails: [], telegram: [], userIds: [] };
    const add = (r?: Recipients) => {
      if (!r) return;
      rec.emails.push(...(r.emails || []));
      rec.telegram.push(...(r.telegram || []));
      rec.userIds.push(...(r.userIds || []));
    };
    if (a.to.includes('hotel') && hotel) add(cfg.recipients.hotels[hotel.id]);
    if (a.to.includes('brand') && hotel?.brandId) add(cfg.recipients.brands[hotel.brandId]);
    if (a.to.includes('developer')) add(cfg.recipients.developer);
    const emails = [...new Set(rec.emails)];
    const tg = [...new Set(rec.telegram)];
    let userIds = [...new Set(rec.userIds)];
    const sent: Record<string, number> = { telegram: 0, email: 0, inapp: 0 };
    const url = this.link(a.path);

    if (a.channels.includes('telegram') && tg.length && cfg.telegramBotId) {
      const bot = await this.bots.findOne({ where: { id: cfg.telegramBotId, tenantId } as any });
      const list: any[] = (bot?.meta?.recipients as any[]) || [];
      for (const r of list.filter((x) => tg.includes(x.id))) {
        try {
          await axios.post(
            `https://api.telegram.org/bot${bot!.botToken}/sendMessage`,
            { chat_id: String(r.telegramChatId), text: `${a.title}\n\n${a.body}\n\n${url}`, disable_web_page_preview: true },
            { timeout: 15_000 },
          );
          sent.telegram++;
        } catch (e: any) {
          this.log.warn(`reputation telegram alert failed: ${e?.response?.data?.description || e?.message}`);
        }
      }
    }
    // email — по таблице ТЗ, а также запасной канал, если Telegram не настроен
    const wantEmail = a.channels.includes('email') || (a.channels.includes('telegram') && sent.telegram === 0);
    if (wantEmail && emails.length) {
      const e = escapeMailHtml;
      const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:560px">
<h2 style="font-size:17px;margin:0 0 10px;color:#18181b">${e(a.title)}</h2>
<div style="font-size:14px;line-height:1.55;color:#3f3f46;white-space:pre-line">${e(a.body)}</div>
<p style="margin:18px 0 0"><a href="${url}" style="display:inline-block;padding:11px 22px;background:#222;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px">Открыть в CRM</a></p></div>`;
      for (const to of emails) {
        try {
          await this.mail.sendMail({ to, subject: a.title, html });
          sent.email++;
        } catch (err: any) {
          this.log.warn(`reputation email alert failed: ${err?.message}`);
        }
      }
    }
    if (!userIds.length && (a.to.includes('developer') || a.kind === 'agent') && !emails.length && !tg.length) {
      userIds = (await this.users.find({ where: { tenantId, role: 'owner' } as any })).map((u) => u.id);
    }
    if (userIds.length) {
      try {
        await this.notifications.create(tenantId, userIds, a.title, a.body.slice(0, 500), { link: a.path, kind: `hotel_review_${a.kind}` });
        sent.inapp = userIds.length;
      } catch (e: any) {
        this.log.warn(`reputation in-app alert failed: ${e?.message}`);
      }
    }
    await this.alerts.update({ id }, { channels: sent });
  }

  private stars(r: HotelReview) {
    const v = r.rating10 != null ? Number(r.rating10) : null;
    return v == null ? '—' : `${r.ratingRaw != null ? Number(r.ratingRaw) : ''}/${r.ratingScale ?? ''} (${v.toFixed(1)}/10)`;
  }

  private async hotelName(id: string | null | undefined) {
    if (!id) return '';
    return (await this.hotels.findOne({ where: { id } }))?.name || '';
  }

  // ---------------------------------------------------------------- события

  async negative(r: HotelReview, cfg: ReputationConfig) {
    const hotel = await this.hotelName(r.hotelId);
    await this.send(r.tenantId, cfg, {
      kind: 'negative',
      key: `negative:${r.id}`,
      hotelId: r.hotelId,
      reviewId: r.id,
      title: `⚠️ Негативный отзыв · ${hotel} · ${PLATFORM_LABEL[r.platform]}`,
      body: `${this.stars(r)} — ${r.author || 'гость'}\n${(r.textOriginal || 'оценка без текста').slice(0, 700)}`,
      path: `/hotels/reviews?review=${r.id}`,
      to: ['hotel', 'brand'],
      channels: ['telegram', 'email', 'inapp'],
    });
  }

  async ratingLowered(r: HotelReview, from: number, to: number, cfg: ReputationConfig) {
    const hotel = await this.hotelName(r.hotelId);
    await this.send(r.tenantId, cfg, {
      kind: 'rating_lowered',
      key: `lowered:${r.id}:${to}`,
      hotelId: r.hotelId,
      reviewId: r.id,
      title: `↘️ Гость понизил оценку · ${hotel} · ${PLATFORM_LABEL[r.platform]}`,
      body: `${r.author || 'Гость'}: ${from.toFixed(1)} → ${to.toFixed(1)} из 10\n${(r.textOriginal || '').slice(0, 500)}`,
      path: `/hotels/reviews?review=${r.id}`,
      to: ['hotel'],
      channels: ['telegram', 'inapp'],
    });
  }

  /** Отзывы без ответа дольше N часов (кроме Check24). Только найденные свежими — не история до подключения. */
  async checkNoReply(tenantId: string, cfg: ReputationConfig) {
    const h = cfg.thresholds.noReplyHours;
    const rows: HotelReview[] = await this.reviews
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.hasReply = false AND r.status <> :del', { del: 'deleted' })
      .andWhere(reviewHasTextSql('r'))
      .andWhere(`r.platform IN (:...pl)`, { pl: Object.entries(REPLY_MODE).filter(([, m]) => m !== 'none').map(([p]) => p) })
      .andWhere('r.publishedAt < :limit AND r.publishedAt > :floor', { limit: new Date(Date.now() - h * 36e5), floor: new Date(Date.now() - (h + 24 * 14) * 36e5) })
      .andWhere(`r.firstSeenAt - r.publishedAt < interval '4 days'`)
      .take(100)
      .getMany();
    for (const r of rows) {
      void this.events.noReply(r, (Date.now() - (r.publishedAt?.getTime() ?? Date.now())) / 36e5);
      const hotel = await this.hotelName(r.hotelId);
      await this.send(tenantId, cfg, {
        kind: 'no_reply',
        key: `no_reply:${r.id}`,
        hotelId: r.hotelId,
        reviewId: r.id,
        title: `⏳ Отзыв без ответа ${h}+ ч · ${hotel} · ${PLATFORM_LABEL[r.platform]}`,
        body: `${this.stars(r)} — ${r.author || 'гость'}\n${(r.textOriginal || '').slice(0, 300)}`,
        path: `/hotels/reviews?review=${r.id}`,
        to: ['hotel'],
        channels: ['telegram', 'inapp'],
      });
    }
  }

  /** Средняя оценка отеля за 30 дней против предыдущих 30 дней упала на порог и больше. */
  async checkAvgDrop(tenantId: string, cfg: ReputationConfig) {
    const rows = await this.reviews.query(
      `SELECT "hotelId",
              AVG("rating10") FILTER (WHERE "publishedAt" >= now() - interval '30 days') AS cur,
              COUNT(*) FILTER (WHERE "publishedAt" >= now() - interval '30 days' AND "rating10" IS NOT NULL) AS cur_n,
              AVG("rating10") FILTER (WHERE "publishedAt" < now() - interval '30 days') AS prev,
              COUNT(*) FILTER (WHERE "publishedAt" < now() - interval '30 days' AND "rating10" IS NOT NULL) AS prev_n
         FROM hotel_reviews
        WHERE "tenantId" = $1 AND status <> 'deleted' AND "publishedAt" >= now() - interval '60 days'
        GROUP BY "hotelId"`,
      [tenantId],
    );
    const week = Math.floor(Date.now() / (7 * 864e5));
    for (const x of rows) {
      if (Number(x.cur_n) < 5 || Number(x.prev_n) < 5) continue;
      const drop = Number(x.prev) - Number(x.cur);
      if (drop < cfg.thresholds.ratingDropPoints) continue;
      void this.events.ratingDrop(tenantId, x.hotelId, Number(x.cur), Number(x.prev), week);
      const hotel = await this.hotelName(x.hotelId);
      await this.send(tenantId, cfg, {
        kind: 'avg_drop',
        key: `avg_drop:${x.hotelId}:${week}`,
        hotelId: x.hotelId,
        title: `📉 Падение оценки · ${hotel}`,
        body: `Средняя оценка за 30 дней: ${Number(x.cur).toFixed(2)} (было ${Number(x.prev).toFixed(2)} за предыдущие 30 дней, −${drop.toFixed(2)}).\nОтзывов: ${x.cur_n} против ${x.prev_n}.`,
        path: `/hotels/reviews/dashboard?hotel=${x.hotelId}`,
        to: ['brand'],
        channels: ['email', 'inapp'],
      });
    }
  }

  /** Одна тема жалоб N раз и больше за M дней в одном отеле. */
  async checkTopicSpike(tenantId: string, cfg: ReputationConfig) {
    const d = cfg.thresholds.topicRepeatDays;
    const rows = await this.reviews.query(
      `SELECT "hotelId", topic, COALESCE("otherLabel", '') AS label, COUNT(*) AS n,
              (array_agg(quote ORDER BY "publishedAt" DESC))[1:3] AS quotes
         FROM hotel_review_topics
        WHERE "tenantId" = $1 AND ${activeTopicSql(cfg, '')} AND sentiment = 'negative' AND "publishedAt" >= now() - ($2 || ' days')::interval
        GROUP BY "hotelId", topic, COALESCE("otherLabel", '')
       HAVING COUNT(*) >= $3`,
      [tenantId, String(d), cfg.thresholds.topicRepeatCount],
    );
    const bucket = Math.floor(Date.now() / (d * 864e5));
    for (const x of rows) {
      const hotel = await this.hotelName(x.hotelId);
      const label = x.topic === 'other' ? x.label || 'прочее' : TOPIC_LABELS_RU[x.topic] || cfg.topicsExtra.find((t) => t.key === x.topic)?.label || x.topic;
      void this.events.topicSpike(tenantId, x.hotelId, x.topic, label, Number(x.n), d, (x.quotes || []).filter(Boolean), bucket);
      await this.send(tenantId, cfg, {
        kind: 'topic_spike',
        key: `topic:${x.hotelId}:${x.topic}:${x.label}:${bucket}`,
        hotelId: x.hotelId,
        title: `🔁 Повторяющаяся жалоба «${label}» · ${hotel}`,
        body: `${x.n} негативных упоминаний за ${d} дн.\n${(x.quotes || []).filter(Boolean).map((q: string) => `«${q}»`).join('\n')}`,
        path: `/hotels/reviews?hotel=${x.hotelId}&topic=${encodeURIComponent(x.topic)}`,
        to: ['hotel', 'brand'],
        channels: ['telegram', 'inapp'],
      });
    }
  }

  // ---------------------------------------------------------------- сбои синхронизации (разработчику)

  async syncError(s: HotelReviewSource, error: string, cfg: ReputationConfig) {
    const hotel = await this.hotelName(s.hotelId);
    const day = new Date().toISOString().slice(0, 10);
    const isAuth = /401|403|unauthor|forbidden|revoked|invalid_grant|ключ/i.test(error);
    await this.send(s.tenantId, cfg, {
      kind: 'sync_problem',
      key: `sync_error:${s.id}:${day}`,
      hotelId: s.hotelId,
      title: `🛠 Ошибка синхронизации · ${PLATFORM_LABEL[s.platform]} · ${hotel}`,
      body: `${error.slice(0, 600)}${isAuth ? '\n\nПохоже на проблему доступа: проверьте ключ/подключение площадки.' : ''}`,
      path: `/hotels/reviews/settings?tab=log`,
      to: ['developer'],
      channels: ['telegram', 'inapp'],
    });
  }

  async countDrift(s: HotelReviewSource, apiTotal: number, inDb: number, pct: number, cfg: ReputationConfig) {
    const hotel = await this.hotelName(s.hotelId);
    const day = new Date().toISOString().slice(0, 10);
    await this.send(s.tenantId, cfg, {
      kind: 'sync_problem',
      key: `drift:${s.id}:${day}`,
      hotelId: s.hotelId,
      title: `🛠 Расхождение счётчика · ${PLATFORM_LABEL[s.platform]} · ${hotel}`,
      body: `По API площадки ${apiTotal} отзывов, в CRM ${inDb} (расхождение ${pct.toFixed(1)}%). Дозагрузка уже выполнена.`,
      path: `/hotels/reviews/settings?tab=log`,
      to: ['developer'],
      channels: ['telegram', 'inapp'],
    });
  }

  async stale(s: HotelReviewSource, days: number, cfg: ReputationConfig) {
    const hotel = await this.hotelName(s.hotelId);
    const bucket = Math.floor(Date.now() / (days * 864e5));
    await this.send(s.tenantId, cfg, {
      kind: 'sync_problem',
      key: `stale:${s.id}:${bucket}`,
      hotelId: s.hotelId,
      title: `🛠 ${days} дн. без новых отзывов · ${PLATFORM_LABEL[s.platform]} · ${hotel}`,
      body: `Обычно с площадки приходят отзывы, а сейчас ни одного нового ${days} дней. Возможно, скрейпер сломался после изменения сайта — проверьте журнал и при необходимости переключите на запасной.`,
      path: `/hotels/reviews/settings?tab=log`,
      to: ['developer'],
      channels: ['telegram', 'inapp'],
    });
  }

  async fallbackSwitched(s: HotelReviewSource, primary: string, fallback: string, cfg: ReputationConfig) {
    const hotel = await this.hotelName(s.hotelId);
    await this.send(s.tenantId, cfg, {
      kind: 'sync_problem',
      key: `fallback:${s.id}:${new Date().toISOString().slice(0, 10)}`,
      hotelId: s.hotelId,
      title: `🛠 Переключено на запасной скрейпер · ${PLATFORM_LABEL[s.platform]} · ${hotel}`,
      body: `Основной ${primary} дважды подряд завершился ошибкой. Дальше сбор идёт через ${fallback}.`,
      path: `/hotels/reviews/settings?tab=log`,
      to: ['developer'],
      channels: ['telegram', 'inapp'],
    });
  }

  async apifyBudget(tenantId: string, error: string, cfg: ReputationConfig) {
    await this.send(tenantId, cfg, {
      kind: 'sync_problem',
      key: `apify_budget:${new Date().toISOString().slice(0, 10)}`,
      title: '🛠 Apify: закончился месячный бюджет — сбор отзывов на паузе',
      body: `${error.slice(0, 300)}\n\nПоднимите лимит или тариф в Apify (Billing → Usage limit / Plan). Сбор возобновится сам в течение 3 часов или сразу по кнопке «Собрать».`,
      path: `/hotels/reviews/settings?tab=connections`,
      to: ['developer'],
      channels: ['telegram', 'email', 'inapp'],
    });
  }

  async replyFailed(r: HotelReview, error: string, cfg: ReputationConfig) {
    const hotel = await this.hotelName(r.hotelId);
    await this.send(r.tenantId, cfg, {
      kind: 'sync_problem',
      key: `reply_failed:${r.id}:${new Date().toISOString().slice(0, 13)}`,
      hotelId: r.hotelId,
      reviewId: r.id,
      title: `🛠 Ответ не отправлен · ${PLATFORM_LABEL[r.platform]} · ${hotel}`,
      body: error.slice(0, 600),
      path: `/hotels/reviews?review=${r.id}`,
      to: ['developer'],
      channels: ['telegram', 'inapp'],
    });
  }

  /** Сообщение от ИИ-менеджера отзывов получателям отеля/бренда/разработчика (с защитой от повтора по key). */
  deliver(
    tenantId: string,
    cfg: ReputationConfig,
    a: { key: string; hotelId?: string | null; reviewId?: string | null; title: string; body: string; path: string; to: Array<'hotel' | 'brand' | 'developer'>; channels: Array<'telegram' | 'email' | 'inapp'> },
  ) {
    return this.send(tenantId, cfg, { kind: 'agent', ...a });
  }

  async recent(tenantId: string, limit = 100) {
    // метки событий автоматизаций (kind=event) — служебные, в журнал алертов не попадают
    return this.alerts.find({ where: { tenantId, kind: Not('event') }, order: { sentAt: 'DESC' }, take: limit });
  }
}
