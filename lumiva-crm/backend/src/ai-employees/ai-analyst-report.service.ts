import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { AiAgent } from './ai-agent.entity';
import { AiAgentReport } from './ai-agent-report.entity';
import { AiEmployeesService } from './ai-employees.service';
import { getAiEmployeeRole } from './ai-employee-role-catalog';
import { readAiAgentConfig } from './ai-employee-triggers';
import { Sale } from '../sales/sale.entity';
import { Payment } from '../payments/payment.entity';
import { Lead } from '../leads/lead.entity';
import { Reservation } from '../bookings/reservation.entity';
import { HotelReservation } from '../hotels/hotel-reservation.entity';
import { Hotel } from '../hotels/hotel.entity';
import { CompanyTask } from '../companies/company-task.entity';
import { Project } from '../projects/project.entity';
import { HelpdeskTicket } from '../helpdesk/helpdesk-ticket.entity';
import { MarketingService } from '../marketing/marketing.service';
import { MailService } from '../mail/mail.service';
import { EmailService } from '../email/email.service';
import { escapeMailHtml } from '../mail/mail-template.util';

/** Галочки «какие данные собирает аналитик». Каждый блок требует своё read_*-право. */
export const ANALYST_BLOCKS = ['sales', 'payments', 'discounts', 'leads', 'bookings', 'hotels', 'tasks', 'helpdesk', 'marketing'] as const;
export type AnalystBlock = (typeof ANALYST_BLOCKS)[number];
const BLOCK_PERMS: Record<AnalystBlock, string[]> = {
  sales: ['read_sales'],
  payments: ['read_sales'],
  discounts: ['read_bookings'],
  leads: ['read_leads'],
  bookings: ['read_bookings'],
  hotels: ['read_bookings'],
  tasks: ['read_tasks', 'read_projects'],
  helpdesk: ['read_helpdesk'],
  marketing: ['read_marketing'],
};

export type AnalystReportConfig = {
  enabled: boolean;
  blocks: AnalystBlock[];
  /** Время отправки HH:MM в часовом поясе сотрудника. */
  time: string;
  /** 0 = вс … 6 = сб */
  weekdays: number[];
  recipients: string[];
  inApp: boolean;
  lastSentDate?: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
type Money = Record<string, number>;
type Lang = 'ru' | 'en' | 'tr';

/** Локальная дата YYYY-MM-DD и границы этих суток в UTC для часового пояса. */
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
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asUtc - at.getTime();
}
function dayWindow(tz: string, ymd: string): { start: Date; end: Date } {
  const [y, m, d] = ymd.split('-').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  const start = new Date(guess.getTime() - tzOffsetMs(tz, guess));
  const end = new Date(start.getTime() + 864e5);
  return { start, end };
}
function shiftYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * 864e5).toISOString().slice(0, 10);
}
const addMoney = (acc: Money, cur: string | null | undefined, v: number) => {
  const c = (cur || '—').toUpperCase();
  acc[c] = Math.round(((acc[c] || 0) + (Number(v) || 0)) * 100) / 100;
};

/**
 * CRM-аналитик: каждый день собирает показатели за вчера по выбранным владельцем блокам,
 * сравнивает с позавчера, пишет короткий вывод и отправляет — на почту и/или в уведомления.
 * Сам ничего в CRM не меняет (роль reportOnly).
 */
@Injectable()
export class AiAnalystReportService {
  private readonly log = new Logger(AiAnalystReportService.name);

  constructor(
    @InjectRepository(AiAgent) private readonly agents: Repository<AiAgent>,
    @InjectRepository(AiAgentReport) private readonly reports: Repository<AiAgentReport>,
    @InjectRepository(Sale) private readonly sales: Repository<Sale>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(Reservation) private readonly reservations: Repository<Reservation>,
    @InjectRepository(HotelReservation) private readonly hotelRes: Repository<HotelReservation>,
    @InjectRepository(CompanyTask) private readonly companyTasks: Repository<CompanyTask>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(HelpdeskTicket) private readonly tickets: Repository<HelpdeskTicket>,
    private readonly employees: AiEmployeesService,
    private readonly marketing: MarketingService,
    private readonly mail: MailService,
    private readonly email: EmailService,
  ) {}

  // ---------------------------------------------------------------- настройки

  readConfig(agent: AiAgent): AnalystReportConfig {
    const raw = ((agent.settings as any)?.analystReport || {}) as Partial<AnalystReportConfig>;
    const blocks = Array.isArray(raw.blocks) ? raw.blocks.filter((b): b is AnalystBlock => (ANALYST_BLOCKS as readonly string[]).includes(b)) : [...ANALYST_BLOCKS];
    return {
      enabled: raw.enabled !== false,
      blocks,
      time: /^\d{2}:\d{2}$/.test(String(raw.time || '')) ? String(raw.time) : '09:00',
      weekdays: Array.isArray(raw.weekdays) ? raw.weekdays.map(Number).filter((n) => n >= 0 && n <= 6) : [0, 1, 2, 3, 4, 5, 6],
      recipients: Array.isArray(raw.recipients) ? raw.recipients.map(String).filter((e) => EMAIL_RE.test(e)).slice(0, 10) : [],
      inApp: raw.inApp !== false,
      lastSentDate: raw.lastSentDate ?? null,
    };
  }

  private async analystOrFail(tenantId: string, id: string) {
    const agent = await this.employees.agentEntity(tenantId, id);
    if (!getAiEmployeeRole(agent.role)?.reportOnly) throw new BadRequestException('This AI employee is not an analyst');
    return agent;
  }

  async getConfig(tenantId: string, id: string) {
    const agent = await this.analystOrFail(tenantId, id);
    return { ...this.readConfig(agent), timezone: readAiAgentConfig(agent.settings).timezone, blocksAll: ANALYST_BLOCKS };
  }

  async updateConfig(tenantId: string, id: string, patch: Partial<AnalystReportConfig>) {
    const agent = await this.analystOrFail(tenantId, id);
    const cur = this.readConfig(agent);
    const next: AnalystReportConfig = {
      ...cur,
      ...(patch.enabled !== undefined ? { enabled: !!patch.enabled } : {}),
      ...(patch.blocks !== undefined
        ? { blocks: (Array.isArray(patch.blocks) ? patch.blocks : []).filter((b): b is AnalystBlock => (ANALYST_BLOCKS as readonly string[]).includes(b)) }
        : {}),
      ...(patch.time !== undefined && /^\d{2}:\d{2}$/.test(String(patch.time)) ? { time: String(patch.time) } : {}),
      ...(patch.weekdays !== undefined ? { weekdays: [...new Set((patch.weekdays || []).map(Number).filter((n) => n >= 0 && n <= 6))] } : {}),
      ...(patch.recipients !== undefined
        ? { recipients: [...new Set((patch.recipients || []).map((e) => String(e).trim().toLowerCase()).filter((e) => EMAIL_RE.test(e)))].slice(0, 10) }
        : {}),
      ...(patch.inApp !== undefined ? { inApp: !!patch.inApp } : {}),
    };
    await this.agents.update({ id: agent.id }, { settings: { ...(agent.settings || {}), analystReport: next } as any });
    // галочки данных = права чтения аналитика (чат и отчёты видят ровно выбранное)
    const reads = [...new Set(next.blocks.flatMap((b) => BLOCK_PERMS[b]))];
    await this.employees.setReadPermissions(tenantId, agent, reads);
    return this.getConfig(tenantId, id);
  }

  // ---------------------------------------------------------------- показатели

  private async metricsForDay(tenantId: string, tz: string, ymd: string, blocks: AnalystBlock[]) {
    const { start, end } = dayWindow(tz, ymd);
    const out: Record<string, any> = {};
    const has = (b: AnalystBlock) => blocks.includes(b);

    if (has('sales')) {
      const rows = await this.sales
        .createQueryBuilder('s')
        .select(['s.amount', 's.currency', 's.status'])
        .where('s.tenantId = :tenantId', { tenantId })
        .andWhere('COALESCE(s.saleDate, s.createdAt) >= :start AND COALESCE(s.saleDate, s.createdAt) < :end', { start, end })
        .getMany();
      const revenue: Money = {};
      let cancelled = 0;
      for (const r of rows) {
        if (r.status === 'cancelled' || r.status === 'refunded') cancelled++;
        else addMoney(revenue, r.currency, r.amount);
      }
      out.sales = { count: rows.length - cancelled, revenue, cancelled };
    }
    if (has('payments')) {
      const paid = await this.payments
        .createQueryBuilder('p')
        .where('p.tenantId = :tenantId AND p.status = :st AND p.paidAt >= :start AND p.paidAt < :end', { tenantId, st: 'paid', start, end })
        .getMany();
      const failed = await this.payments
        .createQueryBuilder('p')
        .where('p.tenantId = :tenantId AND p.status = :st AND p.createdAt >= :start AND p.createdAt < :end', { tenantId, st: 'failed', start, end })
        .getCount();
      const amount: Money = {};
      paid.forEach((p) => addMoney(amount, p.currency, p.amount));
      out.payments = { count: paid.length, amount, failed };
    }
    if (has('discounts') || has('hotels')) {
      const rows = await this.hotelRes
        .createQueryBuilder('r')
        .innerJoin(Hotel, 'h', 'h.id = r.hotelId')
        .select(['r.total AS total', 'r.roomTotal AS "roomTotal"', 'r.discountPct AS "discountPct"', 'r.status AS status', 'h.currency AS currency'])
        .where('r.tenantId = :tenantId AND r.createdAt >= :start AND r.createdAt < :end', { tenantId, start, end })
        .getRawMany();
      if (has('discounts')) {
        const amount: Money = {};
        let count = 0;
        for (const r of rows) {
          const pct = Number(r.discountPct) || 0;
          if (pct <= 0 || r.status === 'cancelled') continue;
          count++;
          addMoney(amount, r.currency, Math.max(0, Number(r.roomTotal) - Number(r.total)));
        }
        out.discounts = { count, amount };
      }
      if (has('hotels')) {
        const revenue: Money = {};
        const live = rows.filter((r) => r.status !== 'cancelled');
        live.forEach((r) => addMoney(revenue, r.currency, Number(r.total)));
        const [arrivals, departures, inHouse] = await Promise.all([
          this.hotelRes.count({ where: { tenantId, checkIn: ymd } as any }),
          this.hotelRes.count({ where: { tenantId, checkOut: ymd } as any }),
          this.hotelRes
            .createQueryBuilder('r')
            .where('r.tenantId = :tenantId AND r.checkIn <= :d AND r.checkOut > :d AND r.status <> :c', { tenantId, d: ymd, c: 'cancelled' })
            .getCount(),
        ]);
        out.hotels = { newReservations: live.length, revenue, cancelled: rows.length - live.length, arrivals, departures, inHouse };
      }
    }
    if (has('bookings')) {
      const rows = await this.reservations
        .createQueryBuilder('r')
        .select(['r.price', 'r.currency', 'r.status'])
        .where('r.tenantId = :tenantId AND r.createdAt >= :start AND r.createdAt < :end', { tenantId, start, end })
        .getMany();
      const cancelledSt = new Set(['cancelled_by_customer', 'cancelled_by_business', 'rejected']);
      const revenue: Money = {};
      let cancelled = 0;
      for (const r of rows) {
        if (cancelledSt.has(r.status)) cancelled++;
        else addMoney(revenue, r.currency, Number(r.price) || 0);
      }
      const visits = await this.reservations
        .createQueryBuilder('r')
        .where('r.tenantId = :tenantId AND r.startAt >= :start AND r.startAt < :end', { tenantId, start, end })
        .andWhere('r.status NOT IN (:...c)', { c: [...cancelledSt, 'no_show'] })
        .getCount();
      out.bookings = { newReservations: rows.length - cancelled, revenue, cancelled, visitsThatDay: visits };
    }
    if (has('leads')) {
      const rows = await this.leads
        .createQueryBuilder('l')
        .select(['l.source', 'l.status'])
        .where('l.tenantId = :tenantId AND l.createdAt >= :start AND l.createdAt < :end', { tenantId, start, end })
        .andWhere(
          new Brackets((qb) =>
            qb.where(`NOT (COALESCE(l.meta::jsonb, '{}'::jsonb) @> '{"deleted":true}'::jsonb OR COALESCE(l.meta::jsonb, '{}'::jsonb) @> '{"archived":true}'::jsonb)`),
          ),
        )
        .getMany();
      const bySource: Record<string, number> = {};
      rows.forEach((r) => (bySource[r.source || '—'] = (bySource[r.source || '—'] || 0) + 1));
      out.leads = {
        count: rows.length,
        bySource: Object.fromEntries(Object.entries(bySource).sort((a, b) => b[1] - a[1]).slice(0, 6)),
      };
    }
    if (has('tasks')) {
      const [overdueCompany, doneCompany] = await Promise.all([
        this.companyTasks
          .createQueryBuilder('t')
          .where('t.tenantId = :tenantId AND t.dueDate < :end AND t.status NOT IN (:...st)', { tenantId, end, st: ['done', 'cancelled'] })
          .getCount(),
        this.companyTasks
          .createQueryBuilder('t')
          .where('t.tenantId = :tenantId AND t.completedAt >= :start AND t.completedAt < :end', { tenantId, start, end })
          .getCount(),
      ]);
      const projs = await this.projects.find({ where: { tenantId, isDeleted: false, isArchived: false } as any, select: ['id', 'tasks'] as any });
      let overdueProject = 0;
      let dueNext = 0;
      const nextDay = shiftYmd(ymd, 1);
      for (const p of projs) {
        for (const t of (p as any).tasks || []) {
          const dl = String(t?.deadline || '').slice(0, 10);
          if (!dl || t?.status === 'Готово' || t?.status === 'done') continue;
          if (dl <= ymd) overdueProject++;
          else if (dl === nextDay) dueNext++;
        }
      }
      out.tasks = { overdue: overdueCompany + overdueProject, completedCompanyTasks: doneCompany, dueNextDay: dueNext };
    }
    if (has('helpdesk')) {
      const [opened, openNow] = await Promise.all([
        this.tickets.createQueryBuilder('t').where('t.tenantId = :tenantId AND t.createdAt >= :start AND t.createdAt < :end', { tenantId, start, end }).getCount(),
        this.tickets.count({ where: { tenantId, status: In(['open', 'pending']) } as any }),
      ]);
      out.helpdesk = { opened, openNow };
    }
    if (has('marketing')) {
      try {
        const st = await this.marketing.getTrafficChannelsStats(tenantId, ymd, ymd, undefined, 50);
        out.marketing = {
          sessions: st.totalSessions || 0,
          clicks: st.totalClicks || 0,
          leads: st.totalLeads || 0,
          // расходы — как деньги, в валюте отчёта маркетинга
          cost: { [String(st.currency || '—')]: Math.round(Number(st.totalCost || 0) * 100) / 100 },
        };
      } catch {
        out.marketing = null;
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- отчёт

  /** Собрать отчёт за вчера (по часовому поясу сотрудника), сохранить и разослать. */
  async runReport(tenantId: string, agentId: string, opts: { deliver: boolean }) {
    const agent = await this.analystOrFail(tenantId, agentId);
    const cfg = this.readConfig(agent);
    const tz = readAiAgentConfig(agent.settings).timezone;
    const today = tzParts(tz, new Date()).ymd;
    const day = shiftYmd(today, -1);
    const prevDay = shiftYmd(today, -2);
    if (!cfg.blocks.length) throw new BadRequestException({ code: 'ANALYST_NO_BLOCKS', message: 'Choose at least one data block' });
    const [cur, prev] = await Promise.all([
      this.metricsForDay(tenantId, tz, day, cfg.blocks),
      this.metricsForDay(tenantId, tz, prevDay, cfg.blocks),
    ]);
    const lang: Lang = agent.language === 'Russian' ? 'ru' : agent.language === 'Turkish' ? 'tr' : 'en';

    // короткий вывод от модели; цифры в таблице — наши, модель их только комментирует
    let summary = '';
    let tokensUsed = 0;
    try {
      const langName = { ru: 'Russian', en: 'English', tr: 'Turkish' }[lang];
      const res = await this.employees.completeForAgent(
        tenantId,
        agent,
        `You are ${agent.name}, the company's AI CRM analyst. You only report facts; you never propose actions for specific records and never invent numbers. Write in ${langName}.`,
        `Yesterday (${day}) vs the day before (${prevDay}) — JSON metrics:\nYESTERDAY: ${JSON.stringify(cur)}\nDAY BEFORE: ${JSON.stringify(prev)}\n\nWrite 3–5 short bullet points: the most important numbers and notable changes (copy numbers exactly; money is per currency). No recommendations about individual leads/deals. Plain text bullets starting with "• ".`,
      );
      summary = String(res.text || '').trim().slice(0, 2000);
      tokensUsed = res.tokensUsed || 0;
    } catch (e: any) {
      this.log.warn(`Analyst summary failed agent=${agent.id}: ${e?.message || e}`);
    }

    const L = I18N[lang];
    const contentMd = this.renderMarkdown(L, day, cur, prev, summary);
    const report = await this.reports.save(
      this.reports.create({
        tenantId,
        agentId: agent.id,
        reportType: 'analyst_daily',
        title: `${L.title} · ${day}`,
        contentMd,
        contentJson: { day, prevDay, metrics: cur, prevMetrics: prev, blocks: cfg.blocks },
        periodStart: dayWindow(tz, day).start,
        periodEnd: dayWindow(tz, day).end,
        status: 'generated',
      }),
    );

    const sentTo: string[] = [];
    if (opts.deliver) {
      if (cfg.recipients.length) {
        const inner = this.renderEmailInner(L, agent.name, day, cur, prev, summary);
        const headline = `${L.title} · ${day}`;
        try {
          const wrapped = await this.email.wrapHtmlInCompanyDesign(tenantId, { headline, innerHtml: inner });
          for (const to of cfg.recipients) {
            await this.mail.sendMail({ to, subject: `${headline} — ${agent.name}`, html: wrapped?.htmlBody || inner });
            sentTo.push(to);
          }
        } catch (e: any) {
          this.log.warn(`Analyst email failed agent=${agent.id}: ${e?.message || e}`);
        }
      }
      if (cfg.inApp) {
        await this.employees
          .notifyOwners(tenantId, `${L.title} · ${day}`, summary || L.ready, { link: '/ai-employees/reports', kind: 'analyst_report' })
          .catch(() => undefined);
        sentTo.push('in_app');
      }
      if (sentTo.length) await this.reports.update({ id: report.id }, { status: 'sent', sentTo } as any);
    }
    await this.employees.logAgentEvent({
      tenantId,
      agentId: agent.id,
      eventType: 'report_generated',
      targetType: 'report',
      targetId: report.id,
      inputSummary: 'analyst_daily',
      outputSummary: report.title,
      status: 'success',
      tokensUsed,
    });
    return { ok: true, reportId: report.id, day, sentTo, contentMd };
  }

  /** Раз в 5 минут: у кого из аналитиков в их часовом поясе наступило время отчёта в выбранный день. */
  async tick(): Promise<void> {
    const rows = await this.agents.find({ where: { status: 'active' as any } });
    for (const agent of rows) {
      if (!getAiEmployeeRole(agent.role)?.reportOnly) continue;
      const cfg = this.readConfig(agent);
      if (!cfg.enabled || !cfg.blocks.length) continue;
      const tz = readAiAgentConfig(agent.settings).timezone;
      const now = tzParts(tz, new Date());
      if (!cfg.weekdays.includes(now.weekday) || cfg.lastSentDate === now.ymd) continue;
      const [hh, mm] = cfg.time.split(':').map(Number);
      const target = hh * 60 + mm;
      if (now.minutes < target || now.minutes > target + 30) continue;
      // отметку ставим до отправки: сбой не должен слать отчёт каждые 5 минут
      await this.agents.update({ id: agent.id }, { settings: { ...(agent.settings || {}), analystReport: { ...cfg, lastSentDate: now.ymd } } as any });
      try {
        await this.runReport(agent.tenantId, agent.id, { deliver: true });
      } catch (e: any) {
        this.log.warn(`Analyst report failed agent=${agent.id}: ${e?.message || e}`);
      }
    }
  }

  // ---------------------------------------------------------------- вывод

  private rows(L: any, cur: Record<string, any>, prev: Record<string, any>): Array<{ block: string; label: string; value: string; prev: string }> {
    const out: Array<{ block: string; label: string; value: string; prev: string }> = [];
    const money = (m: Money | undefined) => {
      const e = Object.entries(m || {}).filter(([, v]) => v);
      return e.length ? e.map(([c, v]) => `${v.toLocaleString('ru-RU')} ${c}`).join(' + ') : '0';
    };
    const push = (block: string, label: string, v: any, p: any, isMoney = false) =>
      out.push({ block, label, value: isMoney ? money(v) : String(v ?? 0), prev: isMoney ? money(p) : String(p ?? 0) });
    for (const block of Object.keys(cur)) {
      const c = cur[block];
      const p = prev[block] || {};
      if (!c || this.isQuiet(c, p)) continue;
      for (const [key, val] of Object.entries(c)) {
        if (key === 'bySource' || key === 'currency') continue;
        const label = L.m[`${block}.${key}`] || `${block}.${key}`;
        push(block, label, val, p[key], typeof val === 'object');
      }
      if (block === 'leads' && Object.keys(c.bySource || {}).length) {
        out.push({ block, label: L.m['leads.bySource'], value: Object.entries(c.bySource).map(([s, n]) => `${s}: ${n}`).join(', '), prev: '' });
      }
    }
    return out;
  }

  /** Блок без движения: все показатели нулевые оба дня — в таблицу не выводим, упоминаем одной строкой. */
  private isQuiet(c: Record<string, any>, p: Record<string, any>) {
    const zero = (v: any): boolean =>
      v == null || v === 0 || (typeof v === 'object' && Object.values(v).every((x) => !x));
    return Object.entries(c).every(([k, v]) => zero(v) && zero(p?.[k]));
  }

  private quietBlocks(L: any, cur: Record<string, any>, prev: Record<string, any>): string {
    const q = Object.keys(cur).filter((b) => cur[b] && this.isQuiet(cur[b], prev[b] || {}));
    return q.length ? `${L.quiet}: ${q.map((b) => L.blocks[b] || b).join(', ')}` : '';
  }

  private renderMarkdown(L: any, day: string, cur: Record<string, any>, prev: Record<string, any>, summary: string) {
    const rows = this.rows(L, cur, prev);
    const lines = [`## ${L.title} · ${day}`, '', summary || '', '', `| ${L.metric} | ${L.yesterday} | ${L.dayBefore} |`, '|---|---|---|'];
    let lastBlock = '';
    for (const r of rows) {
      if (r.block !== lastBlock) {
        lines.push(`| **${L.blocks[r.block] || r.block}** | | |`);
        lastBlock = r.block;
      }
      lines.push(`| ${r.label} | ${r.value} | ${r.prev} |`);
    }
    const quiet = this.quietBlocks(L, cur, prev);
    if (quiet) lines.push('', `_${quiet}_`);
    return lines.join('\n');
  }

  private renderEmailInner(L: any, name: string, day: string, cur: Record<string, any>, prev: Record<string, any>, summary: string) {
    const e = escapeMailHtml;
    const cell = 'padding:7px 10px;border-bottom:1px solid #eee;font-size:13px;';
    let lastBlock = '';
    const body = this.rows(L, cur, prev)
      .map((r) => {
        const head =
          r.block !== lastBlock
            ? `<tr><td colspan="3" style="padding:14px 10px 6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#52525b;">${e(L.blocks[r.block] || r.block)}</td></tr>`
            : '';
        lastBlock = r.block;
        return `${head}<tr><td style="${cell}">${e(r.label)}</td><td style="${cell}text-align:right;"><b>${e(r.value)}</b></td><td style="${cell}text-align:right;color:#71717a;">${e(r.prev)}</td></tr>`;
      })
      .join('');
    const summaryHtml = summary
      ? `<div style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#18181b;">${summary
          .split('\n')
          .filter(Boolean)
          .map((l) => `<div style="margin:0 0 4px;">${e(l)}</div>`)
          .join('')}</div>`
      : '';
    return `${summaryHtml}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
<tr><td style="${cell}color:#71717a;">${L.metric}</td><td style="${cell}text-align:right;color:#71717a;">${L.yesterday} (${day})</td><td style="${cell}text-align:right;color:#71717a;">${L.dayBefore}</td></tr>${body}</table>
${this.quietBlocks(L, cur, prev) ? `<p style="margin:12px 0 0;font-size:12.5px;color:#71717a;">${e(this.quietBlocks(L, cur, prev))}</p>` : ''}
<p style="margin:18px 0 0;font-size:12px;color:#71717a;">${e(L.by(name))}</p>`;
  }
}

const M_RU = {
  'sales.count': 'Продажи', 'sales.revenue': 'Выручка', 'sales.cancelled': 'Отмены/возвраты',
  'payments.count': 'Оплат получено', 'payments.amount': 'Сумма оплат', 'payments.failed': 'Неуспешные оплаты',
  'discounts.count': 'Брони со скидкой', 'discounts.amount': 'Сумма скидок',
  'leads.count': 'Новые лиды', 'leads.bySource': 'По источникам',
  'bookings.newReservations': 'Новые записи', 'bookings.revenue': 'Сумма записей', 'bookings.cancelled': 'Отменено', 'bookings.visitsThatDay': 'Визитов в этот день',
  'hotels.newReservations': 'Новые брони', 'hotels.revenue': 'Сумма броней', 'hotels.cancelled': 'Отменено', 'hotels.arrivals': 'Заезды', 'hotels.departures': 'Выезды', 'hotels.inHouse': 'Проживало гостей (номеров)',
  'tasks.overdue': 'Просрочено задач', 'tasks.completedCompanyTasks': 'Закрыто задач', 'tasks.dueNextDay': 'Срок на следующий день',
  'helpdesk.opened': 'Новые обращения', 'helpdesk.openNow': 'Открыто сейчас',
  'marketing.sessions': 'Визиты', 'marketing.clicks': 'Клики', 'marketing.leads': 'Лиды из рекламы', 'marketing.cost': 'Расходы',
};
const I18N: Record<Lang, any> = {
  ru: {
    title: 'Отчёт аналитика за вчера', quiet: 'Без движения', metric: 'Показатель', yesterday: 'Вчера', dayBefore: 'Позавчера', ready: 'Отчёт готов',
    by: (n: string) => `Подготовил ${n} — ИИ-аналитик. Он только собирает данные и ничего не меняет в CRM.`,
    blocks: { sales: 'Продажи', payments: 'Оплаты', discounts: 'Скидки', leads: 'Лиды', bookings: 'Записи', hotels: 'Отели', tasks: 'Задачи', helpdesk: 'Поддержка', marketing: 'Маркетинг' },
    m: M_RU,
  },
  en: {
    title: "Analyst report for yesterday", quiet: 'No activity', metric: 'Metric', yesterday: 'Yesterday', dayBefore: 'Day before', ready: 'Report ready',
    by: (n: string) => `Prepared by ${n}, AI analyst. It only collects data and never changes anything in the CRM.`,
    blocks: { sales: 'Sales', payments: 'Payments', discounts: 'Discounts', leads: 'Leads', bookings: 'Appointments', hotels: 'Hotels', tasks: 'Tasks', helpdesk: 'Support', marketing: 'Marketing' },
    m: {
      'sales.count': 'Sales', 'sales.revenue': 'Revenue', 'sales.cancelled': 'Cancelled/refunded',
      'payments.count': 'Payments received', 'payments.amount': 'Payments total', 'payments.failed': 'Failed payments',
      'discounts.count': 'Bookings with discount', 'discounts.amount': 'Discounts total',
      'leads.count': 'New leads', 'leads.bySource': 'By source',
      'bookings.newReservations': 'New appointments', 'bookings.revenue': 'Appointments total', 'bookings.cancelled': 'Cancelled', 'bookings.visitsThatDay': 'Visits that day',
      'hotels.newReservations': 'New reservations', 'hotels.revenue': 'Reservations total', 'hotels.cancelled': 'Cancelled', 'hotels.arrivals': 'Arrivals', 'hotels.departures': 'Departures', 'hotels.inHouse': 'In-house (rooms)',
      'tasks.overdue': 'Overdue tasks', 'tasks.completedCompanyTasks': 'Tasks completed', 'tasks.dueNextDay': 'Due next day',
      'helpdesk.opened': 'New tickets', 'helpdesk.openNow': 'Open now',
      'marketing.sessions': 'Sessions', 'marketing.clicks': 'Clicks', 'marketing.leads': 'Leads from ads', 'marketing.cost': 'Spend',
    },
  },
  tr: {
    title: 'Dünün analist raporu', quiet: 'Hareket yok', metric: 'Gösterge', yesterday: 'Dün', dayBefore: 'Önceki gün', ready: 'Rapor hazır',
    by: (n: string) => `${n} hazırladı — YZ analist. Yalnızca veri toplar, CRM'de hiçbir şeyi değiştirmez.`,
    blocks: { sales: 'Satışlar', payments: 'Ödemeler', discounts: 'İndirimler', leads: "Lead'ler", bookings: 'Randevular', hotels: 'Oteller', tasks: 'Görevler', helpdesk: 'Destek', marketing: 'Pazarlama' },
    m: {
      'sales.count': 'Satışlar', 'sales.revenue': 'Gelir', 'sales.cancelled': 'İptal/iade',
      'payments.count': 'Alınan ödemeler', 'payments.amount': 'Ödeme toplamı', 'payments.failed': 'Başarısız ödemeler',
      'discounts.count': 'İndirimli rezervasyonlar', 'discounts.amount': 'İndirim toplamı',
      'leads.count': "Yeni lead'ler", 'leads.bySource': 'Kaynağa göre',
      'bookings.newReservations': 'Yeni randevular', 'bookings.revenue': 'Randevu toplamı', 'bookings.cancelled': 'İptal', 'bookings.visitsThatDay': 'O günkü ziyaretler',
      'hotels.newReservations': 'Yeni rezervasyonlar', 'hotels.revenue': 'Rezervasyon toplamı', 'hotels.cancelled': 'İptal', 'hotels.arrivals': 'Girişler', 'hotels.departures': 'Çıkışlar', 'hotels.inHouse': 'Konaklayan (oda)',
      'tasks.overdue': 'Geciken görevler', 'tasks.completedCompanyTasks': 'Tamamlanan görevler', 'tasks.dueNextDay': 'Ertesi gün teslim',
      'helpdesk.opened': 'Yeni talepler', 'helpdesk.openNow': 'Şu an açık',
      'marketing.sessions': 'Oturumlar', 'marketing.clicks': 'Tıklamalar', 'marketing.leads': "Reklamdan lead'ler", 'marketing.cost': 'Harcama',
    },
  },
};
