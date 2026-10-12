import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { AiDepartment } from './ai-department.entity';
import { AiOfficeService } from './ai-office.service';
import { AiOfficeConnectorsService } from './ai-office-connectors.service';
import { ot } from './ai-office-i18n';
import { createHash } from 'crypto';
import { queryStock, stockTable } from './ai-office-stock';
import { receptionQueues } from './ai-office-reception';
import { mismatchTable, reconcile } from './ai-office-finance';

import { normPrograms, type OfficePrograms } from './ai-office-programs';

const OPEN_LEAD = ['new', 'in_progress', 'waiting', 'contacted', 'qualified'];

/**
 * Программы работают по реальной переписке: «писали» = выполненные отправки агентов отдела этому лиду,
 * «ответил» = входящее письмо/Telegram/WhatsApp лида после последней отправки. Задачи дедуплицируются
 * по sourceRef, так что повторный проход по расписанию ничего не дублирует.
 */
@Injectable()
export class AiOfficeProgramsService implements OnApplicationBootstrap {
  private readonly log = new Logger(AiOfficeProgramsService.name);
  private running = false;

  constructor(
    @InjectRepository(AiDepartment) private readonly depts: Repository<AiDepartment>,
    private readonly office: AiOfficeService,
    private readonly connectors: AiOfficeConnectorsService,
  ) {}

  /** Программа дожима заменяет старый сценарий «лид без движения 3 дня» — иначе клиенту писали бы дважды. */
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.depts.query(
        `UPDATE automations a SET "isActive" = false FROM ai_departments d
          WHERE d.id::text = a.meta->'aiOffice'->>'departmentId' AND a.meta->'aiOffice'->>'playbook' = 'sales_follow_up'
            AND a."isActive" = true AND COALESCE((d.programs->'followup'->>'enabled')::boolean, d.template_key = 'sales')`,
      );
      // финансы: «неоплаченные 7 дней» и «недельный отчёт» теперь программы с цифрами системы
      await this.depts.query(
        `UPDATE automations a SET "isActive" = false FROM ai_departments d
          WHERE d.id::text = a.meta->'aiOffice'->>'departmentId' AND a.meta->'aiOffice'->>'playbook' IN ('finance_unpaid','finance_weekly')
            AND a."isActive" = true AND d.template_key = 'finance'`,
      );
    } catch (e) {
      this.log.warn(`programs bootstrap: ${(e as Error).message}`);
    }
  }

  @Cron('7 * * * *')
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const depts = await this.depts.find({ where: { status: 'active' } });
      for (const d of depts) {
        const p = normPrograms(d.programs, d.templateKey);
        if (p.followup.enabled) await this.followups(d, p).catch((e) => this.log.warn(`followup dept=${d.id}: ${(e as Error).message}`));
        if (p.reactivation.enabled) await this.reactivation(d, p).catch((e) => this.log.warn(`reactivation dept=${d.id}: ${(e as Error).message}`));
        if (p.adsWatch.enabled && this.localHour(d) >= 9) await this.adsWatch(d, p).catch((e) => this.log.warn(`ads watch dept=${d.id}: ${(e as Error).message}`));
        if (p.budgetReview.enabled && this.localWeekday(d) === 1 && this.localHour(d) >= 10) await this.budgetReview(d).catch((e) => this.log.warn(`budget review dept=${d.id}: ${(e as Error).message}`));
        if (p.debtReminders.enabled && this.localHour(d) >= 10) await this.debts(d, p).catch((e) => this.log.warn(`debts dept=${d.id}: ${(e as Error).message}`));
        if (p.bookingReminders.enabled || p.noShows.enabled || p.confirmations.enabled || p.reviewRequests.enabled) await this.reception(d, p).catch((e) => this.log.warn(`reception dept=${d.id}: ${(e as Error).message}`));
        if (p.reconcile.enabled && this.localHour(d) >= 9) await this.reconcile(d).catch((e) => this.log.warn(`reconcile dept=${d.id}: ${(e as Error).message}`));
        if (p.supportSla.enabled) await this.supportSla(d, p).catch((e) => this.log.warn(`support sla dept=${d.id}: ${(e as Error).message}`));
        if (p.prReview.enabled && d.connectors.includes('github')) await this.prReview(d).catch((e) => this.log.warn(`pr review dept=${d.id}: ${(e as Error).message}`));
        if (p.stockWatch.enabled && this.localHour(d) >= 9) await this.stockWatch(d).catch((e) => this.log.warn(`stock watch dept=${d.id}: ${(e as Error).message}`));
        if (p.financeWeekly.enabled && this.localWeekday(d) === 1 && this.localHour(d) >= 9) await this.financeWeekly(d).catch((e) => this.log.warn(`finance weekly dept=${d.id}: ${(e as Error).message}`));
      }
    } finally {
      this.running = false;
    }
  }

  /**
   * Автопостинг: посты одобренных контент-планов, у которых пришло время. Публикуем, только если у отдела
   * включён «Автопостинг», есть md-инструкция для контента и отдел не на паузе; пост, опоздавший больше
   * чем на сутки (автопостинг был выключен), задним числом не выходит — помечается «просрочен».
   */
  @Cron('*/5 * * * *')
  async publishDuePosts(): Promise<number> {
    const due: any[] = await this.depts.query(
      `SELECT p.id, p.tenant_id, p.department_id, p.bot_id, p.channel, p.text, p.task_id, p.publish_at, d.status dstatus, d.safety
         FROM ai_office_posts p JOIN ai_departments d ON d.id = p.department_id
        WHERE p.status = 'scheduled' AND p.publish_at <= now() ORDER BY p.publish_at LIMIT 30`,
    );
    let n = 0;
    for (const post of due) {
      if (new Date(post.publish_at).getTime() < Date.now() - 86_400_000) {
        await this.depts.query(`UPDATE ai_office_posts SET status = 'expired' WHERE id = $1`, [post.id]);
        continue;
      }
      if (post.dstatus !== 'active' || !AiOfficeService.normSafety(post.safety).autoPosting) continue;
      if (!(await this.office.hasContentInstructions(post.tenant_id, post.department_id))) continue;
      await this.office.publishScheduledPost(post).catch((e) => this.log.warn(`post ${post.id}: ${(e as Error).message}`));
      n++;
    }
    return n;
  }

  /** Запуск программ отдела сейчас (кнопка/проверка), не дожидаясь расписания. */
  async runNow(tenantId: string, departmentId: string) {
    const d = await this.office.getDeptEntity(tenantId, departmentId);
    const p = normPrograms(d.programs, d.templateKey);
    return {
      followups: p.followup.enabled ? await this.followups(d, p) : 0,
      reactivations: p.reactivation.enabled ? await this.reactivation(d, p) : 0,
      adsWatch: p.adsWatch.enabled ? await this.adsWatch(d, p) : 0,
      budgetReview: p.budgetReview.enabled ? await this.budgetReview(d) : 0,
      debts: p.debtReminders.enabled ? await this.debts(d, p) : 0,
      financeWeekly: p.financeWeekly.enabled ? await this.financeWeekly(d) : 0,
      stockWatch: p.stockWatch.enabled ? await this.stockWatch(d) : 0,
      prReview: p.prReview.enabled && d.connectors.includes('github') ? await this.prReview(d) : 0,
      supportSla: p.supportSla.enabled ? await this.supportSla(d, p) : 0,
      reception: await this.reception(d, p, true),
      reconcile: p.reconcile.enabled ? await this.reconcile(d) : 0,
    };
  }

  /** Лиды, которым отдел писал и которые молчат: шаги дожима по дням от первого сообщения, затем «потерян». */
  async followups(d: AiDepartment, p: OfficePrograms): Promise<number> {
    const rows: Array<{ id: string; name: string; first_out: Date; last_out: Date; last_in: Date | null }> = await this.depts.query(
      `WITH outs AS (
         SELECT COALESCE(a.payload->>'leadId', CASE WHEN a.target_type = 'lead' THEN a.target_id::text END) lead_id, min(a.updated_at) first_out, max(a.updated_at) last_out
           FROM ai_agent_actions a JOIN ai_agents g ON g.id = a.agent_id
          WHERE a.tenant_id = $1 AND g.department_id = $2 AND a.action_type IN ('send_email','send_telegram','send_whatsapp') AND a.status = 'executed'
          GROUP BY 1)
       SELECT l.id, l.name, o.first_out, o.last_out,
              GREATEST(
                (SELECT max(e."createdAt") FROM email_messages e WHERE e."tenantId" = $1 AND e."leadId" = l.id AND e.direction = 'incoming'),
                (SELECT max(m."createdAt") FROM telegram_messages m JOIN telegram_contacts c ON c.id = m."contactId" WHERE m."tenantId" = $1 AND c."leadId" = l.id AND m.direction = 'incoming'),
                (SELECT max(w."createdAt") FROM whatsapp_messages w JOIN whatsapp_contacts c ON c.id = w."contactId" WHERE w."tenantId" = $1 AND c."leadId" = l.id AND w.direction = 'incoming')
              ) last_in
         FROM outs o JOIN leads l ON l.id::text = o.lead_id
        WHERE l."tenantId" = $1 AND l.status = ANY($3) AND o.first_out > now() - interval '90 days'`,
      [d.tenantId, d.id, OPEN_LEAD],
    );
    const lang = await this.office.langOf(d.tenantId, d.id);
    const days = p.followup.days;
    let created = 0;
    for (const r of rows) {
      if (r.last_in && new Date(r.last_in) > new Date(r.last_out)) continue; // клиент ответил — дожим не нужен
      const since = (Date.now() - new Date(r.first_out).getTime()) / 86_400_000;
      const step = days.filter((x) => since >= x).length; // сколько шагов уже «наступило»
      if (step === 0) continue;
      const lastStepDay = days[days.length - 1];
      const lose = p.followup.loseAfterDays > 0 && since >= lastStepDay + p.followup.loseAfterDays;
      const ref = lose ? `followup:${r.id}:lost` : `followup:${r.id}:${step}`;
      if (await this.exists(d, ref)) continue;
      await this.office.createTask(d.tenantId, {
        departmentId: d.id,
        title: lose ? ot(lang, 'prog_lost_title', { name: r.name }) : ot(lang, 'prog_followup_title', { n: step, name: r.name }),
        details: lose
          ? ot(lang, 'prog_lost_details', { days: Math.round(since) })
          : ot(lang, 'prog_followup_details', { n: step, total: days.length, days: Math.round(since) }),
        entityType: 'lead',
        entityId: r.id,
        source: 'program',
        sourceRef: ref,
        priority: 2,
      });
      created++;
    }
    return created;
  }

  /** Раз в неделю: «потерянные» лиды, не тронутые N дней и не реанимированные за полгода. */
  async reactivation(d: AiDepartment, p: OfficePrograms): Promise<number> {
    const week = `${new Date().getUTCFullYear()}-w${Math.floor((Date.now() / 86_400_000 + 3) / 7)}`;
    const done: Array<{ n: string }> = await this.depts.query(
      `SELECT count(*) n FROM ai_office_tasks WHERE tenant_id = $1 AND department_id = $2 AND source_ref LIKE $3`,
      [d.tenantId, d.id, `reactivate:%:${week}`],
    );
    const left = p.reactivation.perWeek - Number(done[0]?.n ?? 0);
    if (left <= 0) return 0;
    const rows: Array<{ id: string; name: string }> = await this.depts.query(
      `SELECT l.id, l.name FROM leads l
        WHERE l."tenantId" = $1 AND l.status = 'lost' AND l."updatedAt" < now() - make_interval(days => $2)
          AND (COALESCE(l.email, '') <> '' OR COALESCE(l.phone, '') <> '')
          AND NOT EXISTS (SELECT 1 FROM ai_office_tasks t WHERE t.tenant_id = $1 AND t.source_ref LIKE 'reactivate:' || l.id || ':%' AND t.created_at > now() - interval '180 days')
        ORDER BY l."updatedAt" DESC LIMIT $3`,
      [d.tenantId, p.reactivation.afterDays, left],
    );
    const lang = await this.office.langOf(d.tenantId, d.id);
    for (const r of rows) {
      await this.office.createTask(d.tenantId, {
        departmentId: d.id,
        title: ot(lang, 'prog_react_title', { name: r.name }),
        details: ot(lang, 'prog_react_details', { days: p.reactivation.afterDays }),
        entityType: 'lead',
        entityId: r.id,
        source: 'program',
        sourceRef: `reactivate:${r.id}:${week}`,
        priority: 3,
      });
    }
    return rows.length;
  }

  private localHour(d: AiDepartment): number {
    try {
      return Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: d.timezone || 'UTC' }).format(new Date()));
    } catch {
      return new Date().getUTCHours();
    }
  }

  private localWeekday(d: AiDepartment): number {
    try {
      const w = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: d.timezone || 'UTC' }).format(new Date());
      return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(w);
    } catch {
      return new Date().getUTCDay();
    }
  }

  private fmt(v: number, lang: string): string {
    return Math.round(v).toLocaleString(lang === 'ru' ? 'ru-RU' : lang === 'tr' ? 'tr-TR' : 'en-US');
  }

  /** Кампании не на конверсии (охват, трафик, вовлечение, видео) — без конверсий так задумано. */
  private static AWARENESS_RE = /awareness|reach|охват|узнаваем|brand ?lift|video|видео|engagement|вовлеч|profile|post ?boost|boost|traffic|трафик|bilinirlik|erişim|etkileşim|trafik/i;

  /** Ежедневно: кампании, которые N полных дней тратят без единой конверсии. Цифры — системные, не модели. */
  async adsWatch(d: AiDepartment, p: OfficePrograms): Promise<number> {
    const ref = `adswatch:${new Date().toISOString().slice(0, 10)}`;
    if (await this.exists(d, ref)) return 0;
    const rows: Array<{ src: string; campaign: string; currency: string; cost: string; clicks: string; conv30: string }> = await this.depts.query(
      `WITH w AS (
         SELECT "dataSource" src, campaign, currency, sum(cost) cost, sum(conversions) conv, sum("allConversions") allconv, sum(clicks) clicks
           FROM marketing_traffic
          WHERE "tenantId" = $1 AND date >= current_date - $2::int AND date < current_date AND COALESCE(campaign, '') <> ''
            AND ("dataSource" LIKE 'google_ads%' OR "dataSource" LIKE 'meta_ads%')
          GROUP BY 1, 2, 3),
       h AS (
         SELECT "dataSource" src, campaign, sum(conversions) conv30 FROM marketing_traffic
          WHERE "tenantId" = $1 AND date >= current_date - 33 AND date < current_date - $2::int GROUP BY 1, 2),
       tot AS (SELECT currency, sum(cost) total FROM w GROUP BY 1)
       SELECT w.src, w.campaign, w.currency, w.cost, w.clicks, COALESCE(h.conv30, 0) conv30
         FROM w LEFT JOIN h ON h.src = w.src AND h.campaign = w.campaign JOIN tot ON tot.currency = w.currency
        WHERE w.cost > 0 AND w.conv = 0 AND w.allconv = 0 AND w.cost >= tot.total * 0.005
        ORDER BY w.cost DESC LIMIT 40`,
      [d.tenantId, p.adsWatch.days],
    );
    // тревога: конверсии пропали (раньше были) ИЛИ кампания на конверсии заметно тратит впустую
    const totalBy = new Map<string, number>();
    rows.forEach((r) => totalBy.set(r.currency, Math.max(totalBy.get(r.currency) ?? 0, 0)));
    const spend3: Array<{ currency: string; total: string }> = await this.depts.query(
      `SELECT currency, sum(cost) total FROM marketing_traffic WHERE "tenantId" = $1 AND date >= current_date - $2::int AND date < current_date
         AND ("dataSource" LIKE 'google_ads%' OR "dataSource" LIKE 'meta_ads%') GROUP BY 1`,
      [d.tenantId, p.adsWatch.days],
    );
    spend3.forEach((x) => totalBy.set(x.currency, Number(x.total)));
    const flagged = rows
      // «пропали»: по прошлому темпу за эти дни ожидалось ≥3 конверсий (иначе ноль — обычный разброс малых кампаний)
      .filter((r) => (Number(r.conv30) * p.adsWatch.days) / 30 >= 3 || (Number(r.conv30) === 0 && !AiOfficeProgramsService.AWARENESS_RE.test(r.campaign) && Number(r.cost) >= (totalBy.get(r.currency) ?? 0) * 0.02))
      .slice(0, 12);
    if (!flagged.length) return 0;
    const lang = await this.office.langOf(d.tenantId, d.id);
    const spent = new Map<string, number>();
    flagged.forEach((r) => spent.set(r.currency, (spent.get(r.currency) ?? 0) + Number(r.cost)));
    const total = [...spent].map(([c, v]) => `${this.fmt(v, lang)} ${c}`).join(' + ');
    const table = [
      `| ${ot(lang, 'aw_col_campaign')} | ${ot(lang, 'aw_col_spend', { n: p.adsWatch.days })} | ${ot(lang, 'aw_col_clicks')} | ${ot(lang, 'aw_col_conv30')} |`,
      '|---|---|---|---|',
      ...flagged.map((r) => `| ${r.campaign.replace(/\|/g, '/')} (${r.src}) | ${this.fmt(Number(r.cost), lang)} ${r.currency} | ${this.fmt(Number(r.clicks), lang)} | ${this.fmt(Number(r.conv30), lang)}${Number(r.conv30) > 0 ? ' ⚠' : ''} |`),
    ].join('\n');
    await this.office.createTask(d.tenantId, {
      departmentId: d.id,
      title: ot(lang, 'aw_title', { n: flagged.length, days: p.adsWatch.days, total }),
      details: `${ot(lang, 'aw_details', { days: p.adsWatch.days })}\n\n${table}`,
      source: 'program',
      sourceRef: ref,
      priority: 1,
    });
    await this.office.notifyOwners(d.tenantId, d.id, ot(lang, 'aw_title', { n: flagged.length, days: p.adsWatch.days, total }), ot(lang, 'aw_notify'));
    return 1;
  }

  /** По понедельникам: ROAS и цена конверсии по кампаниям за 14 дней → кандидаты урезать / масштабировать. */
  async budgetReview(d: AiDepartment): Promise<number> {
    const week = `${new Date().getUTCFullYear()}-w${Math.floor((Date.now() / 86_400_000 + 3) / 7)}`;
    const ref = `budget:${week}`;
    if (await this.exists(d, ref)) return 0;
    const rows: Array<{ src: string; campaign: string; currency: string; cost: string; conv: string; val: string }> = await this.depts.query(
      `SELECT "dataSource" src, campaign, currency, sum(cost) cost, sum(conversions) conv, sum("conversionValue") val
         FROM marketing_traffic
        WHERE "tenantId" = $1 AND date >= current_date - 14 AND date < current_date AND COALESCE(campaign, '') <> '' AND cost > 0
          AND ("dataSource" LIKE 'google_ads%' OR "dataSource" LIKE 'meta_ads%')
        GROUP BY 1, 2, 3 ORDER BY sum(cost) DESC LIMIT 20`,
      [d.tenantId],
    );
    if (rows.length < 2) return 0;
    const lang = await this.office.langOf(d.tenantId, d.id);
    const roas = (r: (typeof rows)[number]) => (Number(r.cost) > 0 && Number(r.val) > 0 ? Number(r.val) / Number(r.cost) : 0);
    const sorted = rows.map(roas).filter((x) => x > 0).sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    const totals = new Map<string, number>();
    rows.forEach((r) => totals.set(r.currency, (totals.get(r.currency) ?? 0) + Number(r.cost)));
    const mark = (r: (typeof rows)[number]) => {
      if (AiOfficeProgramsService.AWARENESS_RE.test(r.campaign)) return ot(lang, 'br_awareness');
      const ro = roas(r);
      if ((ro > 0 && ro < 1) || (Number(r.conv) === 0 && Number(r.cost) >= (totals.get(r.currency) ?? 0) * 0.05)) return ot(lang, 'br_cut');
      if (ro >= Math.max(2, median * 1.5) && Number(r.conv) >= 5) return ot(lang, 'br_scale');
      return '';
    };
    const table = [
      `| ${ot(lang, 'aw_col_campaign')} | ${ot(lang, 'br_col_spend')} | ${ot(lang, 'br_col_daily')} | ${ot(lang, 'br_col_conv')} | ROAS | ${ot(lang, 'br_col_cpa')} | ${ot(lang, 'br_col_mark')} |`,
      '|---|---|---|---|---|---|---|',
      ...rows.map((r) => {
        const c = Number(r.cost);
        const cv = Number(r.conv);
        const ro = roas(r);
        return `| ${r.campaign.replace(/\|/g, '/')} (${r.src}) | ${this.fmt(c, lang)} ${r.currency} | ${this.fmt(c / 14, lang)} | ${this.fmt(cv, lang)} | ${ro ? ro.toFixed(2) : '—'} | ${cv > 0 ? `${this.fmt(c / cv, lang)} ${r.currency}` : '—'} | ${mark(r)} |`;
      }),
    ].join('\n');
    await this.office.createTask(d.tenantId, {
      departmentId: d.id,
      title: ot(lang, 'br_title'),
      details: `${ot(lang, 'br_details')}\n\n${table}`,
      source: 'program',
      sourceRef: ref,
      priority: 2,
    });
    return 1;
  }

  /** Неоплаченные продажи: напоминание клиенту со ссылкой на оплату на 3-й/7-й/14-й день от даты продажи. */
  async debts(d: AiDepartment, p: OfficePrograms): Promise<number> {
    const rows: Array<{ id: string; amount: number; currency: string; days: number; client: string | null }> = await this.depts.query(
      `SELECT s.id, s.amount, s.currency, floor(extract(epoch FROM now() - COALESCE(s."saleDate", s."createdAt")) / 86400)::int days,
              COALESCE(NULLIF(c."fullName", ''), l.name) client
         FROM sales s LEFT JOIN contacts c ON c.id = s.contact_id LEFT JOIN leads l ON l.id = s.lead_id
        WHERE s."tenantId" = $1 AND s.status IN ('confirmed','pending','on_hold') AND s.amount > 0
          AND NOT EXISTS (SELECT 1 FROM payments p WHERE p."saleId" = s.id AND p.status = 'paid') /* онлайн-оплата ставит продаже confirmed — это не долг */
          AND COALESCE(NULLIF(c.email, ''), NULLIF(l.email, '')) IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM payments p WHERE p."saleId" = s.id AND p.status = 'failed' AND p."updatedAt" > now() - interval '3 days') /* неудачную оплату ведёт сверка */
          AND COALESCE(s."saleDate", s."createdAt") > now() - interval '120 days'`,
      [d.tenantId],
    );
    const lang = await this.office.langOf(d.tenantId, d.id);
    let created = 0;
    for (const r of rows) {
      const step = p.debtReminders.days.filter((x) => r.days >= x).length;
      if (!step) continue;
      const ref = `debt:${r.id}:${step}`;
      if (await this.exists(d, ref)) continue;
      const amount = `${this.fmt(Number(r.amount), lang)} ${r.currency}`;
      await this.office.createTask(d.tenantId, {
        departmentId: d.id,
        title: ot(lang, 'debt_title', { n: step, client: r.client ?? '—', amount }),
        details: ot(lang, 'debt_details', { days: r.days, amount, n: step, total: p.debtReminders.days.length }),
        entityType: 'sale',
        entityId: r.id,
        source: 'program',
        sourceRef: ref,
        priority: 2,
      });
      created++;
    }
    return created;
  }

  /** Понедельник: финансовая сводка — неделя к неделе по статусам/валютам и список должников. */
  async financeWeekly(d: AiDepartment): Promise<number> {
    const week = `${new Date().getUTCFullYear()}-w${Math.floor((Date.now() / 86_400_000 + 3) / 7)}`;
    const ref = `finweek:${week}`;
    if (await this.exists(d, ref)) return 0;
    const lang = await this.office.langOf(d.tenantId, d.id);
    const agg: Array<{ wk: string; status: string; currency: string; n: string; sum: string }> = await this.depts.query(
      `SELECT CASE WHEN COALESCE("saleDate", "createdAt") >= now() - interval '7 days' THEN 'this' ELSE 'prev' END wk, status, currency, count(*) n, sum(amount) sum
         FROM sales WHERE "tenantId" = $1 AND COALESCE("saleDate", "createdAt") >= now() - interval '14 days' GROUP BY 1, 2, 3 ORDER BY 1 DESC, 5 DESC`,
      [d.tenantId],
    );
    const debtors: Array<{ client: string | null; amount: number; currency: string; days: number; status: string }> = await this.depts.query(
      `SELECT COALESCE(NULLIF(c."fullName", ''), l.name) client, s.amount, s.currency, s.status, floor(extract(epoch FROM now() - COALESCE(s."saleDate", s."createdAt")) / 86400)::int days
         FROM sales s LEFT JOIN contacts c ON c.id = s.contact_id LEFT JOIN leads l ON l.id = s.lead_id
        WHERE s."tenantId" = $1 AND s.status IN ('confirmed','pending','on_hold') AND s.amount > 0
          AND NOT EXISTS (SELECT 1 FROM payments p WHERE p."saleId" = s.id AND p.status = 'paid') /* онлайн-оплата ставит продаже confirmed — это не долг */ AND COALESCE(s."saleDate", s."createdAt") < now() - interval '7 days'
        ORDER BY s.amount DESC LIMIT 10`,
      [d.tenantId],
    );
    if (!agg.length && !debtors.length) return 0;
    const t1 = [
      `| ${ot(lang, 'fin_col_week')} | ${ot(lang, 'fin_col_status')} | ${ot(lang, 'fin_col_count')} | ${ot(lang, 'fin_col_sum')} |`,
      '|---|---|---|---|',
      ...agg.map((r) => `| ${ot(lang, r.wk === 'this' ? 'fin_this' : 'fin_prev')} | ${r.status} | ${r.n} | ${this.fmt(Number(r.sum), lang)} ${r.currency} |`),
    ].join('\n');
    const t2 = debtors.length
      ? [`| ${ot(lang, 'fin_col_client')} | ${ot(lang, 'fin_col_sum')} | ${ot(lang, 'fin_col_days')} | ${ot(lang, 'fin_col_status')} |`, '|---|---|---|---|', ...debtors.map((r) => `| ${r.client ?? '—'} | ${this.fmt(Number(r.amount), lang)} ${r.currency} | ${r.days} | ${r.status} |`)].join('\n')
      : ot(lang, 'fin_no_debtors');
    await this.office.createTask(d.tenantId, {
      departmentId: d.id,
      title: ot(lang, 'fin_title'),
      details: `${ot(lang, 'fin_details')}\n\n${t1}\n\n${ot(lang, 'fin_debtors')}\n\n${t2}`,
      source: 'program',
      sourceRef: ref,
      priority: 2,
    });
    return 1;
  }

  /**
   * Склад: позиции на исходе → одна задача «Дозаказ» со списком и количеством от системы. Тот же набор
   * позиций не повторяется в течение недели; появилась новая позиция — новая задача.
   */
  async stockWatch(d: AiDepartment): Promise<number> {
    const st = await queryStock(this.depts, d.tenantId);
    const need = st.rows.filter((r) => r.state !== 'ok' && r.suggestQty > 0);
    if (!need.length) return 0;
    const week = Math.floor((Date.now() / 86_400_000 + 3) / 7);
    const key = createHash('sha1').update(need.map((r) => `${r.productId}:${r.variantId ?? ''}`).sort().join(',')).digest('hex').slice(0, 16);
    const ref = `stockwatch:${week}:${key}`;
    if (await this.exists(d, ref)) return 0;
    const lang = await this.office.langOf(d.tenantId, d.id);
    await this.office.createTask(d.tenantId, {
      departmentId: d.id,
      title: ot(lang, 'sw_title', { n: need.length }),
      details: `${ot(lang, 'sw_details')}\n\n${stockTable(lang, need, 40)}\n\nproductIds: ${JSON.stringify(need.map((r) => ({ productId: r.productId, name: r.name, suggestQty: r.suggestQty })))}`,
      source: 'program',
      sourceRef: ref,
      priority: need.some((r) => r.state === 'out') ? 1 : 2,
    });
    return 1;
  }

  /**
   * Разработка: каждый открытый PR (не черновик) с новым head-коммитом → задача «Ревью PR #N». Ревью
   * привязано к коммиту: после новых коммитов отдел смотрит PR снова, по старому — не повторяет.
   */
  async prReview(d: AiDepartment): Promise<number> {
    const prs = await this.connectors.openPullRequests(d.tenantId, d);
    const lang = await this.office.langOf(d.tenantId, d.id);
    let created = 0;
    for (const pr of prs) {
      if (pr.draft || !pr.sha || created >= 5) continue;
      const ref = `pr:${pr.repo}#${pr.number}:${pr.sha.slice(0, 12)}`;
      if (await this.exists(d, ref)) continue;
      await this.office.createTask(d.tenantId, {
        departmentId: d.id,
        title: ot(lang, 'pr_title', { n: pr.number, title: pr.title.slice(0, 150) }),
        details: ot(lang, 'pr_details', { n: pr.number, author: pr.author, sha: pr.sha.slice(0, 7) }),
        source: 'program',
        sourceRef: ref,
        priority: 2,
      });
      created++;
    }
    return created;
  }

  /**
   * Поддержка: заявки, где последнее сообщение — от клиента и ему больше N часов (отдел стоял на паузе,
   * сценарий выключен, ответ отклонили). Одна задача на одно непрочитанное сообщение клиента.
   */
  async supportSla(d: AiDepartment, p: OfficePrograms): Promise<number> {
    const rows: Array<{ id: string; subject: string; msg_id: string; hours: number }> = await this.depts.query(
      `SELECT h.id, h.subject, lm.id msg_id, floor(extract(epoch FROM now() - lm."createdAt") / 3600)::int hours
         FROM helpdesk_tickets h
         JOIN LATERAL (SELECT id, direction, "createdAt" FROM helpdesk_ticket_messages m WHERE m."ticketId" = h.id ORDER BY "createdAt" DESC LIMIT 1) lm ON true
        WHERE h."tenantId" = $1 AND h.status IN ('open','pending') AND lm.direction = 'incoming'
          AND lm."createdAt" < now() - make_interval(hours => $2::int) AND lm."createdAt" > now() - interval '14 days'
          AND NOT EXISTS (SELECT 1 FROM ai_office_tasks t WHERE t.tenant_id = h."tenantId" AND t.department_id = $3 AND t.entity_type = 'helpdesk_ticket'
                          AND t.entity_id = h.id::text AND t.status IN ('backlog','progress','waiting','blocked'))
        ORDER BY lm."createdAt" ASC LIMIT 10`,
      [d.tenantId, p.supportSla.hours, d.id],
    );
    const lang = await this.office.langOf(d.tenantId, d.id);
    let created = 0;
    for (const r of rows) {
      const ref = `sla:${r.id}:${r.msg_id}`;
      if (await this.exists(d, ref)) continue;
      await this.office.createTask(d.tenantId, {
        departmentId: d.id,
        title: ot(lang, 'sla_title', { h: r.hours, subject: String(r.subject).slice(0, 120) }),
        details: ot(lang, 'sla_details', { h: r.hours }),
        entityType: 'helpdesk_ticket',
        entityId: r.id,
        source: 'program',
        sourceRef: ref,
        priority: 1,
      });
      created++;
    }
    return created;
  }

  /**
   * Ресепшн: одна задача на одну бронь и один повод (напомнить / неявка / подтвердить / отзыв). Повод
   * по брони не повторяется; письма гостям — только днём по времени отдела (неявки и подтверждения — сразу).
   */
  async reception(d: AiDepartment, p: OfficePrograms, force = false): Promise<number> {
    const q = await receptionQueues(this.depts, d.tenantId);
    const lang = await this.office.langOf(d.tenantId, d.id);
    const day = force || (this.localHour(d) >= 10 && this.localHour(d) < 20);
    const plan: Array<{ on: boolean; items: typeof q.tomorrow; key: string; prio: 1 | 2 | 3 }> = [
      { on: p.noShows.enabled, items: q.noShow, key: 'noshow', prio: 2 },
      { on: p.confirmations.enabled, items: q.unconfirmed, key: 'confirm', prio: 1 },
      { on: p.bookingReminders.enabled && day, items: q.tomorrow, key: 'remind', prio: 2 },
      { on: p.reviewRequests.enabled && day, items: q.review, key: 'review', prio: 3 },
    ];
    let created = 0;
    for (const step of plan) {
      if (!step.on) continue;
      for (const it of step.items) {
        if (created >= 25) return created;
        const ref = `rcp:${step.key}:${it.id}`;
        if (await this.exists(d, ref)) continue;
        await this.office.createTask(d.tenantId, {
          departmentId: d.id,
          title: ot(lang, `rcp_${step.key}_title`),
          details: ot(lang, `rcp_${step.key}_details`),
          entityType: it.kind === 'hotel' ? 'hotel_reservation' : 'reservation',
          entityId: it.id,
          source: 'program',
          sourceRef: ref,
          priority: step.prio,
        });
        created++;
      }
    }
    return created;
  }

  /** Финансы: расхождения «платёж ↔ продажа» — одна задача на набор расхождений (новое расхождение — новая задача). */
  async reconcile(d: AiDepartment): Promise<number> {
    const rows = await reconcile(this.depts, d.tenantId);
    if (!rows.length) return 0;
    const key = createHash('sha1').update(rows.map((r) => `${r.kind}:${r.saleId}`).sort().join(',')).digest('hex').slice(0, 16);
    const ref = `reconcile:${key}`;
    if (await this.exists(d, ref)) return 0;
    const lang = await this.office.langOf(d.tenantId, d.id);
    await this.office.createTask(d.tenantId, {
      departmentId: d.id,
      title: ot(lang, 'rec_title', { n: rows.length }),
      details: `${ot(lang, 'rec_details')}\n\n${mismatchTable(lang, rows)}`,
      source: 'program',
      sourceRef: ref,
      priority: rows.some((r) => r.kind === 'not_marked') ? 1 : 2,
    });
    return 1;
  }

  private async exists(d: AiDepartment, ref: string): Promise<boolean> {
    const r: Array<{ n: string }> = await this.depts.query(`SELECT count(*) n FROM ai_office_tasks WHERE tenant_id = $1 AND department_id = $2 AND source_ref = $3`, [d.tenantId, d.id, ref]);
    return Number(r[0]?.n ?? 0) > 0;
  }
}
