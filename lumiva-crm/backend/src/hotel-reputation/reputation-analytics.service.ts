import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hotel } from '../hotels/hotel.entity';
import { MailService } from '../mail/mail.service';
import { escapeMailHtml } from '../mail/mail-template.util';
import { HotelBrand, HotelReview } from './reputation.entities';
import { REPLY_MODE, TOPIC_LABELS_RU, activeTopicSql, listParam, reviewHasTextSql } from './reputation.constants';
import { ReputationSettingsService } from './reputation-settings.service';
import { ReputationAiService } from './reputation-ai.service';
import { ReputationReservationsService } from './reputation-reservations.service';
import { tenantFrontend } from './reputation-tenant.util';

export interface AnalyticsQuery {
  /** Один id или несколько через запятую (мультивыбор в фильтрах). */
  brandId?: string;
  hotelId?: string;
  platform?: string;
  from?: string;
  to?: string;
  /** «Всё время»: начало периода — самый ранний отзыв в срезе. */
  all?: string;
  /** С чем сравнивать: prev — предыдущий период той же длины (по умолчанию), yoy — тот же период год назад. */
  compare?: string;
}

export type SeriesGranularity = 'day' | 'week' | 'month';

const NO_REPLY_PLATFORMS = Object.entries(REPLY_MODE).filter(([, m]) => m === 'none').map(([p]) => p);
const round = (v: any, d = 2) => (v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 10 ** d) / 10 ** d);
/**
 * Страна гостя по языку отзыва (если площадка не отдала страну профиля). Язык ≠ паспорт: немецкий —
 * это и Австрия со Швейцарией; английский и арабский — группы стран (x-en, x-ar).
 */
const LANG_COUNTRY: Record<string, string> = {
  tr: 'TR', ru: 'RU', de: 'DE', pl: 'PL', fr: 'FR', nl: 'NL', ro: 'RO', uk: 'UA', it: 'IT', bg: 'BG', cs: 'CZ', lt: 'LT',
  hu: 'HU', sk: 'SK', es: 'ES', bs: 'BA', hr: 'HR', sv: 'SE', da: 'DK', sq: 'AL', az: 'AZ', sr: 'RS', lv: 'LV', pt: 'PT',
  no: 'NO', nb: 'NO', et: 'EE', zh: 'CN', ja: 'JP', ko: 'KR', fi: 'FI', el: 'GR', he: 'IL', iw: 'IL', ka: 'GE', kk: 'KZ',
  be: 'BY', sl: 'SI', mk: 'MK', fa: 'IR', hy: 'AM', uz: 'UZ', ky: 'KG', tk: 'TM', mn: 'MN', is: 'IS', ga: 'IE', hi: 'IN',
  th: 'TH', vi: 'VN', id: 'ID', ms: 'MY', en: 'x-en', ar: 'x-ar',
};
export function countryOf(authorCountry: string | null, lang: string | null): { code: string; byLang: boolean } | null {
  if (authorCountry) return { code: authorCountry.toUpperCase(), byLang: false };
  const l = (lang || '').toLowerCase().split(/[-_]/)[0];
  return LANG_COUNTRY[l] ? { code: LANG_COUNTRY[l], byLang: true } : null;
}
/** Дашборд репутации: как меняется рейтинг и на что конкретно жалуются гости. */
@Injectable()
export class ReputationAnalyticsService {
  private readonly log = new Logger(ReputationAnalyticsService.name);

  constructor(
    @InjectRepository(HotelReview) private readonly reviews: Repository<HotelReview>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(HotelBrand) private readonly brands: Repository<HotelBrand>,
    private readonly settings: ReputationSettingsService,
    private readonly ai: ReputationAiService,
    private readonly mail: MailService,
    private readonly stays: ReputationReservationsService,
  ) {}

  /** WHERE по отзывам (алиас r) без периода — период добавляется отдельно. */
  private scope(tenantId: string, q: AnalyticsQuery, params: any[], alias = 'r') {
    params.push(tenantId);
    // подтверждённые дубликаты (тот же отзыв гостя на другой площадке) в аналитике не считаем дважды
    let w = `${alias}."tenantId" = $${params.length} AND ${alias}.status <> 'deleted' AND ${alias}."duplicateOfId" IS NULL`;
    const brands = listParam(q.brandId, 'uuid');
    const hotels = listParam(q.hotelId, 'uuid');
    const platforms = listParam(q.platform, 'platform');
    if (brands.length) {
      params.push(brands);
      w += ` AND ${alias}."hotelId" IN (SELECT id FROM hotels WHERE "brandId" = ANY($${params.length}::uuid[]))`;
    }
    if (hotels.length) {
      params.push(hotels);
      w += ` AND ${alias}."hotelId" = ANY($${params.length}::uuid[])`;
    }
    if (platforms.length) {
      params.push(platforms);
      w += ` AND ${alias}.platform = ANY($${params.length}::text[])`;
    }
    return w;
  }

  /** «Всё время» → from = дата самого раннего отзыва в срезе. */
  private async resolveAll(tenantId: string, q: AnalyticsQuery): Promise<AnalyticsQuery> {
    if (q.all !== '1' && q.all !== 'true') return q;
    const p: any[] = [];
    const w = this.scope(tenantId, { ...q, from: undefined, to: undefined }, p);
    const [row] = await this.reviews.query(`SELECT MIN(r."publishedAt") AS m FROM hotel_reviews r WHERE ${w}`, p);
    const from = row?.m ? new Date(row.m).toISOString().slice(0, 10) : new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
    return { ...q, from, to: undefined };
  }

  /** Шаг графика по длине периода: до ~1,5 мес — дни, до ~7 мес — недели, дальше — месяцы. */
  private granularity(from: Date, to: Date): SeriesGranularity {
    const days = (to.getTime() - from.getTime()) / 864e5;
    return days <= 45 ? 'day' : days <= 210 ? 'week' : 'month';
  }

  /** Ряд по периоду: оценка, число отзывов, доля негатива по дням/неделям/месяцам, пустые шаги заполнены нулями. */
  private async series(tenantId: string, q: AnalyticsQuery, from: Date, to: Date, negBelow: number, granOverride?: SeriesGranularity) {
    const gran = granOverride || this.granularity(from, to);
    const p: any[] = [];
    const w = this.scope(tenantId, q, p);
    p.push(from, to, negBelow, gran);
    const rows = await this.reviews.query(
      `SELECT to_char(date_trunc($${p.length}, r."publishedAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS bucket,
              COUNT(*)::int AS count, AVG(r."rating10") AS avg,
              COUNT(*) FILTER (WHERE r."rating10" < $${p.length - 1})::int AS neg
         FROM hotel_reviews r
        WHERE ${w} AND r."publishedAt" >= $${p.length - 3} AND r."publishedAt" < $${p.length - 2}
        GROUP BY 1 ORDER BY 1`,
      p,
    );
    // шаги без отзывов — нулями, чтобы ось времени была честной
    const byKey = new Map<string, any>(rows.map((r: any) => [r.bucket, r]));
    const start = new Date(from);
    start.setUTCHours(0, 0, 0, 0);
    if (gran === 'week') start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    if (gran === 'month') start.setUTCDate(1);
    const out: Array<{ bucket: string; count: number; avg10: number | null; negativeShare: number | null }> = [];
    for (let d = new Date(start); d < to && out.length < 400; ) {
      const key = d.toISOString().slice(0, 10);
      const r = byKey.get(key);
      out.push({ bucket: key, count: r?.count ?? 0, avg10: r ? round(r.avg) : null, negativeShare: r?.count ? round((r.neg / r.count) * 100, 1) : null });
      if (gran === 'day') d.setUTCDate(d.getUTCDate() + 1);
      else if (gran === 'week') d.setUTCDate(d.getUTCDate() + 7);
      else d.setUTCMonth(d.getUTCMonth() + 1);
    }
    return { granularity: gran, points: out };
  }

  private period(q: AnalyticsQuery) {
    const to = q.to ? new Date(new Date(q.to).getTime() + 864e5) : new Date();
    const from = q.from ? new Date(q.from) : new Date(to.getTime() - 90 * 864e5);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) throw new BadRequestException('Bad period');
    if (q.compare === 'yoy') {
      // курорты сезонные: сентябрь честнее сравнивать с прошлым сентябрём, а не с августом
      const prevFrom = new Date(from);
      prevFrom.setUTCFullYear(prevFrom.getUTCFullYear() - 1);
      const prevTo = new Date(to);
      prevTo.setUTCFullYear(prevTo.getUTCFullYear() - 1);
      return { from, to, prevFrom, prevTo, mode: 'yoy' as const };
    }
    const len = to.getTime() - from.getTime();
    return { from, to, prevFrom: new Date(from.getTime() - len), prevTo: from, mode: 'prev' as const };
  }

  /** Базовые метрики за интервал (используется для текущего и предыдущего периода). */
  private async kpis(tenantId: string, q: AnalyticsQuery, from: Date, to: Date, negBelow: number) {
    const p: any[] = [];
    const w = this.scope(tenantId, q, p);
    p.push(from, to, negBelow, NO_REPLY_PLATFORMS);
    const n = p.length;
    const [row] = await this.reviews.query(
      `SELECT COUNT(*)::int AS count,
              AVG(r."rating10") AS avg,
              COUNT(*) FILTER (WHERE r."rating10" < $${n - 1})::int AS neg,
              COUNT(r."rating10")::int AS rated,
              COUNT(*) FILTER (WHERE NOT (r.platform = ANY($${n})) AND ${reviewHasTextSql('r')})::int AS replyable,
              COUNT(*) FILTER (WHERE NOT (r.platform = ANY($${n})) AND ${reviewHasTextSql('r')} AND r."hasReply")::int AS replied,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (r."repliedAt" - r."publishedAt")) / 3600)
                FILTER (WHERE r."hasReply" AND r."repliedAt" >= r."publishedAt" AND NOT r."replyMarkedManually") AS median_h
         FROM hotel_reviews r
        WHERE ${w} AND r."publishedAt" >= $${n - 3} AND r."publishedAt" < $${n - 2}`,
      p,
    );
    return {
      count: row.count,
      avg10: round(row.avg),
      negativeShare: row.rated ? round((row.neg / row.rated) * 100, 1) : null,
      responseRate: row.replyable ? round((row.replied / row.replyable) * 100, 1) : null,
      medianReplyHours: round(row.median_h, 1),
    };
  }

  /**
   * Индекс репутации: средняя оценка по каждой площадке, взвешенная числом отзывов на этой площадке
   * (берём большее из счётчика самой площадки и числа отзывов в CRM — у площадок с большим весом и голос больше).
   */
  private async reputationIndex(tenantId: string, q: AnalyticsQuery, from: Date, to: Date) {
    const p: any[] = [];
    const w = this.scope(tenantId, q, p);
    p.push(from, to);
    const rows = await this.reviews.query(
      `WITH per AS (
         SELECT r."hotelId", r.platform, AVG(r."rating10") AS avg
           FROM hotel_reviews r
          WHERE ${w} AND r."publishedAt" >= $${p.length - 1} AND r."publishedAt" < $${p.length} AND r."rating10" IS NOT NULL
          GROUP BY r."hotelId", r.platform),
       weight AS (
         SELECT r."hotelId", r.platform, GREATEST(COUNT(*), MAX(COALESCE(s."platformCount", 0))) AS w
           FROM hotel_reviews r LEFT JOIN hotel_review_sources s ON s.id = r."sourceId"
          WHERE r."tenantId" = $1 AND r.status <> 'deleted'
          GROUP BY r."hotelId", r.platform)
       SELECT per."hotelId", SUM(per.avg * weight.w) / NULLIF(SUM(weight.w), 0) AS idx
         FROM per JOIN weight USING ("hotelId", platform)
        GROUP BY ROLLUP (per."hotelId")`,
      p,
    );
    const byHotel: Record<string, number | null> = {};
    let total: number | null = null;
    for (const r of rows) {
      // индекс 0–100 (средняя 0–10 × 10); пустой период — null, а не 0
      const v = r.idx == null ? null : round(Number(r.idx) * 10, 2);
      if (r.hotelId) byHotel[r.hotelId] = v;
      else total = v;
    }
    return { total, byHotel };
  }

  async dashboard(tenantId: string, qIn: AnalyticsQuery) {
    const q = await this.resolveAll(tenantId, qIn);
    const cfg = await this.settings.config(tenantId);
    const negBelow = cfg.thresholds.negativeBelow;
    const { from, to, prevFrom, prevTo, mode } = this.period(q);
    const [cur, prev, idx, prevIdx] = await Promise.all([
      this.kpis(tenantId, q, from, to, negBelow),
      this.kpis(tenantId, q, prevFrom, prevTo, negBelow),
      this.reputationIndex(tenantId, q, from, to),
      this.reputationIndex(tenantId, q, prevFrom, prevTo),
    ]);

    // по площадкам
    const pp: any[] = [];
    const wp = this.scope(tenantId, q, pp);
    pp.push(from, to, negBelow);
    const byPlatform = await this.reviews.query(
      `SELECT r.platform, COUNT(*)::int AS count, AVG(r."rating10") AS avg,
              COUNT(*) FILTER (WHERE r."rating10" < $${pp.length})::int AS neg,
              COUNT(*) FILTER (WHERE r."hasReply")::int AS replied
         FROM hotel_reviews r
        WHERE ${wp} AND r."publishedAt" >= $${pp.length - 2} AND r."publishedAt" < $${pp.length - 1}
        GROUP BY r.platform ORDER BY count DESC`,
      pp,
    );
    const sp: any[] = [tenantId];
    let sw = `s."tenantId" = $1`;
    const qHotels = listParam(q.hotelId, 'uuid');
    const qBrands = listParam(q.brandId, 'uuid');
    if (qHotels.length) {
      sp.push(qHotels);
      sw += ` AND s."hotelId" = ANY($${sp.length}::uuid[])`;
    }
    if (qBrands.length) {
      sp.push(qBrands);
      sw += ` AND s."hotelId" IN (SELECT id FROM hotels WHERE "brandId" = ANY($${sp.length}::uuid[]))`;
    }
    const sourceStats = await this.reviews.query(
      `SELECT s.platform, SUM(s."platformCount")::int AS pcount,
              SUM(s."platformRating" * s."platformCount") / NULLIF(SUM(s."platformCount") FILTER (WHERE s."platformRating" IS NOT NULL), 0) AS prating,
              (SELECT COUNT(*)::int FROM hotel_reviews r WHERE r."sourceId" = ANY(array_agg(s.id)) AND r.status <> 'deleted') AS in_crm,
              MAX(s."lastSuccessAt") AS last_ok, COUNT(*) FILTER (WHERE s."lastError" IS NOT NULL)::int AS failing
         FROM hotel_review_sources s WHERE ${sw} AND s.active GROUP BY s.platform`,
      sp,
    );

    // по отелям
    const hp: any[] = [];
    const wh = this.scope(tenantId, q, hp);
    hp.push(from, to, prevFrom, negBelow, NO_REPLY_PLATFORMS, prevTo);
    const n = hp.length - 1; // $n — площадки без ответов, $${n + 1} — конец периода сравнения
    const byHotelRows = await this.reviews.query(
      `SELECT r."hotelId",
              COUNT(*) FILTER (WHERE r."publishedAt" >= $${n - 4})::int AS count,
              AVG(r."rating10") FILTER (WHERE r."publishedAt" >= $${n - 4}) AS avg,
              AVG(r."rating10") FILTER (WHERE r."publishedAt" >= $${n - 2} AND r."publishedAt" < $${n + 1}) AS prev_avg,
              COUNT(*) FILTER (WHERE r."publishedAt" >= $${n - 4} AND r."rating10" < $${n - 1})::int AS neg,
              COUNT(r."rating10") FILTER (WHERE r."publishedAt" >= $${n - 4})::int AS rated,
              COUNT(*) FILTER (WHERE r."publishedAt" >= $${n - 4} AND NOT (r.platform = ANY($${n})) AND ${reviewHasTextSql('r')})::int AS replyable,
              COUNT(*) FILTER (WHERE r."publishedAt" >= $${n - 4} AND NOT (r.platform = ANY($${n})) AND ${reviewHasTextSql('r')} AND r."hasReply")::int AS replied,
              COUNT(*) FILTER (WHERE NOT (r.platform = ANY($${n})) AND NOT r."hasReply" AND ${reviewHasTextSql('r')} AND r."rating10" < $${n - 1})::int AS open_neg,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (r."repliedAt" - r."publishedAt")) / 3600)
                FILTER (WHERE r."publishedAt" >= $${n - 4} AND r."hasReply" AND r."repliedAt" >= r."publishedAt" AND NOT r."replyMarkedManually") AS median_h
         FROM hotel_reviews r
        WHERE ${wh} AND ((r."publishedAt" >= $${n - 4} AND r."publishedAt" < $${n - 3}) OR (r."publishedAt" >= $${n - 2} AND r."publishedAt" < $${n + 1}))
        GROUP BY r."hotelId"`,
      hp,
    );

    const hotelList = await this.hotels.find({ where: { tenantId } });
    const brands = await this.brands.find({ where: { tenantId } });

    // темы: жалобы и похвалы за период против предыдущего
    const tp: any[] = [];
    const wt = this.scope(tenantId, q, tp);
    tp.push(from, to, prevFrom, prevTo);
    const topicRows = await this.reviews.query(
      `SELECT t.topic, COALESCE(t."otherLabel", '') AS label,
              COUNT(*) FILTER (WHERE t.sentiment = 'negative' AND r."publishedAt" >= $${tp.length - 3})::int AS neg,
              COUNT(*) FILTER (WHERE t.sentiment = 'positive' AND r."publishedAt" >= $${tp.length - 3})::int AS pos,
              COUNT(*) FILTER (WHERE t.sentiment = 'neutral' AND r."publishedAt" >= $${tp.length - 3})::int AS neu,
              COUNT(*) FILTER (WHERE t.sentiment = 'negative' AND r."publishedAt" >= $${tp.length - 1} AND r."publishedAt" < $${tp.length})::int AS prev_neg,
              (array_agg(t.quote ORDER BY r."publishedAt" DESC) FILTER (WHERE t.sentiment = 'negative' AND t.quote IS NOT NULL AND r."publishedAt" >= $${tp.length - 3}))[1:2] AS neg_quotes,
              (array_agg(t.quote ORDER BY r."publishedAt" DESC) FILTER (WHERE t.sentiment = 'positive' AND t.quote IS NOT NULL AND r."publishedAt" >= $${tp.length - 3}))[1:2] AS pos_quotes
         FROM hotel_review_topics t JOIN hotel_reviews r ON r.id = t."reviewId"
        WHERE ${wt} AND ${activeTopicSql(cfg)} AND ((r."publishedAt" >= $${tp.length - 3} AND r."publishedAt" < $${tp.length - 2}) OR (r."publishedAt" >= $${tp.length - 1} AND r."publishedAt" < $${tp.length}))
        GROUP BY t.topic, COALESCE(t."otherLabel", '')`,
      tp,
    );
    const topicLabel = (t: string, l: string) => (t === 'other' ? l || TOPIC_LABELS_RU.other : TOPIC_LABELS_RU[t] || cfg.topicsExtra.find((x) => x.key === t)?.label || t);
    const topics = topicRows.map((t: any) => ({
      topic: t.topic,
      label: topicLabel(t.topic, t.label),
      translations: cfg.topicsExtra.find((category) => category.key === t.topic)?.translations,
      isOther: t.topic === 'other',
      negative: t.neg,
      positive: t.pos,
      neutral: t.neu,
      prevNegative: t.prev_neg,
      negQuotes: (t.neg_quotes || []).filter(Boolean),
      posQuotes: (t.pos_quotes || []).filter(Boolean),
    }));

    // главная жалоба по каждому отелю
    const hcp: any[] = [];
    const whc = this.scope(tenantId, q, hcp);
    hcp.push(from, to);
    const hotelTopics = await this.reviews.query(
      `SELECT DISTINCT ON (r."hotelId") r."hotelId", t.topic, COALESCE(t."otherLabel", '') AS label, COUNT(*)::int AS n
         FROM hotel_review_topics t JOIN hotel_reviews r ON r.id = t."reviewId"
        WHERE ${whc} AND ${activeTopicSql(cfg)} AND t.sentiment = 'negative' AND r."publishedAt" >= $${hcp.length - 1} AND r."publishedAt" < $${hcp.length}
        GROUP BY r."hotelId", t.topic, COALESCE(t."otherLabel", '')
        ORDER BY r."hotelId", n DESC`,
      hcp,
    );

    // динамика по выбранному периоду (шаг — дни/недели/месяцы) и тот же ряд за предыдущий такой же период
    const series = await this.series(tenantId, q, from, to, negBelow);
    const prevSeries = await this.series(tenantId, q, prevFrom, prevTo, negBelow, series.granularity);
    const countries = await this.countries(tenantId, q, from, to, negBelow);
    // номера с жалобами — только если в CRM ведутся брони (иначе связать отзыв с номером нечем)
    let rooms: Awaited<ReturnType<ReputationReservationsService['roomsStats']>> | null = null;
    if (await this.stays.enabled(tenantId)) {
      const selHotels = listParam(q.hotelId, 'uuid');
      const selBrands = listParam(q.brandId, 'uuid');
      const all = await this.hotels.find({ where: { tenantId } });
      const ids = all.filter((h: any) => (!selHotels.length || selHotels.includes(h.id)) && (!selBrands.length || selBrands.includes(h.brandId))).map((h) => h.id);
      rooms = ids.length ? await this.stays.roomsStats(tenantId, { hotelIds: ids, from, to, negBelow }) : null;
    }

    // распределение оценок
    const dp: any[] = [];
    const wd = this.scope(tenantId, q, dp);
    dp.push(from, to);
    const dist = await this.reviews.query(
      `SELECT LEAST(10, GREATEST(1, CEIL(r."rating10")))::int AS bucket, COUNT(*)::int AS n
         FROM hotel_reviews r WHERE ${wd} AND r."rating10" IS NOT NULL AND r."publishedAt" >= $${dp.length - 1} AND r."publishedAt" < $${dp.length}
        GROUP BY 1 ORDER BY 1`,
      dp,
    );

    // время ответа по менеджерам (ответы, отправленные из CRM)
    const ap: any[] = [];
    const wa = this.scope(tenantId, q, ap);
    ap.push(from, to);
    const managers = await this.reviews.query(
      `SELECT x."authorUserId" AS "userId", COALESCE(u.name, u.email) AS name, COUNT(*)::int AS replies,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (x."postedAt" - r."publishedAt")) / 3600) AS median_h
         FROM hotel_review_replies x JOIN hotel_reviews r ON r.id = x."reviewId" LEFT JOIN users u ON u.id = x."authorUserId"
        WHERE ${wa} AND x."authorUserId" IS NOT NULL AND x.status IN ('sent','published') AND x."postedAt" >= $${ap.length - 1} AND x."postedAt" < $${ap.length}
        GROUP BY x."authorUserId", COALESCE(u.name, u.email) ORDER BY replies DESC`,
      ap,
    );

    const delta = (a: number | null, b: number | null) => (a == null || b == null ? null : round(a - b));
    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      prevPeriod: { from: prevFrom.toISOString(), to: prevTo.toISOString(), mode },
      prevSeries,
      countries,
      rooms,
      kpis: {
        ...cur,
        reputationIndex: idx.total,
        delta: {
          avg10: delta(cur.avg10, prev.avg10),
          count: cur.count - prev.count,
          negativeShare: delta(cur.negativeShare, prev.negativeShare),
          responseRate: delta(cur.responseRate, prev.responseRate),
          medianReplyHours: delta(cur.medianReplyHours, prev.medianReplyHours),
          reputationIndex: delta(idx.total, prevIdx.total),
        },
      },
      byPlatform: byPlatform.map((x: any) => {
        const s = sourceStats.find((y: any) => y.platform === x.platform);
        return {
          platform: x.platform,
          count: x.count,
          avg10: round(x.avg),
          negativeShare: x.count ? round((x.neg / x.count) * 100, 1) : null,
          responseRate: REPLY_MODE[x.platform as keyof typeof REPLY_MODE] === 'none' ? null : x.count ? round((x.replied / x.count) * 100, 1) : null,
          platformCount: s?.pcount ?? null,
          platformRating: round(s?.prating),
        };
      }),
      sources: sourceStats.map((s: any) => ({
        platform: s.platform,
        platformCount: s.pcount,
        inCrm: s.in_crm,
        lastSuccessAt: s.last_ok,
        failing: s.failing,
      })),
      byHotel: byHotelRows
        .map((x: any) => {
          const h = hotelList.find((y) => y.id === x.hotelId);
          const top = hotelTopics.find((y: any) => y.hotelId === x.hotelId);
          return {
            hotelId: x.hotelId,
            name: h?.name || '—',
            brandId: h?.brandId || null,
            brand: brands.find((b) => b.id === h?.brandId)?.name || null,
            count: x.count,
            avg10: round(x.avg),
            prevAvg10: round(x.prev_avg),
            delta: delta(round(x.avg), round(x.prev_avg)),
            reputationIndex: idx.byHotel[x.hotelId] ?? null,
            negativeShare: x.rated ? round((x.neg / x.rated) * 100, 1) : null,
            responseRate: x.replyable ? round((x.replied / x.replyable) * 100, 1) : null,
            medianReplyHours: round(x.median_h, 1),
            openNegative: x.open_neg,
            topComplaint: top ? {
              topic: top.topic,
              label: topicLabel(top.topic, top.label),
              translations: cfg.topicsExtra.find((category) => category.key === top.topic)?.translations,
              count: top.n,
            } : null,
          };
        })
        .sort((a: any, b: any) => (b.reputationIndex ?? -1) - (a.reputationIndex ?? -1)),
      series,
      distribution: dist,
      complaints: topics.filter((t: any) => t.negative > 0).sort((a: any, b: any) => b.negative - a.negative).slice(0, 10),
      praises: topics.filter((t: any) => t.positive > 0).sort((a: any, b: any) => b.positive - a.positive).slice(0, 10),
      otherTopics: topics.filter((t: any) => t.isOther).sort((a: any, b: any) => b.negative + b.positive - (a.negative + a.positive)).slice(0, 30),
      managers: managers.map((m: any) => ({ userId: m.userId, name: m.name, replies: m.replies, medianReplyHours: round(m.median_h, 1) })),
    };
  }

  /** Короткая сводка по всем отелям (карточки отелей, список, виджет главной): 90 дней. */
  async hotelsSummary(tenantId: string) {
    const cfg = await this.settings.config(tenantId);
    const rows = await this.reviews.query(
      `SELECT r."hotelId",
              COUNT(*) FILTER (WHERE r."publishedAt" > now() - interval '90 days')::int AS n90,
              ROUND(AVG(r."rating10") FILTER (WHERE r."publishedAt" > now() - interval '90 days'), 2) AS avg90,
              ROUND(AVG(r."rating10") FILTER (WHERE r."publishedAt" > now() - interval '30 days'), 2) AS avg30,
              ROUND(AVG(r."rating10") FILTER (WHERE r."publishedAt" > now() - interval '60 days' AND r."publishedAt" <= now() - interval '30 days'), 2) AS avg_prev30,
              COUNT(*) FILTER (WHERE r."publishedAt" > now() - interval '7 days')::int AS n7,
              COUNT(*) FILTER (WHERE NOT r."hasReply" AND r.platform <> 'check24' AND ${reviewHasTextSql('r')} AND r."rating10" < $2 AND r."publishedAt" > now() - interval '30 days')::int AS open_neg,
              COUNT(*) FILTER (WHERE NOT r."hasReply" AND r.platform <> 'check24' AND ${reviewHasTextSql('r')} AND r."publishedAt" > now() - interval '30 days')::int AS open_all
         FROM hotel_reviews r WHERE r."tenantId" = $1 AND r.status <> 'deleted' GROUP BY r."hotelId"`,
      [tenantId, cfg.thresholds.negativeBelow],
    );
    const totals = rows.reduce((a: any, x: any) => ({ n7: a.n7 + x.n7, openNeg: a.openNeg + x.open_neg, openAll: a.openAll + x.open_all }), { n7: 0, openNeg: 0, openAll: 0 });
    const n90 = rows.reduce((a: number, x: any) => a + x.n90, 0);
    const avg90 = n90 ? round(rows.reduce((a: number, x: any) => a + (x.avg90 ? Number(x.avg90) * x.n90 : 0), 0) / n90) : null;
    return {
      negBelow: cfg.thresholds.negativeBelow,
      totals: { ...totals, n90, avg90 },
      hotels: rows.map((x: any) => ({
        hotelId: x.hotelId, n90: x.n90, avg90: round(x.avg90), avg30: round(x.avg30), avgPrev30: round(x.avg_prev30), n7: x.n7,
        unansweredNegative: x.open_neg, unanswered: x.open_all,
      })),
    };
  }

  /** Вкладка «Отзывы» карточки отеля: KPI, площадки (с рейтингом на самой площадке), последние отзывы, главные темы. */
  async hotelSummary(tenantId: string, hotelId: string) {
    const cfg = await this.settings.config(tenantId);
    const nb = cfg.thresholds.negativeBelow;
    const from = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
    const dash = await this.dashboard(tenantId, { hotelId, from });
    const platforms = await this.reviews.query(
      `SELECT s.platform, s.url, s."platformRating", s."platformCount", s."lastSuccessAt", s."lastError",
              COUNT(r.id) FILTER (WHERE r.status <> 'deleted')::int AS total,
              COUNT(r.id) FILTER (WHERE r."publishedAt" > now() - interval '90 days' AND r.status <> 'deleted')::int AS n90,
              ROUND(AVG(r."rating10") FILTER (WHERE r."publishedAt" > now() - interval '90 days' AND r.status <> 'deleted'), 2) AS avg90,
              COUNT(r.id) FILTER (WHERE NOT r."hasReply" AND r.platform <> 'check24' AND ${reviewHasTextSql('r')} AND r."rating10" < $3 AND r."publishedAt" > now() - interval '30 days' AND r.status <> 'deleted')::int AS open_neg
         FROM hotel_review_sources s LEFT JOIN hotel_reviews r ON r."sourceId" = s.id
        WHERE s."tenantId" = $1 AND s."hotelId" = $2
        GROUP BY s.id ORDER BY total DESC`,
      [tenantId, hotelId, nb],
    );
    return {
      negBelow: nb,
      kpis: dash.kpis,
      series: dash.series,
      complaints: dash.complaints.slice(0, 5),
      praises: dash.praises.slice(0, 5),
      platforms: platforms.map((p: any) => ({
        platform: p.platform, url: p.url, platformRating: round(p.platformRating), platformCount: p.platformCount, lastSuccessAt: p.lastSuccessAt,
        failing: !!p.lastError, total: p.total, n90: p.n90, avg90: round(p.avg90), unansweredNegative: p.open_neg,
      })),
    };
  }

  /**
   * Страны гостей: страна профиля (Booking), иначе — по языку отзыва. Для «кто больше жалуется»:
   * средняя, доля негатива и число негативных отзывов.
   */
  private async countries(tenantId: string, q: AnalyticsQuery, from: Date, to: Date, negBelow: number) {
    const p: any[] = [];
    const w = this.scope(tenantId, q, p);
    p.push(from, to, negBelow);
    const rows = await this.reviews.query(
      `SELECT r."authorCountry" AS c, LOWER(SPLIT_PART(COALESCE(r.lang, ''), '-', 1)) AS l, COUNT(*)::int AS n,
              SUM(r."rating10") AS s, COUNT(r."rating10")::int AS rated,
              COUNT(*) FILTER (WHERE r."rating10" < $${p.length})::int AS neg
         FROM hotel_reviews r
        WHERE ${w} AND r."publishedAt" >= $${p.length - 2} AND r."publishedAt" < $${p.length - 1}
        GROUP BY 1, 2`,
      p,
    );
    const acc = new Map<string, { code: string; byLang: number; total: number; sum: number; rated: number; neg: number }>();
    let unknown = 0;
    for (const r of rows) {
      const c = countryOf(r.c, r.l);
      if (!c) {
        unknown += r.n;
        continue;
      }
      const a = acc.get(c.code) || { code: c.code, byLang: 0, total: 0, sum: 0, rated: 0, neg: 0 };
      a.total += r.n;
      a.sum += Number(r.s || 0);
      a.rated += r.rated;
      a.neg += r.neg;
      if (c.byLang) a.byLang += r.n;
      acc.set(c.code, a);
    }
    return {
      unknown,
      items: [...acc.values()]
        .map((a) => ({
          code: a.code,
          /** Доля отзывов, где страна определена по языку, а не по профилю. */
          byLangShare: a.total ? round(a.byLang / a.total, 2) : null,
          count: a.total,
          avg10: a.rated ? round(a.sum / a.rated) : null,
          negative: a.neg,
          negativeShare: a.rated ? round((a.neg / a.rated) * 100, 1) : null,
        }))
        .sort((x, y) => y.count - x.count),
    };
  }

  /**
   * Сравнение на одном графике: каждый выбранный отель (dim=hotel) или площадка (dim=platform) — своя линия.
   * Шаг тот же, что у общего ряда, пустые шаги — null (линия рвётся, а не падает в 0).
   */
  async compare(tenantId: string, qIn: AnalyticsQuery, dim: 'hotel' | 'platform') {
    const q = await this.resolveAll(tenantId, qIn);
    const { from, to } = this.period(q);
    const gran = this.granularity(from, to);
    const p: any[] = [];
    const w = this.scope(tenantId, q, p);
    p.push(from, to, gran);
    const col = dim === 'hotel' ? 'r."hotelId"::text' : 'r.platform';
    const rows = await this.reviews.query(
      `SELECT ${col} AS key, to_char(date_trunc($${p.length}, r."publishedAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS bucket,
              COUNT(*)::int AS count, AVG(r."rating10") AS avg
         FROM hotel_reviews r
        WHERE ${w} AND r."publishedAt" >= $${p.length - 2} AND r."publishedAt" < $${p.length - 1}
        GROUP BY 1, 2`,
      p,
    );
    const keys = dim === 'hotel' ? listParam(q.hotelId, 'uuid') : listParam(q.platform, 'platform');
    const hotels = dim === 'hotel' ? await this.hotels.find({ where: { tenantId } }) : [];
    const start = new Date(from);
    start.setUTCHours(0, 0, 0, 0);
    if (gran === 'week') start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    if (gran === 'month') start.setUTCDate(1);
    const buckets: string[] = [];
    for (let d = new Date(start); d < to && buckets.length < 400; ) {
      buckets.push(d.toISOString().slice(0, 10));
      if (gran === 'day') d.setUTCDate(d.getUTCDate() + 1);
      else if (gran === 'week') d.setUTCDate(d.getUTCDate() + 7);
      else d.setUTCMonth(d.getUTCMonth() + 1);
    }
    const keyList: string[] = keys.length ? keys : [...new Set<string>(rows.map((r: any) => String(r.key)))];
    const items = keyList.map((key) => {
      const mine = rows.filter((r: any) => r.key === key);
      const total = mine.reduce((a: number, r: any) => a + r.count, 0);
      const sum = mine.reduce((a: number, r: any) => a + (r.avg != null ? Number(r.avg) * r.count : 0), 0);
      const rated = mine.reduce((a: number, r: any) => a + (r.avg != null ? r.count : 0), 0);
      return {
        key,
        label: dim === 'hotel' ? hotels.find((h) => h.id === key)?.name || '—' : key,
        count: total,
        avg10: rated ? round(sum / rated) : null,
        points: buckets.map((b) => {
          const r = mine.find((x: any) => x.bucket === b);
          return { bucket: b, count: r?.count ?? 0, avg10: r ? round(r.avg) : null };
        }),
      };
    });
    return { dim, granularity: gran, items };
  }

  /** Сравнение отелей бренда по темам: доля негативных упоминаний темы среди отзывов отеля. */
  async topicMatrix(tenantId: string, qIn: AnalyticsQuery) {
    const q = await this.resolveAll(tenantId, qIn);
    const cfg = await this.settings.config(tenantId);
    const { from, to } = this.period(q);
    const p: any[] = [];
    const w = this.scope(tenantId, q, p);
    p.push(from, to);
    const rows = await this.reviews.query(
      `WITH base AS (SELECT r.id, r."hotelId" FROM hotel_reviews r WHERE ${w} AND r."publishedAt" >= $${p.length - 1} AND r."publishedAt" < $${p.length} AND r."textOriginal" IS NOT NULL),
            tot AS (SELECT "hotelId", COUNT(*)::int AS n FROM base GROUP BY 1)
       SELECT b."hotelId", t.topic, COUNT(*) FILTER (WHERE t.sentiment = 'negative')::int AS neg,
              COUNT(*) FILTER (WHERE t.sentiment = 'positive')::int AS pos, MAX(tot.n) AS total
         FROM base b JOIN hotel_review_topics t ON t."reviewId" = b.id JOIN tot ON tot."hotelId" = b."hotelId"
        WHERE t.topic <> 'other' AND ${activeTopicSql(cfg)}
        GROUP BY b."hotelId", t.topic`,
      p,
    );
    const hotels = await this.hotels.find({ where: { tenantId } });
    const hotelIds = [...new Set(rows.map((r: any) => r.hotelId))] as string[];
    const topicTotals: Record<string, number> = {};
    for (const r of rows) topicTotals[r.topic] = (topicTotals[r.topic] || 0) + r.neg + r.pos;
    const topics = Object.entries(topicTotals).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k]) => k);
    return {
      topics: topics.map((k) => ({
        topic: k,
        label: TOPIC_LABELS_RU[k] || cfg.topicsExtra.find((x) => x.key === k)?.label || k,
        translations: cfg.topicsExtra.find((category) => category.key === k)?.translations,
      })),
      hotels: hotelIds.map((id) => ({
        hotelId: id,
        name: hotels.find((h) => h.id === id)?.name || '—',
        cells: topics.map((k) => {
          const r = rows.find((x: any) => x.hotelId === id && x.topic === k);
          const total = Number(r?.total || rows.find((x: any) => x.hotelId === id)?.total || 0);
          return { topic: k, negative: r?.neg || 0, positive: r?.pos || 0, negativePct: total ? round(((r?.neg || 0) / total) * 100, 1) : 0 };
        }),
      })),
    };
  }

  /** Ежемесячный отчёт по бренду: динамика рейтинга, топ-5 жалоб, изменения против прошлого месяца, отели с падением. */
  async monthlyReport(tenantId: string, brandId: string | null, month?: string) {
    const cfg = await this.settings.config(tenantId);
    const m = month && /^\d{4}-\d{2}$/.test(month) ? month : (() => {
      const d = new Date();
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() - 1);
      return d.toISOString().slice(0, 7);
    })();
    const from = new Date(`${m}-01T00:00:00Z`);
    const to = new Date(from);
    to.setUTCMonth(to.getUTCMonth() + 1);
    const prevFrom = new Date(from);
    prevFrom.setUTCMonth(prevFrom.getUTCMonth() - 1);
    const q: AnalyticsQuery = { brandId: brandId || undefined };
    const negBelow = cfg.thresholds.negativeBelow;
    const [cur, prev, idx, prevIdx] = await Promise.all([
      this.kpis(tenantId, q, from, to, negBelow),
      this.kpis(tenantId, q, prevFrom, from, negBelow),
      this.reputationIndex(tenantId, q, from, to),
      this.reputationIndex(tenantId, q, prevFrom, from),
    ]);
    const dash = await this.dashboard(tenantId, { ...q, from: from.toISOString().slice(0, 10), to: new Date(to.getTime() - 864e5).toISOString().slice(0, 10) });
    const brand = brandId ? await this.brands.findOne({ where: { id: brandId, tenantId } }) : null;
    const brandHotels = brandId ? await this.hotels.count({ where: { tenantId, brandId } as any }) : null;
    const hotels = dash.byHotel.map((h: any) => ({
      ...h,
      prevIndex: prevIdx.byHotel[h.hotelId] ?? null,
      indexDelta: h.reputationIndex != null && prevIdx.byHotel[h.hotelId] != null ? round(h.reputationIndex - prevIdx.byHotel[h.hotelId]!) : null,
    }));
    const facts = {
      brand: brand?.name || 'all',
      month: m,
      avg10: cur.avg10,
      prevAvg10: prev.avg10,
      reputationIndex: idx.total,
      prevReputationIndex: prevIdx.total,
      reviews: cur.count,
      prevReviews: prev.count,
      negativeShare: cur.negativeShare,
      responseRate: cur.responseRate,
      topComplaints: dash.complaints.slice(0, 5).map((c: any) => ({ topic: c.label, count: c.negative, prev: c.prevNegative })),
      droppedHotels: hotels.filter((h: any) => (h.delta ?? 0) < 0).map((h: any) => ({ hotel: h.name, avg10: h.avg10, delta: h.delta })),
    };
    return {
      month: m,
      brand: brand ? { id: brand.id, name: brand.name } : null,
      brandHotels,
      kpis: { ...cur, reputationIndex: idx.total },
      prev: { ...prev, reputationIndex: prevIdx.total },
      topComplaints: dash.complaints.slice(0, 5),
      hotels,
      droppedHotels: hotels.filter((h: any) => (h.delta ?? 0) < 0).sort((a: any, b: any) => (a.delta ?? 0) - (b.delta ?? 0)),
      series: dash.series,
      facts,
    };
  }

  async monthlyReportWithSummary(tenantId: string, brandId: string | null, month?: string) {
    const rep = await this.monthlyReport(tenantId, brandId, month);
    const cfg = await this.settings.config(tenantId);
    const summary = rep.kpis.count ? await this.ai.monthlySummary(tenantId, cfg.translateTo, rep.facts) : null;
    return { ...rep, summary };
  }

  /** 1-го числа: отчёт за прошлый месяц каждому бренду на почты маркетинга бренда. */
  async sendMonthlyReports() {
    const tenants = await this.settings.tenantsWithModule();
    for (const tenantId of tenants) {
      const cfg = await this.settings.config(tenantId);
      if (!cfg.monthlyReport.enabled) continue;
      const brands = await this.brands.find({ where: { tenantId } });
      for (const b of brands) {
        const emails = cfg.recipients.brands[b.id]?.emails || [];
        if (!emails.length) continue;
        try {
          const rep = await this.monthlyReportWithSummary(tenantId, b.id);
          if (!rep.kpis.count) continue;
          const html = this.reportHtml(rep, await tenantFrontend((sql, p) => this.reviews.query(sql, p), tenantId));
          for (const to of emails) await this.mail.sendMail({ to, subject: `Репутация ${b.name} · ${rep.month}`, html });
        } catch (e: any) {
          this.log.warn(`monthly reputation report ${b.id}: ${e?.message || e}`);
        }
      }
    }
  }

  private reportHtml(rep: any, frontend: string): string {
    const e = escapeMailHtml;
    const f = (v: any, d = 2) => (v == null ? '—' : Number(v).toFixed(d));
    const sign = (v: any) => (v == null ? '' : v > 0 ? `+${f(v)}` : f(v));
    return `<div style="font-family:Inter,Arial,sans-serif;max-width:640px;color:#222">
<h2 style="margin:0 0 4px;font-size:20px">${e(rep.brand?.name || '')} · ${e(rep.month)}</h2>
<p style="margin:0 0 16px;color:#888;font-size:13px">Ежемесячный отчёт по репутации</p>
${rep.summary ? `<p style="font-size:14px;line-height:1.55;background:#fafafa;padding:12px 14px;border-radius:10px">${e(rep.summary)}</p>` : ''}
<table style="width:100%;border-collapse:collapse;font-size:13px;margin:12px 0">
<tr><td style="padding:6px 0;color:#888">Средняя оценка</td><td style="text-align:right"><b>${f(rep.kpis.avg10)}</b> / 10 (было ${f(rep.prev.avg10)})</td></tr>
<tr><td style="padding:6px 0;color:#888">Индекс репутации</td><td style="text-align:right"><b>${f(rep.kpis.reputationIndex)}</b> / 100 (было ${f(rep.prev.reputationIndex)} / 100)</td></tr>
<tr><td style="padding:6px 0;color:#888">Отзывов</td><td style="text-align:right"><b>${rep.kpis.count}</b> (было ${rep.prev.count})</td></tr>
<tr><td style="padding:6px 0;color:#888">Доля негатива</td><td style="text-align:right"><b>${f(rep.kpis.negativeShare, 1)}%</b></td></tr>
<tr><td style="padding:6px 0;color:#888">Доля ответов</td><td style="text-align:right"><b>${f(rep.kpis.responseRate, 1)}%</b></td></tr>
</table>
<h3 style="font-size:15px;margin:18px 0 8px">Топ-5 жалоб</h3>
<ol style="font-size:13px;padding-left:18px;margin:0">${rep.topComplaints.map((c: any) => `<li>${e(c.label)} — ${c.negative} (было ${c.prevNegative})</li>`).join('') || '<li>нет</li>'}</ol>
<h3 style="font-size:15px;margin:18px 0 8px">Отели</h3>
<table style="width:100%;border-collapse:collapse;font-size:13px">${rep.hotels
      .map(
        (h: any) =>
          `<tr><td style="padding:5px 0;border-bottom:1px solid #f0f0f0">${e(h.name)}</td><td style="text-align:right;border-bottom:1px solid #f0f0f0">${f(h.avg10)} <span style="color:${(h.delta ?? 0) < 0 ? '#cc2f47' : '#2f8a4f'}">${sign(h.delta)}</span></td><td style="text-align:right;border-bottom:1px solid #f0f0f0;color:#888">${h.count} отз.</td></tr>`,
      )
      .join('')}</table>
<p style="margin:20px 0 0"><a href="${frontend}/hotels/reviews/dashboard" style="display:inline-block;padding:11px 22px;background:#222;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px">Открыть дашборд</a></p></div>`;
  }
}
