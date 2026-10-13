import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { Hotel } from '../hotels/hotel.entity';
import {
  HotelReview,
  HotelReviewReply,
  HotelReviewSource,
  HotelReviewSyncRun,
  HotelReviewVersion,
} from './reputation.entities';
import { APIFY_PLATFORMS, ReputationConfig, historyFloor, toRating10 } from './reputation.constants';
import { NormalizedReview, normalizeApifyItem, normalizeGoogleApiReview } from './reputation-normalize.util';
import { ReputationSettingsService } from './reputation-settings.service';
import { GoogleBusinessService } from './google-business.service';
import { ApifyService } from './apify.service';
import { ReputationAiService } from './reputation-ai.service';
import { ReputationAlertsService } from './reputation-alerts.service';
import { ReputationEventsService } from './reputation-events.service';

type IngestResult = { fetched: number; created: number; updated: number; createdIds: string[] };

const DAY = 864e5;
/** Негатив старше этого срока не поднимает тревогу (первая загрузка истории, запоздавший скрейпер). */
const NEGATIVE_ALERT_MAX_AGE_DAYS = 7;
const RUN_TIMEOUT_MS = 3 * 36e5;
/** Повтор ИИ-разбора после ошибки (например, ключ пополнили) — не чаще раза в 30 минут на отзыв. */
const RETRY_AI_MS = 30 * 60_000;
/** Сколько отзывов разбирать параллельно (gpt-4o-mini/Haiku легко держат такой поток). */
const AI_PARALLEL = 6;

/** Сбор отзывов со всех площадок в одну базу: нормализация, версии, ответы, удалённые, сверка. */
@Injectable()
export class ReputationSyncService {
  private readonly log = new Logger(ReputationSyncService.name);

  constructor(
    @InjectRepository(HotelReview) private readonly reviews: Repository<HotelReview>,
    @InjectRepository(HotelReviewVersion) private readonly versions: Repository<HotelReviewVersion>,
    @InjectRepository(HotelReviewReply) private readonly replies: Repository<HotelReviewReply>,
    @InjectRepository(HotelReviewSource) private readonly sources: Repository<HotelReviewSource>,
    @InjectRepository(HotelReviewSyncRun) private readonly runs: Repository<HotelReviewSyncRun>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    private readonly settings: ReputationSettingsService,
    private readonly google: GoogleBusinessService,
    private readonly apify: ApifyService,
    private readonly ai: ReputationAiService,
    private readonly alerts: ReputationAlertsService,
    private readonly events: ReputationEventsService,
  ) {}

  // ---------------------------------------------------------------- запись

  /**
   * Запись пачки отзывов одного источника. Уникальность — platform + externalReviewId (повтор не пишется).
   * Правка гостем: старое значение уходит в историю версий, статус edited; понижение оценки — алерт.
   */
  async ingest(source: HotelReviewSource, items: NormalizedReview[], cfg: ReputationConfig): Promise<IngestResult> {
    const res: IngestResult = { fetched: items.length, created: 0, updated: 0, createdIds: [] };
    const uniq = new Map<string, NormalizedReview>();
    // «Брать отзывы начиная с»: старше — не записываем (скрейперы без фильтра по дате всё равно их присылают)
    const floor = historyFloor(cfg);
    for (const it of items) {
      if (!it.externalReviewId) continue;
      if (it.publishedAt && it.publishedAt.getTime() < floor) continue;
      uniq.set(it.externalReviewId, it);
    }
    const ids = [...uniq.keys()];
    const existing = new Map<string, HotelReview>();
    for (let i = 0; i < ids.length; i += 500) {
      const rows = await this.reviews.find({
        where: { tenantId: source.tenantId, platform: source.platform, externalReviewId: In(ids.slice(i, i + 500)) },
      });
      for (const r of rows) existing.set(r.externalReviewId, r);
    }

    for (const it of uniq.values()) {
      const rating10 = toRating10(it.ratingRaw, it.ratingScale);
      const ex = existing.get(it.externalReviewId);
      if (!ex) {
        const row = await this.reviews.save(
          this.reviews.create({
            tenantId: source.tenantId,
            hotelId: source.hotelId,
            sourceId: source.id,
            platform: source.platform,
            externalReviewId: it.externalReviewId,
            author: it.author?.slice(0, 255) ?? null,
            authorPhoto: it.authorPhoto,
            lang: it.lang,
            title: it.title,
            textOriginal: it.textOriginal,
            textTranslated: null,
            ratingRaw: it.ratingRaw != null ? String(it.ratingRaw) : null,
            ratingScale: it.ratingScale,
            rating10: rating10 != null ? String(rating10) : null,
            subRatings: it.subRatings,
            travelDate: it.travelDate,
            publishedAt: it.publishedAt || new Date(),
            platformUpdatedAt: it.platformUpdatedAt,
            status: 'active',
            reviewUrl: it.reviewUrl,
            hasReply: !!it.reply,
            repliedAt: it.reply ? it.reply.at || new Date() : null,
            replyText: it.reply?.text ?? null,
            firstSeenAt: new Date(),
          }),
        );
        await this.versions.insert({ reviewId: row.id, rating10: row.rating10, ratingRaw: row.ratingRaw, text: row.textOriginal } as any);
        if (it.reply) {
          await this.replies.insert({
            tenantId: row.tenantId, reviewId: row.id, text: it.reply.text, source: 'platform', status: 'published', postedAt: it.reply.at || new Date(),
          } as any);
        }
        res.created++;
        res.createdIds.push(row.id);
        continue;
      }

      let changed = false;
      const textChanged = (ex.textOriginal || '') !== (it.textOriginal || '') && !!(it.textOriginal || ex.textOriginal);
      const ratingChanged = rating10 != null && ex.rating10 != null && Number(ex.rating10) !== rating10;
      if (textChanged || ratingChanged) {
        const oldRating = ex.rating10 != null ? Number(ex.rating10) : null;
        ex.textOriginal = it.textOriginal;
        ex.title = it.title ?? ex.title;
        ex.ratingRaw = it.ratingRaw != null ? String(it.ratingRaw) : ex.ratingRaw;
        ex.ratingScale = it.ratingScale;
        ex.rating10 = rating10 != null ? String(rating10) : ex.rating10;
        ex.status = 'edited';
        ex.platformUpdatedAt = it.platformUpdatedAt || new Date();
        ex.analyzedAt = null; // разобрать заново
        ex.aiDraft = null;
        await this.reviews.save(ex);
        await this.versions.insert({ reviewId: ex.id, rating10: ex.rating10, ratingRaw: ex.ratingRaw, text: ex.textOriginal } as any);
        if (ratingChanged && oldRating != null && rating10! < oldRating) {
          await this.alerts.ratingLowered(ex, oldRating, rating10!, cfg).catch((e) => this.log.warn(`alert rating_lowered: ${e?.message}`));
          void this.events.ratingLowered(ex, oldRating, rating10!);
        }
        changed = true;
      }
      if (ex.status === 'deleted') {
        ex.status = textChanged || ratingChanged ? 'edited' : 'active';
        ex.deletedAt = null;
        changed = true;
      }
      if (it.reply && (!ex.hasReply || (ex.replyText || '') !== it.reply.text)) {
        const wasReplied = ex.hasReply;
        ex.hasReply = true;
        ex.repliedAt = ex.repliedAt && wasReplied ? ex.repliedAt : it.reply.at || new Date();
        ex.replyText = it.reply.text;
        const dup = await this.replies.findOne({ where: { reviewId: ex.id, text: it.reply.text } });
        if (!dup) {
          await this.replies.insert({
            tenantId: ex.tenantId, reviewId: ex.id, text: it.reply.text, source: 'platform', status: 'published', postedAt: it.reply.at || new Date(),
          } as any);
          if (!wasReplied) void this.events.replied(ex, it.reply.text, 'platform');
        }
        changed = true;
      }
      for (const k of ['author', 'authorPhoto', 'reviewUrl', 'travelDate', 'lang'] as const) {
        if (!ex[k] && it[k]) {
          (ex as any)[k] = it[k];
          changed = true;
        }
      }
      if (!ex.subRatings && it.subRatings) {
        ex.subRatings = it.subRatings;
        changed = true;
      }
      if (changed) {
        await this.reviews.save(ex);
        res.updated++;
      }
    }

    const now = new Date();
    await this.sources.update(
      { id: source.id },
      { lastSyncAt: now, lastSuccessAt: now, lastError: null, ...(res.created ? { lastNewAt: now } : {}) },
    );
    await this.afterIngest(source, res.createdIds, cfg);
    return res;
  }

  /** Новые отзывы: алерт по негативу сразу (по оценке), затем ИИ-разбор тем. */
  private async afterIngest(source: HotelReviewSource, createdIds: string[], cfg: ReputationConfig) {
    if (!createdIds.length) return;
    const rows = await this.reviews.find({ where: { id: In(createdIds) } });
    const fresh = rows.filter(
      (r) => r.rating10 != null && Number(r.rating10) < cfg.thresholds.negativeBelow && r.publishedAt && Date.now() - r.publishedAt.getTime() < NEGATIVE_ALERT_MAX_AGE_DAYS * DAY,
    );
    for (const r of fresh) await this.alerts.negative(r, cfg).catch((e) => this.log.warn(`alert negative: ${e?.message}`));
    // автоматизации и ИИ-сотрудники: только по свежим отзывам (не по загрузке истории)
    for (const r of rows) await this.events.reviewCreated(r, cfg.thresholds.negativeBelow);
    // разбор — небольшими порциями здесь, остальное подберёт фоновая очередь
    for (const r of rows.slice(0, 30)) await this.ai.analyze(r, cfg);
  }

  // ---------------------------------------------------------------- журнал

  private async openRun(source: HotelReviewSource, trigger: string, actorId: string | null = null) {
    return this.runs.save(
      this.runs.create({
        tenantId: source.tenantId, platform: source.platform, hotelId: source.hotelId, sourceId: source.id, trigger, status: 'running', actorId, startedAt: new Date(),
      }),
    );
  }

  private async closeRun(run: HotelReviewSyncRun, r: Partial<IngestResult> & { error?: string | null }) {
    run.finishedAt = new Date();
    run.fetched = r.fetched ?? run.fetched;
    run.newCount = r.created ?? run.newCount;
    run.updated = r.updated ?? run.updated;
    run.errors = r.error ? run.errors + 1 : run.errors;
    run.errorText = r.error ? String(r.error).slice(0, 1000) : null;
    run.status = r.error ? 'error' : 'ok';
    await this.runs.save(run);
  }

  private async failSource(source: HotelReviewSource, run: HotelReviewSyncRun, error: string, cfg: ReputationConfig) {
    await this.sources.update({ id: source.id }, { lastSyncAt: new Date(), lastError: error.slice(0, 500) });
    await this.closeRun(run, { error });
    await this.alerts.syncError(source, error, cfg).catch(() => undefined);
  }

  // ---------------------------------------------------------------- Google API

  /**
   * Google: full — вся история (первая загрузка, по nextPageToken); reconcile — последние 30 дней
   * (ночная сверка) + пометка удалённых + сравнение счётчика с totalReviewCount.
   */
  async syncGoogle(source: HotelReviewSource, mode: 'full' | 'reconcile', trigger: string) {
    const cfg = await this.settings.config(source.tenantId);
    if (!source.externalId) throw new BadRequestException('Google location is not linked to this hotel');
    const run = await this.openRun(source, trigger, 'gbp-v4');
    try {
      const cutoff = Date.now() - 30 * DAY;
      const all: NormalizedReview[] = [];
      let pageToken: string | undefined;
      let total: number | null = null;
      let avg: number | null = null;
      let complete = true;
      for (let page = 0; page < 400; page++) {
        const d = await this.google.listReviews(source.tenantId, source.externalId, pageToken);
        total = d.totalReviewCount ?? total;
        avg = d.averageRating ?? avg;
        const batch = (d.reviews || []).map(normalizeGoogleApiReview);
        all.push(...batch);
        pageToken = d.nextPageToken;
        if (!pageToken) break;
        const lastItem = batch[batch.length - 1];
        const lastT = (lastItem?.platformUpdatedAt || lastItem?.publishedAt)?.getTime() ?? 0;
        if (lastT && lastT < historyFloor(cfg)) {
          complete = false; // дальше только отзывы старше «Брать отзывы начиная с»
          break;
        }
        if (mode === 'reconcile') {
          const last = batch[batch.length - 1];
          const t = (last?.platformUpdatedAt || last?.publishedAt)?.getTime() ?? 0;
          if (t && t < cutoff) {
            complete = false;
            break;
          }
        }
      }
      if (pageToken) complete = false;
      const res = await this.ingest(source, all, cfg);

      // удалённые площадкой: в окне выборки отзыва больше нет → deleted (из аналитики не стираем)
      const seen = new Set(all.map((r) => r.externalReviewId));
      const windowWhere: any = { sourceId: source.id, status: Not('deleted') };
      if (!complete) windowWhere.platformUpdatedAt = MoreThanOrEqual(new Date(cutoff));
      const candidates = await this.reviews.find({ where: windowWhere, select: ['id', 'externalReviewId'] as any });
      const gone = candidates.filter((r) => !seen.has(r.externalReviewId)).map((r) => r.id);
      if (gone.length && all.length) await this.reviews.update({ id: In(gone) }, { status: 'deleted', deletedAt: new Date() });

      await this.sources.update({ id: source.id }, { platformCount: total, platformRating: avg != null ? String(avg) : null });
      await this.closeRun(run, res);

      // контроль количества: расхождение больше порога → дозагрузка всей истории один раз + алерт
      if (total != null && mode === 'reconcile') {
        const inDb = await this.reviews.count({ where: { sourceId: source.id, status: Not('deleted') } });
        const drift = total ? (Math.abs(total - inDb) / total) * 100 : 0;
        if (drift > cfg.thresholds.countDriftPct) {
          if (inDb < total) await this.syncGoogle({ ...source }, 'full', 'reconcile').catch(() => undefined);
          const after = await this.reviews.count({ where: { sourceId: source.id, status: Not('deleted') } });
          const drift2 = total ? (Math.abs(total - after) / total) * 100 : 0;
          if (drift2 > cfg.thresholds.countDriftPct) await this.alerts.countDrift(source, total, after, drift2, cfg).catch(() => undefined);
        }
      }
      return { ...res, total };
    } catch (e: any) {
      const msg = e?.getResponse?.()?.message || e?.message || String(e);
      await this.failSource(source, run, msg, cfg);
      throw e;
    }
  }

  /** Push NEW_REVIEW/UPDATED_REVIEW из Pub/Sub: дозапрашиваем один отзыв и пишем. */
  async handleGooglePush(tenantId: string, payload: { type?: string; location?: string; review?: string }) {
    const reviewName = payload.review ? String(payload.review) : null;
    const location = payload.location || (reviewName ? reviewName.replace(/\/reviews\/[^/]+$/, '') : null);
    if (!location) return { ok: true, skipped: 'no_location' };
    const source = await this.sources.findOne({ where: { tenantId, platform: 'google', externalId: location, active: true } });
    if (!source) return { ok: true, skipped: 'unknown_location' };
    const cfg = await this.settings.config(tenantId);
    const run = await this.openRun(source, 'push', 'gbp-v4');
    try {
      let items: NormalizedReview[] = [];
      if (reviewName) items = [normalizeGoogleApiReview(await this.google.getReview(tenantId, reviewName))];
      else items = ((await this.google.listReviews(tenantId, location)).reviews || []).map(normalizeGoogleApiReview);
      const res = await this.ingest(source, items, cfg);
      await this.closeRun(run, res);
      return { ok: true, ...res };
    } catch (e: any) {
      await this.failSource(source, run, e?.getResponse?.()?.message || e?.message || String(e), cfg);
      return { ok: false };
    }
  }

  // ---------------------------------------------------------------- Apify

  private actorFor(source: HotelReviewSource, cfg: ReputationConfig) {
    const a = cfg.apifyActors[source.platform];
    if (!a) return null;
    const id = source.useFallback && a.fallback ? a.fallback : a.primary;
    return id ? { id, input: a.input, isFallback: source.useFallback && !!a.fallback } : null;
  }

  /** Запуск скрейпера по ссылке отеля. Первая загрузка — вся история, дальше только свежие. */
  async startApify(source: HotelReviewSource, trigger: string, opts: { max?: number; test?: boolean; backfill?: number } = {}) {
    const cfg = await this.settings.config(source.tenantId);
    const token = await this.settings.secret(source.tenantId, 'apifyToken');
    if (!token) throw new BadRequestException({ code: 'APIFY_NO_TOKEN', message: 'Apify token is not set (Settings → Connections)' });
    if (!source.url) throw new BadRequestException('Hotel page URL on this platform is not set');
    const actor = this.actorFor(source, cfg);
    if (!actor) throw new BadRequestException(`No Apify actor configured for ${source.platform}`);
    const running = await this.runs.findOne({ where: { sourceId: source.id, status: 'running' } });
    if (running && Date.now() - running.startedAt.getTime() < RUN_TIMEOUT_MS) return { runId: running.id, alreadyRunning: true };
    // лимит одновременных запусков тарифа Apify: не превышаем, а ставим в очередь (lastSyncAt = null → планировщик возьмёт первым)
    if ((await this.runningApifyCount(source.tenantId)) >= cfg.schedule.maxConcurrentRuns) {
      if (opts.test) throw new BadRequestException({ code: 'APIFY_BUSY', message: `All ${cfg.schedule.maxConcurrentRuns} Apify slots are busy — try the test again in a couple of minutes` });
      await this.sources.update({ id: source.id }, { lastSyncAt: null });
      return { queued: true };
    }

    const latest = await this.reviews.findOne({ where: { sourceId: source.id }, order: { publishedAt: 'DESC' } });
    const first = !latest;
    // только новое: от последнего собранного отзыва минус 3 дня (площадки индексируют отзывы с задержкой)
    // дозагрузка истории: фильтра «до даты» у скрейперов нет — берём N самых свежих целиком, уже собранные отбросятся как дубли
    const floor = historyFloor(cfg);
    const sinceTs = first || opts.backfill ? floor : Math.max(floor, (latest!.publishedAt?.getTime() ?? Date.now()) - 3 * DAY);
    const lim = cfg.apifyActors[source.platform];
    const max = opts.backfill ?? opts.max ?? (first ? lim.firstLoadMax : await this.plannedMax(source, actor.input, lim.maxPerRun));
    const input = this.apify.buildInput(actor.input, { url: source.url, max, since: new Date(sinceTs).toISOString().slice(0, 10) });
    const run = await this.openRun(source, opts.test ? 'test' : opts.backfill ? 'backfill' : trigger, actor.id);
    try {
      const started = await this.apify.startRun(token, actor.id, input);
      run.externalRunId = started.runId;
      await this.runs.save(run);
      if (opts.backfill) await this.sources.update({ id: source.id }, { backfillMax: null });
      if (cfg.apifyPause.reason) await this.settings.patchConfig(source.tenantId, { apifyPause: { reason: null, at: null } } as any);
      await this.sources.update({ id: source.id }, { lastSyncAt: new Date() });
      return { runId: run.id, apifyRunId: started.runId, firstLoad: first };
    } catch (e: any) {
      const msg = e?.getResponse?.()?.message || e?.message || String(e);
      // упёрлись в лимит тарифа (параллельно идут и чужие/ручные запуски) — это не сбой площадки: в очередь, без алерта
      if (/concurrent|memory limit|exceed/i.test(msg)) {
        await this.runs.delete({ id: run.id });
        await this.sources.update({ id: source.id }, { lastSyncAt: null });
        if (opts.test) throw new BadRequestException({ code: 'APIFY_BUSY', message: 'Apify plan limit of concurrent runs reached — try again in a couple of minutes' });
        return { queued: true };
      }
      // кончился месячный бюджет тарифа Apify — это не сбой площадки: весь сбор на паузу, один алерт, источники остаются в очереди
      if (/usage hard limit|monthly usage|not enough (credit|usage)|insufficient|payment required|402/i.test(msg)) {
        await this.runs.delete({ id: run.id });
        await this.sources.update({ id: source.id }, { lastSyncAt: null });
        await this.settings.patchConfig(source.tenantId, { apifyPause: { reason: msg.slice(0, 300), at: new Date().toISOString() } } as any);
        await this.alerts.apifyBudget(source.tenantId, msg, cfg).catch(() => undefined);
        throw new BadRequestException({ code: 'APIFY_BUDGET', message: 'Apify monthly usage limit reached — raise the limit or upgrade the plan in Apify (Billing). Collection is paused and resumes automatically.' });
      }
      await this.failSource(source, run, msg, cfg);
      throw e;
    }
  }

  /**
   * Сколько отзывов просить за плановый запуск. Если площадка умеет фильтр по дате ({{since}} во входе) —
   * потолок не страшен, платим только за новые. Если не умеет — берём «ожидаемый поток × 2 + запас»,
   * чтобы не оплачивать каждый раз одни и те же старые отзывы.
   */
  private async plannedMax(source: HotelReviewSource, input: string, cap: number): Promise<number> {
    if (input.includes('{{since}}') || source.platform === 'otelpuan') return cap; // Otelpuan не сортирует по дате — фиксированный потолок
    const last = await this.runs.find({ where: { sourceId: source.id, status: 'ok' }, order: { startedAt: 'DESC' }, take: 5 });
    const scheduled = last.filter((r) => r.trigger !== 'test');
    if (scheduled.length < 2) return cap;
    const avgNew = scheduled.reduce((a, r) => a + r.newCount, 0) / scheduled.length;
    return Math.max(5, Math.min(cap, Math.ceil(avgNew * 2) + 5));
  }

  private runningApifyCount(tenantId: string) {
    return this.runs.count({
      where: { tenantId, status: 'running', externalRunId: Not(IsNull()), startedAt: MoreThanOrEqual(new Date(Date.now() - RUN_TIMEOUT_MS)) },
    });
  }

  /** Опрос запущенных Apify-прогонов: готов — забираем датасет и пишем; упал — запасной скрейпер. */
  async pollApifyRuns() {
    const running = await this.runs.find({ where: { status: 'running', externalRunId: Not(IsNull()) }, take: 50 });
    for (const run of running) {
      const source = run.sourceId ? await this.sources.findOne({ where: { id: run.sourceId } }) : null;
      if (!source) {
        await this.closeRun(run, { error: 'source removed' });
        continue;
      }
      const cfg = await this.settings.config(run.tenantId);
      const token = await this.settings.secret(run.tenantId, 'apifyToken');
      if (!token) {
        await this.closeRun(run, { error: 'Apify token removed' });
        continue;
      }
      try {
        const st = await this.apify.runStatus(token, run.externalRunId!);
        if (st.status === 'READY' || st.status === 'RUNNING') {
          if (Date.now() - run.startedAt.getTime() > RUN_TIMEOUT_MS) await this.failSource(source, run, 'Apify run timed out', cfg);
          continue;
        }
        if (st.status !== 'SUCCEEDED') {
          await this.failSource(source, run, `Apify run ${st.status}${st.statusMessage ? `: ${st.statusMessage}` : ''}`, cfg);
          await this.maybeSwitchToFallback(source, cfg);
          continue;
        }
        const raw = await this.apify.datasetItems(token, st.datasetId);
        const items = raw.map((x) => normalizeApifyItem(source.platform, x)).filter(Boolean) as NormalizedReview[];
        if (run.trigger === 'test') {
          // тестовый прогон: только счётчики, без записи — сверить количество с сайтом
          run.fetched = items.length;
          await this.closeRun(run, { fetched: items.length, created: 0, updated: 0 });
          continue;
        }
        if (raw.length && !items.length) {
          await this.failSource(source, run, `Apify returned ${raw.length} items but none could be parsed as reviews — check the actor output format`, cfg);
          continue;
        }
        const res = await this.ingest(source, items, cfg);
        await this.closeRun(run, res);
      } catch (e: any) {
        this.log.warn(`apify poll ${run.id}: ${e?.message || e}`);
        if (Date.now() - run.startedAt.getTime() > RUN_TIMEOUT_MS) await this.failSource(source, run, e?.message || String(e), cfg);
      }
    }
  }

  /** Две ошибки основного скрейпера подряд → переключение на запасной (если задан) + алерт. */
  private async maybeSwitchToFallback(source: HotelReviewSource, cfg: ReputationConfig) {
    const a = cfg.apifyActors[source.platform];
    if (!a?.fallback || source.useFallback) return;
    const last = await this.runs.find({ where: { sourceId: source.id, status: Not('running') }, order: { startedAt: 'DESC' }, take: 2 });
    if (last.length < 2 || last.some((r) => r.status !== 'error')) return;
    await this.sources.update({ id: source.id }, { useFallback: true });
    await this.alerts.fallbackSwitched(source, a.primary, a.fallback, cfg).catch(() => undefined);
  }

  /** Тестовый прогон скрейпера на одном отеле (без записи): сверить число отзывов с сайтом. */
  async testRun(tenantId: string, sourceId: string, max = 20) {
    const s = await this.sources.findOne({ where: { id: sourceId, tenantId } });
    if (!s) throw new NotFoundException('Source not found');
    return this.startApify(s, 'test', { max, test: true });
  }

  async previewTestRun(tenantId: string, runId: string) {
    const run = await this.runs.findOne({ where: { id: runId, tenantId } });
    if (!run) throw new NotFoundException('Run not found');
    const token = await this.settings.secret(tenantId, 'apifyToken');
    if (!token || !run.externalRunId) return { run, items: [] };
    const st = await this.apify.runStatus(token, run.externalRunId);
    if (st.status !== 'SUCCEEDED') return { run, status: st.status, items: [] };
    const raw = (await this.apify.datasetItems(token, st.datasetId, 1000)).slice(0, 10);
    const source = run.sourceId ? await this.sources.findOne({ where: { id: run.sourceId } }) : null;
    return {
      run,
      status: st.status,
      costUsd: st.usd,
      items: raw.map((x) => ({ raw: x, parsed: normalizeApifyItem(source?.platform || run.platform, x) })),
    };
  }

  // ---------------------------------------------------------------- расписание

  private intervalMs(source: HotelReviewSource, cfg: ReputationConfig): number {
    const h = cfg.apifyActors[source.platform]?.everyHours || 24;
    // вне сезона — не чаще раза в сутки
    return (cfg.schedule.offSeason ? Math.max(24, h) : h) * 36e5;
  }

  /** Раз в несколько минут: Apify-площадки (и Google, пока API не подключён), у которых подошёл срок. */
  async scheduleDue() {
    const all = await this.sources.find({ where: { active: true } });
    const tenants = [...new Set(all.map((s) => s.tenantId))];
    for (const tenantId of tenants) {
      const cfg = await this.settings.config(tenantId);
      // бюджет Apify кончился — не стучимся, повтор раз в 3 часа (или сразу после ручного «Собрать»)
      if (cfg.apifyPause.at && Date.now() - Date.parse(cfg.apifyPause.at) < 3 * 36e5) continue;
      const hasToken = !!(await this.settings.secret(tenantId, 'apifyToken'));
      const googleApi = await this.google.isConnected(tenantId);
      // сначала ожидающие в очереди (lastSyncAt = null), потом самые давние; дальше лимита параллельных запусков не идём
      const mine = all
        .filter((x) => x.tenantId === tenantId)
        .sort((a, b) => (a.lastSyncAt?.getTime() ?? 0) - (b.lastSyncAt?.getTime() ?? 0));
      for (const s of mine) {
        if ((await this.runningApifyCount(tenantId)) >= cfg.schedule.maxConcurrentRuns) break;
        const viaApify = APIFY_PLATFORMS.includes(s.platform) || (s.platform === 'google' && (!googleApi || !s.externalId));
        if (!viaApify || !hasToken || !s.url) continue;
        if (!s.backfillMax && s.lastSyncAt && Date.now() - s.lastSyncAt.getTime() < this.intervalMs(s, cfg) - 60_000) continue;
        try {
          await this.startApify(s, 'schedule', s.backfillMax ? { backfill: s.backfillMax } : {});
        } catch (e: any) {
          if (e?.getResponse?.()?.code === 'APIFY_BUDGET') break;
          this.log.warn(`apify start ${s.platform}/${s.hotelId}: ${e?.message || e}`);
        }
      }
    }
  }

  /**
   * «Догрузить историю»: помечает источники (по id или по площадке) — планировщик запустит их по очереди
   * с учётом лимита параллельных запусков. Google, подключённый через API, сам грузит всю историю — пропускаем.
   */
  async requestBackfill(tenantId: string, body: { sourceIds?: string[]; platform?: string; max: number }) {
    const max = Math.round(Math.min(20000, Math.max(10, Number(body.max) || 0)));
    const where: any = { tenantId, active: true };
    if (body.sourceIds?.length) where.id = In(body.sourceIds.slice(0, 500));
    else if (body.platform) where.platform = body.platform;
    else throw new BadRequestException('sourceIds or platform is required');
    const googleApi = await this.google.isConnected(tenantId);
    const list = (await this.sources.find({ where })).filter(
      (s) => s.url && (APIFY_PLATFORMS.includes(s.platform) || (s.platform === 'google' && (!googleApi || !s.externalId))),
    );
    if (list.length) await this.sources.update({ id: In(list.map((s) => s.id)) }, { backfillMax: max, lastSyncAt: null });
    void this.scheduleDue().catch(() => undefined);
    return { queued: list.length, max };
  }

  /** Сколько отзывов в CRM старше даты — для кнопки «Удалить старше». */
  async countOlder(tenantId: string, before: string) {
    const d = this.parseDay(before);
    return { count: await this.reviews.count({ where: { tenantId, publishedAt: LessThan(d) } as any }) };
  }

  /** Удалить из CRM отзывы старше даты (по явному действию пользователя; версии, ответы и темы — каскадом). */
  async purgeOlder(tenantId: string, before: string) {
    const d = this.parseDay(before);
    const res = await this.reviews.delete({ tenantId, publishedAt: LessThan(d) } as any);
    return { deleted: res.affected ?? 0 };
  }

  private parseDay(v: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))) throw new BadRequestException('Date must be YYYY-MM-DD');
    return new Date(`${v}T00:00:00Z`);
  }

  /** Ночная сверка Google по всем привязанным локациям (первая — полная загрузка истории). */
  async nightlyGoogle() {
    const all = await this.sources.find({ where: { active: true, platform: 'google', externalId: Not(IsNull()) } });
    for (const s of all) {
      if (!(await this.google.isConnected(s.tenantId))) continue;
      const hasAny = await this.reviews.count({ where: { sourceId: s.id } });
      await this.syncGoogle(s, hasAny ? 'reconcile' : 'full', 'reconcile').catch((e) => this.log.warn(`google reconcile ${s.id}: ${e?.message || e}`));
    }
  }

  /** Ручной запуск «Синхронизировать» из настроек. */
  async syncNow(tenantId: string, sourceId: string) {
    const s = await this.sources.findOne({ where: { id: sourceId, tenantId } });
    if (!s) throw new NotFoundException('Source not found');
    if (s.platform === 'google' && s.externalId && (await this.google.isConnected(tenantId))) {
      const hasAny = await this.reviews.count({ where: { sourceId: s.id } });
      return this.syncGoogle(s, hasAny ? 'reconcile' : 'full', 'manual');
    }
    return this.startApify(s, 'manual');
  }

  /**
   * Фоновая очередь ИИ-разбора: новые и изменённые отзывы, которые не успели разобрать при записи.
   * Работает до ~4 минут за тик (тик раз в 5 минут), по AI_PARALLEL запросов параллельно; при ошибке
   * кредитов/ключа тенант пропускается до следующей попытки.
   */
  async analyzeBacklog(batch = 24) {
    const deadline = Date.now() + 4 * 60_000;
    const pending = await this.reviews
      .createQueryBuilder('r')
      .select('DISTINCT r.tenantId', 'tenantId')
      .where('r.analyzedAt IS NULL AND r.status <> :d', { d: 'deleted' })
      .andWhere('(r.analysisError IS NULL OR r.updatedAt < :retry)', { retry: new Date(Date.now() - RETRY_AI_MS) })
      .getRawMany();
    for (const { tenantId } of pending) {
      const cfg = await this.settings.config(tenantId);
      let blocked = false;
      while (!blocked && Date.now() < deadline) {
        const rows = await this.reviews
          .createQueryBuilder('r')
          .where('r.tenantId = :tenantId AND r.analyzedAt IS NULL AND r.status <> :d', { tenantId, d: 'deleted' })
          .andWhere('(r.analysisError IS NULL OR r.updatedAt < :retry)', { retry: new Date(Date.now() - RETRY_AI_MS) })
          // отзывы старше «Отзывы с даты» не разбираем — это токены впустую
          .andWhere('r.publishedAt >= :floor', { floor: new Date(historyFloor(cfg)) })
          .orderBy('r.publishedAt', 'DESC')
          .take(batch)
          .getMany();
        if (!rows.length) break;
        for (let i = 0; i < rows.length && !blocked; i += AI_PARALLEL) {
          const chunk = rows.slice(i, i + AI_PARALLEL);
          const results = await Promise.all(chunk.map((r) => this.ai.analyze(r, cfg)));
          if (results.every(Boolean)) continue;
          // нет кредитов / неверный ключ — дальше по этому тенанту не стучимся до следующей попытки
          const failed = await this.reviews.find({ where: { id: In(chunk.map((r) => r.id)) }, select: ['id', 'analysisError'] as any });
          if (failed.some((f) => f.analysisError && /credit|quota|billing|insufficient|api key|401|403|429/i.test(f.analysisError))) blocked = true;
        }
      }
    }
  }

  /** Признак «тихо сломавшегося» скрейпера: 0 новых отзывов N дней при обычном потоке. */
  async checkStale() {
    const all = await this.sources.find({ where: { active: true } });
    for (const s of all) {
      const cfg = await this.settings.config(s.tenantId);
      const days = cfg.thresholds.staleDays;
      const lastNew = s.lastNewAt?.getTime() ?? 0;
      if (!lastNew || Date.now() - lastNew < days * DAY) continue;
      // «обычный поток»: за 60 дней до затишья приходило хотя бы ~1 отзыв в неделю
      const before = await this.reviews.count({
        where: { sourceId: s.id, firstSeenAt: MoreThanOrEqual(new Date(lastNew - 60 * DAY)) as any },
      });
      if (before < 8) continue;
      await this.alerts.stale(s, days, cfg).catch(() => undefined);
    }
  }

  async cleanupOldRuns() {
    await this.runs.delete({ startedAt: LessThan(new Date(Date.now() - 120 * DAY)) as any });
  }

  hotelName(hotelId: string) {
    return this.hotels.findOne({ where: { id: hotelId } }).then((h) => h?.name || '');
  }
}
