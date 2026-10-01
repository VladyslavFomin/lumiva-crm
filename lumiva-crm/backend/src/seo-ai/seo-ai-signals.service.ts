import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { SeoAiAgent } from './seo-ai-agent.entity';
import { SeoAiReport } from './seo-ai-report.entity';
import { AiAgent } from '../ai-employees/ai-agent.entity';
import { AiEmployeesService } from '../ai-employees/ai-employees.service';
import { Project } from '../projects/project.entity';
import { ProjectsService } from '../projects/projects.service';
import { ProjectStatusesService } from '../projects/project-statuses.service';
import { User } from '../users/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { EmailService } from '../email/email.service';
import { escapeMailHtml } from '../mail/mail-template.util';
import { auditPage, auditSite } from './seo-crawler';
import { MarketingService } from '../marketing/marketing.service';

type Lang = 'ru' | 'en' | 'tr';
type Severity = 'high' | 'medium';

/** Один обнаруженный сигнал. key — стабильный (для «не повторять 7 дней»). */
export interface SeoAlert {
  key: string;
  severity: Severity;
  code: 'site_down' | 'robots_block' | 'noindex' | 'page_broken' | 'kw_drop' | 'clicks_drop';
  url?: string;
  keyword?: string;
  from?: number | null;
  to?: number | null;
  pct?: number;
}

/** Что проверяем — одинаково для недельного отчёта и ежедневной лёгкой проверки. */
interface HealthSnapshot {
  siteUrl: string;
  home: { status: number | null; unreachable: boolean; noindex: boolean } | null;
  robotsDisallowAll: boolean;
  pages: Array<{ url: string; status: number | null; unreachable: boolean; noindex: boolean }>;
  keywords: Array<{ keyword: string; position: number | null; prevPosition: number | null }>;
  clicks: { week: number; prevWeek: number } | null;
}

const TASK_REPEAT_DAYS = 30;
const ALERT_REPEAT_DAYS = 7;
const MAX_TASKS_PER_REPORT = 5;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const pathOf = (u: string) => {
  try {
    const p = new URL(u);
    return p.pathname === '/' ? p.hostname : decodeURI(p.pathname);
  } catch {
    return u;
  }
};
const norm = (v: string) => v.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * ИИ SEO-менеджер «делает сам»: превращает рекомендации отчёта в задачи и поднимает сигналы о
 * проблемах (уведомление + письмо + срочная задача). Все задачи — это действия ИИ-сотрудника
 * (AiEmployeesService.proposeModuleAction): его права, «Помощник» → согласование, «Авто» → сразу,
 * «Режим предложений» → задач нет.
 */
@Injectable()
export class SeoAiSignalsService {
  private readonly log = new Logger(SeoAiSignalsService.name);

  constructor(
    @InjectRepository(SeoAiAgent) private readonly agents: Repository<SeoAiAgent>,
    @InjectRepository(SeoAiReport) private readonly reports: Repository<SeoAiReport>,
    @InjectRepository(AiAgent) private readonly aiAgents: Repository<AiAgent>,
    @InjectRepository(Project) private readonly projectsRepo: Repository<Project>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly employees: AiEmployeesService,
    private readonly projects: ProjectsService,
    private readonly projectStatuses: ProjectStatusesService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly email: EmailService,
    private readonly marketing: MarketingService,
  ) {}

  private async activeEmployee(tenantId: string): Promise<AiAgent | null> {
    return this.aiAgents.findOne({ where: { tenantId, role: 'seo_manager' as any, status: 'active' as any }, order: { createdAt: 'ASC' } });
  }

  // ---------------------------------------------------------------- проект для задач

  /** Проект для SEO-задач: выбранный в настройках, иначе «SEO · сайт» (создаётся один раз).
   * Публичный: сюда же ИИ-сотрудники (ai-employees) направляют SEO-задачи из своих циклов. */
  async ensureProject(site: SeoAiAgent): Promise<string | null> {
    if (site.taskProjectId) {
      const p = await this.projectsRepo.findOne({ where: { id: site.taskProjectId, tenantId: site.tenantId } });
      if (p && !(p as any).isDeleted) return p.id;
    }
    try {
      const statuses = await this.projectStatuses.findAll(site.tenantId);
      const status = (statuses.find((s) => s.value === 'Новый') || statuses[0])?.value || 'Новый';
      const proj = await this.projects.createForTenant(site.tenantId, {
        name: `SEO · ${site.siteHost}`,
        description: `Задачи ИИ SEO-менеджера по сайту ${site.siteUrl}`,
        amount: '0',
        currency: 'EUR',
        status,
      } as any);
      site.taskProjectId = proj.id;
      await this.agents.update({ id: site.id }, { taskProjectId: proj.id });
      return proj.id;
    } catch (e: any) {
      this.log.warn(`SEO AI: cannot create task project for ${site.siteHost}: ${e?.message || e}`);
      return null;
    }
  }

  private async createTask(
    site: SeoAiAgent,
    employee: AiAgent,
    t: { title: string; description: string; priority: 'urgent' | 'high' | 'medium'; dueInDays: number; reason: string },
  ) {
    const projectId = await this.ensureProject(site);
    if (!projectId) return { skipped: 'no_project' as const };
    return this.employees.proposeModuleAction(site.tenantId, employee.id, {
      actionType: 'create_task',
      title: t.title,
      reason: t.reason,
      targetType: 'project',
      targetId: projectId,
      payload: {
        projectId,
        title: t.title,
        description: t.description,
        priority: t.priority,
        dueDate: isoDay(Date.now() + t.dueInDays * 864e5),
        ...(site.taskAssigneeId ? { assignedUserId: site.taskAssigneeId } : {}),
        source: 'seo_ai',
      },
    });
  }

  // ---------------------------------------------------------------- задачи из рекомендаций

  /** После готового отчёта: high/medium рекомендации → задачи (не чаще раза в 30 дней на одну и ту же). */
  async tasksFromReport(site: SeoAiAgent, report: SeoAiReport, lang: Lang): Promise<Array<Record<string, unknown>>> {
    if (!site.tasksEnabled) return [];
    const employee = await this.activeEmployee(site.tenantId);
    if (!employee) return [];
    const recs = ((report.report as any)?.recommendations || []) as Array<Record<string, any>>;
    const L = TASK_I18N[lang];
    const frontend = (process.env.FRONTEND_URL || 'https://crm.lumiva.agency').replace(/\/$/, '');
    const link = `${frontend}/app/marketing/seo?tab=ai&report=${report.id}`;
    const log = { ...(site.taskLog || {}) };
    const out: Array<Record<string, unknown>> = [];
    for (const r of recs.filter((x) => x.priority === 'high' || x.priority === 'medium')) {
      if (out.length >= MAX_TASKS_PER_REPORT) break;
      const fp = norm(`${r.title} ${r.page || ''}`).slice(0, 200);
      const prev = log[fp];
      if (prev && Date.now() - new Date(prev).getTime() < TASK_REPEAT_DAYS * 864e5) continue;
      const title = `SEO: ${r.title}${r.page ? ` — ${pathOf(r.page)}` : ''}`.slice(0, 250);
      const description = [
        r.why ? `${L.why} ${r.why}` : '',
        r.how ? `${L.how}\n${r.how}` : '',
        r.page ? `${L.page} ${r.page}` : '',
        `${L.source} ${link}`,
      ]
        .filter(Boolean)
        .join('\n\n');
      const res = await this.createTask(site, employee, {
        title,
        description,
        priority: r.priority === 'high' ? 'high' : 'medium',
        dueInDays: r.priority === 'high' ? 3 : 7,
        reason: L.reason(site.siteHost),
      });
      if ('skipped' in res && res.skipped) {
        // «Режим предложений»/сотрудник неактивен — дальше пробовать бессмысленно
        if (res.skipped === 'suggest_mode' || res.skipped === 'inactive' || res.skipped === 'no_project') {
          out.push({ title, status: 'skipped', reason: res.skipped });
          break;
        }
        continue;
      }
      log[fp] = new Date().toISOString();
      out.push({ title, status: (res as any).status, actionId: (res as any).id, projectId: site.taskProjectId });
    }
    if (out.some((x) => x.status !== 'skipped')) await this.agents.update({ id: site.id }, { taskLog: pruneLog(log, TASK_REPEAT_DAYS * 2) });
    return out;
  }

  // ---------------------------------------------------------------- сигналы

  /** Что показывает недельный отчёт + сравнение с предыдущим отчётом того же сайта. */
  snapshotFromFacts(facts: Record<string, any>, prevFacts: Record<string, any> | null): HealthSnapshot {
    const pages = ((facts.pages || []) as any[]).map((p) => ({
      url: p.url,
      status: p.status ?? null,
      unreachable: (p.issues || []).some((i: any) => i.code === 'unreachable'),
      noindex: (p.issues || []).some((i: any) => i.code === 'noindex'),
    }));
    const home = pages.find((p) => (facts.pages || []).find((x: any) => x.url === p.url && x.source === 'home')) || null;
    const prevKw = new Map<string, number | null>(
      ((prevFacts?.gsc?.trackedKeywords || []) as any[]).map((k) => [k.keyword, k.position ?? null]),
    );
    const g = facts.gsc;
    return {
      siteUrl: facts.siteUrl,
      home: home ? { status: home.status, unreachable: home.unreachable, noindex: home.noindex } : null,
      robotsDisallowAll: !!facts.site?.robotsTxt?.disallowAll,
      pages,
      keywords: ((g?.trackedKeywords || []) as any[])
        .filter((k) => prevKw.has(k.keyword))
        .map((k) => ({ keyword: k.keyword, position: k.position ?? null, prevPosition: prevKw.get(k.keyword) ?? null })),
      clicks: g ? { week: g.week?.clicks ?? 0, prevWeek: g.prevWeek?.clicks ?? 0 } : null,
    };
  }

  /** Ежедневная лёгкая проверка без ИИ: главная, robots.txt, позиции целевых запросов и клики 7 к 7 дням. */
  async dailySnapshot(site: SeoAiAgent): Promise<HealthSnapshot> {
    const siteUrl = site.siteUrl!;
    const [{ site: s }, home] = await Promise.all([auditSite(siteUrl), auditPage(siteUrl, 'home')]);
    const snap: HealthSnapshot = {
      siteUrl,
      home: {
        status: home.status,
        unreachable: home.issues.some((i) => i.code === 'unreachable'),
        noindex: home.issues.some((i) => i.code === 'noindex'),
      },
      robotsDisallowAll: s.robotsTxt.disallowAll,
      pages: [],
      keywords: [],
      clicks: null,
    };
    const property = await this.marketing.resolveGscProperty(site.tenantId, siteUrl);
    if (property) {
      const end = Date.now() - 2 * 864e5;
      const cur = { from: isoDay(end - 6 * 864e5), to: isoDay(end) };
      const prev = { from: isoDay(end - 13 * 864e5), to: isoDay(end - 7 * 864e5) };
      const [dCur, dPrev, qCur, qPrev] = await Promise.all([
        this.marketing.fetchGscBreakdown(site.tenantId, cur.from, cur.to, 'date', 20, property),
        this.marketing.fetchGscBreakdown(site.tenantId, prev.from, prev.to, 'date', 20, property),
        site.keywords?.length ? this.marketing.fetchGscBreakdown(site.tenantId, cur.from, cur.to, 'query', 500, property) : Promise.resolve([]),
        site.keywords?.length ? this.marketing.fetchGscBreakdown(site.tenantId, prev.from, prev.to, 'query', 500, property) : Promise.resolve([]),
      ]);
      if (dCur && dPrev) {
        snap.clicks = { week: dCur.reduce((a, r) => a + r.clicks, 0), prevWeek: dPrev.reduce((a, r) => a + r.clicks, 0) };
      }
      const find = (list: Array<{ key: string; position: number; impressions: number }> | null, kw: string) =>
        (list || []).find((q) => q.key.toLowerCase() === kw) ||
        (list || []).filter((q) => q.key.toLowerCase().includes(kw)).sort((a, b) => b.impressions - a.impressions)[0] ||
        null;
      if (qCur && qPrev) {
        snap.keywords = (site.keywords || []).map((kw) => ({
          keyword: kw,
          position: find(qCur, kw)?.position ?? null,
          prevPosition: find(qPrev, kw)?.position ?? null,
        }));
      }
    }
    return snap;
  }

  detect(snap: HealthSnapshot): SeoAlert[] {
    const out: SeoAlert[] = [];
    if (snap.home && (snap.home.unreachable || (snap.home.status ?? 0) >= 500)) {
      out.push({ key: 'site_down', code: 'site_down', severity: 'high', url: snap.siteUrl });
    }
    if (snap.robotsDisallowAll) out.push({ key: 'robots_block', code: 'robots_block', severity: 'high', url: snap.siteUrl });
    if (snap.home?.noindex) out.push({ key: `noindex:${snap.siteUrl}`, code: 'noindex', severity: 'high', url: snap.siteUrl });
    for (const p of snap.pages) {
      if (p.url === snap.siteUrl) continue;
      if (p.noindex) out.push({ key: `noindex:${p.url}`, code: 'noindex', severity: 'high', url: p.url });
      else if (p.unreachable || (p.status ?? 0) >= 400) out.push({ key: `page_broken:${p.url}`, code: 'page_broken', severity: 'medium', url: p.url });
    }
    for (const k of snap.keywords) {
      if (k.prevPosition == null) continue;
      // выпал из выдачи или просел на 3+ позиции (позиция — чем меньше, тем лучше)
      if (k.position == null || k.position - k.prevPosition >= 3) {
        out.push({ key: `kw_drop:${k.keyword}`, code: 'kw_drop', severity: 'medium', keyword: k.keyword, from: round1(k.prevPosition), to: k.position == null ? null : round1(k.position) });
      }
    }
    if (snap.clicks && snap.clicks.prevWeek >= 20) {
      const pct = ((snap.clicks.week - snap.clicks.prevWeek) / snap.clicks.prevWeek) * 100;
      if (pct <= -30) out.push({ key: 'clicks_drop', code: 'clicks_drop', severity: 'medium', from: snap.clicks.prevWeek, to: snap.clicks.week, pct: Math.round(pct) });
    }
    return out;
  }

  /**
   * Новые сигналы (или те, о которых не напоминали 7+ дней): уведомление в CRM, письмо получателям,
   * срочная задача от имени сотрудника. fullCheck — снимок полный (недельный отчёт) и пропавшие
   * сигналы можно считать решёнными; в лёгкой проверке снимаем только то, что она сама проверяет.
   */
  async raise(site: SeoAiAgent, alerts: SeoAlert[], lang: Lang, opts: { fullCheck: boolean }): Promise<SeoAlert[]> {
    const state = { ...(site.alertState || {}) };
    const current = new Set(alerts.map((a) => a.key));
    for (const key of Object.keys(state)) {
      const lightCovers = /^(site_down|robots_block|clicks_drop|kw_drop:)/.test(key) || key === `noindex:${site.siteUrl}`;
      if (!current.has(key) && (opts.fullCheck || lightCovers)) delete state[key];
    }
    const fresh = alerts.filter((a) => !state[a.key] || Date.now() - new Date(state[a.key]).getTime() > ALERT_REPEAT_DAYS * 864e5);
    if (!fresh.length || !site.alertsEnabled) {
      await this.agents.update({ id: site.id }, { alertState: state });
      return [];
    }
    const employee = await this.activeEmployee(site.tenantId);
    if (!employee) return [];
    const L = ALERT_I18N[lang];
    const lines = fresh.map((a) => L.line(a));
    const frontend = (process.env.FRONTEND_URL || 'https://crm.lumiva.agency').replace(/\/$/, '');
    const link = `${frontend}/app/marketing/seo?tab=ai`;
    const title = L.title(employee.name, site.siteHost);

    // уведомление в колокольчике — получателям отчёта, у кого есть аккаунт в CRM, иначе владельцам
    try {
      const emails = (site.recipients || []).map((e) => e.toLowerCase());
      let userIds = emails.length
        ? (await this.users.find({ where: { tenantId: site.tenantId, email: In(emails) } as any })).map((u) => u.id)
        : [];
      if (!userIds.length) userIds = (await this.users.find({ where: { tenantId: site.tenantId, role: 'owner' } as any })).map((u) => u.id);
      await this.notifications.create(site.tenantId, userIds, title, lines.join('\n'), { link: '/app/marketing/seo?tab=ai', kind: 'seo_alert' });
    } catch (e: any) {
      this.log.warn(`SEO alert notification failed: ${e?.message || e}`);
    }

    // письмо — в дизайне компании
    if (site.recipients?.length) {
      const inner = `<p style="margin:0 0 12px;font-size:14px;color:#18181b;">${escapeMailHtml(L.intro(site.siteHost))}</p>
<ul style="margin:0 0 16px;padding-left:18px;font-size:14px;line-height:1.55;color:#18181b;">${lines.map((l) => `<li style="margin:0 0 6px;">${escapeMailHtml(l)}</li>`).join('')}</ul>
<p style="margin:20px 0 0;"><a href="${link}" style="display:inline-block;padding:12px 24px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;">${L.open}</a></p>
<p style="margin:16px 0 0;font-size:12px;color:#71717a;">${escapeMailHtml(L.by(employee.name))}</p>`;
      try {
        const wrapped = await this.email.wrapHtmlInCompanyDesign(site.tenantId, { headline: title, innerHtml: inner });
        const html = wrapped?.htmlBody || inner;
        for (const to of site.recipients) await this.mail.sendMail({ to, subject: title, html });
      } catch (e: any) {
        this.log.warn(`SEO alert email failed: ${e?.message || e}`);
      }
    }

    // срочные задачи — по одной на сигнал высокой важности, остальное одной задачей
    const high = fresh.filter((a) => a.severity === 'high');
    const medium = fresh.filter((a) => a.severity !== 'high');
    for (const a of high) {
      await this.createTask(site, employee, {
        title: `SEO ⚠ ${L.line(a)}`.slice(0, 250),
        description: `${L.fix[a.code]}\n\n${link}`,
        priority: 'urgent',
        dueInDays: 1,
        reason: L.reasonAlert,
      }).catch(() => undefined);
    }
    if (medium.length) {
      await this.createTask(site, employee, {
        title: `SEO ⚠ ${L.check(site.siteHost)}`.slice(0, 250),
        description: `${medium.map((a) => `• ${L.line(a)} — ${L.fix[a.code]}`).join('\n')}\n\n${link}`,
        priority: 'high',
        dueInDays: 2,
        reason: L.reasonAlert,
      }).catch(() => undefined);
    }

    for (const a of fresh) state[a.key] = new Date().toISOString();
    await this.agents.update({ id: site.id }, { alertState: state });
    return fresh;
  }

  /** Сигналы по свежему недельному отчёту (сравнение с предыдущим отчётом того же сайта). */
  async alertsFromReport(site: SeoAiAgent, report: SeoAiReport, lang: Lang): Promise<SeoAlert[]> {
    if (!report.facts) return [];
    // предыдущий готовый отчёт того же сайта (не считая текущего)
    const [prev] = await this.reports.find({
      where: { tenantId: site.tenantId, siteHost: site.siteHost, status: 'done', id: Not(report.id) },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    const snap = this.snapshotFromFacts(report.facts, prev?.facts ?? null);
    return this.raise(site, this.detect(snap), lang, { fullCheck: true });
  }

  /** Ежедневный обход: лёгкая проверка каждого включённого сайта у тенантов с активным SEO-менеджером. */
  async dailyCheck(site: SeoAiAgent, lang: Lang): Promise<SeoAlert[]> {
    await this.agents.update({ id: site.id }, { lastCheckAt: new Date() });
    const snap = await this.dailySnapshot(site);
    return this.raise(site, this.detect(snap), lang, { fullCheck: false });
  }
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function pruneLog(log: Record<string, string>, days: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(log)) if (Date.now() - new Date(v).getTime() < days * 864e5) out[k] = v;
  return out;
}

const TASK_I18N: Record<Lang, { why: string; how: string; page: string; source: string; reason: (h: string) => string }> = {
  ru: { why: 'Почему:', how: 'Что сделать:', page: 'Страница:', source: 'Из SEO-отчёта:', reason: (h) => `Рекомендация из еженедельного SEO-отчёта по ${h}` },
  en: { why: 'Why:', how: 'What to do:', page: 'Page:', source: 'From the SEO report:', reason: (h) => `Recommendation from the weekly SEO report for ${h}` },
  tr: { why: 'Neden:', how: 'Yapılacak:', page: 'Sayfa:', source: 'SEO raporundan:', reason: (h) => `${h} için haftalık SEO raporundan öneri` },
};

const ALERT_I18N: Record<Lang, any> = {
  ru: {
    title: (n: string, h: string) => `SEO-сигнал · ${h}`,
    intro: (h: string) => `При проверке сайта ${h} обнаружены проблемы, которые могут стоить трафика:`,
    by: (n: string) => `Сообщил ${n} — ИИ SEO-менеджер вашей команды.`,
    open: 'Открыть ИИ-SEO',
    check: (h: string) => `проверить изменения на ${h}`,
    reasonAlert: 'Сигнал ежедневной SEO-проверки',
    line: (a: SeoAlert) =>
      ({
        site_down: `Сайт не открывается (${a.url})`,
        robots_block: 'Сайт закрыт от индексации в robots.txt (Disallow: /)',
        noindex: `Страница закрыта от индексации (noindex): ${a.url}`,
        page_broken: `Страница из выдачи Google отдаёт ошибку: ${a.url}`,
        kw_drop: a.to == null ? `Запрос «${a.keyword}» выпал из выдачи (был на ${a.from})` : `Запрос «${a.keyword}» просел: ${a.from} → ${a.to}`,
        clicks_drop: `Клики из Google упали на ${Math.abs(a.pct || 0)}% за неделю (${a.from} → ${a.to})`,
      })[a.code as SeoAlert['code']],
    fix: {
      site_down: 'Проверьте хостинг/домен/SSL — пока сайт недоступен, Google снижает позиции.',
      robots_block: 'Уберите «Disallow: /» для User-agent: * в robots.txt (часто остаётся после разработки или включённой в CMS галочки «скрыть от поисковиков»).',
      noindex: 'Уберите meta robots noindex со страницы (в SEO-плагине или настройках CMS), если её нужно показывать в поиске.',
      page_broken: 'Восстановите страницу или настройте 301-редирект на актуальную.',
      kw_drop: 'Сравните страницу с конкурентами в топе, проверьте, не менялись ли title/контент, обновите материал.',
      clicks_drop: 'Проверьте, какие страницы и запросы потеряли клики (Search Console → Эффективность), и нет ли технических проблем.',
    },
  },
  en: {
    title: (n: string, h: string) => `SEO alert · ${h}`,
    intro: (h: string) => `Checking ${h} found problems that may cost you traffic:`,
    by: (n: string) => `Reported by ${n}, your team's AI SEO Manager.`,
    open: 'Open AI SEO',
    check: (h: string) => `review changes on ${h}`,
    reasonAlert: 'Daily SEO check alert',
    line: (a: SeoAlert) =>
      ({
        site_down: `The site does not open (${a.url})`,
        robots_block: 'The site is blocked from indexing in robots.txt (Disallow: /)',
        noindex: `Page is excluded from indexing (noindex): ${a.url}`,
        page_broken: `A page Google shows returns an error: ${a.url}`,
        kw_drop: a.to == null ? `Query “${a.keyword}” dropped out of results (was ${a.from})` : `Query “${a.keyword}” dropped: ${a.from} → ${a.to}`,
        clicks_drop: `Google clicks fell ${Math.abs(a.pct || 0)}% this week (${a.from} → ${a.to})`,
      })[a.code as SeoAlert['code']],
    fix: {
      site_down: 'Check hosting/domain/SSL — Google lowers rankings while the site is down.',
      robots_block: 'Remove “Disallow: /” for User-agent: * in robots.txt (often left after development or by a CMS “discourage search engines” option).',
      noindex: 'Remove the meta robots noindex from the page (SEO plugin or CMS settings) if it should appear in search.',
      page_broken: 'Restore the page or set up a 301 redirect to the current one.',
      kw_drop: 'Compare the page with the current top results, check whether title/content changed, refresh the content.',
      clicks_drop: 'Check which pages and queries lost clicks (Search Console → Performance) and look for technical issues.',
    },
  },
  tr: {
    title: (n: string, h: string) => `SEO uyarısı · ${h}`,
    intro: (h: string) => `${h} kontrolünde trafiğe mal olabilecek sorunlar bulundu:`,
    by: (n: string) => `Bildiren: ${n}, ekibinizin YZ SEO yöneticisi.`,
    open: 'YZ SEO’yu aç',
    check: (h: string) => `${h} üzerindeki değişiklikleri incele`,
    reasonAlert: 'Günlük SEO kontrolü uyarısı',
    line: (a: SeoAlert) =>
      ({
        site_down: `Site açılmıyor (${a.url})`,
        robots_block: 'Site robots.txt ile dizinlemeye kapalı (Disallow: /)',
        noindex: `Sayfa dizinlemeden hariç (noindex): ${a.url}`,
        page_broken: `Google’da görünen bir sayfa hata veriyor: ${a.url}`,
        kw_drop: a.to == null ? `“${a.keyword}” sorgusu sonuçlardan düştü (önceden ${a.from})` : `“${a.keyword}” sorgusu geriledi: ${a.from} → ${a.to}`,
        clicks_drop: `Google tıklamaları bu hafta %${Math.abs(a.pct || 0)} düştü (${a.from} → ${a.to})`,
      })[a.code as SeoAlert['code']],
    fix: {
      site_down: 'Hosting/alan adı/SSL’i kontrol edin — site kapalıyken Google sıralamayı düşürür.',
      robots_block: 'robots.txt’te User-agent: * için “Disallow: /” satırını kaldırın.',
      noindex: 'Aramada görünmesi gerekiyorsa sayfadan meta robots noindex’i kaldırın.',
      page_broken: 'Sayfayı geri yükleyin veya güncel sayfaya 301 yönlendirmesi kurun.',
      kw_drop: 'Sayfayı ilk sıradakilerle karşılaştırın, title/içerik değişti mi kontrol edin, içeriği güncelleyin.',
      clicks_drop: 'Hangi sayfa ve sorguların tıklama kaybettiğini (Search Console → Performans) ve teknik sorunları kontrol edin.',
    },
  },
};
