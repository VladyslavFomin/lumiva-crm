import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Not, Repository } from 'typeorm';
import { SeoAiAgent } from './seo-ai-agent.entity';
import { SeoAiReport } from './seo-ai-report.entity';
import { Tenant } from '../tenants/tenant.entity';
import { User } from '../users/user.entity';
import { AiAgent } from '../ai-employees/ai-agent.entity';
import {
  getAiEmployeeLimitForPlan,
  getAiEmployeeRole,
  planAllowsAiEmployeeRole,
} from '../ai-employees/ai-employee-role-catalog';
import { MarketingService } from '../marketing/marketing.service';
import { AiOpenAiService } from '../ai/ai-openai.service';
import { AiAssistantService } from '../ai/ai-assistant.service';
import { AiQuotaService } from '../ai/ai-quota.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { MailService } from '../mail/mail.service';
import { EmailService } from '../email/email.service';
import { SeoAiSignalsService } from './seo-ai-signals.service';
import { escapeMailHtml, renderMailShell } from '../mail/mail-template.util';
import {
  SeoPageAudit,
  auditPage,
  auditSite,
  markDuplicates,
  normalizeSiteUrl,
  technicalScore,
} from './seo-crawler';

type Lang = 'ru' | 'en' | 'tr';
const LANGS: Lang[] = ['ru', 'en', 'tr'];
const MAX_PAGES = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type GscRow = { key: string; clicks: number; impressions: number; ctr: number; position: number };
type Totals = { clicks: number; impressions: number; ctr: number; position: number };

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const bareHost = (u: string | null | undefined) =>
  (u || '')
    .replace(/^sc-domain:/, '')
    .replace(/^https?:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/^www\./, '')
    .toLowerCase();
const r2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class SeoAiService {
  private readonly log = new Logger(SeoAiService.name);

  constructor(
    @InjectRepository(SeoAiAgent) private readonly agents: Repository<SeoAiAgent>,
    @InjectRepository(SeoAiReport) private readonly reports: Repository<SeoAiReport>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AiAgent) private readonly aiAgents: Repository<AiAgent>,
    private readonly marketing: MarketingService,
    private readonly openai: AiOpenAiService,
    private readonly assistant: AiAssistantService,
    private readonly quota: AiQuotaService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly mail: MailService,
    private readonly email: EmailService,
    private readonly signals: SeoAiSignalsService,
  ) {}

  // ---------------------------------------------------------------- доступ

  /**
   * ИИ-SEO работает только при активном ИИ-сотруднике «SEO-менеджер» (роль seo_manager) — он
   * занимает слот из лимита ИИ-сотрудников тарифа. Для экрана-заглушки отдаём, можно ли его нанять.
   */
  async getAccess(tenantId: string) {
    const employees = await this.aiAgents.find({ where: { tenantId, role: 'seo_manager' as any }, order: { createdAt: 'ASC' } });
    const active = employees.find((a) => a.status === 'active') || null;
    const employee = active || employees.find((a) => a.status !== 'disabled') || employees[0] || null;
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    const role = getAiEmployeeRole('seo_manager')!;
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
      // включить отключённого (disabled) сотрудника тоже нужен свободный слот; paused/setup_required слот уже занимают
      canHire: planAllowed && (limit == null || used < limit),
    };
  }

  async assertAccess(tenantId: string) {
    const access = await this.getAccess(tenantId);
    if (!access.allowed) {
      throw new ForbiddenException({ code: 'SEO_AI_NO_EMPLOYEE', message: 'Hire and activate the AI SEO Manager to use AI SEO' });
    }
    return access;
  }

  // ---------------------------------------------------------------- настройки

  /**
   * Сайт, с которым работает запрос: явно переданный (ресурс, выбранный на странице SEO),
   * иначе текущий ресурс из настроек SEO. У каждого сайта свой ассистент и своя история отчётов.
   */
  async resolveSite(tenantId: string, site?: string | null): Promise<{ url: string; host: string } | null> {
    let url = normalizeSiteUrl(site);
    if (!url) {
      const seo = await this.marketing.getOrCreateSeoSettings(tenantId);
      url = normalizeSiteUrl(seo.gscPropertyUrl || seo.pageSpeedUrl);
    }
    return url ? { url, host: bareHost(url) } : null;
  }

  async getOrCreateAgent(tenantId: string, userId: string | null | undefined, site?: string | null): Promise<SeoAiAgent> {
    const target = await this.resolveSite(tenantId, site);
    if (!target) throw new BadRequestException({ code: 'SEO_AI_NO_SITE', message: 'Choose a site on the SEO page first' });
    let row = await this.agents.findOne({ where: { tenantId, siteHost: target.host } });
    if (row) return row;
    // новый сайт наследует получателей/расписание/язык у уже настроенного ассистента тенанта
    const sibling = await this.agents.findOne({ where: { tenantId }, order: { updatedAt: 'DESC' } });
    const [tenant, user] = await Promise.all([
      this.tenants.findOne({ where: { id: tenantId } }),
      userId ? this.users.findOne({ where: { id: userId, tenantId } }) : Promise.resolve(null),
    ]);
    const lang = String(tenant?.uiLanguage || 'ru').slice(0, 2) as Lang;
    const email = user?.email || tenant?.ownerEmail || null;
    row = this.agents.create({
      tenantId,
      siteHost: target.host,
      siteUrl: target.url,
      enabled: false,
      recipients: sibling?.recipients?.length ? sibling.recipients : email ? [email] : [],
      weekday: sibling?.weekday ?? 1,
      hour: sibling?.hour ?? 9,
      timezone: sibling?.timezone || (user as any)?.timezone || 'Europe/Istanbul',
      language: sibling?.language || (LANGS.includes(lang) ? lang : 'ru'),
    });
    return this.agents.save(row);
  }

  async getAgentPublic(tenantId: string, userId: string | null, site?: string | null) {
    const row = await this.getOrCreateAgent(tenantId, userId, site);
    return this.toPublic(row);
  }

  private toPublic(row: SeoAiAgent) {
    return {
      enabled: row.enabled,
      siteUrl: row.siteUrl,
      pages: row.pages || [],
      keywords: row.keywords || [],
      recipients: row.recipients || [],
      weekday: row.weekday,
      hour: row.hour,
      timezone: row.timezone,
      language: row.language,
      focus: row.focus,
      tasksEnabled: row.tasksEnabled,
      taskProjectId: row.taskProjectId,
      taskAssigneeId: row.taskAssigneeId,
      alertsEnabled: row.alertsEnabled,
      activeAlerts: Object.keys(row.alertState || {}),
      lastCheckAt: row.lastCheckAt?.toISOString() ?? null,
      lastRunAt: row.lastRunAt?.toISOString() ?? null,
      nextRunAt: row.enabled ? this.nextRunAt(row)?.toISOString() ?? null : null,
    };
  }

  async patchAgent(
    tenantId: string,
    userId: string | null,
    site: string | null | undefined,
    patch: Partial<{
      enabled: boolean;
      pages: string[];
      keywords: string[];
      recipients: string[];
      weekday: number;
      hour: number;
      timezone: string;
      language: string;
      focus: string | null;
      tasksEnabled: boolean;
      taskProjectId: string | null;
      taskAssigneeId: string | null;
      alertsEnabled: boolean;
    }>,
  ) {
    // сайт ассистента не меняется — он задаётся переключателем «Ресурс» на странице SEO
    const row = await this.getOrCreateAgent(tenantId, userId, site);
    if (patch.pages !== undefined) {
      const list = (Array.isArray(patch.pages) ? patch.pages : [])
        .map((p) => normalizeSiteUrl(String(p)))
        .filter((p): p is string => !!p);
      row.pages = [...new Set(list)].slice(0, 10);
    }
    if (patch.keywords !== undefined) {
      const list = (Array.isArray(patch.keywords) ? patch.keywords : [])
        .map((k) => String(k).replace(/\s+/g, ' ').trim().slice(0, 80))
        .filter(Boolean);
      row.keywords = [...new Set(list.map((k) => k.toLowerCase()))].slice(0, 20);
    }
    if (patch.recipients !== undefined) {
      const list = (Array.isArray(patch.recipients) ? patch.recipients : [])
        .map((e) => String(e).trim().toLowerCase())
        .filter((e) => EMAIL_RE.test(e));
      row.recipients = [...new Set(list)].slice(0, 10);
    }
    if (patch.weekday !== undefined) row.weekday = Math.min(6, Math.max(0, Math.round(Number(patch.weekday) || 0)));
    if (patch.hour !== undefined) row.hour = Math.min(23, Math.max(0, Math.round(Number(patch.hour) || 0)));
    if (patch.timezone !== undefined) {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: String(patch.timezone) });
        row.timezone = String(patch.timezone);
      } catch {
        throw new BadRequestException({ code: 'SEO_AI_BAD_TZ', message: 'Invalid timezone' });
      }
    }
    if (patch.language !== undefined && LANGS.includes(patch.language as Lang)) row.language = patch.language as string;
    const uuidOrNull = (v: unknown) => (typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) ? v : null);
    if (patch.tasksEnabled !== undefined) row.tasksEnabled = !!patch.tasksEnabled;
    if (patch.alertsEnabled !== undefined) row.alertsEnabled = !!patch.alertsEnabled;
    if (patch.taskProjectId !== undefined) row.taskProjectId = uuidOrNull(patch.taskProjectId);
    if (patch.taskAssigneeId !== undefined) row.taskAssigneeId = uuidOrNull(patch.taskAssigneeId);
    if (patch.focus !== undefined) row.focus = patch.focus ? String(patch.focus).slice(0, 2000) : null;
    if (patch.enabled !== undefined) {
      if (patch.enabled && !row.recipients.length) throw new BadRequestException({ code: 'SEO_AI_NO_RECIPIENTS', message: 'Add at least one recipient' });
      row.enabled = !!patch.enabled;
    }
    await this.agents.save(row);
    return this.toPublic(row);
  }

  // ---------------------------------------------------------------- расписание

  private localParts(tz: string, at = new Date()): { weekday: number; hour: number } | null {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', hour12: false }).formatToParts(at);
      const wd = parts.find((p) => p.type === 'weekday')?.value || '';
      const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '', 10) % 24;
      const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
      return weekday < 0 || !Number.isFinite(hour) ? null : { weekday, hour };
    } catch {
      return null;
    }
  }

  /** Ближайший час, когда в часовом поясе ассистента наступят его день недели и час (шаг — час). */
  private nextRunAt(row: SeoAiAgent): Date | null {
    const start = Math.ceil(Date.now() / 36e5) * 36e5;
    for (let i = 0; i < 24 * 8; i++) {
      const at = new Date(start + i * 36e5);
      const p = this.localParts(row.timezone, at);
      if (p && p.weekday === row.weekday && p.hour === row.hour) return at;
    }
    return null;
  }

  isDue(row: SeoAiAgent, now = new Date()): boolean {
    if (!row.enabled || !row.siteUrl || !row.recipients?.length) return false;
    const p = this.localParts(row.timezone, now);
    if (!p || p.weekday !== row.weekday || p.hour !== row.hour) return false;
    // не чаще раза в ~неделю, даже если час совпал повторно (перезапуск, смена настроек)
    return !row.lastRunAt || now.getTime() - row.lastRunAt.getTime() > 6 * 864e5;
  }

  async listDueAgents(): Promise<SeoAiAgent[]> {
    const rows = await this.agents.find({ where: { enabled: true } });
    const due = rows.filter((r) => this.isDue(r));
    if (!due.length) return [];
    const active = await this.tenants.find({ where: { id: In(due.map((r) => r.tenantId)), status: 'active' } });
    const staffed = await this.aiAgents.find({
      where: { tenantId: In(due.map((r) => r.tenantId)), role: 'seo_manager' as any, status: 'active' as any },
      select: ['tenantId'],
    });
    // без активного ИИ-сотрудника «SEO-менеджер» еженедельные отчёты не идут
    const ok = new Set(active.map((t) => t.id).filter((id) => staffed.some((a) => a.tenantId === id)));
    return due.filter((r) => ok.has(r.tenantId));
  }

  /**
   * Ежедневная лёгкая проверка (без ИИ): включённые сайты тенантов с активным SEO-менеджером,
   * в час отчёта по часовому поясу сайта, не чаще раза в ~сутки.
   */
  async runDailyChecks(): Promise<void> {
    const rows = await this.agents.find({ where: { enabled: true } });
    const now = new Date();
    for (const site of rows) {
      const p = this.localParts(site.timezone, now);
      if (!p || p.hour !== site.hour || !site.siteUrl) continue;
      if (site.lastCheckAt && now.getTime() - site.lastCheckAt.getTime() < 20 * 36e5) continue;
      // в день недельного отчёта проверка идёт внутри самого отчёта
      if (p.weekday === site.weekday) continue;
      const staffed = await this.aiAgents.count({ where: { tenantId: site.tenantId, role: 'seo_manager' as any, status: 'active' as any } });
      if (!staffed) continue;
      const lang = (LANGS.includes(site.language as Lang) ? site.language : 'ru') as Lang;
      try {
        await this.signals.dailyCheck(site, lang);
      } catch (e: any) {
        this.log.warn(`SEO daily check failed for ${site.siteHost}: ${e?.message || e}`);
      }
    }
  }

  // ---------------------------------------------------------------- отчёты

  async listReports(tenantId: string, site?: string | null) {
    const target = await this.resolveSite(tenantId, site);
    if (!target) return [];
    // прогон, оборванный рестартом сервера, навсегда остался бы «в работе»
    await this.reports.update(
      { tenantId, status: 'running', createdAt: LessThan(new Date(Date.now() - 20 * 60_000)) },
      { status: 'failed', error: 'interrupted', stage: null, finishedAt: new Date() },
    );
    const rows = await this.reports.find({
      where: { tenantId, siteHost: target.host },
      order: { createdAt: 'DESC' },
      take: 30,
      select: ['id', 'siteUrl', 'trigger', 'status', 'stage', 'score', 'error', 'emailedTo', 'finishedAt', 'createdAt'],
    });
    return rows.map((r) => this.reportSummary(r));
  }

  private reportSummary(r: SeoAiReport) {
    return {
      id: r.id,
      siteUrl: r.siteUrl,
      trigger: r.trigger,
      status: r.status,
      stage: r.stage,
      score: r.score,
      error: r.error,
      emailedTo: r.emailedTo || [],
      finishedAt: r.finishedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  }

  async getReport(tenantId: string, id: string) {
    const r = await this.reports.findOne({ where: { id, tenantId } });
    if (!r) throw new NotFoundException('Report not found');
    return { ...this.reportSummary(r), facts: r.facts, report: r.report };
  }

  async deleteReport(tenantId: string, id: string) {
    const res = await this.reports.delete({ id, tenantId });
    if (!res.affected) throw new NotFoundException('Report not found');
    return { ok: true };
  }

  /** Ручной запуск: создаёт отчёт «в работе» и считает его в фоне — интерфейс опрашивает статус. */
  async startRun(tenantId: string, userId: string | null, site: string | null | undefined, opts: { email?: boolean } = {}) {
    const agent = await this.getOrCreateAgent(tenantId, userId, site);
    const running = await this.reports.findOne({ where: { tenantId, siteHost: agent.siteHost, status: 'running' }, order: { createdAt: 'DESC' } });
    if (running && Date.now() - running.createdAt.getTime() < 20 * 60_000) return this.reportSummary(running);
    const report = await this.reports.save(
      this.reports.create({ tenantId, siteUrl: agent.siteUrl!, siteHost: agent.siteHost, trigger: 'manual', status: 'running', stage: 'queued', createdByUserId: userId }),
    );
    void this.execute(report.id, agent, { email: !!opts.email }).catch((e) =>
      this.log.error(`SEO AI run ${report.id} crashed: ${e?.message || e}`),
    );
    return this.reportSummary(report);
  }

  /** Плановый запуск из шедулера — синхронно, чтобы тенанты шли по очереди, а не все разом. */
  async runScheduled(agent: SeoAiAgent): Promise<void> {
    agent.lastRunAt = new Date();
    await this.agents.save(agent);
    const report = await this.reports.save(
      this.reports.create({ tenantId: agent.tenantId, siteUrl: agent.siteUrl!, siteHost: agent.siteHost, trigger: 'schedule', status: 'running', stage: 'queued' }),
    );
    await this.execute(report.id, agent, { email: true });
  }

  private async stage(id: string, stage: string) {
    await this.reports.update({ id }, { stage });
  }

  private async execute(reportId: string, agent: SeoAiAgent, opts: { email: boolean }): Promise<void> {
    const tenantId = agent.tenantId;
    const lang = (LANGS.includes(agent.language as Lang) ? agent.language : 'ru') as Lang;
    try {
      const facts = await this.collectFacts(reportId, agent, lang);
      await this.stage(reportId, 'ai');
      const report = await this.analyze(tenantId, agent, lang, facts);
      const score = Math.min(100, Math.max(0, Math.round(Number(report.score) || facts.techScore || 0)));
      await this.reports.update(
        { id: reportId },
        { status: 'done', stage: null, score, facts: facts as any, report: report as any, finishedAt: new Date() },
      );
      // «делает сам»: задачи из рекомендаций + сигналы по сравнению с прошлым отчётом; сбой здесь
      // не должен портить уже готовый отчёт
      try {
        const saved = await this.reports.findOne({ where: { id: reportId } });
        const site = await this.agents.findOne({ where: { id: agent.id } });
        if (saved && site) {
          const tasks = await this.signals.tasksFromReport(site, saved, lang);
          const fresh = await this.agents.findOne({ where: { id: agent.id } });
          const alerts = fresh ? await this.signals.alertsFromReport(fresh, saved, lang) : [];
          if (tasks.length || alerts.length) {
            await this.reports.update({ id: reportId }, { report: { ...(saved.report || {}), tasks, alerts } as any });
          }
        }
      } catch (e: any) {
        this.log.warn(`SEO AI report ${reportId}: tasks/alerts failed: ${e?.message || e}`);
      }
      // lastRunAt ставит только плановый прогон — ручной запуск не должен сдвигать еженедельный отчёт
      if (opts.email && agent.recipients?.length) {
        await this.emailReport(tenantId, reportId, agent.recipients);
      }
    } catch (e: any) {
      const code = e?.response?.code || e?.getResponse?.()?.code;
      const msg = code === 'AI_QUOTA_EXCEEDED' || code === 'AI_NOT_CONFIGURED' ? code : String(e?.message || e).slice(0, 300);
      this.log.warn(`SEO AI report ${reportId} failed: ${msg}`);
      await this.reports.update({ id: reportId }, { status: 'failed', stage: null, error: msg, finishedAt: new Date() });
    }
  }

  // ---------------------------------------------------------------- сбор фактов

  private async collectFacts(reportId: string, agent: SeoAiAgent, lang: Lang) {
    const tenantId = agent.tenantId;
    const siteUrl = agent.siteUrl!;
    const host = bareHost(siteUrl);
    // ресурс Search Console этого сайта — не обязательно тот, что сейчас выбран на странице SEO
    const seo = await this.marketing.getOrCreateSeoSettings(tenantId);
    const gscProperty = await this.marketing.resolveGscProperty(tenantId, siteUrl);

    // Search Console отдаёт данные с задержкой ~2 дня — последние дни неполные, берём окно до «позавчера»
    const end = Date.now() - 2 * 864e5;
    const cur = { from: isoDay(end - 27 * 864e5), to: isoDay(end) };
    const prev = { from: isoDay(end - 55 * 864e5), to: isoDay(end - 28 * 864e5) };

    // ---- Search Console (прямые запросы к Google, без записи в сохранённые метрики страницы SEO)
    let gsc: Record<string, any> | null = null;
    let gscTopPages: string[] = [];
    if (gscProperty) {
      await this.stage(reportId, 'gsc');
      const [dCur, dPrev, qCur, qPrev, pCur] = await Promise.all([
        this.marketing.fetchGscBreakdown(tenantId, cur.from, cur.to, 'date', 100, gscProperty),
        this.marketing.fetchGscBreakdown(tenantId, prev.from, prev.to, 'date', 100, gscProperty),
        this.marketing.fetchGscBreakdown(tenantId, cur.from, cur.to, 'query', 500, gscProperty),
        this.marketing.fetchGscBreakdown(tenantId, prev.from, prev.to, 'query', 500, gscProperty),
        this.marketing.fetchGscBreakdown(tenantId, cur.from, cur.to, 'page', 50, gscProperty),
      ]);
      const asDaily = (rows: GscRow[] | null) => (rows || []).map((r) => ({ date: r.key, clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }));
      const daily = asDaily(dCur);
      const prevDaily = asDaily(dPrev);
      const weekTo = cur.to;
      const weekFrom = isoDay(end - 6 * 864e5);
      const pWeekFrom = isoDay(end - 13 * 864e5);
      const inRange = (d: { date: string }, a: string, b: string) => d.date >= a && d.date <= b;
      const agg = (rows: Totals[]): Totals => {
        let clicks = 0, impressions = 0, posWt = 0;
        for (const r of rows) {
          clicks += r.clicks;
          impressions += r.impressions;
          posWt += r.position * r.impressions;
        }
        return {
          clicks,
          impressions,
          ctr: impressions ? r2((clicks / impressions) * 100) : 0,
          position: impressions ? r2(posWt / impressions) : 0,
        };
      };
      const qc = qCur || [];
      const qp = qPrev || [];
      const prevByKey = new Map(qp.map((q) => [q.key.toLowerCase(), q]));
      const row = (q: GscRow) => ({ query: q.key, clicks: q.clicks, impressions: q.impressions, ctr: r2(q.ctr * 100), position: r2(q.position) });
      const find = (list: GscRow[], kw: string) =>
        list.find((q) => q.key.toLowerCase() === kw) ||
        list.filter((q) => q.key.toLowerCase().includes(kw)).sort((a, b) => b.impressions - a.impressions)[0] ||
        null;

      const week = agg(daily.filter((d) => inRange(d, weekFrom, weekTo)));
      const prevWeek = agg(daily.filter((d) => inRange(d, pWeekFrom, isoDay(end - 7 * 864e5))));
      const month = agg(daily);
      const prevMonth = agg(prevDaily);
      // готовые сравнения — модель не должна сама считать проценты (путает и выдумывает цифры)
      const changes: Array<Record<string, any>> = [];
      for (const [period, c, p] of [['week', week, prevWeek], ['month', month, prevMonth]] as const) {
        for (const metric of ['clicks', 'impressions', 'ctr', 'position'] as const) {
          if (!p[metric] && !c[metric]) continue;
          const diff = c[metric] - p[metric];
          changes.push({
            period,
            metric,
            current: c[metric],
            previous: p[metric],
            ...(metric === 'position'
              ? { positionsChange: r2(-diff) }
              : { changePct: p[metric] ? r2((diff / p[metric]) * 100) : null }),
            trend: Math.abs(diff) < 1e-9 ? 'flat' : (metric === 'position' ? diff < 0 : diff > 0) ? 'improved' : 'worsened',
          });
        }
      }
      gsc = {
        property: gscProperty,
        periods: { week: { from: weekFrom, to: weekTo }, month: cur, prevMonth: prev },
        week,
        prevWeek,
        month,
        prevMonth,
        changes,
        topQueries: [...qc].sort((a, b) => b.clicks - a.clicks).slice(0, 15).map(row),
        // позиции 4–20 с показами — самый быстрый рост: чуть подтянуть страницу, и запрос выходит в топ-3
        strikingDistance: qc
          .filter((q) => q.position >= 4 && q.position <= 20 && q.impressions >= 10)
          .sort((a, b) => b.impressions - a.impressions)
          .slice(0, 15)
          .map(row),
        lowCtr: qc
          .filter((q) => q.position <= 6 && q.impressions >= 50 && q.ctr < 0.03)
          .sort((a, b) => b.impressions - a.impressions)
          .slice(0, 10)
          .map(row),
        movers: qc
          .filter((q) => prevByKey.has(q.key.toLowerCase()) && q.impressions >= 20)
          .map((q) => ({ ...row(q), prevPosition: r2(prevByKey.get(q.key.toLowerCase())!.position) }))
          .map((q) => ({ ...q, change: r2(q.prevPosition - q.position) }))
          .filter((q) => Math.abs(q.change) >= 1)
          .sort((a, b) => Math.abs(b.change) * b.impressions - Math.abs(a.change) * a.impressions)
          .slice(0, 12),
        newQueries: qc
          .filter((q) => !prevByKey.has(q.key.toLowerCase()) && q.impressions >= 10)
          .sort((a, b) => b.impressions - a.impressions)
          .slice(0, 10)
          .map(row),
        topPages: (pCur || [])
          .sort((a, b) => b.clicks - a.clicks)
          .slice(0, 12)
          .map((p) => ({ page: p.key, clicks: p.clicks, impressions: p.impressions, ctr: r2(p.ctr * 100), position: r2(p.position) })),
        trackedKeywords: (agent.keywords || []).map((kw) => {
          const c = find(qc, kw);
          const p = find(qp, kw);
          return {
            keyword: kw,
            matchedQuery: c?.key ?? null,
            position: c ? r2(c.position) : null,
            prevPosition: p ? r2(p.position) : null,
            clicks: c?.clicks ?? 0,
            impressions: c?.impressions ?? 0,
          };
        }),
        breakdownAvailable: qCur !== null,
      };
      gscTopPages = (pCur || []).sort((a, b) => b.clicks - a.clicks).map((p) => p.key);
    }

    // ---- страницы
    await this.stage(reportId, 'crawl');
    const { site, sitemapUrls } = await auditSite(siteUrl);
    const sameHost = (u: string) => bareHost(u) === host;
    const queue: Array<{ url: string; source: SeoPageAudit['source'] }> = [{ url: siteUrl, source: 'home' }];
    for (const u of agent.pages || []) queue.push({ url: u, source: 'custom' });
    for (const u of gscTopPages.filter(sameHost)) queue.push({ url: u, source: 'gsc' });
    for (const u of sitemapUrls.filter(sameHost)) queue.push({ url: u, source: 'sitemap' });
    const seen = new Set<string>();
    const targets = queue.filter((q) => {
      const k = q.url.replace(/[?#].*$/, '').replace(/\/+$/, '').replace(/^https?:\/\/(www\.)?/, '').toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, MAX_PAGES);
    const pages: SeoPageAudit[] = [];
    for (let i = 0; i < targets.length; i += 3) {
      pages.push(...(await Promise.all(targets.slice(i, i + 3).map((t) => auditPage(t.url, t.source)))));
    }
    markDuplicates(pages);

    // ---- скорость
    await this.stage(reportId, 'psi');
    const [mobile, desktop] = await Promise.all([
      this.marketing.runPageSpeedFull(tenantId, siteUrl, 'mobile', lang),
      this.marketing.runPageSpeedFull(tenantId, siteUrl, 'desktop', lang),
    ]);

    return {
      siteUrl,
      host,
      generatedAt: new Date().toISOString(),
      techScore: technicalScore(site, pages),
      site,
      pages,
      gsc,
      gscNote: gsc ? null : seo.gscRefreshToken ? 'otherProperty' : 'notConnected',
      psi: { mobile: mobile?.psi ?? null, desktop: desktop?.psi ?? null, audits: mobile?.audits || desktop?.audits || [] },
    };
  }

  // ---------------------------------------------------------------- ИИ

  private async analyze(tenantId: string, agent: SeoAiAgent, lang: Lang, facts: Awaited<ReturnType<SeoAiService['collectFacts']>>) {
    const langName = { ru: 'русском', en: 'English', tr: 'Turkish (Türkçe)' }[lang];
    // для модели — компактная версия фактов (без лишних полей и с урезанным текстом страниц)
    const compact = {
      ...facts,
      pages: facts.pages.map((p) => ({
        url: p.url,
        source: p.source,
        status: p.status,
        ms: p.ms,
        error: p.error,
        title: p.title,
        titleLen: p.title?.length || 0,
        description: p.description,
        descLen: p.description?.length || 0,
        h1: p.h1,
        h2Count: p.h2Count,
        canonical: p.canonical,
        robots: p.robots,
        lang: p.lang,
        jsonLdTypes: p.jsonLdTypes,
        hreflangCount: p.hreflangCount,
        wordCount: p.wordCount,
        imagesNoAlt: `${p.imagesNoAlt}/${p.images}`,
        internalLinks: p.internalLinks,
        issues: p.issues.map((i) => i.code),
        excerpt: p.excerpt.slice(0, 300),
      })),
    };

    const prompt = `You are a senior SEO specialist working as an AI employee for the owner of the website ${facts.siteUrl}.
Every week you review the site and send the owner a concise, practical report. Below are REAL facts collected just now:
Google Search Console (clicks, impressions, CTR in %, average position — lower is better; "week" = last 7 days vs "prevWeek", "month" = last 28 days vs "prevMonth"),
PageSpeed Insights (scores 0–100, LCP/FCP/SpeedIndex in seconds, TBT in ms, plus failed Lighthouse audits), and an on-page crawl of key pages (issue codes are deterministic checks).
${agent.focus ? `\nBusiness context from the owner: """${agent.focus.slice(0, 1500)}"""\n` : ''}
FACTS (JSON):
${JSON.stringify(compact)}

Rules:
- Base every statement on the facts. Do not invent numbers, pages, competitors or backlinks you cannot see. If Search Console is missing (gsc = null), say so once and focus on on-page and speed.
- For traffic trends use ONLY gsc.changes (already computed: changePct in %, positionsChange > 0 means the average position improved). Copy the numbers exactly; never compute or guess them. Put every change with trend "improved" and |changePct| ≥ 10 or |positionsChange| ≥ 1 into wins, every such "worsened" one into risks.
- Be concrete, never generic. A recommendation like "add meta descriptions" is NOT acceptable on its own — the "how" must contain READY-TO-PASTE text: for missing/weak title, description or H1 write the proposed text for that exact page (title ≤60 chars, description 140–160 chars, in the page's own language — see its "lang" and "excerpt", and use the queries that page ranks for). Make one recommendation per important page for such fixes (home page and top Search Console pages first) instead of one vague item for "all pages".
- For speed, name the specific failed Lighthouse audits and their savings. For images without alt, say on which pages and how many.
- Prioritise by expected traffic impact: indexability problems and broken (4xx/5xx) URLs that Google still shows, striking-distance queries (positions 4–20), low-CTR queries in the top 6 (rewrite title/description), then speed and content gaps.
- keywordOpportunities: only non-brand queries that can realistically gain clicks (positions roughly 4–30 or low CTR). Do not list brand queries already in the top 3.
- pageNotes.score rates THAT page's own condition (its issues, content depth, status): a page returning 4xx/5xx or unreachable must score 0–15; do not copy the overall score to every page.
- "score" is your overall SEO health grade 0–100 for this site (the deterministic technical score is ${facts.techScore}; weigh in traffic trend and speed).
- Write ALL text values in ${langName} (ready-to-paste snippets stay in the page's own language). Keep JSON keys and enum values in English.

Respond with ONLY a JSON object, no markdown:
{
  "score": <0-100>,
  "summary": "<3-4 sentences: overall state, main trend of the week, the single most important thing to do>",
  "wins": ["<what is good or improved, with numbers>"],
  "risks": ["<what worsened or is dangerous, with numbers>"],
  "recommendations": [
    { "priority": "high|medium|low", "area": "technical|content|keywords|performance|links|ux", "title": "<short action>", "why": "<the fact that motivates it>", "how": "<concrete steps>", "page": "<url or null>", "effort": "low|medium|high" }
  ],
  "keywordOpportunities": [ { "query": "<query>", "position": <number>, "impressions": <number>, "action": "<what to do to win it>" } ],
  "contentIdeas": [ { "title": "<article/page idea>", "targetQuery": "<query>", "why": "<reason>" } ],
  "pageNotes": [ { "url": "<crawled url>", "score": <0-100>, "notes": ["<specific fix>"] } ],
  "nextWeekFocus": ["<1-3 things to do this week>"]
}
Give 6–12 recommendations, up to 8 keyword opportunities (only from real queries), 3–5 content ideas, and a pageNotes entry for every crawled page.`;

    const override = await this.assistant.resolveTenantOpenAiOverride(tenantId);
    const cfg = override ? null : await this.platformSettings.getSettings();
    // отдельная модель платформы для SEO-отчёта (pl1 → Настройки); свой ключ клиента (BYOK) использует свою модель
    const seoModel = cfg?.seoAiModel?.trim() || null;
    const model = override ? override.model || null : seoModel || cfg?.openAiModel?.trim() || null;
    const ask = (temperatureOverride: number | null) =>
      this.openai.chatCompletionWithConfig(
        {
          messages: [{ role: 'user', content: prompt }],
          temperatureOverride,
          ...(seoModel ? { modelOverride: seoModel } : {}),
          timeoutMs: 300_000,
        },
        override,
      );
    let res: Awaited<ReturnType<typeof ask>>;
    try {
      res = await ask(0.3);
    } catch (e: any) {
      // reasoning-модели (o-серия, gpt-5…) принимают только temperature по умолчанию — повторяем без неё
      if (!/temperature/i.test(String(e?.message || ''))) throw e;
      res = await ask(null);
    }
    const { message, usage } = res;
    // свой ключ (BYOK) — тенант платит провайдеру напрямую, платформенную квоту не списываем
    if (cfg) {
      const price = (seo: string | null | undefined, base: string | null | undefined, d: string) =>
        parseFloat((seoModel && seo?.trim()) || base?.trim() || d);
      const cost = this.openai.estimateCostCents(
        usage.prompt_tokens || 0,
        usage.completion_tokens || 0,
        price(cfg.seoAiPriceInputPerMtokUsd, cfg.aiPriceInputPerMtokUsd, '0.15'),
        price(cfg.seoAiPriceOutputPerMtokUsd, cfg.aiPriceOutputPerMtokUsd, '0.6'),
      );
      await this.quota.chargeCents(tenantId, cost, {
        kind: 'chat',
        model,
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
      });
    }
    const parsed = this.parseReport(String(message.content || ''));
    parsed.model = model;
    // возможности — только по реальным запросам из Search Console, с настоящими цифрами
    const known = new Map<string, any>();
    const g = facts.gsc as any;
    if (g) {
      for (const list of [g.topQueries, g.strikingDistance, g.lowCtr, g.movers, g.newQueries]) {
        for (const q of list || []) if (!known.has(q.query.toLowerCase())) known.set(q.query.toLowerCase(), q);
      }
    }
    parsed.keywordOpportunities = parsed.keywordOpportunities
      .map((o: any) => {
        const real = known.get(String(o.query).toLowerCase());
        return real ? { ...o, query: real.query, position: real.position, impressions: real.impressions } : null;
      })
      .filter(Boolean);
    return parsed;
  }

  private parseReport(raw: string): Record<string, any> {
    const text = raw.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '');
    const a = text.indexOf('{');
    const b = text.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('ai_parse_failed');
    const j = JSON.parse(text.slice(a, b + 1));
    const str = (v: any, n = 600) => (v == null ? '' : String(v).slice(0, n));
    const arr = (v: any) => (Array.isArray(v) ? v : []);
    const pick = <T extends string>(v: any, allowed: T[], d: T): T => (allowed.includes(v) ? v : d);
    return {
      score: Math.min(100, Math.max(0, Math.round(Number(j.score) || 0))),
      summary: str(j.summary, 1500),
      wins: arr(j.wins).map((x) => str(x, 400)).filter(Boolean).slice(0, 8),
      risks: arr(j.risks).map((x) => str(x, 400)).filter(Boolean).slice(0, 8),
      recommendations: arr(j.recommendations)
        .map((r) => ({
          priority: pick(r?.priority, ['high', 'medium', 'low'], 'medium'),
          area: pick(r?.area, ['technical', 'content', 'keywords', 'performance', 'links', 'ux'], 'technical'),
          title: str(r?.title, 200),
          why: str(r?.why),
          how: str(r?.how, 1200),
          page: r?.page && r.page !== 'null' ? str(r.page, 500) : null,
          effort: pick(r?.effort, ['low', 'medium', 'high'], 'medium'),
        }))
        .filter((r) => r.title)
        .slice(0, 15),
      keywordOpportunities: arr(j.keywordOpportunities)
        .map((k) => ({ query: str(k?.query, 200), position: Number(k?.position) || null, impressions: Number(k?.impressions) || null, action: str(k?.action) }))
        .filter((k) => k.query)
        .slice(0, 10),
      contentIdeas: arr(j.contentIdeas)
        .map((c) => ({ title: str(c?.title, 200), targetQuery: str(c?.targetQuery, 200), why: str(c?.why) }))
        .filter((c) => c.title)
        .slice(0, 8),
      pageNotes: arr(j.pageNotes)
        .map((p) => ({ url: str(p?.url, 500), score: Math.min(100, Math.max(0, Math.round(Number(p?.score) || 0))), notes: arr(p?.notes).map((x) => str(x, 400)).filter(Boolean).slice(0, 8) }))
        .filter((p) => p.url)
        .slice(0, MAX_PAGES + 2),
      nextWeekFocus: arr(j.nextWeekFocus).map((x) => str(x, 300)).filter(Boolean).slice(0, 5),
    };
  }

  // ---------------------------------------------------------------- почта

  async emailReport(tenantId: string, reportId: string, to?: string[]) {
    const r = await this.reports.findOne({ where: { id: reportId, tenantId } });
    if (!r || r.status !== 'done' || !r.report || !r.facts) throw new BadRequestException({ code: 'SEO_AI_REPORT_NOT_READY', message: 'Report is not ready' });
    // получатели и язык — у ассистента того сайта, по которому сделан отчёт
    const agent = await this.getOrCreateAgent(tenantId, null, r.siteUrl);
    const recipients = (to?.length ? to : agent.recipients || []).map((e) => e.trim().toLowerCase()).filter((e) => EMAIL_RE.test(e)).slice(0, 10);
    if (!recipients.length) throw new BadRequestException({ code: 'SEO_AI_NO_RECIPIENTS', message: 'No recipients' });
    const lang = (LANGS.includes(agent.language as Lang) ? agent.language : 'ru') as Lang;
    const { subject, html } = await this.renderEmail(tenantId, r, lang);
    for (const email of recipients) await this.mail.sendMail({ to: email, subject, html });
    const emailedTo = [...new Set([...(r.emailedTo || []), ...recipients])];
    await this.reports.update({ id: r.id }, { emailedTo });
    return { ok: true, emailedTo };
  }

  private async renderEmail(tenantId: string, r: SeoAiReport, lang: Lang): Promise<{ subject: string; html: string }> {
    const L = MAIL_I18N[lang];
    const rep = r.report as any;
    const facts = r.facts as any;
    const e = escapeMailHtml;
    const nf = (n: number, d = 0) => Number(n || 0).toLocaleString(lang === 'en' ? 'en-US' : lang === 'tr' ? 'tr-TR' : 'ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });
    const tone = (s: number) => (s >= 80 ? '#1f8a5e' : s >= 50 ? '#c08319' : '#cc2f47');
    const delta = (cur: number, prev: number, lowerBetter = false) => {
      if (!prev) return '';
      const pct = ((cur - prev) / prev) * 100;
      if (!isFinite(pct) || Math.abs(pct) < 0.5) return `<span style="color:#71717a;">±0%</span>`;
      const good = lowerBetter ? pct < 0 : pct > 0;
      return `<span style="color:${good ? '#1f8a5e' : '#cc2f47'};">${pct > 0 ? '▲' : '▼'} ${nf(Math.abs(pct), 1)}%</span>`;
    };
    const cell = 'padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;';
    const h = (t: string) => `<h3 style="margin:22px 0 8px;font-size:14px;color:#18181b;">${t}</h3>`;

    let kpis = '';
    const g = facts.gsc;
    if (g) {
      const rows: Array<[string, number, number, number, number, number, boolean]> = [
        [L.clicks, g.week.clicks, g.prevWeek.clicks, g.month.clicks, g.prevMonth.clicks, 0, false],
        [L.impressions, g.week.impressions, g.prevWeek.impressions, g.month.impressions, g.prevMonth.impressions, 0, false],
        [L.ctr, g.week.ctr, g.prevWeek.ctr, g.month.ctr, g.prevMonth.ctr, 2, false],
        [L.position, g.week.position, g.prevWeek.position, g.month.position, g.prevMonth.position, 1, true],
      ];
      kpis = `${h(L.traffic)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
<tr><td style="${cell}color:#71717a;"></td><td style="${cell}color:#71717a;">${L.week}</td><td style="${cell}color:#71717a;">${L.month}</td></tr>
${rows
  .map(
    ([n, w, pw, m, pm, d, lb]) =>
      `<tr><td style="${cell}">${n}</td><td style="${cell}"><b>${nf(w, d)}${n === L.ctr ? '%' : ''}</b> ${delta(w, pw, lb)}</td><td style="${cell}"><b>${nf(m, d)}${n === L.ctr ? '%' : ''}</b> ${delta(m, pm, lb)}</td></tr>`,
  )
  .join('')}
</table>`;
    } else {
      kpis = `<p style="margin:16px 0 0;font-size:13px;color:#71717a;">${L.noGsc}</p>`;
    }

    const psi = facts.psi?.mobile;
    const psiBlock = psi
      ? `${h(L.speed)}<p style="margin:0;font-size:13px;">${[
          [L.perf, psi.performance],
          ['SEO', psi.seo],
          [L.a11y, psi.accessibility],
          [L.bp, psi.bestPractices],
        ]
          .map(([n, v]) => `${n}: <b style="color:${tone(Number(v))};">${v}</b>`)
          .join(' · ')} · LCP ${nf(psi.lcp, 1)} s</p>`
      : '';

    const tracked = (g?.trackedKeywords || []) as any[];
    const trackedBlock = tracked.length
      ? `${h(L.tracked)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${tracked
          .map((k) => {
            const ch = k.position != null && k.prevPosition != null ? k.prevPosition - k.position : null;
            const chHtml = ch == null || Math.abs(ch) < 0.1 ? '' : `<span style="color:${ch > 0 ? '#1f8a5e' : '#cc2f47'};"> ${ch > 0 ? '▲' : '▼'}${nf(Math.abs(ch), 1)}</span>`;
            return `<tr><td style="${cell}">${e(k.keyword)}</td><td style="${cell}text-align:right;">${k.position != null ? `<b>${nf(k.position, 1)}</b>${chHtml}` : `<span style="color:#71717a;">${L.notRanking}</span>`}</td></tr>`;
          })
          .join('')}</table>`
      : '';

    const recs = ((rep.recommendations || []) as any[]).slice(0, 6);
    const prioColor: Record<string, string> = { high: '#cc2f47', medium: '#c08319', low: '#71717a' };
    const recBlock = recs.length
      ? `${h(L.recs)}${recs
          .map(
            (x) => `<div style="margin:0 0 12px;padding:12px 14px;border:1px solid #eee;border-radius:10px;">
<div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${prioColor[x.priority] || '#71717a'};margin-bottom:4px;">${e(L.prio[x.priority] || x.priority)}${x.page ? ` · <span style="color:#71717a;text-transform:none;letter-spacing:0;">${e(x.page)}</span>` : ''}</div>
<div style="font-size:14px;font-weight:600;color:#18181b;margin-bottom:4px;">${e(x.title)}</div>
${x.why ? `<div style="font-size:13px;color:#52525b;margin-bottom:4px;">${e(x.why)}</div>` : ''}
${x.how ? `<div style="font-size:13px;color:#18181b;">${e(x.how)}</div>` : ''}
</div>`,
          )
          .join('')}`
      : '';

    const list = (title: string, items: string[]) =>
      items?.length ? `${h(title)}<ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.5;">${items.map((i) => `<li style="margin:0 0 4px;">${e(i)}</li>`).join('')}</ul>` : '';

    const score = r.score ?? 0;
    const bodyHtml = `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:16px;"><div style="width:64px;height:64px;border-radius:50%;border:5px solid ${tone(score)};text-align:center;line-height:64px;font-size:24px;font-weight:700;color:${tone(score)};">${score}</div></td>
<td><div style="font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:.08em;">${L.score}</div><div style="font-size:15px;font-weight:600;color:#18181b;">${e(facts.host || r.siteUrl)}</div></td>
</tr></table>
<p style="margin:16px 0 0;font-size:14px;line-height:1.55;color:#18181b;">${e(rep.summary || '')}</p>
${kpis}${psiBlock}${trackedBlock}
${list(L.wins, rep.wins)}${list(L.risks, rep.risks)}
${recBlock}
${list(L.focus, rep.nextWeekFocus)}`;

    const frontend = (process.env.FRONTEND_URL || 'https://crm.lumiva.agency').replace(/\/$/, '');
    const href = `${frontend}/app/marketing/seo?tab=ai&report=${r.id}`;
    const author = (await this.getAccess(tenantId).catch(() => null))?.employee?.name || null;
    const headline = `${L.headline} · ${facts.host || r.siteUrl}`;
    const subject = `${L.subject}: ${facts.host || r.siteUrl} — ${score}/100`;
    // в дизайне компании (как остальные письма CRM): кнопка и пояснение — внутри содержимого
    const innerHtml = `${bodyHtml}
<p style="margin:26px 0 0;"><a href="${href}" style="display:inline-block;padding:12px 24px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;">${L.open}</a></p>
<p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#71717a;">${author ? `${e(L.by(author))} ` : ''}${L.footer}</p>`;
    try {
      const wrapped = await this.email.wrapHtmlInCompanyDesign(tenantId, { headline, innerHtml });
      if (wrapped?.htmlBody) return { subject, html: wrapped.htmlBody };
    } catch (err: any) {
      this.log.warn(`SEO AI: company mail design failed, falling back to the platform one: ${err?.message || err}`);
    }
    const html = renderMailShell({
      headline: e(headline),
      bodyHtml,
      cta: { label: L.open, href },
      footerHtml: L.footer,
    });
    return { subject, html };
  }
}

const MAIL_I18N: Record<Lang, any> = {
  ru: {
    subject: 'Еженедельный SEO-отчёт',
    headline: 'SEO-отчёт за неделю',
    score: 'Оценка SEO',
    traffic: 'Органический трафик (Google)',
    week: '7 дней',
    month: '28 дней',
    clicks: 'Клики',
    impressions: 'Показы',
    ctr: 'CTR',
    position: 'Ср. позиция',
    noGsc: 'Search Console не подключён для этого сайта — отчёт построен по разбору страниц и скорости.',
    speed: 'Скорость (мобильная версия)',
    perf: 'Производительность',
    a11y: 'Доступность',
    bp: 'Практики',
    tracked: 'Позиции по целевым запросам',
    notRanking: 'нет в выдаче',
    recs: 'Главные рекомендации',
    wins: 'Что хорошо',
    risks: 'Что требует внимания',
    focus: 'Фокус на эту неделю',
    open: 'Открыть полный отчёт',
    prio: { high: 'Высокий приоритет', medium: 'Средний приоритет', low: 'Низкий приоритет' },
    by: (n: string) => `Отчёт подготовил ${n} — ИИ SEO-менеджер вашей команды.`,
    footer: 'Изменить расписание и получателей: Маркетинг → SEO → ИИ-ассистент.',
  },
  en: {
    subject: 'Weekly SEO report',
    headline: 'Weekly SEO report',
    score: 'SEO score',
    traffic: 'Organic traffic (Google)',
    week: '7 days',
    month: '28 days',
    clicks: 'Clicks',
    impressions: 'Impressions',
    ctr: 'CTR',
    position: 'Avg. position',
    noGsc: 'Search Console is not connected for this site — the report is based on the page audit and speed.',
    speed: 'Speed (mobile)',
    perf: 'Performance',
    a11y: 'Accessibility',
    bp: 'Best practices',
    tracked: 'Target keyword positions',
    notRanking: 'not ranking',
    recs: 'Top recommendations',
    wins: 'What is going well',
    risks: 'Needs attention',
    focus: 'Focus for this week',
    open: 'Open the full report',
    prio: { high: 'High priority', medium: 'Medium priority', low: 'Low priority' },
    by: (n: string) => `Prepared by ${n}, your team's AI SEO Manager.`,
    footer: 'Change schedule and recipients: Marketing → SEO → AI assistant.',
  },
  tr: {
    subject: 'Haftalık SEO raporu',
    headline: 'Haftalık SEO raporu',
    score: 'SEO puanı',
    traffic: 'Organik trafik (Google)',
    week: '7 gün',
    month: '28 gün',
    clicks: 'Tıklamalar',
    impressions: 'Gösterimler',
    ctr: 'TO',
    position: 'Ort. konum',
    noGsc: 'Bu site için Search Console bağlı değil — rapor sayfa analizi ve hıza dayanıyor.',
    speed: 'Hız (mobil)',
    perf: 'Performans',
    a11y: 'Erişilebilirlik',
    bp: 'En iyi uygulamalar',
    tracked: 'Hedef anahtar kelime konumları',
    notRanking: 'sıralamada yok',
    recs: 'Başlıca öneriler',
    wins: 'İyi gidenler',
    risks: 'Dikkat gerektirenler',
    focus: 'Bu haftanın odağı',
    open: 'Raporun tamamını aç',
    prio: { high: 'Yüksek öncelik', medium: 'Orta öncelik', low: 'Düşük öncelik' },
    by: (n: string) => `Bu raporu ekibinizin YZ SEO yöneticisi ${n} hazırladı.`,
    footer: 'Takvim ve alıcılar: Pazarlama → SEO → YZ asistanı.',
  },
};
