import { BadRequestException, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from './lead.entity';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
/** Продажи с этими статусами не выручка. */
const DEAD_SALE_STATUSES = ['cancelled', 'canceled', 'refunded', 'failed'];
const LEAD_ALIVE_SQL = `l.deleted_at IS NULL AND NOT (COALESCE(l.meta::jsonb, '{}'::jsonb) @> '{"deleted":true}'::jsonb OR COALESCE(l.meta::jsonb, '{}'::jsonb) @> '{"deleted":"true"}'::jsonb)`;

function normCurrency(c: unknown): string {
  const s = String(c || 'EUR').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  return /^[A-Z]{3}$/.test(s) ? s : 'EUR';
}
const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * leads/won/lost — когорта лидов, созданных в месяце (по текущему статусу);
 * revenue/deals — продажи (проекты) лидов с датой в месяце;
 * repeat* — из них не первая продажа лида за всё время.
 */
type Cell = { leads: number; won: number; lost: number; revenue: number; deals: number; repeatRevenue: number; repeatDeals: number };
const emptyCell = (): Cell => ({ leads: 0, won: 0, lost: 0, revenue: 0, deals: 0, repeatRevenue: 0, repeatDeals: 0 });
const addCell = (a: Cell, c: Cell) => {
  a.leads += c.leads;
  a.won += c.won;
  a.lost += c.lost;
  a.revenue += c.revenue;
  a.deals += c.deals;
  a.repeatRevenue += c.repeatRevenue;
  a.repeatDeals += c.repeatDeals;
};
const roundCell = (c: Cell): Cell => ({ ...c, revenue: r2(c.revenue), repeatRevenue: r2(c.repeatRevenue) });

/**
 * Итоги лидов по менеджерам (/leads/roi): сколько лидов выиграно/проиграно,
 * сколько выручки они принесли и сколько из неё — повторные покупки.
 */
@Injectable()
export class LeadsManagerRoiService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadsRepo: Repository<Lead>,
    private readonly moduleRef: ModuleRef,
  ) {}

  async getManagerRoi(
    tenantId: string,
    opts: {
      fromMonth?: string;
      toMonth?: string;
      displayCurrency?: string;
      source?: 'sales' | 'projects';
      restrictToLeadIds?: string[] | null;
    },
  ) {
    const now = new Date();
    const toMonth = opts.toMonth && MONTH_RE.test(opts.toMonth) ? opts.toMonth : now.toISOString().slice(0, 7);
    const defFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1)).toISOString().slice(0, 7);
    const fromMonth = opts.fromMonth && MONTH_RE.test(opts.fromMonth) ? opts.fromMonth : defFrom;
    if (fromMonth > toMonth) throw new BadRequestException('Начало периода позже конца');
    const source = opts.source === 'projects' ? 'projects' : 'sales';
    const fromDate = `${fromMonth}-01`;
    const [ty, tm] = toMonth.split('-').map(Number);
    const toDate = new Date(Date.UTC(ty, tm, 0)).toISOString().slice(0, 10);

    const display = normCurrency(opts.displayCurrency || 'EUR');
    let mult: Record<string, number> = { [display]: 1 };
    let fxAsOf: string | null = null;
    try {
      // MarketingModule импортирует LeadsModule — берём сервис лениво, без циклической DI.
      const { MarketingService } = require('../marketing/marketing.service');
      const fx = await this.moduleRef.get(MarketingService, { strict: false }).getMarketingFxRates(display);
      mult = fx.multiplyToDisplay;
      fxAsOf = fx.asOf;
    } catch {
      /* без курсов суммы в другой валюте помечаются missingRate */
    }
    const missingRates = new Set<string>();
    const conv = (amount: number, cur: string | null) => {
      const c = normCurrency(cur || display);
      if (c === display) return amount;
      const m = mult[c];
      if (m == null || !Number.isFinite(m)) {
        missingRates.add(c);
        return amount;
      }
      return amount * m;
    };

    const months: string[] = [];
    for (let d = new Date(Date.UTC(Number(fromMonth.slice(0, 4)), Number(fromMonth.slice(5)) - 1, 1)); d.toISOString().slice(0, 7) <= toMonth; d.setUTCMonth(d.getUTCMonth() + 1)) {
      months.push(d.toISOString().slice(0, 7));
    }

    const restrict = opts.restrictToLeadIds;
    const empty = {
      fromMonth,
      toMonth,
      months,
      source,
      displayCurrency: display,
      fxAsOf,
      missingRates: [] as string[],
      managers: [] as unknown[],
      total: roundCell(emptyCell()),
      repeatLeads: 0,
      leadsWithRevenue: 0,
    };
    if (restrict && !restrict.length) return empty;
    const q = this.leadsRepo.manager;

    // Лиды, созданные в периоде (когорта для «лиды / выиграно / проиграно»).
    const leadRows = (await q.query(
      `SELECT l.id, l."assignedUserId" AS uid, l."assignedTo" AS "assignedTo", l.status,
              to_char(l."createdAt", 'YYYY-MM') AS month
         FROM leads l
        WHERE l."tenantId" = $1 AND ${LEAD_ALIVE_SQL}
          AND l."createdAt" >= $2::date AND l."createdAt" < ($3::date + interval '1 day')`,
      [tenantId, fromDate, toDate],
    )) as Array<{ id: string; uid: string | null; assignedTo: string | null; status: string | null; month: string }>;

    // Выручка: продажи или проекты лидов с датой в периоде; seq — номер покупки лида за всё время (1 — первая).
    const revenueRows = (await (source === 'projects'
      ? q.query(
          `SELECT x.* FROM (
             SELECT p.lead_id AS "leadId", p.amount, p.currency, p.created_at AS dt,
                    to_char(p.created_at, 'YYYY-MM') AS month,
                    ROW_NUMBER() OVER (PARTITION BY p.lead_id ORDER BY p.created_at, p.id) AS seq,
                    l.name, l.status, l."assignedUserId" AS uid, l."assignedTo" AS "assignedTo"
               FROM crm_projects p
               JOIN leads l ON l.id = p.lead_id
              WHERE l."tenantId" = $1 AND ${LEAD_ALIVE_SQL} AND p.is_deleted = false
                AND p.status <> 'Проиграно'
           ) x
           WHERE x.dt >= $2::date AND x.dt < ($3::date + interval '1 day')`,
          [tenantId, fromDate, toDate],
        )
      : q.query(
          `SELECT x.* FROM (
             SELECT s.lead_id AS "leadId", s.amount, s.currency, COALESCE(s."saleDate", s."createdAt") AS dt,
                    to_char(COALESCE(s."saleDate", s."createdAt"), 'YYYY-MM') AS month,
                    ROW_NUMBER() OVER (PARTITION BY s.lead_id ORDER BY COALESCE(s."saleDate", s."createdAt"), s.id) AS seq,
                    l.name, l.status, l."assignedUserId" AS uid, l."assignedTo" AS "assignedTo"
               FROM sales s
               JOIN leads l ON l.id = s.lead_id
               LEFT JOIN sales_channels ch ON ch.id = s.channel_id
              WHERE l."tenantId" = $1 AND ${LEAD_ALIVE_SQL}
                AND COALESCE(ch."isDeleted", false) = false
                AND COALESCE(s.status, '') <> ALL($4::text[])
           ) x
           WHERE x.dt >= $2::date AND x.dt < ($3::date + interval '1 day')`,
          [tenantId, fromDate, toDate, DEAD_SALE_STATUSES],
        ))) as Array<{
      leadId: string;
      amount: string;
      currency: string | null;
      month: string;
      seq: string | number;
      name: string | null;
      status: string | null;
      uid: string | null;
      assignedTo: string | null;
    }>;

    const staffIds = [...new Set([...leadRows, ...revenueRows].map((r) => r.uid).filter((x): x is string => !!x))];
    const staff = staffIds.length
      ? ((await q.query(
          `SELECT id, full_name AS "fullName", department, avatar_url AS "avatarUrl", is_active AS "isActive"
             FROM staff_users WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
          [tenantId, staffIds],
        )) as Array<{ id: string; fullName: string | null; department: string | null; avatarUrl: string | null; isActive: boolean }>)
      : [];
    const staffById = new Map(staff.map((s) => [s.id, s]));

    type LeadAgg = { leadId: string; name: string | null; status: string | null; revenue: number; deals: number; repeatDeals: number };
    type Mgr = {
      key: string;
      userId: string | null;
      name: string | null;
      department: string | null;
      avatarUrl: string | null;
      inactive: boolean;
      months: Map<string, Cell>;
      leads: Map<string, LeadAgg>;
    };
    const mgrs = new Map<string, Mgr>();
    const mgrOf = (uid: string | null, assignedTo: string | null) => {
      const st = uid ? staffById.get(uid) : undefined;
      const nameTxt = (assignedTo || '').trim();
      const key = st ? st.id : nameTxt ? `name:${nameTxt.toLocaleLowerCase()}` : '_none';
      let m = mgrs.get(key);
      if (!m) {
        m = {
          key,
          userId: st?.id ?? null,
          name: st?.fullName || nameTxt || null,
          department: st?.department ?? null,
          avatarUrl: st?.avatarUrl ?? null,
          inactive: st ? st.isActive === false : false,
          months: new Map(),
          leads: new Map(),
        };
        mgrs.set(key, m);
      }
      return m;
    };
    const cellOf = (m: Mgr, month: string) => {
      let c = m.months.get(month);
      if (!c) {
        c = emptyCell();
        m.months.set(month, c);
      }
      return c;
    };
    const visible = restrict ? new Set(restrict) : null;

    for (const l of leadRows) {
      if (visible && !visible.has(l.id)) continue;
      const c = cellOf(mgrOf(l.uid, l.assignedTo), l.month);
      c.leads += 1;
      if (l.status === 'won') c.won += 1;
      else if (l.status === 'lost') c.lost += 1;
    }
    for (const r of revenueRows) {
      if (visible && !visible.has(r.leadId)) continue;
      const amount = conv(Number(r.amount) || 0, r.currency);
      const repeat = Number(r.seq) > 1;
      const m = mgrOf(r.uid, r.assignedTo);
      const c = cellOf(m, r.month);
      c.revenue += amount;
      c.deals += 1;
      if (repeat) {
        c.repeatRevenue += amount;
        c.repeatDeals += 1;
      }
      const ld = m.leads.get(r.leadId) ?? { leadId: r.leadId, name: r.name, status: r.status, revenue: 0, deals: 0, repeatDeals: 0 };
      ld.revenue += amount;
      ld.deals += 1;
      if (repeat) ld.repeatDeals += 1;
      m.leads.set(r.leadId, ld);
    }

    const grand = emptyCell();
    let repeatLeadsTotal = 0;
    let leadsWithRevenueTotal = 0;
    const managers = [...mgrs.values()]
      .map((m) => {
        const tot = emptyCell();
        const byMonth: Record<string, Cell> = {};
        for (const [month, c] of m.months) {
          byMonth[month] = roundCell(c);
          addCell(tot, c);
        }
        addCell(grand, tot);
        const leads = [...m.leads.values()];
        const repeatLeads = leads.filter((x) => x.repeatDeals > 0).length;
        repeatLeadsTotal += repeatLeads;
        leadsWithRevenueTotal += leads.length;
        return {
          key: m.key,
          userId: m.userId,
          name: m.name,
          department: m.department,
          avatarUrl: m.avatarUrl,
          inactive: m.inactive,
          months: byMonth,
          topLeads: leads
            .map((x) => ({ ...x, revenue: r2(x.revenue) }))
            .sort((a, b) => b.repeatDeals - a.repeatDeals || b.revenue - a.revenue)
            .slice(0, 10),
          leadsWithRevenue: leads.length,
          repeatLeads,
          total: roundCell(tot),
        };
      })
      .sort((a, b) => b.total.won - a.total.won || b.total.revenue - a.total.revenue || b.total.leads - a.total.leads);

    return {
      ...empty,
      missingRates: [...missingRates],
      managers,
      total: roundCell(grand),
      /** Лидов с повторной покупкой в периоде / лидов с любой выручкой в периоде. */
      repeatLeads: repeatLeadsTotal,
      leadsWithRevenue: leadsWithRevenueTotal,
    };
  }
}
