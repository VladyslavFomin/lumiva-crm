import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import axios from 'axios';
import { createHash } from 'node:crypto';
import { ReviewPlace } from './review-place.entity';
import { ReviewItem, ReviewSentiment, ReviewStatus } from './review-item.entity';
import { Tenant } from '../tenants/tenant.entity';
import { User } from '../users/user.entity';
import { AiAgent } from '../ai-employees/ai-agent.entity';
import { AiEmployeesService } from '../ai-employees/ai-employees.service';
import { getAiEmployeeLimitForPlan, getAiEmployeeRole, planAllowsAiEmployeeRole } from '../ai-employees/ai-employee-role-catalog';
import { Project } from '../projects/project.entity';
import { ProjectsService } from '../projects/projects.service';
import { ProjectStatusesService } from '../projects/project-statuses.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { EmailService } from '../email/email.service';
import { escapeMailHtml } from '../mail/mail-template.util';

type Lang = 'ru' | 'en' | 'tr';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Первая синхронизация не должна засыпать владельца сигналами по старым отзывам. */
const ALERT_MAX_AGE_DAYS = 14;

/**
 * ИИ-менеджер отзывов: мониторинг Google-отзывов объекта (Places API — 5 самых свежих отзывов на
 * каждый опрос), разбор и черновик ответа ИИ на языке отзыва, сигналы о негативе.
 * Публикация ответа — вручную (копировать → «Открыть в Google»): автопубликации нужен Google Business
 * Profile API, доступ к которому Google выдаёт по отдельной заявке.
 */
@Injectable()
export class ReviewsAiService {
  private readonly log = new Logger(ReviewsAiService.name);

  constructor(
    @InjectRepository(ReviewPlace) private readonly places: Repository<ReviewPlace>,
    @InjectRepository(ReviewItem) private readonly items: Repository<ReviewItem>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AiAgent) private readonly aiAgents: Repository<AiAgent>,
    @InjectRepository(Project) private readonly projectsRepo: Repository<Project>,
    private readonly employees: AiEmployeesService,
    private readonly projects: ProjectsService,
    private readonly projectStatuses: ProjectStatusesService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly email: EmailService,
  ) {}

  private key(): string {
    const k = process.env.GOOGLE_PLACES_API_KEY?.trim();
    if (!k) throw new BadRequestException({ code: 'REVIEWS_NO_PLACES_KEY', message: 'Google Places API key is not configured on the platform' });
    return k;
  }

  // ---------------------------------------------------------------- доступ

  private async employee(tenantId: string): Promise<AiAgent | null> {
    return this.aiAgents.findOne({ where: { tenantId, role: 'reviews_manager' as any, status: 'active' as any }, order: { createdAt: 'ASC' } });
  }

  /** Как у ИИ-SEO: работает только при активном ИИ-сотруднике «Менеджер отзывов» (место из лимита тарифа). */
  async getAccess(tenantId: string) {
    const all = await this.aiAgents.find({ where: { tenantId, role: 'reviews_manager' as any }, order: { createdAt: 'ASC' } });
    const active = all.find((a) => a.status === 'active') || null;
    const employee = active || all.find((a) => a.status !== 'disabled') || all[0] || null;
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    const role = getAiEmployeeRole('reviews_manager')!;
    const limit = getAiEmployeeLimitForPlan(tenant?.plan);
    const used = await this.aiAgents.count({ where: { tenantId, status: Not('disabled') as any } });
    const planAllowed = planAllowsAiEmployeeRole(tenant?.plan, role.minPlan);
    return {
      allowed: !!active,
      employee: employee
        ? { id: employee.id, name: employee.name, status: employee.status, avatarUrl: employee.avatarUrl, autonomyMode: employee.autonomyMode }
        : null,
      planAllowed,
      limit,
      used,
      canHire: planAllowed && (limit == null || used < limit),
      placesKey: !!process.env.GOOGLE_PLACES_API_KEY?.trim(),
    };
  }

  async assertAccess(tenantId: string) {
    const a = await this.getAccess(tenantId);
    if (!a.allowed) throw new ForbiddenException({ code: 'REVIEWS_NO_EMPLOYEE', message: 'Hire and activate the AI Reviews Manager' });
    return a;
  }

  // ---------------------------------------------------------------- объекты

  /** Поиск объекта в Google по названию/адресу (Places API New, Text Search). */
  async search(query: string) {
    const q = String(query || '').trim().slice(0, 200);
    if (q.length < 2) return [];
    const res = await axios.post(
      'https://places.googleapis.com/v1/places:searchText',
      { textQuery: q, maxResultCount: 8 },
      {
        headers: {
          'X-Goog-Api-Key': this.key(),
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri',
        },
        timeout: 20_000,
      },
    );
    return ((res.data?.places || []) as any[]).map((p) => ({
      placeId: p.id as string,
      name: p.displayName?.text || '',
      address: p.formattedAddress || null,
      rating: p.rating ?? null,
      totalReviews: p.userRatingCount ?? 0,
      mapsUrl: p.googleMapsUri || null,
    }));
  }

  private toPublic(p: ReviewPlace) {
    return {
      id: p.id,
      placeId: p.placeId,
      name: p.name,
      address: p.address,
      mapsUrl: p.mapsUrl,
      rating: p.rating != null ? Number(p.rating) : null,
      totalReviews: p.totalReviews,
      enabled: p.enabled,
      syncHours: p.syncHours,
      alertThreshold: p.alertThreshold,
      recipients: p.recipients || [],
      businessContext: p.businessContext,
      signature: p.signature,
      lastSyncAt: p.lastSyncAt?.toISOString() ?? null,
      lastError: p.lastError,
      /** Ссылка «написать/ответить на отзыв» в Google. */
      writeReviewUrl: `https://search.google.com/local/reviews?placeid=${encodeURIComponent(p.placeId)}`,
    };
  }

  async listPlaces(tenantId: string) {
    const rows = await this.places.find({ where: { tenantId }, order: { createdAt: 'ASC' } });
    const stats = rows.length
      ? await this.items
          .createQueryBuilder('r')
          .select('r.placeRowId', 'placeRowId')
          .addSelect(`COUNT(*) FILTER (WHERE r.status IN ('new','drafted'))`, 'open')
          .addSelect(`COUNT(*) FILTER (WHERE r.status IN ('new','drafted') AND r.sentiment = 'negative')`, 'openNegative')
          .where('r.tenantId = :tenantId', { tenantId })
          .groupBy('r.placeRowId')
          .getRawMany()
      : [];
    return rows.map((p) => {
      const st = stats.find((s) => s.placeRowId === p.id);
      return { ...this.toPublic(p), open: Number(st?.open || 0), openNegative: Number(st?.openNegative || 0) };
    });
  }

  async addPlace(tenantId: string, userId: string | null, placeId: string) {
    const id = String(placeId || '').trim();
    if (!id) throw new BadRequestException('placeId is required');
    const existing = await this.places.findOne({ where: { tenantId, placeId: id } });
    if (existing) return this.toPublic(existing);
    if ((await this.places.count({ where: { tenantId } })) >= 10) {
      throw new BadRequestException({ code: 'REVIEWS_PLACES_LIMIT', message: 'Up to 10 places per company' });
    }
    const d = await this.details(id);
    const [tenant, user] = await Promise.all([
      this.tenants.findOne({ where: { id: tenantId } }),
      userId ? this.users.findOne({ where: { id: userId, tenantId } }) : Promise.resolve(null),
    ]);
    const email = user?.email || tenant?.ownerEmail || null;
    const row = await this.places.save(
      this.places.create({
        tenantId,
        placeId: id,
        name: d.name || id,
        address: d.address,
        mapsUrl: d.mapsUrl,
        rating: d.rating != null ? String(d.rating) : null,
        totalReviews: d.total,
        recipients: email ? [email] : [],
        signature: d.name ? `${d.name}` : null,
      }),
    );
    // первый опрос сразу — чтобы страница не была пустой
    await this.syncPlace(row, { firstRun: true }).catch((e) => this.log.warn(`first review sync failed: ${e?.message || e}`));
    return this.toPublic((await this.places.findOne({ where: { id: row.id } }))!);
  }

  async updatePlace(
    tenantId: string,
    id: string,
    patch: Partial<{ enabled: boolean; syncHours: number; alertThreshold: number; recipients: string[]; businessContext: string | null; signature: string | null }>,
  ) {
    const p = await this.places.findOne({ where: { id, tenantId } });
    if (!p) throw new NotFoundException('Place not found');
    if (patch.enabled !== undefined) p.enabled = !!patch.enabled;
    if (patch.syncHours !== undefined) p.syncHours = [1, 3, 6, 12, 24].includes(Number(patch.syncHours)) ? Number(patch.syncHours) : 3;
    if (patch.alertThreshold !== undefined) p.alertThreshold = Math.min(5, Math.max(1, Math.round(Number(patch.alertThreshold) || 3)));
    if (patch.recipients !== undefined) {
      p.recipients = [...new Set((Array.isArray(patch.recipients) ? patch.recipients : []).map((e) => String(e).trim().toLowerCase()).filter((e) => EMAIL_RE.test(e)))].slice(0, 10);
    }
    if (patch.businessContext !== undefined) p.businessContext = patch.businessContext ? String(patch.businessContext).slice(0, 2000) : null;
    if (patch.signature !== undefined) p.signature = patch.signature ? String(patch.signature).slice(0, 200) : null;
    await this.places.save(p);
    return this.toPublic(p);
  }

  async removePlace(tenantId: string, id: string) {
    const p = await this.places.findOne({ where: { id, tenantId } });
    if (!p) throw new NotFoundException('Place not found');
    await this.items.delete({ tenantId, placeRowId: p.id });
    await this.places.delete({ id: p.id });
    return { ok: true };
  }

  // ---------------------------------------------------------------- Google

  /** Place Details (legacy): единственный способ получить именно 5 САМЫХ СВЕЖИХ отзывов (reviews_sort=newest). */
  private async details(placeId: string) {
    const res = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
      params: {
        place_id: placeId,
        fields: 'name,formatted_address,url,rating,user_ratings_total,reviews',
        reviews_sort: 'newest',
        reviews_no_translations: true,
        key: this.key(),
      },
      timeout: 20_000,
    });
    if (res.data?.status !== 'OK') {
      throw new BadRequestException({ code: 'REVIEWS_GOOGLE_ERROR', message: `${res.data?.status}: ${res.data?.error_message || ''}`.trim() });
    }
    const r = res.data.result || {};
    return {
      name: r.name as string | undefined,
      address: (r.formatted_address as string) || null,
      mapsUrl: (r.url as string) || null,
      rating: typeof r.rating === 'number' ? r.rating : null,
      total: Number(r.user_ratings_total || 0),
      reviews: ((r.reviews || []) as any[]).map((x) => ({
        key: createHash('sha1').update(`${x.author_url || x.author_name}|${x.time}`).digest('hex'),
        authorName: x.author_name || null,
        authorUrl: x.author_url || null,
        authorPhoto: x.profile_photo_url || null,
        rating: Number(x.rating || 0),
        text: (x.text as string) || null,
        language: (x.original_language || x.language || null) as string | null,
        publishedAt: new Date(Number(x.time || 0) * 1000),
      })),
    };
  }

  // ---------------------------------------------------------------- синхронизация

  async syncPlace(place: ReviewPlace, opts: { firstRun?: boolean } = {}) {
    let d: Awaited<ReturnType<ReviewsAiService['details']>>;
    try {
      d = await this.details(place.placeId);
    } catch (e: any) {
      const msg = e?.getResponse?.()?.message || e?.message || String(e);
      await this.places.update({ id: place.id }, { lastSyncAt: new Date(), lastError: String(msg).slice(0, 300) });
      throw e;
    }
    await this.places.update(
      { id: place.id },
      {
        rating: d.rating != null ? String(d.rating) : place.rating,
        totalReviews: d.total || place.totalReviews,
        mapsUrl: d.mapsUrl || place.mapsUrl,
        lastSyncAt: new Date(),
        lastError: null,
      },
    );
    const fresh: ReviewItem[] = [];
    for (const r of d.reviews) {
      const ex = await this.items.findOne({ where: { placeRowId: place.id, externalKey: r.key } });
      if (ex) {
        // автор отредактировал отзыв — разбираем заново, если ещё не ответили
        if ((ex.text || '') !== (r.text || '') || ex.rating !== r.rating) {
          ex.text = r.text;
          ex.rating = r.rating;
          if (ex.status !== 'replied') {
            ex.status = 'new';
            ex.aiReply = null;
            fresh.push(ex);
          }
          await this.items.save(ex);
        }
        continue;
      }
      const row = await this.items.save(
        this.items.create({ tenantId: place.tenantId, placeRowId: place.id, externalKey: r.key, ...r, status: 'new' as ReviewStatus }),
      );
      fresh.push(row);
    }
    if (fresh.length) {
      await this.analyze(place, fresh).catch((e) => this.log.warn(`review analysis failed: ${e?.message || e}`));
      await this.alertNegatives(place, opts.firstRun ?? false).catch((e) => this.log.warn(`review alerts failed: ${e?.message || e}`));
    }
    return { fetched: d.reviews.length, new: fresh.length };
  }

  async syncNow(tenantId: string, id: string) {
    const p = await this.places.findOne({ where: { id, tenantId } });
    if (!p) throw new NotFoundException('Place not found');
    return this.syncPlace(p);
  }

  /** Раз в 30 минут: объекты, у которых подошёл срок опроса, у тенантов с активным менеджером отзывов. */
  async tick(): Promise<void> {
    const rows = await this.places.find({ where: { enabled: true } });
    const staffed = new Map<string, boolean>();
    for (const p of rows) {
      if (p.lastSyncAt && Date.now() - p.lastSyncAt.getTime() < p.syncHours * 36e5 - 5 * 60_000) continue;
      if (!staffed.has(p.tenantId)) staffed.set(p.tenantId, !!(await this.employee(p.tenantId)));
      if (!staffed.get(p.tenantId)) continue;
      try {
        await this.syncPlace(p);
      } catch (e: any) {
        this.log.warn(`review sync failed place=${p.id}: ${e?.message || e}`);
      }
    }
  }

  // ---------------------------------------------------------------- ИИ

  private ownerLang(agent: AiAgent | null): Lang {
    return agent?.language === 'Russian' ? 'ru' : agent?.language === 'Turkish' ? 'tr' : agent?.language === 'English' ? 'en' : 'ru';
  }

  /**
   * Разбор новых отзывов: один пакетный вызов — тональность, темы, суть для владельца (на его языке);
   * затем ответ на КАЖДЫЙ отзыв отдельным запросом на языке отзыва. В пакете gpt-4o-mini путал язык
   * ответа (отвечал по-русски на корейский/английский отзыв), поэтому ответы — поштучно, с проверкой.
   */
  private async analyze(place: ReviewPlace, rows: ReviewItem[], tone?: string) {
    const agent = await this.employee(place.tenantId);
    if (!agent) return;
    const lang = this.ownerLang(agent);
    const langName = { ru: 'Russian', en: 'English', tr: 'Turkish' }[lang];
    const batch = rows.slice(0, 10);
    const signature = (place.signature || place.name).trim();

    const payload = batch.map((r) => ({ id: r.id, rating: r.rating, text: (r.text || '').slice(0, 1500) }));
    const res = await this.employees.completeForAgent(
      place.tenantId,
      agent,
      `You analyse Google reviews of "${place.name}" for its owner. Write in ${langName}.`,
      `Reviews (JSON): ${JSON.stringify(payload)}

For EACH review return: sentiment ("positive" | "neutral" | "negative" — consider rating AND text; 3★ with complaints is negative), topics (1–4 short topic words in ${langName}: cleanliness, staff, food, price, location, noise…; empty if no text), summary (one short sentence in ${langName}: what the guest liked or complained about).
Respond with ONLY JSON: {"items":[{"id":"...","sentiment":"...","topics":["..."],"summary":"..."}]}`,
    );
    const raw = String(res.text || '').replace(/```[a-z]*\n?/gi, '').replace(/```/g, '');
    const a = raw.indexOf('{');
    const b = raw.lastIndexOf('}');
    const parsed: any[] = a >= 0 && b > a ? (JSON.parse(raw.slice(a, b + 1)).items || []) : [];

    for (const row of batch) {
      const it = parsed.find((x) => x?.id === row.id) || {};
      // без текста судить можно только по оценке
      const sentiment: ReviewSentiment = row.text && ['positive', 'neutral', 'negative'].includes(it.sentiment)
        ? it.sentiment
        : row.rating <= 2
          ? 'negative'
          : row.rating >= 4
            ? 'positive'
            : 'neutral';
      let reply = await this.replyOnly(place, row, agent, signature, tone).catch(() => null);
      // письменность не та (ответ по-русски на корейский отзыв и т.п.) — одна повторная попытка
      if (reply && !this.scriptMatches(reply, this.replyLang(row))) {
        const again = await this.replyOnly(place, row, agent, signature, tone).catch(() => null);
        if (again && this.scriptMatches(again, this.replyLang(row))) reply = again;
      }
      await this.items.update(
        { id: row.id },
        {
          sentiment,
          topics: (Array.isArray(it.topics) ? it.topics : []).map((x: any) => String(x).slice(0, 40)).slice(0, 4),
          summary: it.summary ? String(it.summary).slice(0, 400) : null,
          aiReply: reply ? reply.slice(0, 3000) : null,
          status: row.status === 'replied' || row.status === 'ignored' ? row.status : 'drafted',
        },
      );
    }
  }

  /** Ответ на один отзыв — промпт целиком про язык ответа, без языка владельца. */
  private async replyOnly(place: ReviewPlace, r: ReviewItem, agent: AiAgent, signature: string, tone?: string): Promise<string | null> {
    const lang = this.langName(this.replyLang(r));
    const about = place.businessContext ? `About the business: <<<${place.businessContext.slice(0, 1200)}>>>\n` : '';
    const res = await this.employees.completeForAgent(
      place.tenantId,
      agent,
      `You write public replies to Google reviews on behalf of "${place.name}". You ALWAYS write in ${lang}, whatever language these instructions are in.`,
      `${about}${tone ? `Tone: ${tone}\n` : ''}Review (${r.rating} of 5 stars) by ${r.authorName || 'a guest'}: <<<${(r.text || 'rating only, no text').slice(0, 1500)}>>>

Write the reply in ${lang} only: ${r.text ? '2–5 sentences' : '1–2 sentences'}, warm and specific to what they wrote (thank them by name, mention the concrete points). For complaints: apologise without excuses, say what the team will check, invite them to contact the business directly. No invented facts, no promises of compensation, no private data, no hashtags, never argue. Do not add a signature — it is added automatically.
Output only the reply text.`,
    );
    const text = String(res.text || '').trim();
    return text ? this.withSignature(text, signature) : null;
  }

  private replyLang(r: ReviewItem): string {
    // нет языка (оценка без текста) — английский: гости отелей/клиник в Турции международные
    return (r.language || '').split('-')[0].toLowerCase() || 'en';
  }

  private langName(code: string): string {
    try {
      return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code;
    } catch {
      return code;
    }
  }

  /** Грубая проверка письменности ответа — ловит «ответ по-русски на корейский отзыв». */
  private scriptMatches(text: string, lang: string): boolean {
    const expect: Record<string, RegExp> = {
      ru: /[Ѐ-ӿ]/, uk: /[Ѐ-ӿ]/, bg: /[Ѐ-ӿ]/, sr: /[Ѐ-ӿ]/, kk: /[Ѐ-ӿ]/,
      ko: /[가-힯]/, ja: /[぀-ヿ一-鿿]/, zh: /[一-鿿]/, ar: /[؀-ۿ]/, fa: /[؀-ۿ]/,
      he: /[֐-׿]/, el: /[Ͱ-Ͽ]/, th: /[฀-๿]/, hi: /[ऀ-ॿ]/, ka: /[Ⴀ-ჿ]/,
    };
    const body = text.replace(/\n[^\n]*$/, ''); // без подписи
    if (expect[lang]) return expect[lang].test(body);
    // латиница (en, tr, de, fr…): кириллицы быть не должно
    return !/[Ѐ-ӿ]/.test(body);
  }

  /** Подпись — отдельная последняя строка (модель вплетает название в предложение и не подписывается). */
  private withSignature(reply: string, signature: string): string {
    if (!signature) return reply.trim();
    const lines = reply.trim().split('\n').map((l) => l.trim()).filter(Boolean);
    const last = (lines[lines.length - 1] || '').toLowerCase();
    const signed = last.includes(signature.toLowerCase()) && last.length <= signature.length + 25;
    return signed ? reply.trim() : `${reply.trim()}\n\n${signature}`;
  }

  // ---------------------------------------------------------------- отзывы

  async listReviews(tenantId: string, q: { placeId?: string; status?: string; sentiment?: string }) {
    const where: Record<string, unknown> = { tenantId };
    if (q.placeId) where.placeRowId = q.placeId;
    if (q.status === 'open') where.status = In(['new', 'drafted']);
    else if (q.status && ['new', 'drafted', 'replied', 'ignored'].includes(q.status)) where.status = q.status;
    if (q.sentiment && ['positive', 'neutral', 'negative'].includes(q.sentiment)) where.sentiment = q.sentiment;
    const rows = await this.items.find({ where: where as any, order: { publishedAt: 'DESC' }, take: 200 });
    return rows.map((r) => ({
      id: r.id,
      placeRowId: r.placeRowId,
      authorName: r.authorName,
      authorUrl: r.authorUrl,
      authorPhoto: r.authorPhoto,
      rating: r.rating,
      text: r.text,
      language: r.language,
      publishedAt: r.publishedAt.toISOString(),
      status: r.status,
      sentiment: r.sentiment,
      topics: r.topics || [],
      summary: r.summary,
      aiReply: r.aiReply,
      repliedAt: r.repliedAt?.toISOString() ?? null,
    }));
  }

  async updateReview(tenantId: string, id: string, patch: { status?: ReviewStatus; aiReply?: string }) {
    const r = await this.items.findOne({ where: { id, tenantId } });
    if (!r) throw new NotFoundException('Review not found');
    if (patch.aiReply !== undefined) r.aiReply = String(patch.aiReply).slice(0, 3000);
    if (patch.status && ['new', 'drafted', 'replied', 'ignored'].includes(patch.status)) {
      r.status = patch.status;
      r.repliedAt = patch.status === 'replied' ? new Date() : r.repliedAt;
    }
    await this.items.save(r);
    return (await this.listReviews(tenantId, {})).find((x) => x.id === r.id) ?? null;
  }

  /** Переписать черновик ответа (другой тон: короче / теплее / официальнее). */
  async regenerate(tenantId: string, id: string, tone?: string) {
    const r = await this.items.findOne({ where: { id, tenantId } });
    if (!r) throw new NotFoundException('Review not found');
    const p = await this.places.findOne({ where: { id: r.placeRowId, tenantId } });
    if (!p) throw new NotFoundException('Place not found');
    await this.analyze(p, [r], tone ? String(tone).slice(0, 100) : undefined);
    return (await this.listReviews(tenantId, {})).find((x) => x.id === r.id) ?? null;
  }

  /** Сводка для шапки страницы: средняя оценка новых отзывов, доля негатива, частые темы за 30 дней. */
  async stats(tenantId: string, placeRowId?: string) {
    const since = new Date(Date.now() - 30 * 864e5);
    const qb = this.items.createQueryBuilder('r').where('r.tenantId = :tenantId AND r.publishedAt >= :since', { tenantId, since });
    if (placeRowId) qb.andWhere('r.placeRowId = :p', { p: placeRowId });
    const rows = await qb.getMany();
    const topics: Record<string, { total: number; negative: number }> = {};
    for (const r of rows) {
      for (const t of r.topics || []) {
        const k = t.toLowerCase();
        topics[k] = topics[k] || { total: 0, negative: 0 };
        topics[k].total++;
        if (r.sentiment === 'negative') topics[k].negative++;
      }
    }
    return {
      days: 30,
      count: rows.length,
      avgRating: rows.length ? Math.round((rows.reduce((a, r) => a + r.rating, 0) / rows.length) * 100) / 100 : null,
      negative: rows.filter((r) => r.sentiment === 'negative').length,
      replied: rows.filter((r) => r.status === 'replied').length,
      topics: Object.entries(topics)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 8)
        .map(([topic, v]) => ({ topic, ...v })),
    };
  }

  // ---------------------------------------------------------------- негатив

  private async ensureProject(place: ReviewPlace): Promise<string | null> {
    if (place.taskProjectId) {
      const p = await this.projectsRepo.findOne({ where: { id: place.taskProjectId, tenantId: place.tenantId } });
      if (p && !(p as any).isDeleted) return p.id;
    }
    try {
      const statuses = await this.projectStatuses.findAll(place.tenantId);
      const status = (statuses.find((s) => s.value === 'Новый') || statuses[0])?.value || 'Новый';
      const proj = await this.projects.createForTenant(place.tenantId, {
        name: `Отзывы · ${place.name}`.slice(0, 250),
        description: `Задачи ИИ-менеджера отзывов по объекту ${place.name}`,
        amount: '0',
        currency: 'EUR',
        status,
      } as any);
      await this.places.update({ id: place.id }, { taskProjectId: proj.id });
      return proj.id;
    } catch (e: any) {
      this.log.warn(`reviews task project failed: ${e?.message || e}`);
      return null;
    }
  }

  /** Новые отзывы с оценкой ≤ порога (не старше 14 дней): уведомление, письмо, задача от сотрудника. */
  private async alertNegatives(placeIn: ReviewPlace, firstRun: boolean) {
    const place = (await this.places.findOne({ where: { id: placeIn.id } }))!;
    const since = new Date(Date.now() - ALERT_MAX_AGE_DAYS * 864e5);
    const rows = await this.items.find({ where: { placeRowId: place.id, alertedAt: IsNull() } });
    const bad = rows.filter((r) => r.rating <= place.alertThreshold && r.publishedAt >= since && r.status !== 'replied' && r.status !== 'ignored');
    // старые отзывы из первой выборки помечаем «уже известными», без сигналов
    const skip = rows.filter((r) => !bad.includes(r));
    if (skip.length) await this.items.update({ id: In(skip.map((r) => r.id)) }, { alertedAt: new Date() });
    if (!bad.length) return;
    const agent = await this.employee(place.tenantId);
    if (!agent) return;
    const lang = this.ownerLang(agent);
    const L = ALERT_I18N[lang];
    const frontend = (process.env.FRONTEND_URL || 'https://crm.lumiva.agency').replace(/\/$/, '');
    const link = `${frontend}/app/marketing/reviews?place=${place.id}`;
    const title = L.title(place.name, bad.length);
    const lines = bad.map((r) => `${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} ${r.authorName || ''}: ${(r.summary || r.text || '').slice(0, 160)}`);

    try {
      const emails = (place.recipients || []).map((e) => e.toLowerCase());
      let userIds = emails.length ? (await this.users.find({ where: { tenantId: place.tenantId, email: In(emails) } as any })).map((u) => u.id) : [];
      if (!userIds.length) userIds = (await this.users.find({ where: { tenantId: place.tenantId, role: 'owner' } as any })).map((u) => u.id);
      await this.notifications.create(place.tenantId, userIds, title, lines.join('\n'), { link: `/app/marketing/reviews?place=${place.id}`, kind: 'review_negative' });
    } catch (e: any) {
      this.log.warn(`review alert notification failed: ${e?.message || e}`);
    }

    if (place.recipients?.length) {
      const e = escapeMailHtml;
      const inner = `<p style="margin:0 0 12px;font-size:14px;color:#18181b;">${e(L.intro(place.name))}</p>
${bad
  .map(
    (r) => `<div style="margin:0 0 12px;padding:12px 14px;border:1px solid #f3d0d6;border-radius:10px;background:#fff7f8;">
<div style="font-size:14px;color:#cc2f47;letter-spacing:1px;">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
<div style="font-size:13px;font-weight:600;color:#18181b;margin:4px 0;">${e(r.authorName || '')}</div>
<div style="font-size:13px;color:#3f3f46;line-height:1.5;">${e((r.text || '').slice(0, 600))}</div>
${r.aiReply ? `<div style="margin-top:10px;font-size:12px;color:#71717a;">${e(L.draft)}</div><div style="font-size:13px;color:#18181b;line-height:1.5;white-space:pre-line;">${e(r.aiReply)}</div>` : ''}
</div>`,
  )
  .join('')}
<p style="margin:18px 0 0;"><a href="${link}" style="display:inline-block;padding:12px 24px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;">${L.open}</a></p>
<p style="margin:14px 0 0;font-size:12px;color:#71717a;">${e(L.by(agent.name))}</p>`;
      try {
        const wrapped = await this.email.wrapHtmlInCompanyDesign(place.tenantId, { headline: title, innerHtml: inner });
        for (const to of place.recipients) await this.mail.sendMail({ to, subject: title, html: wrapped?.htmlBody || inner });
      } catch (err: any) {
        this.log.warn(`review alert email failed: ${err?.message || err}`);
      }
    }

    // задача на разбор — по одной на негативный отзыв, через действия сотрудника (права/согласования)
    const projectId = await this.ensureProject(place);
    if (projectId) {
      for (const r of bad) {
        await this.employees
          .proposeModuleAction(place.tenantId, agent.id, {
            actionType: 'create_task',
            title: L.taskTitle(r.rating, r.authorName || '', place.name).slice(0, 250),
            reason: L.taskReason,
            targetType: 'project',
            targetId: projectId,
            payload: {
              projectId,
              title: L.taskTitle(r.rating, r.authorName || '', place.name).slice(0, 250),
              description: `${r.text || ''}\n\n${r.aiReply ? `${L.draft}\n${r.aiReply}\n\n` : ''}${link}`,
              priority: r.rating <= 2 ? 'urgent' : 'high',
              dueDate: new Date(Date.now() + 864e5).toISOString().slice(0, 10),
              source: 'reviews_ai',
            },
          })
          .catch(() => undefined);
      }
    }
    await this.items.update({ id: In(bad.map((r) => r.id)) }, { alertedAt: new Date() });
    if (firstRun) this.log.log(`reviews: first sync of ${place.name} raised ${bad.length} alerts`);
  }
}

const ALERT_I18N: Record<Lang, any> = {
  ru: {
    title: (n: string, c: number) => `Негативный отзыв · ${n}${c > 1 ? ` (${c})` : ''}`,
    intro: (n: string) => `На Google появились негативные отзывы о «${n}». Черновик ответа уже готов:`,
    draft: 'Черновик ответа:',
    open: 'Открыть отзывы',
    by: (n: string) => `Сообщила ${n} — ИИ-менеджер отзывов вашей команды.`,
    taskTitle: (r: number, a: string, n: string) => `Отзыв ${r}★ от ${a || 'гостя'} (${n}) — ответить и разобраться`,
    taskReason: 'Негативный отзыв в Google',
  },
  en: {
    title: (n: string, c: number) => `Negative review · ${n}${c > 1 ? ` (${c})` : ''}`,
    intro: (n: string) => `New negative Google reviews about "${n}". A reply draft is ready:`,
    draft: 'Reply draft:',
    open: 'Open reviews',
    by: (n: string) => `Reported by ${n}, your team's AI Reviews Manager.`,
    taskTitle: (r: number, a: string, n: string) => `${r}★ review from ${a || 'a guest'} (${n}) — reply and follow up`,
    taskReason: 'Negative Google review',
  },
  tr: {
    title: (n: string, c: number) => `Olumsuz yorum · ${n}${c > 1 ? ` (${c})` : ''}`,
    intro: (n: string) => `"${n}" hakkında Google'da yeni olumsuz yorumlar var. Yanıt taslağı hazır:`,
    draft: 'Yanıt taslağı:',
    open: 'Yorumları aç',
    by: (n: string) => `Bildiren: ${n}, ekibinizin YZ yorum yöneticisi.`,
    taskTitle: (r: number, a: string, n: string) => `${a || 'Misafir'} ${r}★ yorumu (${n}) — yanıtla ve ilgilen`,
    taskReason: 'Olumsuz Google yorumu',
  },
};
