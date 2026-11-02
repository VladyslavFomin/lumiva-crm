import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, In, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Lead } from '../leads/lead.entity';
import { LeadActivity } from '../leads/lead-activity.entity';
import { Tenant } from '../tenants/tenant.entity';
import { Project } from '../projects/project.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { Reservation } from '../bookings/reservation.entity';
import { excludeTrashedLeads } from '../leads/lead-relations.util';
import { RbacService } from '../rbac/rbac.service';
import { MediaService } from '../media/media.service';
import {
  AuraDataService,
  buildPeriod,
  type AuraScope,
  type AuraWidgetResult,
} from '../aura/aura-data.service';
import { AURA_WIDGET_BY_KEY, type AuraPeriod } from '../aura/aura-catalog';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';

/**
 * Главная v3 (Claude Design home-aura-v3): одним запросом — KPI, цифры профиля, помесячная
 * «Динамика», таймлайн, живая лента, кто онлайн, медиа-папки, заметки.
 * Цифры по разделам CRM считает движок Aura (те же права, «Видимость данных», курсы валют и
 * компоненты тарифа, что на дашбордах Aura); отзывы, медиа и задачи — здесь, с теми же
 * правилами доступа, что у их модулей.
 */

export type DashMetric =
  | { value: number | null; format: 'int' | 'money' | 'pct' | 'num'; unit?: string; delta: { kind: 'pct' | 'pp'; value: number } | null; good: boolean | null }
  | { error: 'denied' | 'locked' | 'failed' | 'amounts_hidden' };

export type DashSeries =
  | { format: 'int' | 'money' | 'pct' | 'num'; labels: string[]; current: number[]; previous: number[] }
  | { error: 'denied' | 'locked' | 'failed' | 'amounts_hidden' };

export type DashTimelineItem = {
  id: string;
  kind: 'meeting' | 'booking' | 'task';
  title: string;
  sub: string | null;
  at: string;
  end: string | null;
  who: string | null;
  link: string;
  overdue?: boolean;
  priority?: string | null;
};

export type DashFeedItem = {
  id: string;
  kind: 'lead' | 'sale' | 'booking' | 'call' | 'activity' | 'media' | 'review';
  at: string;
  title: string | null;
  sub: string | null;
  status: string | null;
  value: number | null;
  format: 'money' | 'num' | null;
  link: string;
};

export type DashOverview = {
  currency: string;
  generatedAt: string;
  me: {
    name: string | null;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
    role: string;
    position: string | null;
    company: string | null;
    since: string;
  };
  online: Array<{ userId: string; name: string; avatarUrl: string | null; me: boolean }>;
  kpiPeriod: AuraPeriod;
  /** Показатели и ряды, которые пользователь может выбрать (права + компоненты тарифа). */
  available: string[];
  kpis: Record<string, DashMetric>;
  stats: Record<string, DashMetric>;
  series: Record<string, DashSeries>;
  timeline: { today: DashTimelineItem[]; past: DashTimelineItem[]; tasks: DashTimelineItem[] };
  feed: DashFeedItem[];
  folders: null | {
    total: number;
    items: Array<{ id: string; name: string; hotel: string | null; files: number; downloads: number; lastAt: string | null; shareUrl: string | null }>;
  };
  notes: { text: string; updatedAt: string | null };
};

/** KPI главной, которых нет в Aura (отзывы, медиа, задачи). Ключи Aura (*_kpi, deals_rev …) идут как есть. */
export const DASH_EXTRA_KPIS = ['rv_avg', 'rv_new', 'rv_noreply', 'md_views', 'md_downloads', 'md_leads', 'tasks_open', 'tasks_overdue'] as const;
/** Ряды «Динамики» вне Aura. */
export const DASH_EXTRA_SERIES = ['rv_line', 'md_line'] as const;
const AURA_KPI_TYPES = new Set(['kpi']);
const AURA_SERIES_TYPES = new Set(['line']);
const PERIODS: AuraPeriod[] = ['today', '7d', '30d'];
const DONE_TASK = new Set(['готово', 'done', 'completed', 'завершена', 'выполнена']);
const DAY = 86_400_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Ctx = {
  user: CurrentUserPayload;
  userId: string;
  tenantId: string;
  scope: AuraScope;
  tz: string;
  perm: (key: 'projects' | 'media' | 'hotels') => Promise<boolean>;
  hotelAcc: () => Promise<string[] | null>;
};

@Injectable()
export class DashboardOverviewService {
  private readonly log = new Logger(DashboardOverviewService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(LeadActivity) private readonly activities: Repository<LeadActivity>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(StaffUser) private readonly staffUsers: Repository<StaffUser>,
    @InjectRepository(Reservation) private readonly reservations: Repository<Reservation>,
    private readonly aura: AuraDataService,
    private readonly rbac: RbacService,
    private readonly media: MediaService,
    private readonly db: DataSource,
  ) {}

  static userIdOf(u: CurrentUserPayload): string {
    return String(u.userId || u.id || u.sub || '');
  }

  async overview(
    u: CurrentUserPayload,
    q: { currency?: string; tz?: string; kpis?: string; stats?: string; series?: string; period?: string },
  ): Promise<DashOverview> {
    const tenantId = u.tenantId;
    const userId = DashboardOverviewService.userIdOf(u);
    const user = await this.users.findOne({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    const scope = await this.aura.buildScope(tenantId, { userId, role: u.role, email: u.email, staffUserId: u.staffUserId ?? null });
    const tz = safeTz(q.tz || user.timezone || undefined);
    const permCache = new Map<string, Promise<boolean>>();
    let accP: Promise<string[] | null> | null = null;
    const ctx: Ctx = {
      user: u,
      userId,
      tenantId,
      scope,
      tz,
      perm: (key) => {
        if (!permCache.has(key)) {
          const comp = key === 'hotels' ? 'hotels_reviews' : key;
          permCache.set(
            key,
            scope.lockedComponents.has(comp) || scope.lockedComponents.has(key)
              ? Promise.resolve(false)
              : this.rbac.canUserAccess(tenantId, u.role, scope.staff?.id ?? null, key).catch(() => false),
          );
        }
        return permCache.get(key)!;
      },
      hotelAcc: () => (accP ||= this.media.allowedHotels(tenantId, userId, u.role)),
    };

    const period: AuraPeriod = (PERIODS as string[]).includes(String(q.period)) ? (q.period as AuraPeriod) : '30d';
    const kpiKeys = parseKeys(q.kpis, 8);
    const statKeys = parseKeys(q.stats, 6);
    const seriesKeys = parseKeys(q.series, 6);

    const [available, kpiRes, statRes, seriesRes, timeline, feed, online, folders, tenant] = await Promise.all([
      this.available(ctx),
      this.metrics(ctx, kpiKeys, period, q.currency),
      this.metrics(ctx, statKeys, 'today', q.currency),
      this.seriesFor(ctx, seriesKeys, q.currency),
      this.timeline(ctx).catch((e) => this.fail('timeline', e, { today: [], past: [], tasks: [] })),
      this.feed(ctx).catch((e) => this.fail('feed', e, [] as DashFeedItem[])),
      this.online(tenantId, userId).catch((e) => this.fail('online', e, [] as DashOverview['online'])),
      this.folders(ctx).catch((e) => this.fail('folders', e, null)),
      this.tenants.findOne({ where: { id: tenantId }, select: ['id', 'name', 'primaryCurrency'] }),
    ]);

    const prefs = (user.preferences || {}) as Record<string, any>;
    const notes = prefs.dashboardNotes && typeof prefs.dashboardNotes === 'object' ? prefs.dashboardNotes : {};
    return {
      currency: kpiRes.currency || statRes.currency || seriesRes.currency || (tenant?.primaryCurrency || 'EUR').toUpperCase(),
      generatedAt: new Date().toISOString(),
      me: {
        name: user.name?.trim() || scope.staff?.fullName?.trim() || null,
        email: user.email,
        phone: user.phone?.trim() || scope.staff?.phone?.trim() || null,
        avatarUrl: user.avatarUrl?.trim() || scope.staff?.avatarUrl?.trim() || null,
        role: user.role,
        position: scope.staff?.department?.trim() || null,
        company: tenant?.name?.trim() || null,
        since: user.createdAt.toISOString(),
      },
      online,
      kpiPeriod: period,
      available,
      kpis: kpiRes.items,
      stats: statRes.items,
      series: seriesRes.items,
      timeline,
      feed,
      folders,
      notes: { text: typeof notes.text === 'string' ? notes.text : '', updatedAt: typeof notes.updatedAt === 'string' ? notes.updatedAt : null },
    };
  }

  async saveNotes(tenantId: string, userId: string, text: unknown) {
    const user = await this.users.findOne({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    const updatedAt = new Date().toISOString();
    user.preferences = { ...(user.preferences || {}), dashboardNotes: { text: String(text ?? '').slice(0, 5000), updatedAt } };
    await this.users.save(user);
    return { ok: true as const, updatedAt };
  }

  private fail<T>(what: string, e: unknown, fallback: T): T {
    this.log.warn(`dashboard overview ${what} failed: ${(e as Error)?.message}`);
    return fallback;
  }

  private async available(ctx: Ctx): Promise<string[]> {
    const out: string[] = [];
    for (const [key, def] of AURA_WIDGET_BY_KEY) {
      if (!AURA_KPI_TYPES.has(def.type) && !AURA_SERIES_TYPES.has(def.type)) continue;
      if (def.source !== 'extra' && ctx.scope.lockedSources.has(def.source)) continue;
      if (def.needs.some((n) => !ctx.scope.can.has(n))) continue;
      out.push(key);
    }
    const [hotels, media, projects] = await Promise.all([ctx.perm('hotels'), ctx.perm('media'), ctx.perm('projects')]);
    if (hotels) out.push('rv_avg', 'rv_new', 'rv_noreply', 'rv_line');
    if (media) out.push('md_views', 'md_downloads', 'md_leads', 'md_line');
    if (projects) out.push('tasks_open', 'tasks_overdue');
    return out;
  }

  /* ───────────── KPI / цифры профиля ───────────── */

  private async metrics(ctx: Ctx, keys: string[], period: AuraPeriod, currency?: string) {
    const items: Record<string, DashMetric> = {};
    const auraKeys = keys.filter((k) => AURA_KPI_TYPES.has(AURA_WIDGET_BY_KEY.get(k)?.type || ''));
    let cur = '';
    if (auraKeys.length) {
      const res = await this.aura.compute(ctx.scope, { widgets: auraKeys, period, tz: ctx.tz, currency }).catch((e) => this.fail('aura kpi', e, null));
      cur = res?.currency || '';
      for (const k of auraKeys) items[k] = toMetric(res?.widgets[k]);
    }
    const P = buildPeriod(period, ctx.tz);
    await Promise.all(
      keys
        .filter((k) => (DASH_EXTRA_KPIS as readonly string[]).includes(k))
        .map(async (k) => {
          items[k] = await this.extraKpi(ctx, k, P).catch((e) => this.fail(`kpi ${k}`, e, { error: 'failed' as const }));
        }),
    );
    return { items, currency: cur };
  }

  private async extraKpi(ctx: Ctx, key: string, P: ReturnType<typeof buildPeriod>): Promise<DashMetric> {
    const range = [new Date(P.start), new Date(P.end), new Date(P.prevStart), new Date(P.prevEnd)];
    if (key.startsWith('rv_')) {
      if (!(await ctx.perm('hotels'))) return { error: 'denied' };
      const acc = await ctx.hotelAcc();
      const params: unknown[] = [ctx.tenantId, ...range];
      let hotelSql = '';
      if (acc) {
        params.push(acc);
        hotelSql = ` AND "hotelId" = ANY($${params.length}::uuid[])`;
      }
      const base = `FROM hotel_reviews WHERE "tenantId" = $1 AND "deletedAt" IS NULL AND status = 'active' AND "duplicateOfId" IS NULL${hotelSql}`;
      const [r] = (await this.db.query(
        `SELECT count(*) FILTER (WHERE "publishedAt" >= $2 AND "publishedAt" < $3)::int AS n,
                count(*) FILTER (WHERE "publishedAt" >= $4 AND "publishedAt" < $5)::int AS pn,
                avg("rating10") FILTER (WHERE "publishedAt" >= $2 AND "publishedAt" < $3)::float AS a,
                avg("rating10") FILTER (WHERE "publishedAt" >= $4 AND "publishedAt" < $5)::float AS pa,
                count(*) FILTER (WHERE NOT "hasReply" AND "publishedAt" >= $2 AND "publishedAt" < $3)::int AS nr,
                count(*) FILTER (WHERE NOT "hasReply" AND "publishedAt" >= $4 AND "publishedAt" < $5)::int AS pnr
           ${base}`,
        params,
      )) as Array<{ n: number; pn: number; a: number | null; pa: number | null; nr: number; pnr: number }>;
      if (key === 'rv_new') return metric(r.n, r.pn, 'int', 'up');
      if (key === 'rv_noreply') return metric(r.nr, r.pnr, 'int', 'down');
      // средняя оценка по шкале 10, как в модуле отзывов; без отзывов за период — прочерк
      const a = r.a == null ? null : Math.round(r.a * 100) / 100;
      const pa = r.pa == null ? null : Math.round(r.pa * 100) / 100;
      return {
        value: a,
        format: 'num',
        unit: '/10',
        delta: a != null && pa ? { kind: 'pct', value: Math.round(((a - pa) / pa) * 1000) / 10 } : null,
        good: a != null && pa != null && a !== pa ? a > pa : null,
      };
    }
    if (key.startsWith('md_')) {
      const ids = await this.mediaLinkIds(ctx);
      if (!ids) return { error: 'denied' };
      if (!ids.length) return metric(0, 0, 'int', 'up');
      const [r] = (await this.db.query(
        `SELECT count(*) FILTER (WHERE type = 'view' AND "createdAt" >= $2 AND "createdAt" < $3)::int AS v,
                count(*) FILTER (WHERE type = 'view' AND "createdAt" >= $4 AND "createdAt" < $5)::int AS pv,
                coalesce(sum("filesCount") FILTER (WHERE type = 'download' AND "createdAt" >= $2 AND "createdAt" < $3), 0)::int AS d,
                coalesce(sum("filesCount") FILTER (WHERE type = 'download' AND "createdAt" >= $4 AND "createdAt" < $5), 0)::int AS pd,
                count(*) FILTER (WHERE type = 'lead' AND "createdAt" >= $2 AND "createdAt" < $3)::int AS l,
                count(*) FILTER (WHERE type = 'lead' AND "createdAt" >= $4 AND "createdAt" < $5)::int AS pl
           FROM media_events WHERE "tenantId" = $1 AND "linkId" = ANY($6::uuid[])`,
        [ctx.tenantId, ...range, ids],
      )) as Array<Record<string, number>>;
      if (key === 'md_views') return metric(r.v, r.pv, 'int', 'up');
      if (key === 'md_downloads') return metric(r.d, r.pd, 'int', 'up');
      return metric(r.l, r.pl, 'int', 'up');
    }
    if (key.startsWith('tasks_')) {
      const tasks = await this.visibleTasks(ctx);
      if (!tasks) return { error: 'denied' };
      const now = Date.now();
      const open = tasks.filter((t) => !t.done);
      if (key === 'tasks_open') return { value: open.length, format: 'int', delta: null, good: null };
      return { value: open.filter((t) => t.deadline != null && t.deadline < now).length, format: 'int', delta: null, good: null };
    }
    return { error: 'failed' };
  }

  /* ───────────── «Динамика»: 12 месяцев против тех же месяцев год назад ───────────── */

  private async seriesFor(ctx: Ctx, keys: string[], currency?: string) {
    const items: Record<string, DashSeries> = {};
    const auraKeys = keys.filter((k) => AURA_SERIES_TYPES.has(AURA_WIDGET_BY_KEY.get(k)?.type || ''));
    let cur = '';
    if (auraKeys.length) {
      const res = await this.aura.compute(ctx.scope, { widgets: auraKeys, period: 'year', tz: ctx.tz, currency }).catch((e) => this.fail('aura series', e, null));
      cur = res?.currency || '';
      for (const k of auraKeys) {
        const w = res?.widgets[k];
        if (!w) items[k] = { error: 'failed' };
        else if ('error' in w) items[k] = { error: w.error };
        else if (w.type === 'line') items[k] = { format: w.format, labels: res!.period.labels, current: w.current, previous: w.previous };
        else items[k] = { error: 'failed' };
      }
    }
    const P = buildPeriod('year', ctx.tz);
    const labels = P.labels;
    const bucketize = (rows: Array<{ t: Date | string; n: number }>) => {
      const cur = new Array(P.buckets.length).fill(0);
      const prev = new Array(P.buckets.length).fill(0);
      for (const r of rows) {
        const t = new Date(r.t).getTime();
        const i = P.buckets.findIndex((b) => t >= b.s && t < b.e);
        if (i >= 0) cur[i] += Number(r.n) || 0;
        const j = P.prevBuckets.findIndex((b) => t >= b.s && t < b.e);
        if (j >= 0) prev[j] += Number(r.n) || 0;
      }
      return { cur, prev };
    };
    const from = new Date(P.prevBuckets[0].s);
    if (keys.includes('rv_line')) {
      if (!(await ctx.perm('hotels'))) items.rv_line = { error: 'denied' };
      else {
        const acc = await ctx.hotelAcc();
        const params: unknown[] = [ctx.tenantId, from];
        let hotelSql = '';
        if (acc) {
          params.push(acc);
          hotelSql = ` AND "hotelId" = ANY($3::uuid[])`;
        }
        const rows = (await this.db.query(
          `SELECT date_trunc('day', "publishedAt") AS t, count(*)::int AS n FROM hotel_reviews
            WHERE "tenantId" = $1 AND "publishedAt" >= $2 AND "deletedAt" IS NULL AND status = 'active' AND "duplicateOfId" IS NULL${hotelSql}
            GROUP BY 1`,
          params,
        )) as Array<{ t: Date; n: number }>;
        const b = bucketize(rows);
        items.rv_line = { format: 'int', labels, current: b.cur, previous: b.prev };
      }
    }
    if (keys.includes('md_line')) {
      const ids = await this.mediaLinkIds(ctx);
      if (!ids) items.md_line = { error: 'denied' };
      else {
        const rows = ids.length
          ? ((await this.db.query(
              `SELECT date_trunc('day', "createdAt") AS t, count(*)::int AS n FROM media_events
                WHERE "tenantId" = $1 AND type = 'view' AND "createdAt" >= $2 AND "linkId" = ANY($3::uuid[]) GROUP BY 1`,
              [ctx.tenantId, from, ids],
            )) as Array<{ t: Date; n: number }>)
          : [];
        const b = bucketize(rows);
        items.md_line = { format: 'int', labels, current: b.cur, previous: b.prev };
      }
    }
    return { items, currency: cur };
  }

  /* ───────────── таймлайн ───────────── */

  private async timeline(ctx: Ctx): Promise<DashOverview['timeline']> {
    const P = buildPeriod('today', ctx.tz);
    const dayStart = P.start;
    const dayEnd = dayStart + DAY;
    const pastFrom = dayStart - 7 * DAY;
    const now = Date.now();
    const meetings: DashTimelineItem[] = [];

    if (ctx.scope.can.has('leads')) {
      const raw = await this.leads
        .createQueryBuilder('l')
        .where('l.tenantId = :tenantId', { tenantId: ctx.tenantId })
        .andWhere("l.meta -> 'meetings' IS NOT NULL")
        .getMany();
      const visible = excludeTrashedLeads(raw).filter((l) => !ctx.scope.leadFilter || ctx.scope.leadFilter(l));
      for (const l of visible) {
        const list = (l.meta as { meetings?: unknown[] } | null)?.meetings;
        if (!Array.isArray(list)) continue;
        for (const m of list as Array<Record<string, any>>) {
          if (!m || typeof m.startsAt !== 'string') continue;
          const t = new Date(m.startsAt).getTime();
          if (Number.isNaN(t) || t < pastFrom || t >= dayEnd) continue;
          meetings.push({
            id: `lm:${l.id}:${m.id}`,
            kind: 'meeting',
            title: String(m.title || '').trim() || (l.name || '').trim() || '—',
            sub: (l.name || '').trim() || null,
            at: new Date(t).toISOString(),
            end: m.endsAt ? new Date(m.endsAt).toISOString() : null,
            who: l.assignedTo?.trim() || null,
            link: `/leads/${l.id}`,
          });
        }
      }
    }

    const projects = await this.visibleProjects(ctx);
    for (const p of projects || []) {
      for (const m of (p.meetings || []) as Array<Record<string, any>>) {
        if (!m || typeof m.startsAt !== 'string') continue;
        const t = new Date(m.startsAt).getTime();
        if (Number.isNaN(t) || t < pastFrom || t >= dayEnd) continue;
        meetings.push({
          id: `pm:${p.id}:${m.id}`,
          kind: 'meeting',
          title: String(m.title || '').trim() || p.name,
          sub: p.name,
          at: new Date(t).toISOString(),
          end: m.endsAt ? new Date(m.endsAt).toISOString() : null,
          who: p.ownerName?.trim() || null,
          link: `/projects/${p.id}`,
        });
      }
    }

    if (ctx.scope.can.has('booking')) {
      const staffId = ctx.scope.staff?.id ?? null;
      const rows = await this.reservations.find({
        where: { tenantId: ctx.tenantId, startAt: Between(new Date(pastFrom), new Date(dayEnd)) },
        order: { startAt: 'ASC' },
        take: 300,
      });
      for (const r of rows) {
        if (['cancelled_by_customer', 'cancelled_by_business', 'rejected', 'draft'].includes(r.status)) continue;
        const own = !!staffId && (r.staffUserId === staffId || r.assignedUserId === staffId);
        if (ctx.scope.ownOnly && !own) continue;
        meetings.push({
          id: `bk:${r.id}`,
          kind: 'booking',
          title: ctx.scope.maskNames && !own ? '•••' : r.customerName?.trim() || '—',
          sub: null,
          at: r.startAt.toISOString(),
          end: r.endAt ? r.endAt.toISOString() : null,
          who: null,
          link: '/bookings',
        });
      }
    }

    const today = meetings
      .filter((m) => Date.parse(m.at) >= dayStart && (Date.parse(m.end || m.at) >= now || Date.parse(m.at) >= now))
      .sort((a, b) => a.at.localeCompare(b.at))
      .slice(0, 12);
    const todayIds = new Set(today.map((m) => m.id));
    const past = meetings
      .filter((m) => !todayIds.has(m.id) && Date.parse(m.at) < now)
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 8);

    const tasksAll = await this.visibleTasks(ctx, projects);
    const tasks = (tasksAll || [])
      .filter((t) => !t.done && t.deadline != null && t.deadline < dayStart + 14 * DAY)
      .sort((a, b) => (a.deadline ?? 0) - (b.deadline ?? 0))
      .slice(0, 50)
      .map<DashTimelineItem>((t) => ({
        id: `tk:${t.projectId}:${t.id}`,
        kind: 'task',
        title: t.title,
        sub: t.projectName,
        at: new Date(t.deadline!).toISOString(),
        end: null,
        who: t.assignee,
        link: `/projects/${encodeURIComponent(t.projectId)}?tab=tasks`,
        overdue: t.deadline! < now,
        priority: t.priority,
      }));

    await this.resolveWho(ctx.tenantId, [...today, ...past, ...tasks]);
    return { today, past, tasks };
  }

  /** Исполнители задач хранятся как id сотрудника (staff_users) — показываем ФИО; старые записи с именем остаются как есть. */
  private async resolveWho(tenantId: string, items: DashTimelineItem[]) {
    const ids = [...new Set(items.map((i) => i.who).filter((w): w is string => !!w && UUID_RE.test(w)))];
    if (!ids.length) return;
    const [staff, users] = await Promise.all([
      this.staffUsers.find({ where: { tenantId, id: In(ids) }, select: ['id', 'fullName', 'email'] }),
      this.users.find({ where: { tenantId, id: In(ids) }, select: ['id', 'name', 'email'] }),
    ]);
    const names = new Map<string, string>();
    for (const u of users) names.set(u.id, u.name?.trim() || u.email);
    for (const st of staff) names.set(st.id, st.fullName?.trim() || st.email);
    for (const i of items) if (i.who && UUID_RE.test(i.who)) i.who = names.get(i.who) ?? null;
  }

  /** Проекты, которые видит пользователь: владелец компании — все; иначе — где он ответственный или наблюдатель
   * (как ProjectTableAccessGuard для основной таблицы); null — нет права на проекты. */
  private async visibleProjects(ctx: Ctx): Promise<Project[] | null> {
    if (!(await ctx.perm('projects'))) return null;
    const list = await this.projects.find({ where: { tenantId: ctx.tenantId, isDeleted: false, isArchived: false } });
    if ((ctx.user.role || '').toLowerCase() === 'owner') return list;
    const staff = ctx.scope.staff;
    if (!staff) return [];
    const name = staff.fullName?.trim();
    return list.filter(
      (p) =>
        p.ownerUserId === staff.id ||
        (p.ownerUserIds || []).includes(staff.id) ||
        (!!name && p.ownerName?.trim() === name) ||
        (p.accessMembers || []).some((m) => m?.staffUserId === staff.id),
    );
  }

  /** Задачи: владельцу компании — все из видимых проектов, остальным — где он в исполнителях. */
  private async visibleTasks(ctx: Ctx, projectsIn?: Project[] | null) {
    const projects = projectsIn !== undefined ? projectsIn : await this.visibleProjects(ctx);
    if (!projects) return null;
    const owner = (ctx.user.role || '').toLowerCase() === 'owner';
    const staff = ctx.scope.staff;
    const mine = new Set(
      [staff?.id, staff?.fullName, staff?.email, ctx.user.email].filter((x): x is string => !!x && !!String(x).trim()).map((x) => x.trim().toLowerCase()),
    );
    const out: Array<{ id: string; title: string; projectId: string; projectName: string; deadline: number | null; done: boolean; assignee: string | null; priority: string | null }> = [];
    for (const p of projects) {
      for (const t of (p.tasks || []) as Array<Record<string, any>>) {
        if (!t || !t.id) continue;
        const assignees: string[] = Array.isArray(t.assignees) ? t.assignees.filter((a: unknown) => typeof a === 'string') : [];
        if (!owner && !assignees.some((a) => mine.has(a.trim().toLowerCase()))) continue;
        const d = t.deadline ? new Date(t.deadline).getTime() : NaN;
        out.push({
          id: String(t.id),
          title: String(t.title || '').trim() || '—',
          projectId: p.id,
          projectName: p.name,
          deadline: Number.isNaN(d) ? null : d,
          done: t.done === true || DONE_TASK.has(String(t.status || '').trim().toLowerCase()),
          assignee: assignees[0] || null,
          priority: typeof t.priority === 'string' ? t.priority : null,
        });
      }
    }
    return out;
  }

  /* ───────────── живая лента ───────────── */

  private async feed(ctx: Ctx): Promise<DashFeedItem[]> {
    const out: DashFeedItem[] = [];
    const res = await this.aura.compute(ctx.scope, { widgets: ['stream'], period: '30d', tz: ctx.tz }).catch(() => null);
    const stream = res?.widgets.stream;
    if (stream && !('error' in stream) && stream.type === 'stream') {
      const link = { lead: '/leads', sale: '/sales', booking: '/bookings', call: '/telephony' } as const;
      stream.items.forEach((s, i) =>
        out.push({
          id: `st:${i}:${s.at}`,
          kind: s.kind,
          at: s.at,
          title: s.title,
          sub: s.sub,
          status: s.status,
          value: s.value,
          format: s.format === 'money' ? 'money' : s.value != null ? 'num' : null,
          link: link[s.kind],
        }),
      );
    }

    if (ctx.scope.can.has('leads')) {
      const acts = await this.activities
        .createQueryBuilder('a')
        .innerJoinAndSelect('a.lead', 'l')
        .where('a.tenantId = :tenantId', { tenantId: ctx.tenantId })
        .andWhere("a.type IN ('status_changed', 'assignee_changed', 'comment')")
        .orderBy('a.createdAt', 'DESC')
        .take(30)
        .getMany();
      for (const a of acts) {
        if (!a.lead || (a.lead.meta as any)?.deleted === true || (a.lead.meta as any)?.deleted === 'true') continue;
        if (ctx.scope.leadFilter && !ctx.scope.leadFilter(a.lead)) continue;
        out.push({
          id: `la:${a.id}`,
          kind: 'activity',
          at: a.createdAt.toISOString(),
          title: a.lead.name?.trim() || null,
          sub: a.type === 'comment' ? (a.comment || '').slice(0, 140) || null : a.toValue || null,
          status: a.type,
          value: null,
          format: null,
          link: `/leads/${a.leadId}`,
        });
        if (out.filter((x) => x.kind === 'activity').length >= 8) break;
      }
    }

    const linkIds = await this.mediaLinkIds(ctx);
    if (linkIds?.length) {
      const rows = (await this.db.query(
        `SELECT e.id, e.type, e."createdAt", e."filesCount", l.name AS link, v.name, v.company
           FROM media_events e
           JOIN media_links l ON l.id = e."linkId"
           LEFT JOIN media_visitors v ON v.id = e."visitorId"
          WHERE e."tenantId" = $1 AND e."linkId" = ANY($2::uuid[]) AND e.type IN ('download', 'lead')
          ORDER BY e."createdAt" DESC LIMIT 6`,
        [ctx.tenantId, linkIds],
      )) as Array<{ id: string; type: string; createdAt: Date; filesCount: number; link: string; name: string | null; company: string | null }>;
      for (const r of rows)
        out.push({
          id: `me:${r.id}`,
          kind: 'media',
          at: new Date(r.createdAt).toISOString(),
          title: r.link,
          sub: [r.name, r.company].filter(Boolean).join(' · ') || null,
          status: r.type,
          value: r.type === 'download' ? Number(r.filesCount) || null : null,
          format: r.type === 'download' ? 'num' : null,
          link: '/media',
        });
    }

    if (await ctx.perm('hotels')) {
      const acc = await ctx.hotelAcc();
      const params: unknown[] = [ctx.tenantId];
      let hotelSql = '';
      if (acc) {
        params.push(acc);
        hotelSql = ` AND r."hotelId" = ANY($2::uuid[])`;
      }
      const rows = (await this.db.query(
        `SELECT r.id, r."publishedAt", r."firstSeenAt", r.author, r.platform, r."rating10", r."hasReply", h.name AS hotel
           FROM hotel_reviews r LEFT JOIN hotels h ON h.id = r."hotelId"
          WHERE r."tenantId" = $1 AND r."deletedAt" IS NULL AND r.status = 'active'${hotelSql}
          ORDER BY r."firstSeenAt" DESC LIMIT 5`,
        params,
      )) as Array<{ id: string; publishedAt: Date | null; firstSeenAt: Date; author: string | null; platform: string; rating10: string | null; hasReply: boolean; hotel: string | null }>;
      for (const r of rows)
        out.push({
          id: `rv:${r.id}`,
          kind: 'review',
          at: new Date(r.firstSeenAt).toISOString(),
          title: r.hotel,
          sub: [r.author, r.platform].filter(Boolean).join(' · ') || null,
          status: r.hasReply ? 'replied' : 'noreply',
          value: r.rating10 == null ? null : Number(r.rating10),
          format: r.rating10 == null ? null : 'num',
          link: `/hotels/reviews?review=${r.id}`,
        });
    }

    const horizon = Date.now() + 60_000;
    return out
      .filter((x) => Date.parse(x.at) <= horizon)
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 20);
  }

  /* ───────────── онлайн, медиа ───────────── */

  /** Активная сессия за последние 5 минут (user_sessions.lastSeenAt обновляется не чаще раза в 2 минуты). */
  private async online(tenantId: string, userId: string) {
    const rows = (await this.db.query(
      `SELECT u.id, coalesce(nullif(trim(u.name), ''), u.email) AS name, u."avatarUrl"
         FROM users u
        WHERE u."tenantId" = $1 AND u.status = 'active'
          AND (u.id = $2 OR EXISTS (
            SELECT 1 FROM user_sessions s
             WHERE s."userId" = u.id AND s."tenantId" = $1 AND s."revokedAt" IS NULL AND s."lastSeenAt" > now() - interval '5 minutes'))
        LIMIT 12`,
      [tenantId, userId],
    )) as Array<{ id: string; name: string; avatarUrl: string | null }>;
    return rows
      .map((r) => ({ userId: r.id, name: r.name, avatarUrl: r.avatarUrl?.trim() || null, me: r.id === userId }))
      .sort((a, b) => Number(b.me) - Number(a.me));
  }

  /** id медиа-ссылок, которые видит пользователь; null — нет права на медиа. */
  private async mediaLinkIds(ctx: Ctx): Promise<string[] | null> {
    if (!(await ctx.perm('media'))) return null;
    const links = await this.mediaLinks(ctx);
    return links.map((l) => l.id);
  }

  private linksCache = new WeakMap<Ctx, Promise<Awaited<ReturnType<MediaService['listLinks']>>>>();
  private mediaLinks(ctx: Ctx) {
    if (!this.linksCache.has(ctx)) this.linksCache.set(ctx, ctx.hotelAcc().then((acc) => this.media.listLinks(ctx.tenantId, acc)));
    return this.linksCache.get(ctx)!;
  }

  private async folders(ctx: Ctx): Promise<DashOverview['folders']> {
    if (!(await ctx.perm('media'))) return null;
    const acc = await ctx.hotelAcc();
    const rows = (await this.db.query(
      `WITH RECURSIVE t AS (
         SELECT id, id AS root FROM media_folders WHERE "tenantId" = $1 AND "parentId" IS NULL
         UNION ALL
         SELECT f.id, t.root FROM media_folders f JOIN t ON f."parentId" = t.id WHERE f."tenantId" = $1
       )
       SELECT r.id, r.name, r."hotelId", h.name AS hotel, count(mf.id)::int AS files,
              coalesce(sum(mf.downloads), 0)::int AS downloads,
              greatest(max(mf."createdAt"), max(mf."lastDownloadAt"), r."updatedAt") AS "lastAt"
         FROM media_folders r
         JOIN t ON t.root = r.id
         LEFT JOIN media_files mf ON mf."folderId" = t.id
         LEFT JOIN hotels h ON h.id = r."hotelId"
        WHERE r."tenantId" = $1 AND r."parentId" IS NULL
        GROUP BY r.id, h.name`,
      [ctx.tenantId],
    )) as Array<{ id: string; name: string; hotelId: string | null; hotel: string | null; files: number; downloads: number; lastAt: Date | null }>;
    const visible = rows.filter((r) => !acc || !r.hotelId || acc.includes(r.hotelId));
    const links = (await this.mediaLinks(ctx)).filter((l) => l.enabled && !l.expired);
    const items = visible
      .sort((a, b) => (b.lastAt ? new Date(b.lastAt).getTime() : 0) - (a.lastAt ? new Date(a.lastAt).getTime() : 0))
      .slice(0, 4)
      .map((r) => ({
        id: r.id,
        name: r.name,
        hotel: r.hotel,
        files: Number(r.files) || 0,
        downloads: Number(r.downloads) || 0,
        lastAt: r.lastAt ? new Date(r.lastAt).toISOString() : null,
        shareUrl: links.find((l) => l.folderIds.includes(r.id))?.url ?? null,
      }));
    return { total: visible.length, items };
  }
}

function safeTz(tz?: string): string {
  if (!tz) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

function parseKeys(raw: string | undefined, max: number): string[] {
  const ok = (k: string) => AURA_WIDGET_BY_KEY.has(k) || (DASH_EXTRA_KPIS as readonly string[]).includes(k) || (DASH_EXTRA_SERIES as readonly string[]).includes(k);
  return [...new Set(String(raw || '').split(',').map((s) => s.trim()).filter(ok))].slice(0, max);
}

function toMetric(w: AuraWidgetResult | undefined): DashMetric {
  if (!w) return { error: 'failed' };
  if ('error' in w) return { error: w.error };
  if (w.type !== 'kpi') return { error: 'failed' };
  return { value: w.value, format: w.format, delta: w.delta, good: w.good };
}

function metric(cur: number, prev: number, format: 'int' | 'num', mode: 'up' | 'down'): DashMetric {
  const c = Number(cur) || 0;
  const p = Number(prev) || 0;
  const delta = p ? { kind: 'pct' as const, value: Math.round(((c - p) / p) * 1000) / 10 } : null;
  const good = !delta || delta.value === 0 ? null : mode === 'up' ? delta.value > 0 : delta.value < 0;
  return { value: c, format, delta, good };
}
