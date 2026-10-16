import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Hotel } from '../hotels/hotel.entity';
import { HotelCompetitor, HotelCompetitorReview, HotelCompetitorSource, HotelReviewSyncRun } from './reputation.entities';
import { APIFY_PLATFORMS, ReputationConfig, ReputationPlatform, activeTopicKeys, activeTopicSql, historyFloor, listParam, reviewHasTextSql, toRating10 } from './reputation.constants';
import { NormalizedReview } from './reputation-normalize.util';
import { ReputationSettingsService } from './reputation-settings.service';
import { ReputationAiService } from './reputation-ai.service';

const DAY = 864e5;
const round = (v: any, d = 2) => (v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 10 ** d) / 10 ** d);
/** Сколько отзывов конкурентов разбирать ИИ за один тик (раз в 5 минут) и параллельно. */
const AI_PER_TICK = 60;
const AI_PARALLEL = 6;
/** Площадки, которые можно собирать для конкурентов: те же скрейперы Apify (Google — через Apify, не API). */
export const COMPETITOR_PLATFORMS: ReputationPlatform[] = ['google', ...APIFY_PLATFORMS.filter((p) => p !== 'google')] as ReputationPlatform[];

export interface CompetitorAnalyticsQuery {
  brandId?: string;
  hotelId?: string;
  platform?: string;
  from?: string;
  to?: string;
  all?: string;
  compare?: string;
}

/**
 * Конкуренты отеля: их отзывы с тех же площадок — только для сравнения «мы против них»
 * (средняя, доля негатива, динамика, темы, где проигрываем и где выигрываем). Конкуренты не попадают
 * в ленту, алерты, задачи ИИ-менеджера и собственную аналитику. Сбор оплачивается клиентом (Apify),
 * поэтому: ничего не собирается, пока конкурент не добавлен; редкое расписание; ограниченная первая загрузка.
 */
@Injectable()
export class ReputationCompetitorsService {
  private readonly log = new Logger(ReputationCompetitorsService.name);

  constructor(
    @InjectRepository(HotelCompetitor) private readonly competitors: Repository<HotelCompetitor>,
    @InjectRepository(HotelCompetitorSource) private readonly sources: Repository<HotelCompetitorSource>,
    @InjectRepository(HotelCompetitorReview) private readonly reviews: Repository<HotelCompetitorReview>,
    @InjectRepository(HotelReviewSyncRun) private readonly runs: Repository<HotelReviewSyncRun>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    private readonly settings: ReputationSettingsService,
    private readonly ai: ReputationAiService,
  ) {}

  // ---------------------------------------------------------------- управление

  async list(tenantId: string, hotelId?: string) {
    const comps = await this.competitors.find({ where: { tenantId, ...(hotelId ? { hotelId } : {}) }, order: { createdAt: 'ASC' } });
    if (!comps.length) return [];
    const ids = comps.map((c) => c.id);
    const srcs = await this.sources.find({ where: { competitorId: In(ids) } });
    const stats: Array<{ competitorId: string; platform: string; n: number; avg: string | null; last: Date | null; pending: number }> = await this.reviews.query(
      `SELECT "competitorId", platform, COUNT(*)::int AS n, AVG(rating10) AS avg, MAX("publishedAt") AS last,
              COUNT(*) FILTER (WHERE "analyzedAt" IS NULL AND "textOriginal" IS NOT NULL)::int AS pending
         FROM hotel_competitor_reviews WHERE "tenantId" = $1 AND "competitorId" = ANY($2) GROUP BY 1, 2`,
      [tenantId, ids],
    );
    const running = await this.runs.find({ where: { tenantId, trigger: 'competitor', status: 'running' } });
    return comps.map((c) => ({
      id: c.id,
      hotelId: c.hotelId,
      name: c.name,
      active: c.active,
      createdAt: c.createdAt.toISOString(),
      sources: srcs
        .filter((s) => s.competitorId === c.id)
        .map((s) => {
          const st = stats.find((x) => x.competitorId === c.id && x.platform === s.platform);
          return {
            id: s.id,
            platform: s.platform,
            url: s.url,
            active: s.active,
            lastSyncAt: s.lastSyncAt?.toISOString() ?? null,
            lastSuccessAt: s.lastSuccessAt?.toISOString() ?? null,
            lastError: s.lastError,
            platformRating: s.platformRating != null ? Number(s.platformRating) : null,
            platformCount: s.platformCount,
            collected: st?.n ?? 0,
            avg10: round(st?.avg),
            lastReviewAt: st?.last ? new Date(st.last).toISOString() : null,
            aiPending: st?.pending ?? 0,
            running: running.some((r) => r.sourceId === s.id),
          };
        }),
    }));
  }

  private cleanUrl(platform: string, url: unknown): string {
    const u = String(url || '').trim();
    if (!u) return '';
    let parsed: URL;
    try {
      parsed = new URL(u);
    } catch {
      throw new BadRequestException(`Invalid ${platform} URL`);
    }
    if (!/^https?:$/.test(parsed.protocol)) throw new BadRequestException(`Invalid ${platform} URL`);
    return u.slice(0, 2000);
  }

  private async ownHotel(tenantId: string, hotelId: string) {
    const h = await this.hotels.findOne({ where: { id: hotelId, tenantId } });
    if (!h) throw new NotFoundException('Hotel not found');
    return h;
  }

  /** Новый конкурент: название + ссылки на площадках (хотя бы одна). Сбор начнётся по расписанию планировщика. */
  async create(tenantId: string, body: { hotelId?: string; name?: string; sources?: Array<{ platform?: string; url?: string }> }) {
    await this.ownHotel(tenantId, String(body?.hotelId || ''));
    const name = String(body?.name || '').trim().slice(0, 160);
    if (!name) throw new BadRequestException('Competitor name is required');
    const srcs = this.parseSources(body?.sources);
    if (!srcs.length) throw new BadRequestException('Add at least one platform link');
    const existing = await this.competitors.count({ where: { tenantId, hotelId: body.hotelId! } });
    if (existing >= 10) throw new BadRequestException('Up to 10 competitors per hotel');
    const c = await this.competitors.save(this.competitors.create({ tenantId, hotelId: body.hotelId!, name, active: true }));
    for (const s of srcs) await this.sources.insert({ tenantId, competitorId: c.id, platform: s.platform, url: s.url, active: true } as any);
    return (await this.list(tenantId, c.hotelId)).find((x) => x.id === c.id);
  }

  private parseSources(raw: unknown): Array<{ platform: ReputationPlatform; url: string }> {
    const out: Array<{ platform: ReputationPlatform; url: string }> = [];
    for (const s of Array.isArray(raw) ? raw : []) {
      const platform = String((s as any)?.platform || '') as ReputationPlatform;
      if (!COMPETITOR_PLATFORMS.includes(platform)) continue;
      const url = this.cleanUrl(platform, (s as any)?.url);
      if (url && !out.some((x) => x.platform === platform)) out.push({ platform, url });
    }
    return out;
  }

  /**
   * Правка: название, пауза, ссылки. Пустая ссылка — площадка убирается (вместе с собранными с неё отзывами).
   * Сменилась ссылка — старые отзывы с этой площадки удаляются: это уже другой объект.
   */
  async update(tenantId: string, id: string, body: { name?: string; active?: boolean; sources?: Array<{ platform?: string; url?: string }> }) {
    const c = await this.competitors.findOne({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Competitor not found');
    if (body?.name !== undefined) {
      const name = String(body.name || '').trim().slice(0, 160);
      if (!name) throw new BadRequestException('Competitor name is required');
      c.name = name;
    }
    if (body?.active !== undefined) c.active = !!body.active;
    await this.competitors.save(c);
    if (Array.isArray(body?.sources)) {
      const current = await this.sources.find({ where: { competitorId: c.id } });
      for (const raw of body.sources) {
        const platform = String(raw?.platform || '') as ReputationPlatform;
        if (!COMPETITOR_PLATFORMS.includes(platform)) continue;
        const url = this.cleanUrl(platform, raw?.url);
        const cur = current.find((s) => s.platform === platform);
        if (!url) {
          if (cur) await this.sources.delete({ id: cur.id });
          continue;
        }
        if (!cur) await this.sources.insert({ tenantId, competitorId: c.id, platform, url, active: true } as any);
        else if (cur.url !== url) {
          await this.reviews.delete({ sourceId: cur.id });
          await this.sources.update({ id: cur.id }, { url, lastSyncAt: null, lastSuccessAt: null, lastError: null, platformRating: null, platformCount: null });
        }
      }
      if (!(await this.sources.count({ where: { competitorId: c.id } }))) throw new BadRequestException('Add at least one platform link');
    }
    return (await this.list(tenantId, c.hotelId)).find((x) => x.id === c.id);
  }

  async remove(tenantId: string, id: string) {
    const c = await this.competitors.findOne({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Competitor not found');
    await this.competitors.delete({ id: c.id }); // площадки и отзывы — каскадом
    return { ok: true };
  }

  // ---------------------------------------------------------------- сбор (запуск и опрос Apify — в ReputationSyncService)

  async competitorOf(id: string) {
    return this.competitors.findOne({ where: { id } });
  }

  async source(id: string) {
    return this.sources.findOne({ where: { id } });
  }

  async sourceForTenant(tenantId: string, id: string) {
    const s = await this.sources.findOne({ where: { id, tenantId } });
    if (!s) throw new NotFoundException('Source not found');
    return s;
  }

  /** Площадки конкурентов, которым пора собираться (не чаще раза в everyDays). Первыми — ни разу не собранные. */
  async dueSources(tenantId: string, cfg: ReputationConfig) {
    const rows = await this.sources
      .createQueryBuilder('s')
      .innerJoin(HotelCompetitor, 'c', 'c.id = s.competitorId AND c.active = true')
      .where('s.tenantId = :tenantId AND s.active = true', { tenantId })
      .andWhere('(s.lastSyncAt IS NULL OR s.lastSyncAt < :due)', { due: new Date(Date.now() - cfg.competitors.everyDays * DAY + 60_000) })
      .orderBy('s.lastSyncAt', 'ASC', 'NULLS FIRST')
      .getMany();
    return rows;
  }

  /**
   * Что запросить у скрейпера: первая загрузка — история за historyMonths (но не раньше «Отзывы с»),
   * не больше firstLoadMax; дальше — только новое (от последнего отзыва минус нахлёст) и «поток × 2 + запас».
   */
  async plan(source: HotelCompetitorSource, cfg: ReputationConfig): Promise<{ max: number; since: string; first: boolean }> {
    const latest = await this.reviews.findOne({ where: { sourceId: source.id }, order: { publishedAt: 'DESC' } });
    const floor = Math.max(historyFloor(cfg), Date.now() - cfg.competitors.historyMonths * 30 * DAY);
    if (!latest?.publishedAt) return { max: cfg.competitors.firstLoadMax, since: new Date(floor).toISOString().slice(0, 10), first: true };
    const overlap = source.platform === 'google' ? 1 : 3;
    const since = Math.max(floor, latest.publishedAt.getTime() - overlap * DAY);
    const cap = cfg.competitors.maxPerRun;
    const last = await this.runs.find({ where: { sourceId: source.id, status: 'ok', trigger: 'competitor' }, order: { startedAt: 'DESC' }, take: 6 });
    const regular = last.filter((r) => r.newCount <= cap);
    let max = cap;
    if (regular.length >= 2 && !(regular[0].newCount > 0 && regular[0].newCount >= regular[0].fetched)) {
      const avgNew = regular.reduce((a, r) => a + r.newCount, 0) / regular.length;
      max = Math.max(3, Math.min(cap, Math.ceil(avgNew * 2) + 3));
    }
    return { max, since: new Date(since).toISOString().slice(0, 10), first: false };
  }

  async markSynced(sourceId: string, patch: Partial<HotelCompetitorSource>) {
    await this.sources.update({ id: sourceId }, patch as any);
  }

  /** Запись собранного: новые отзывы — вставка, изменённые (текст/оценка) — обновление и повторный разбор тем. */
  async ingest(source: HotelCompetitorSource, items: NormalizedReview[], cfg: ReputationConfig, stats: { rating: number | null; count: number | null }) {
    const floor = Math.max(historyFloor(cfg), Date.now() - cfg.competitors.historyMonths * 30 * DAY);
    const uniq = new Map<string, NormalizedReview>();
    for (const it of items) {
      if (!it.externalReviewId) continue;
      if (it.publishedAt && it.publishedAt.getTime() < floor) continue;
      uniq.set(it.externalReviewId, it);
    }
    const ids = [...uniq.keys()];
    const existing = new Map<string, HotelCompetitorReview>();
    for (let i = 0; i < ids.length; i += 500) {
      for (const r of await this.reviews.find({ where: { sourceId: source.id, externalReviewId: In(ids.slice(i, i + 500)) } })) existing.set(r.externalReviewId, r);
    }
    let created = 0;
    let updated = 0;
    for (const it of uniq.values()) {
      const r10 = toRating10(it.ratingRaw, it.ratingScale);
      const ex = existing.get(it.externalReviewId);
      if (!ex) {
        await this.reviews.insert({
          tenantId: source.tenantId,
          competitorId: source.competitorId,
          sourceId: source.id,
          platform: source.platform,
          externalReviewId: it.externalReviewId,
          author: it.author?.slice(0, 255) ?? null,
          lang: it.lang?.slice(0, 8) ?? null,
          title: it.title,
          textOriginal: it.textOriginal,
          ratingRaw: it.ratingRaw != null ? String(it.ratingRaw) : null,
          ratingScale: it.ratingScale,
          rating10: r10 != null ? String(r10) : null,
          publishedAt: it.publishedAt || new Date(),
          authorCountry: it.authorCountry ?? null,
          topics: [],
        } as any);
        created++;
        continue;
      }
      const textChanged = (ex.textOriginal || '') !== (it.textOriginal || '') && !!it.textOriginal;
      const ratingChanged = r10 != null && (ex.rating10 == null || Number(ex.rating10) !== r10);
      if (textChanged || ratingChanged) {
        await this.reviews.update(
          { id: ex.id },
          {
            textOriginal: it.textOriginal ?? ex.textOriginal,
            title: it.title ?? ex.title,
            rating10: r10 != null ? String(r10) : ex.rating10,
            ratingRaw: it.ratingRaw != null ? String(it.ratingRaw) : ex.ratingRaw,
            ...(textChanged ? { analyzedAt: null, topics: [] as any } : {}),
          },
        );
        updated++;
      }
    }
    const now = new Date();
    await this.sources.update(
      { id: source.id },
      {
        lastSyncAt: now,
        lastSuccessAt: now,
        lastError: null,
        ...(stats.rating != null ? { platformRating: String(stats.rating) } : {}),
        ...(stats.count != null ? { platformCount: stats.count } : {}),
      },
    );
    return { fetched: items.length, created, updated };
  }

  /**
   * ИИ-разбор тем у отзывов конкурентов: только с текстом, только в окне истории, не больше AI_PER_TICK за тик.
   * Ошибка кредитов/ключа — стоп до следующего тика (как у своих отзывов). Выключено в настройках — не тратим токены.
   */
  async analyzeBacklog() {
    const tenants: Array<{ tenantId: string }> = await this.reviews.query(
      `SELECT DISTINCT "tenantId" FROM hotel_competitor_reviews WHERE "analyzedAt" IS NULL AND "textOriginal" IS NOT NULL`,
    );
    for (const { tenantId } of tenants) {
      const cfg = await this.settings.config(tenantId);
      if (!cfg.competitors.ai) continue;
      const floor = Math.max(historyFloor(cfg), Date.now() - cfg.competitors.historyMonths * 30 * DAY);
      const rows = await this.reviews
        .createQueryBuilder('r')
        .where('r.tenantId = :tenantId AND r.analyzedAt IS NULL AND r.textOriginal IS NOT NULL', { tenantId })
        .andWhere('r.publishedAt >= :floor', { floor: new Date(floor) })
        .andWhere(`(r.analysisError IS NULL OR r.analysisError NOT LIKE 'retry-after:%' OR r.analysisError < :retry)`, { retry: `retry-after:${new Date().toISOString()}` })
        .orderBy('r.publishedAt', 'DESC')
        .take(AI_PER_TICK)
        .getMany();
      let blocked = false;
      for (let i = 0; i < rows.length && !blocked; i += AI_PARALLEL) {
        const res = await Promise.all(rows.slice(i, i + AI_PARALLEL).map((r) => this.analyzeOne(r, cfg)));
        if (res.some((x) => x === 'blocked')) blocked = true;
      }
    }
  }

  private async analyzeOne(r: HotelCompetitorReview, cfg: ReputationConfig): Promise<'ok' | 'error' | 'blocked'> {
    const r10 = r.rating10 != null ? Number(r.rating10) : null;
    const byRating = r10 == null ? null : r10 < cfg.thresholds.negativeBelow ? 'negative' : r10 >= 8 ? 'positive' : 'neutral';
    const text = [r.title, r.textOriginal].filter(Boolean).join('\n').trim();
    try {
      const c = await this.ai.classify(r.tenantId, cfg, { platform: r.platform, ratingRaw: r.ratingRaw, ratingScale: r.ratingScale, r10, text, fallback: byRating as any });
      await this.reviews.update({ id: r.id }, { topics: c.topics as any, sentiment: c.sentiment, lang: r.lang || c.lang, analyzedAt: new Date(), analysisError: null });
      return 'ok';
    } catch (e: any) {
      const msg = String(e?.message || e);
      const credit = /credit|quota|billing|insufficient|api key|401|403|429/i.test(msg);
      // повтор не раньше чем через 30 минут (метка в analysisError — без отдельной колонки)
      await this.reviews.update({ id: r.id }, { analysisError: `retry-after:${new Date(Date.now() + 30 * 60_000).toISOString()} ${msg.slice(0, 200)}` });
      return credit ? 'blocked' : 'error';
    }
  }

  // ---------------------------------------------------------------- сравнение

  private period(q: CompetitorAnalyticsQuery) {
    const to = q.to ? new Date(new Date(q.to).getTime() + DAY) : new Date();
    const from = q.from ? new Date(q.from) : new Date(to.getTime() - 90 * DAY);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) throw new BadRequestException('Bad period');
    let prevFrom: Date;
    let prevTo: Date;
    if (q.compare === 'yoy') {
      prevFrom = new Date(from);
      prevFrom.setUTCFullYear(prevFrom.getUTCFullYear() - 1);
      prevTo = new Date(to);
      prevTo.setUTCFullYear(prevTo.getUTCFullYear() - 1);
    } else {
      prevTo = from;
      prevFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));
    }
    const days = (to.getTime() - from.getTime()) / DAY;
    // у конкурентов отзывов меньше, чем у нас (собираем редко) — шаг крупнее: недели до ~1,5 мес, дальше месяцы
    const gran: 'week' | 'month' = days <= 45 ? 'week' : 'month';
    return { from, to, prevFrom, prevTo, gran };
  }

  /**
   * «Мы против конкурентов» по каждому отелю в срезе, у которого есть конкуренты. Сравнение честное:
   * наши отзывы берутся только с тех площадок, где собираются конкуренты этого отеля (и выбранных в фильтре).
   */
  async compare(tenantId: string, q: CompetitorAnalyticsQuery) {
    const cfg = await this.settings.config(tenantId);
    let { from } = this.period(q);
    if (q.all === '1' || q.all === 'true') from = new Date(Math.max(historyFloor(cfg), Date.now() - cfg.competitors.historyMonths * 30 * DAY));
    const { to, prevFrom, prevTo, gran } = this.period({ ...q, from: from.toISOString().slice(0, 10) });
    const brands = listParam(q.brandId, 'uuid');
    const hotelsSel = listParam(q.hotelId, 'uuid');
    const platformsSel = listParam(q.platform, 'platform');
    const comps = await this.competitors.find({ where: { tenantId, active: true } });
    if (!comps.length) return { hotels: [], granularity: gran, period: { from: from.toISOString(), to: to.toISOString() } };
    let hotelIds = [...new Set(comps.map((c) => c.hotelId))];
    if (hotelsSel.length) hotelIds = hotelIds.filter((id) => hotelsSel.includes(id));
    const hotels = hotelIds.length ? await this.hotels.find({ where: { tenantId, id: In(hotelIds) } }) : [];
    const inBrand = brands.length ? hotels.filter((h: any) => h.brandId && brands.includes(h.brandId)) : hotels;
    const srcs = await this.sources.find({ where: { tenantId, competitorId: In(comps.map((c) => c.id)), active: true } });
    const negBelow = cfg.thresholds.negativeBelow;
    const active = new Set(activeTopicKeys(cfg));
    const out: any[] = [];
    for (const h of inBrand) {
      const mine = comps.filter((c) => c.hotelId === h.id);
      let platforms = [...new Set(srcs.filter((s) => mine.some((c) => c.id === s.competitorId)).map((s) => s.platform))];
      if (platformsSel.length) platforms = platforms.filter((p) => platformsSel.includes(p));
      if (!platforms.length) continue;
      const compIds = mine.map((c) => c.id);
      // наши: отзывы отеля на тех же площадках (без подтверждённых дубликатов)
      const [ours] = await this.reviews.query(
        `SELECT COUNT(*) FILTER (WHERE r."publishedAt" >= $3 AND r."publishedAt" < $4)::int AS n,
                AVG(r.rating10) FILTER (WHERE r."publishedAt" >= $3 AND r."publishedAt" < $4) AS avg,
                COUNT(r.rating10) FILTER (WHERE r."publishedAt" >= $3 AND r."publishedAt" < $4)::int AS rated,
                COUNT(*) FILTER (WHERE r."publishedAt" >= $3 AND r."publishedAt" < $4 AND r.rating10 < $7)::int AS neg,
                AVG(r.rating10) FILTER (WHERE r."publishedAt" >= $5 AND r."publishedAt" < $6) AS prev_avg,
                COUNT(*) FILTER (WHERE r."publishedAt" >= $5 AND r."publishedAt" < $6)::int AS prev_n
           FROM hotel_reviews r
          WHERE r."tenantId" = $1 AND r."hotelId" = $2 AND r.status <> 'deleted' AND r."duplicateOfId" IS NULL AND r.platform = ANY($8)`,
        [tenantId, h.id, from, to, prevFrom, prevTo, negBelow, platforms],
      );
      const theirs: any[] = await this.reviews.query(
        `SELECT r."competitorId", COUNT(*) FILTER (WHERE r."publishedAt" >= $3 AND r."publishedAt" < $4)::int AS n,
                AVG(r.rating10) FILTER (WHERE r."publishedAt" >= $3 AND r."publishedAt" < $4) AS avg,
                COUNT(r.rating10) FILTER (WHERE r."publishedAt" >= $3 AND r."publishedAt" < $4)::int AS rated,
                COUNT(*) FILTER (WHERE r."publishedAt" >= $3 AND r."publishedAt" < $4 AND r.rating10 < $7)::int AS neg,
                AVG(r.rating10) FILTER (WHERE r."publishedAt" >= $5 AND r."publishedAt" < $6) AS prev_avg,
                COUNT(*) FILTER (WHERE r."publishedAt" >= $5 AND r."publishedAt" < $6)::int AS prev_n
           FROM hotel_competitor_reviews r
          WHERE r."tenantId" = $1 AND r."competitorId" = ANY($2) AND r.platform = ANY($8)
          GROUP BY r."competitorId"`,
        [tenantId, compIds, from, to, prevFrom, prevTo, negBelow, platforms],
      );
      // динамика: средняя по шагам периода (неделя / месяц)
      const seriesOurs: any[] = await this.reviews.query(
        `SELECT to_char(date_trunc($5, r."publishedAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS b, COUNT(*)::int AS n, AVG(r.rating10) AS avg
           FROM hotel_reviews r WHERE r."tenantId" = $1 AND r."hotelId" = $2 AND r.status <> 'deleted' AND r."duplicateOfId" IS NULL
            AND r.platform = ANY($6) AND r."publishedAt" >= $3 AND r."publishedAt" < $4 GROUP BY 1`,
        [tenantId, h.id, from, to, gran, platforms],
      );
      const seriesTheirs: any[] = await this.reviews.query(
        `SELECT r."competitorId" AS c, to_char(date_trunc($5, r."publishedAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS b, COUNT(*)::int AS n, AVG(r.rating10) AS avg
           FROM hotel_competitor_reviews r WHERE r."tenantId" = $1 AND r."competitorId" = ANY($2)
            AND r.platform = ANY($6) AND r."publishedAt" >= $3 AND r."publishedAt" < $4 GROUP BY 1, 2`,
        [tenantId, compIds, from, to, gran, platforms],
      );
      const buckets: string[] = [];
      const start = new Date(from);
      start.setUTCHours(0, 0, 0, 0);
      if (gran === 'week') start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
      if (gran === 'month') start.setUTCDate(1);
      for (let d = new Date(start); d < to && buckets.length < 120; ) {
        buckets.push(d.toISOString().slice(0, 10));
        if (gran === 'week') d.setUTCDate(d.getUTCDate() + 7);
        else d.setUTCMonth(d.getUTCMonth() + 1);
      }
      const pts = (rows: any[]) => buckets.map((b) => {
        const r = rows.find((x) => x.b === b);
        return { bucket: b, count: r?.n ?? 0, avg10: r ? round(r.avg) : null };
      });

      // темы: доля отзывов с текстом, где тема упомянута негативно / позитивно — у нас и у конкурентов вместе
      const ourTopics: any[] = await this.reviews.query(
        `SELECT t.topic, COUNT(DISTINCT t."reviewId") FILTER (WHERE t.sentiment = 'negative')::int AS neg,
                COUNT(DISTINCT t."reviewId") FILTER (WHERE t.sentiment = 'positive')::int AS pos
           FROM hotel_review_topics t JOIN hotel_reviews r ON r.id = t."reviewId"
          WHERE r."tenantId" = $1 AND r."hotelId" = $2 AND r.status <> 'deleted' AND r."duplicateOfId" IS NULL AND r.platform = ANY($5)
            AND r."publishedAt" >= $3 AND r."publishedAt" < $4 AND t.topic <> 'other' AND ${activeTopicSql(cfg)}
          GROUP BY t.topic`,
        [tenantId, h.id, from, to, platforms],
      );
      const [ourBase] = await this.reviews.query(
        `SELECT COUNT(*)::int AS n FROM hotel_reviews r
          WHERE r."tenantId" = $1 AND r."hotelId" = $2 AND r.status <> 'deleted' AND r."duplicateOfId" IS NULL AND r.platform = ANY($5)
            AND r."publishedAt" >= $3 AND r."publishedAt" < $4 AND r."analyzedAt" IS NOT NULL AND ${reviewHasTextSql('r')}`,
        [tenantId, h.id, from, to, platforms],
      );
      const theirTopics: any[] = await this.reviews.query(
        `SELECT x->>'topic' AS topic, COUNT(*) FILTER (WHERE x->>'sentiment' = 'negative')::int AS neg,
                COUNT(*) FILTER (WHERE x->>'sentiment' = 'positive')::int AS pos
           FROM hotel_competitor_reviews r, jsonb_array_elements(r.topics) x
          WHERE r."tenantId" = $1 AND r."competitorId" = ANY($2) AND r.platform = ANY($5)
            AND r."publishedAt" >= $3 AND r."publishedAt" < $4 AND r."analyzedAt" IS NOT NULL
          GROUP BY 1`,
        [tenantId, compIds, from, to, platforms],
      );
      const [theirBase] = await this.reviews.query(
        `SELECT COUNT(*)::int AS n FROM hotel_competitor_reviews r
          WHERE r."tenantId" = $1 AND r."competitorId" = ANY($2) AND r.platform = ANY($5)
            AND r."publishedAt" >= $3 AND r."publishedAt" < $4 AND r."analyzedAt" IS NOT NULL AND ${reviewHasTextSql('r')}`,
        [tenantId, compIds, from, to, platforms],
      );
      // сравнивать темы имеет смысл только на выборке: меньше 15 разобранных отзывов с каждой стороны — не показываем
      const MIN_BASE = 15;
      const topicKeys = [...new Set([...ourTopics, ...theirTopics].map((t) => t.topic))].filter((k) => k && k !== 'other' && active.has(k));
      const topics = ourBase.n >= MIN_BASE && theirBase.n >= MIN_BASE
        ? topicKeys
            .map((k) => {
              const o = ourTopics.find((t) => t.topic === k);
              const t = theirTopics.find((x) => x.topic === k);
              const oNeg = ((o?.neg || 0) / ourBase.n) * 100;
              const tNeg = ((t?.neg || 0) / theirBase.n) * 100;
              const oPos = ((o?.pos || 0) / ourBase.n) * 100;
              const tPos = ((t?.pos || 0) / theirBase.n) * 100;
              return {
                topic: k,
                label: cfg.topicsExtra.find((x) => x.key === k)?.label || null,
                translations: cfg.topicsExtra.find((x) => x.key === k)?.translations,
                oursNegPct: round(oNeg, 1),
                theirsNegPct: round(tNeg, 1),
                oursPosPct: round(oPos, 1),
                theirsPosPct: round(tPos, 1),
                // > 0 — у нас на эту тему жалуются чаще / хвалят реже, чем у конкурентов
                gap: round(oNeg - tNeg + (tPos - oPos), 1),
                /** Откуда разрыв: из жалоб или из похвал — это и показываем в подписи. */
                basis: Math.abs(oNeg - tNeg) >= Math.abs(tPos - oPos) ? ('complaints' as const) : ('praise' as const),
              };
            })
            .filter((x) => (x.oursNegPct || 0) + (x.theirsNegPct || 0) + (x.oursPosPct || 0) + (x.theirsPosPct || 0) >= 2)
        : [];
      const statOf = (r: any) => ({
        count: r?.n ?? 0,
        avg10: round(r?.avg),
        negativeShare: r?.rated ? round((r.neg / r.rated) * 100, 1) : null,
        prevAvg10: round(r?.prev_avg),
        delta: r?.avg != null && r?.prev_avg != null ? round(Number(r.avg) - Number(r.prev_avg)) : null,
      });
      const compStats = mine.map((c) => {
        const row = theirs.find((x) => x.competitorId === c.id);
        const cs = srcs.filter((s) => s.competitorId === c.id && platforms.includes(s.platform));
        return {
          id: c.id,
          name: c.name,
          ...statOf(row),
          platforms: cs.map((s) => ({ platform: s.platform, rating: s.platformRating != null ? Number(s.platformRating) : null, count: s.platformCount, lastSuccessAt: s.lastSuccessAt?.toISOString() ?? null, lastError: s.lastError })),
          points: pts(seriesTheirs.filter((x) => x.c === c.id)),
        };
      });
      const rated = compStats.filter((c) => c.avg10 != null);
      const ourStat = statOf(ours);
      out.push({
        hotelId: h.id,
        name: h.name,
        platforms,
        ours: { ...ourStat, points: pts(seriesOurs) },
        competitors: compStats,
        /** Место по средней среди «мы + конкуренты» (1 — лучший), только у кого есть отзывы за период. */
        rank: ourStat.avg10 != null ? 1 + rated.filter((c) => c.avg10! > ourStat.avg10!).length : null,
        rankOf: ourStat.avg10 != null ? rated.length + 1 : null,
        topicsBase: { ours: ourBase.n, theirs: theirBase.n, min: MIN_BASE },
        losing: topics.filter((x) => (x.gap ?? 0) >= 1).sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0)).slice(0, 6),
        winning: topics.filter((x) => (x.gap ?? 0) <= -1).sort((a, b) => (a.gap ?? 0) - (b.gap ?? 0)).slice(0, 6),
      });
    }
    return { hotels: out, granularity: gran, period: { from: from.toISOString(), to: to.toISOString() } };
  }

  /** Есть ли у тенанта конкуренты (для показа раздела на дашборде и в отчёте). */
  async hasAny(tenantId: string) {
    return (await this.competitors.count({ where: { tenantId, active: true } })) > 0;
  }

  /** Источники без сбора ни разу и без ошибок — для подсказки «первый сбор в очереди». */
  async pendingFirstLoad(tenantId: string) {
    return this.sources.count({ where: { tenantId, active: true, lastSuccessAt: IsNull() } });
  }
}
