import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThan, Not, Repository } from 'typeorm';
import { AiDepartment } from './ai-department.entity';
import { AiOfficeTask, type OfficeTaskStatus } from './ai-office-task.entity';
import { AiOfficeIssue } from './ai-office-issue.entity';
import { AiOfficeEvent } from './ai-office-event.entity';
import { AiAgent } from '../ai-employees/ai-agent.entity';
import { AiAgentAction } from '../ai-employees/ai-agent-action.entity';
import { Tenant } from '../tenants/tenant.entity';
import { normalizeTenantPlan } from '../tenants/plan-entitlements';
import { AiEmployeesService } from '../ai-employees/ai-employees.service';
import { AiBrainService } from './ai-brain.service';
import {
  OFFICE_COLORS,
  OFFICE_EXTRA_SLOT_EUR,
  OFFICE_KPIS,
  OFFICE_MAX_AGENTS,
  OFFICE_PERM_CATEGORIES,
  OFFICE_RULES,
  OFFICE_SLOTS,
  OFFICE_TEMPLATES,
  OFFICE_WORK_HOURS,
  getOfficeTemplate,
  includedDepartmentsForPlan,
  levelsFor,
  matrixGrants,
  normalizeMatrix,
  type OfficeKpi,
} from './ai-office-catalog';
import { OFFICE_AGENT_ROLE_KEY, type OfficeHooks, type OfficeRunContext } from './ai-office-bridge';
import { agentLanguageFor, langFromUi, normLang, ot } from './ai-office-i18n';
import { OFFICE_PLAYBOOKS, toAutomationVars } from './ai-office-playbooks';
import { AiOfficeConnectorsService } from './ai-office-connectors.service';
import { AiOfficeDataService, accessIssueText } from './ai-office-data.service';
import { knownSupplierEmail } from './ai-office-stock';
import axios from 'axios';
import { createHash } from 'crypto';
import { ESCALATE_RE } from './ai-office-escalate';
import { bookingContact, bookingKindOf, bookingVars, fillTemplate, type BookingKind } from './ai-office-reception';
import { RECEPTION_TEMPLATE_KEYS } from './ai-office-starter-templates';
import { readAiAgentConfig } from '../ai-employees/ai-employee-triggers';
import { normPrograms } from './ai-office-programs';
import { STARTER_TEMPLATES } from './ai-office-starter-templates';

type Lang = 'ru' | 'en' | 'tr';

export type DepartmentInput = {
  templateKey?: string | null;
  name?: string;
  color?: string;
  mission?: string;
  systemPrompt?: string;
  rules?: string[];
  permissions?: Record<string, string>;
  connectors?: string[];
  engine?: { mode?: string; connectionId?: string | null };
  monthlyBudgetCents?: number;
  parallelLimit?: number;
  safety?: { dailySends?: number; minHoursPerClient?: number; stopList?: string[]; allowAdChanges?: boolean; autoPurchaseOrders?: boolean; autoKbReplies?: boolean; autoBookingMessages?: boolean; autoPosting?: boolean };
  curatorAgentId?: string | null;
  programs?: Record<string, any>;
  workHours?: string;
  timezone?: string;
  kpis?: string[];
  proactiveEveryHours?: number;
  language?: string;
  agents?: Array<{ id?: string; title?: string; isLead?: boolean; prompt?: string }>;
};

const OPEN_STATUSES: OfficeTaskStatus[] = ['backlog', 'progress', 'waiting', 'blocked'];
const RULE_TEXT: Record<string, string> = {
  no_client_send_without_approval: 'Never send anything to a client without human approval (your sends go to approval automatically).',
  respect_daily_budget: 'Stay within the daily spend limit — do the most valuable work first.',
  write_brain_notes: 'After finishing a task, the result is written to the department findings log in the Brain; use brain_write for reusable knowledge (procedures, findings, data).',
  notify_slack_on_done: 'Each delivered task is announced in Slack automatically.',
  approve_sensitive: 'Messages about prices, discounts, payments, invoices or contracts always go to the owner for approval, even when you may send on your own.',
  no_pii_outside_crm: 'Never put personal data (client names, emails, phones) into external services (Notion, Canva, GitHub, Slack) — keep it inside the CRM.',
};

/**
 * ИИ-офис: отделы, их агенты, задачи, согласования, «нужна помощь» и журнал. Исполнение задач —
 * AiOfficeEngineService (очередь, расписание, бюджет), сами запуски агентов — движок ИИ-сотрудников
 * через хуки (ai-office-bridge.ts).
 */
@Injectable()
export class AiOfficeService implements OnModuleInit, OfficeHooks {
  private readonly log = new Logger(AiOfficeService.name);
  private ctxCache = new Map<string, { at: number; dept: AiDepartment; agents: AiAgent[]; others: AiDepartment[] }>();
  /** Двигатель подписывается, чтобы мгновенно взять новую задачу (а не ждать минутный тик). */
  onTaskQueued: (() => void) | null = null;

  constructor(
    @InjectRepository(AiDepartment) private readonly depts: Repository<AiDepartment>,
    @InjectRepository(AiOfficeTask) private readonly tasks: Repository<AiOfficeTask>,
    @InjectRepository(AiOfficeIssue) private readonly issues: Repository<AiOfficeIssue>,
    @InjectRepository(AiOfficeEvent) private readonly events: Repository<AiOfficeEvent>,
    @InjectRepository(AiAgent) private readonly agents: Repository<AiAgent>,
    @InjectRepository(AiAgentAction) private readonly actions: Repository<AiAgentAction>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    private readonly aiEmployees: AiEmployeesService,
    private readonly brain: AiBrainService,
    private readonly connectors: AiOfficeConnectorsService,
    private readonly data: AiOfficeDataService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit(): void {
    this.aiEmployees.registerOfficeHooks(this);
  }

  // ───────────────────────── общее ─────────────────────────

  /** Язык отдела (на нём агенты пишут задачи, итоги и журнал); без отдела — язык компании. */
  async langOf(tenantId: string, departmentId?: string | null): Promise<Lang> {
    if (departmentId) {
      const d = await this.depts.findOne({ where: { id: departmentId }, select: ['id', 'language'] });
      const dl = normLang(d?.language);
      if (dl) return dl;
    }
    const t = await this.tenants.findOne({ where: { id: tenantId }, select: ['id', 'uiLanguage'] as any });
    return langFromUi((t as any)?.uiLanguage);
  }

  invalidate(departmentId?: string) {
    if (departmentId) this.ctxCache.delete(departmentId);
    else this.ctxCache.clear();
  }

  async addEvent(e: Partial<AiOfficeEvent> & { tenantId: string; kind: string; text: string }) {
    try {
      await this.events.save(this.events.create({ level: 'ok', ...e, text: e.text.slice(0, 500) }));
    } catch (err) {
      this.log.warn(`office event failed: ${(err as Error).message}`);
    }
  }

  /** Событие для автоматизаций (тот же вход, что у событий CRM). */
  async emitAutomation(tenantId: string, event: string, data: Record<string, unknown>) {
    try {
      const { AutomationsService } = await import('../automations/automations.service.js');
      await this.moduleRef.get(AutomationsService, { strict: false }).triggerAutomation(tenantId, event as any, data);
    } catch (e) {
      this.log.warn(`office automation event ${event} failed: ${(e as Error).message}`);
    }
  }

  // ───────────────────────── тариф и слоты ─────────────────────────

  async planInfo(tenantId: string) {
    const rows: Array<{ plan: string; extra: number; until: Date | null }> = await this.tenants.query(
      `SELECT plan, ai_office_extra_slots AS extra, ai_office_slots_until AS until FROM tenants WHERE id = $1`,
      [tenantId],
    );
    if (!rows.length) throw new NotFoundException('Tenant not found');
    const plan = normalizeTenantPlan(rows[0].plan);
    const included = includedDepartmentsForPlan(plan);
    const until = rows[0].until ? new Date(rows[0].until) : null;
    const extraSlots = Number(rows[0].extra || 0);
    const extraActive = until && until.getTime() > Date.now() ? extraSlots : 0;
    const used = await this.depts.count({ where: { tenantId } });
    return {
      plan,
      available: included > 0,
      included,
      extraSlots,
      extraActive,
      slotsUntil: until,
      capacity: included > 0 ? Math.min(OFFICE_SLOTS.length, included + extraActive) : 0,
      used,
      maxDepartments: OFFICE_SLOTS.length,
      extraPriceEur: OFFICE_EXTRA_SLOT_EUR,
    };
  }

  private assertPlan(plan: Awaited<ReturnType<AiOfficeService['planInfo']>>) {
    if (!plan.available) {
      throw new ForbiddenException({ code: 'AI_OFFICE_PLAN', message: 'AI departments are available on Enterprise and Ultimate plans' });
    }
  }

  // ───────────────────────── отделы ─────────────────────────

  templates(lang: Lang) {
    return OFFICE_TEMPLATES.map((t) => ({
      key: t.key,
      color: t.color,
      name: t.name[lang],
      mission: t.mission[lang],
      agents: t.agents.map((a) => ({ title: a.title[lang], isLead: !!a.lead, prompt: a.prompt[lang] })),
      permissions: t.permissions,
      rules: t.rules,
      connectors: t.connectors,
      kpis: t.kpis,
    }));
  }

  catalog() {
    return {
      categories: OFFICE_PERM_CATEGORIES.map((c) => ({ key: c.key, levels: levelsFor(c.key) })),
      rules: OFFICE_RULES,
      workHours: OFFICE_WORK_HOURS,
      colors: OFFICE_COLORS,
      kpis: OFFICE_KPIS,
      maxAgents: OFFICE_MAX_AGENTS,
      slots: OFFICE_SLOTS,
    };
  }

  private agentDto(a: AiAgent) {
    return { id: a.id, title: a.jobTitle || a.name, isLead: a.isLead, prompt: a.officePrompt ?? '', status: a.status, sort: a.officeSort };
  }

  deptDto(d: AiDepartment, agents: AiAgent[]) {
    return {
      id: d.id,
      name: d.name,
      color: d.color,
      slot: [d.slotX, d.slotY] as [number, number],
      templateKey: d.templateKey,
      mission: d.mission,
      systemPrompt: d.systemPrompt,
      rules: d.rules,
      permissions: normalizeMatrix(d.permissions),
      connectors: d.connectors,
      engine: d.engine,
      monthlyBudgetCents: d.monthlyBudgetCents,
      parallelLimit: d.parallelLimit,
      safety: AiOfficeService.normSafety(d.safety),
      curatorAgentId: d.curatorAgentId ?? null,
      programs: normPrograms(d.programs, d.templateKey),
      workHours: d.workHours,
      timezone: d.timezone,
      status: d.status,
      pausedReason: d.pausedReason,
      kpis: d.kpis,
      proactiveEveryHours: d.proactiveEveryHours,
      lastPlannedAt: d.lastPlannedAt,
      language: normLang(d.language) ?? 'en',
      sort: d.sort,
      createdAt: d.createdAt,
      agents: agents
        .filter((a) => a.departmentId === d.id)
        .sort((a, b) => Number(b.isLead) - Number(a.isLead) || a.officeSort - b.officeSort)
        .map((a) => this.agentDto(a)),
    };
  }

  async getDeptEntity(tenantId: string, id: string) {
    const d = await this.depts.findOne({ where: { tenantId, id } });
    if (!d) throw new NotFoundException('Department not found');
    return d;
  }

  async deptAgents(tenantId: string, departmentIds: string[]) {
    if (!departmentIds.length) return [];
    return this.agents.find({ where: { tenantId, departmentId: In(departmentIds) } });
  }

  private cleanText(v: unknown, max: number, fallback = '') {
    return String(v ?? fallback).replace(/\u0000/g, '').trim().slice(0, max);
  }

  private normalizeInput(input: DepartmentInput, base: Partial<AiDepartment>, lang: Lang): Partial<AiDepartment> {
    const out: Partial<AiDepartment> = {};
    if (input.name !== undefined || base.name === undefined) out.name = this.cleanText(input.name, 120) || base.name || 'AI department';
    if (input.color !== undefined) out.color = /^#[0-9a-f]{6}$/i.test(String(input.color)) ? String(input.color) : base.color ?? OFFICE_COLORS[0];
    if (input.mission !== undefined) out.mission = this.cleanText(input.mission, 4000);
    if (input.systemPrompt !== undefined) out.systemPrompt = this.cleanText(input.systemPrompt, 12000);
    if (input.rules !== undefined) out.rules = (input.rules || []).map(String).filter((r) => (OFFICE_RULES as readonly string[]).includes(r));
    if (input.permissions !== undefined) out.permissions = normalizeMatrix(input.permissions);
    if (input.connectors !== undefined) out.connectors = [...new Set((input.connectors || []).map((c) => String(c).slice(0, 40)))].slice(0, 40);
    if (input.engine !== undefined) {
      const mode = input.engine?.mode === 'byok' && input.engine.connectionId ? 'byok' : 'platform';
      out.engine = { mode, connectionId: mode === 'byok' ? String(input.engine!.connectionId) : null };
    }
    if (input.monthlyBudgetCents !== undefined) out.monthlyBudgetCents = Math.max(500, Math.min(1_000_000, Math.round(Number(input.monthlyBudgetCents) || 0)));
    if (input.parallelLimit !== undefined) out.parallelLimit = Math.max(1, Math.min(12, Math.round(Number(input.parallelLimit) || 1)));
    if (input.programs !== undefined) out.programs = normPrograms({ ...normPrograms(base?.programs, base?.templateKey ?? null), ...input.programs }, base?.templateKey ?? null) as any;
    if (input.safety !== undefined) out.safety = AiOfficeService.normSafety({ ...AiOfficeService.normSafety(base?.safety), ...input.safety });
    if (input.workHours !== undefined) out.workHours = (OFFICE_WORK_HOURS as readonly string[]).includes(String(input.workHours)) ? String(input.workHours) : '24/7';
    if (input.timezone !== undefined) {
      const tz = String(input.timezone || 'UTC');
      try {
        new Intl.DateTimeFormat('en', { timeZone: tz });
        out.timezone = tz;
      } catch {
        out.timezone = 'UTC';
      }
    }
    if (input.kpis !== undefined) out.kpis = (input.kpis || []).map(String).filter((k) => (OFFICE_KPIS as readonly string[]).includes(k)).slice(0, 2);
    if (input.language !== undefined && normLang(input.language)) out.language = normLang(input.language);
    if (input.proactiveEveryHours !== undefined) out.proactiveEveryHours = Math.max(1, Math.min(168, Math.round(Number(input.proactiveEveryHours) || 6)));
    void lang;
    return out;
  }

  /** BYOK-движок отдела: только подключение OpenAI/Anthropic этого же тенанта. */
  private async assertEngine(tenantId: string, engine?: { mode: string; connectionId?: string | null }) {
    if (!engine || engine.mode !== 'byok') return;
    const rows = await this.tenants.query(
      `SELECT id FROM integration_connections WHERE id = $1 AND "tenantId" = $2 LIMIT 1`,
      [engine.connectionId, tenantId],
    ).catch(() => []);
    if (!rows.length) throw new BadRequestException('Unknown AI key connection');
  }

  async listDepartments(tenantId: string) {
    const list = await this.depts.find({ where: { tenantId }, order: { sort: 'ASC', createdAt: 'ASC' } });
    const agents = await this.deptAgents(tenantId, list.map((d) => d.id));
    return list.map((d) => this.deptDto(d, agents));
  }

  async createDepartment(tenantId: string, userId: string | null, input: DepartmentInput) {
    const plan = await this.planInfo(tenantId);
    this.assertPlan(plan);
    if (plan.used >= plan.capacity) {
      throw new BadRequestException({
        code: plan.used >= OFFICE_SLOTS.length ? 'AI_OFFICE_FULL' : 'AI_OFFICE_SLOT_REQUIRED',
        message: plan.used >= OFFICE_SLOTS.length ? 'The office is full' : 'No free paid department slot — add one in the plan page',
        capacity: plan.capacity,
        used: plan.used,
      });
    }
    const lang = normLang(input.language) ?? (await this.langOf(tenantId));
    const tpl = getOfficeTemplate(input.templateKey);
    const existing = await this.depts.find({ where: { tenantId }, select: ['id', 'slotX', 'slotY', 'color', 'sort'] });
    const taken = new Set(existing.map((d) => `${d.slotX},${d.slotY}`));
    const slot = OFFICE_SLOTS.find(([x, y]) => !taken.has(`${x},${y}`));
    if (!slot) throw new BadRequestException({ code: 'AI_OFFICE_FULL', message: 'The office is full' });
    const usedColors = new Set(existing.map((d) => d.color));

    const merged: DepartmentInput = {
      name: tpl?.name[lang],
      color: tpl?.color && !usedColors.has(tpl.color) ? tpl.color : OFFICE_COLORS.find((c) => !usedColors.has(c)) ?? OFFICE_COLORS[0],
      mission: tpl?.mission[lang] ?? '',
      systemPrompt: '',
      rules: tpl?.rules ?? ['no_client_send_without_approval', 'write_brain_notes'],
      permissions: tpl?.permissions ?? { crm: 'read', tasks: 'appr', ads: 'read' },
      connectors: tpl?.connectors ?? ['crm'],
      engine: { mode: 'platform' },
      monthlyBudgetCents: 15000,
      parallelLimit: 3,
      workHours: '24/7',
      timezone: 'UTC',
      kpis: tpl?.kpis ?? ['tasks_done_today', 'tasks_waiting'],
      agents: tpl?.agents.map((a) => ({ title: a.title[lang], isLead: !!a.lead, prompt: a.prompt[lang] })) ?? [],
      ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)),
    };
    const fields = this.normalizeInput(merged, {}, lang);
    await this.assertEngine(tenantId, fields.engine);
    const dept = await this.depts.save(
      this.depts.create({
        ...fields,
        tenantId,
        templateKey: tpl?.key ?? null,
        language: lang,
        slotX: slot[0],
        slotY: slot[1],
        sort: Math.max(-1, ...existing.map((d) => d.sort)) + 1,
        status: 'active',
        createdBy: userId,
      }),
    );
    const agentsIn = merged.agents?.length ? merged.agents : [{ title: lang === 'ru' ? 'Руководитель' : lang === 'tr' ? 'Yönetici' : 'Lead', isLead: true, prompt: '' }];
    await this.syncAgents(tenantId, dept, agentsIn, lang, userId);
    await this.installPlaybooks(dept).catch((e) => this.log.warn(`playbooks dept=${dept.id}: ${(e as Error).message}`));
    await this.addEvent({ tenantId, departmentId: dept.id, kind: 'resumed', text: ot(lang, 'resumed') });
    return this.getDepartment(tenantId, dept.id);
  }

  /** Состав отдела: добавить/обновить/убрать агентов; ровно один руководитель. */
  private async syncAgents(
    tenantId: string,
    dept: AiDepartment,
    input: Array<{ id?: string; title?: string; isLead?: boolean; prompt?: string }>,
    lang: Lang,
    userId: string | null,
  ) {
    const list = input
      .map((a) => ({ id: a.id, title: this.cleanText(a.title, 120), isLead: !!a.isLead, prompt: this.cleanText(a.prompt, 6000) }))
      .filter((a) => a.title)
      .slice(0, OFFICE_MAX_AGENTS);
    if (!list.length) throw new BadRequestException('A department needs at least one agent');
    if (!list.some((a) => a.isLead)) list[0].isLead = true;
    let leadSeen = false;
    for (const a of list) {
      if (a.isLead && leadSeen) a.isLead = false;
      if (a.isLead) leadSeen = true;
    }
    const current = await this.agents.find({ where: { tenantId, departmentId: dept.id } });
    const keep = new Set(list.map((a) => a.id).filter(Boolean) as string[]);
    const removed = current.filter((a) => !keep.has(a.id));
    if (removed.length) {
      // задачи ушедших агентов возвращаются в очередь отдела
      await this.tasks.update(
        { tenantId, agentId: In(removed.map((a) => a.id)), status: In(['backlog', 'blocked']) as any },
        { agentId: null },
      );
      await this.agents.delete({ tenantId, id: In(removed.map((a) => a.id)) });
    }
    const settingsFor = (prev: Record<string, unknown> | null) => ({
      ...(prev || {}),
      openaiConnectionId: dept.engine?.mode === 'byok' ? dept.engine.connectionId ?? null : null,
    });
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const existing = a.id ? current.find((c) => c.id === a.id) : undefined;
      if (existing) {
        existing.name = a.title;
        existing.jobTitle = a.title;
        existing.isLead = a.isLead;
        existing.officePrompt = a.prompt;
        existing.officeSort = i;
        existing.department = dept.name;
        existing.language = agentLanguageFor(lang);
        existing.settings = settingsFor(existing.settings);
        await this.agents.save(existing);
      } else {
        await this.agents.save(
          this.agents.create({
            tenantId,
            role: OFFICE_AGENT_ROLE_KEY as any,
            name: a.title,
            jobTitle: a.title,
            department: dept.name,
            language: agentLanguageFor(lang),
            tone: 'Professional, warm, concise',
            status: 'active',
            autonomyMode: 'auto',
            provider: 'openai_compatible',
            scheduleMode: 'manual',
            createdBy: userId,
            settings: settingsFor(null),
            departmentId: dept.id,
            isLead: a.isLead,
            officePrompt: a.prompt,
            officeSort: i,
          } as Partial<AiAgent>),
        );
      }
    }
    this.invalidate(dept.id);
  }

  /** Куратор — только ИИ-сотрудник этой компании (не агент другого отдела). */
  private async validCurator(tenantId: string, id: string | null): Promise<string | null> {
    if (!id) return null;
    const a = await this.agents.findOne({ where: { tenantId, id: String(id), departmentId: IsNull() } });
    if (!a) throw new BadRequestException('Curator must be one of your AI employees');
    return a.id;
  }

  /** Задачи, которые куратор прямо сейчас возвращает на доработку (не «сдавать» их в onActionDecided). */
  readonly revising = new Set<string>();

  async updateDepartment(tenantId: string, id: string, userId: string | null, input: DepartmentInput) {
    const dept = await this.getDeptEntity(tenantId, id);
    const fields = this.normalizeInput(input, dept, 'en');
    if (fields.engine) await this.assertEngine(tenantId, fields.engine);
    if (input.curatorAgentId !== undefined) fields.curatorAgentId = await this.validCurator(tenantId, input.curatorAgentId);
    Object.assign(dept, fields);
    await this.depts.save(dept);
    this.invalidate(dept.id);
    const lang = await this.langOf(tenantId, dept.id);
    if (input.agents) await this.syncAgents(tenantId, dept, input.agents, lang, userId);
    else if (fields.engine || fields.name || fields.language) {
      // движок/название отдела меняются у всех агентов отдела
      const ag = await this.agents.find({ where: { tenantId, departmentId: dept.id } });
      await this.syncAgents(tenantId, dept, ag.map((a) => ({ id: a.id, title: a.jobTitle || a.name, isLead: a.isLead, prompt: a.officePrompt })), lang, userId);
    }
    this.invalidate(dept.id);
    // бюджет подняли — снимаем паузу «лимит исчерпан» (движок проверит заново на тике)
    if (dept.status === 'paused' && dept.pausedReason === 'budget' && fields.monthlyBudgetCents !== undefined) {
      dept.status = 'active';
      dept.pausedReason = null;
      await this.depts.save(dept);
      this.onTaskQueued?.();
    }
    return this.getDepartment(tenantId, dept.id);
  }

  async moveDepartment(tenantId: string, id: string, slot: [number, number]) {
    const dept = await this.getDeptEntity(tenantId, id);
    if (!OFFICE_SLOTS.some(([x, y]) => x === slot[0] && y === slot[1])) throw new BadRequestException('Unknown slot');
    const other = await this.depts.findOne({ where: { tenantId, slotX: slot[0], slotY: slot[1] } });
    if (other && other.id !== dept.id) {
      // поменять комнаты местами (уникальный индекс по слоту — через временный слот)
      const [ox, oy] = [dept.slotX, dept.slotY];
      await this.depts.update({ id: other.id }, { slotX: 99, slotY: 99 });
      await this.depts.update({ id: dept.id }, { slotX: slot[0], slotY: slot[1] });
      await this.depts.update({ id: other.id }, { slotX: ox, slotY: oy });
    } else {
      await this.depts.update({ id: dept.id }, { slotX: slot[0], slotY: slot[1] });
    }
    return this.listDepartments(tenantId);
  }

  async deleteDepartment(tenantId: string, id: string) {
    const dept = await this.getDeptEntity(tenantId, id);
    // ожидающие согласования действия агентов отдела отклоняем — иначе они висели бы без владельца
    const ag = await this.agents.find({ where: { tenantId, departmentId: dept.id }, select: ['id'] });
    if (ag.length) {
      await this.actions.update({ tenantId, agentId: In(ag.map((a) => a.id)), status: 'pending' }, { status: 'rejected' });
    }
    // сценарии отдела (автоматизации) без отдела бессмысленны — удаляем вместе с ним
    await this.depts.query(`DELETE FROM automations WHERE "tenantId" = $1 AND meta->'aiOffice'->>'departmentId' = $2`, [tenantId, dept.id]).catch((e) => this.log.warn(`playbook cleanup: ${(e as Error).message}`));
    await this.depts.delete({ tenantId, id: dept.id }); // агенты/задачи/проблемы/файлы отдела — ON DELETE CASCADE
    this.invalidate(dept.id);
    return { ok: true };
  }

  async setStatus(tenantId: string, id: string, status: 'active' | 'paused') {
    const dept = await this.getDeptEntity(tenantId, id);
    const lang = await this.langOf(tenantId, dept.id);
    if (status === 'active') {
      if (dept.pausedReason === 'plan') {
        const plan = await this.planInfo(tenantId);
        const order = await this.depts.find({ where: { tenantId }, order: { sort: 'ASC', createdAt: 'ASC' }, select: ['id'] });
        if (order.findIndex((d) => d.id === dept.id) >= plan.capacity) {
          throw new BadRequestException({ code: 'AI_OFFICE_SLOT_REQUIRED', message: 'This department does not fit the paid slots' });
        }
      }
      dept.status = 'active';
      dept.pausedReason = null;
      await this.depts.save(dept);
      await this.addEvent({ tenantId, departmentId: dept.id, kind: 'resumed', text: ot(lang, 'resumed') });
      this.onTaskQueued?.();
    } else {
      dept.status = 'paused';
      dept.pausedReason = 'manual';
      await this.depts.save(dept);
      await this.addEvent({ tenantId, departmentId: dept.id, kind: 'paused', text: ot(lang, 'paused'), level: 'warn' });
    }
    this.invalidate(dept.id);
    return this.getDepartment(tenantId, dept.id);
  }

  // ───────────────────────── готовые сценарии ─────────────────────────

  /**
   * Сценарии шаблона → обычные автоматизации CRM с действием ai_office_task (видны и редактируются в
   * «Автоматизациях»). Ставятся один раз на отдел: если владелец их удалит — не возвращаем.
   */
  /** Стартовые шаблоны писем отдела (в фирменной обёртке) — один раз на компанию для каждого ключа. */
  async installStarterTemplates(dept: AiDepartment): Promise<number> {
    const list = STARTER_TEMPLATES[dept.templateKey ?? ''] ?? [];
    if (!list.length) return 0;
    const lang = normLang(dept.language) ?? (await this.langOf(dept.tenantId));
    let n = 0;
    for (const t of list) {
      const ex: Array<{ id: string }> = await this.depts.query(`SELECT id FROM email_templates WHERE "tenantId" = $1 AND meta->>'aiOfficeStarter' = $2 LIMIT 1`, [dept.tenantId, t.key]);
      if (ex.length) continue;
      await this.depts.query(
        `INSERT INTO email_templates ("tenantId", name, description, subject, "textBody", meta, "isActive", "useWrapper") VALUES ($1, $2, $3, $4, $5, $6, true, true)`,
        [dept.tenantId, t.name[lang], t.description[lang], t.subject[lang], t.text[lang], JSON.stringify({ aiOfficeStarter: t.key, category: dept.templateKey, variables: dept.templateKey === 'reception' ? ['guest_name', 'date', 'time', 'service', 'place', 'address', 'review_link'] : ['lead.name'] })],
      );
      n++;
    }
    return n;
  }

  async installPlaybooks(dept: AiDepartment): Promise<number> {
    await this.installStarterTemplates(dept).catch((e) => this.log.warn(`starter templates dept=${dept.id}: ${(e as Error).message}`));
    if (dept.playbooksInstalled) return 0;
    const list = OFFICE_PLAYBOOKS[dept.templateKey ?? ''] ?? [];
    const lang = normLang(dept.language) ?? (await this.langOf(dept.tenantId));
    const { AutomationsService } = await import('../automations/automations.service.js');
    const svc = this.moduleRef.get(AutomationsService, { strict: false });
    let n = 0;
    for (const pb of list) {
      await svc.create(dept.tenantId, {
        name: `${dept.name}: ${pb.name[lang]}`,
        description: ot(lang, 'playbook_desc', { dept: dept.name }),
        triggerEvent: pb.trigger as any,
        isActive: true,
        actions: [{ type: 'ai_office_task' as any, config: { departmentId: dept.id, title: toAutomationVars(pb.title[lang]), details: toAutomationVars(pb.details[lang]), priority: pb.priority } }],
        meta: { ...(pb.meta?.(dept.timezone || 'UTC') ?? {}), aiOffice: { departmentId: dept.id, playbook: pb.key } },
      } as any);
      n++;
    }
    await this.depts.update({ id: dept.id }, { playbooksInstalled: true });
    dept.playbooksInstalled = true;
    return n;
  }

  // ───────────────────────── польза отдела ─────────────────────────

  /** Минут работы человека на одно действие — для оценки «сэкономлено часов» (формула видна в интерфейсе). */
  static readonly MINUTES_PER_ACTION: Record<string, number> = {
    send_email: 6, send_telegram: 4, send_whatsapp: 4, draft_email: 4, draft_whatsapp: 3, send_bulk_email: 30,
    create_note: 3, add_comment: 2, create_task: 3, update_task: 1, create_meeting: 5, update_lead_status: 1,
    assign_lead: 1, assign_self: 1, brain_write: 30, create_report: 30, create_project: 5,
    notion_create_page: 15, github_create_issue: 10, github_comment: 5, canva_create_design: 5, office_handoff: 2,
  };

  /**
   * Что отдел реально сделал за период — только по выполненным действиям его агентов и его задачам.
   * Первый ответ: от создания лида до первого отправленного клиенту сообщения агентом отдела.
   */
  async impact(tenantId: string, departmentId: string, days: number) {
    await this.getDeptEntity(tenantId, departmentId);
    const d = Math.max(1, Math.min(365, Math.round(days) || 30));
    const since = new Date(Date.now() - d * 86_400_000);
    const ag = await this.agents.find({ where: { tenantId, departmentId }, select: ['id'] });
    const ids = ag.map((a) => a.id);
    const empty = { days: d, since, tasks: { done: 0, failed: 0, waiting: 0 }, actions: {} as Record<string, number>, leadsHandled: 0, firstResponse: { newLeads: 0, answered: 0, medianMinutes: null as number | null, within5: 0 }, wonAfterTouch: 0, savedMinutes: 0, spendCents: 0, minutesPerAction: AiOfficeService.MINUTES_PER_ACTION };
    if (!ids.length) return empty;

    const taskRows: Array<{ status: string; n: string }> = await this.tasks.query(
      `SELECT status, count(*) n FROM ai_office_tasks WHERE tenant_id = $1 AND department_id = $2 AND COALESCE(finished_at, updated_at) >= $3 GROUP BY 1`,
      [tenantId, departmentId, since],
    );
    const actRows: Array<{ action_type: string; n: string }> = await this.tasks.query(
      `SELECT action_type, count(*) n FROM ai_agent_actions WHERE tenant_id = $1 AND agent_id = ANY($2::uuid[]) AND status = 'executed' AND executed_at >= $3 GROUP BY 1`,
      [tenantId, ids, since],
    );
    const actions = Object.fromEntries(actRows.filter((r) => AiOfficeService.MINUTES_PER_ACTION[r.action_type] !== undefined).map((r) => [r.action_type, Number(r.n)]));
    const savedMinutes = Object.entries(actions).reduce((s, [k, n]) => s + n * (AiOfficeService.MINUTES_PER_ACTION[k] ?? 0), 0);

    // лиды, которых касался отдел: задачи отдела по лиду + действия агентов по лиду
    const touched: Array<{ lead_id: string; first_touch: Date }> = await this.tasks.query(
      `SELECT lead_id, min(at) first_touch FROM (
         SELECT entity_id AS lead_id, created_at AS at FROM ai_office_tasks
          WHERE tenant_id = $1 AND department_id = $2 AND entity_type = 'lead' AND created_at >= $4 AND status <> 'rejected'
         UNION ALL
         SELECT COALESCE(NULLIF(payload->>'leadId',''), CASE WHEN target_type = 'lead' THEN target_id END) AS lead_id, executed_at AS at
           FROM ai_agent_actions WHERE tenant_id = $1 AND agent_id = ANY($3::uuid[]) AND status = 'executed' AND executed_at >= $4
       ) x WHERE lead_id ~ '^[0-9a-f-]{36}$' GROUP BY lead_id`,
      [tenantId, departmentId, ids, since],
    );
    const leadIds = touched.map((t) => t.lead_id);
    const won: Array<{ n: string }> = leadIds.length
      ? await this.tasks.query(`SELECT count(*) n FROM leads WHERE "tenantId" = $1 AND id = ANY($2::uuid[]) AND status = 'won'`, [tenantId, leadIds])
      : [{ n: '0' }];

    // первый ответ новым лидам периода
    const fr: Array<{ mins: number | null }> = await this.tasks.query(
      `SELECT EXTRACT(EPOCH FROM (
                (SELECT min(a.executed_at) FROM ai_agent_actions a
                  WHERE a.tenant_id = $1 AND a.agent_id = ANY($2::uuid[]) AND a.status = 'executed'
                    AND a.action_type IN ('send_email','send_telegram','send_whatsapp')
                    AND (a.payload->>'leadId' = l.id::text OR (a.target_type = 'lead' AND a.target_id = l.id::text))) - l."createdAt")) / 60 AS mins
         FROM leads l WHERE l."tenantId" = $1 AND l."createdAt" >= $3 AND l.deleted_at IS NULL`,
      [tenantId, ids, since],
    );
    const answered = fr.map((r) => (r.mins == null ? null : Number(r.mins))).filter((m): m is number => m != null && m >= 0).sort((a, b) => a - b);
    const median = answered.length ? answered[Math.floor((answered.length - 1) / 2)] : null;
    const spend = (await this.spendSince(tenantId, [departmentId], since))[departmentId] ?? 0;
    const st = (s: string) => Number(taskRows.find((r) => r.status === s)?.n ?? 0);
    return {
      ...empty,
      tasks: { done: st('done'), failed: st('failed'), waiting: st('waiting') },
      actions,
      leadsHandled: leadIds.length,
      firstResponse: { newLeads: fr.length, answered: answered.length, medianMinutes: median == null ? null : Math.round(median * 10) / 10, within5: answered.filter((m) => m <= 5).length },
      wonAfterTouch: Number(won[0]?.n ?? 0),
      savedMinutes,
      spendCents: spend,
    };
  }

  // ───────────────────────── метрики ─────────────────────────

  monthStart(d = new Date()) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }

  dayStart(d = new Date()) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  /** Расход отдела (центы платформенной квоты) с даты — по журналу использования ИИ. */
  async spendSince(tenantId: string, departmentIds: string[], since: Date): Promise<Record<string, number>> {
    if (!departmentIds.length) return {};
    const rows: Array<{ department_id: string; cents: string }> = await this.tenants.query(
      `SELECT department_id, COALESCE(SUM("costCents"), 0) AS cents FROM ai_usage_logs
        WHERE "tenantId" = $1 AND department_id = ANY($2::uuid[]) AND "createdAt" >= $3 GROUP BY department_id`,
      [tenantId, departmentIds, since],
    );
    return Object.fromEntries(rows.map((r) => [r.department_id, Number(r.cents)]));
  }

  private async tenantKpis(tenantId: string, keys: Set<string>): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    const one = async (key: string, sql: string, params: unknown[]) => {
      if (!keys.has(key)) return;
      try {
        const r = await this.tenants.query(sql, params);
        out[key] = Number(r?.[0]?.n ?? 0);
      } catch (e) {
        this.log.warn(`kpi ${key}: ${(e as Error).message}`);
      }
    };
    const activeLead = `NOT (COALESCE(l.meta::jsonb,'{}'::jsonb) @> '{"deleted":true}'::jsonb OR COALESCE(l.meta::jsonb,'{}'::jsonb) @> '{"archived":true}'::jsonb) AND l.deleted_at IS NULL`;
    await Promise.all([
      one('leads_new_7d', `SELECT count(*) n FROM leads l WHERE l."tenantId" = $1 AND l."createdAt" > now() - interval '7 days' AND ${activeLead}`, [tenantId]),
      one('leads_open', `SELECT count(*) n FROM leads l WHERE l."tenantId" = $1 AND COALESCE(l.status,'new') NOT IN ('won','lost') AND ${activeLead}`, [tenantId]),
      one(
        'meetings_upcoming',
        `SELECT (SELECT count(*) FROM leads l, jsonb_array_elements(COALESCE(l.meta::jsonb->'meetings','[]'::jsonb)) m
                  WHERE l."tenantId" = $1 AND ${activeLead} AND (m->>'startsAt') > to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI') AND m->>'closedAt' IS NULL)
              + (SELECT count(*) FROM crm_projects p, jsonb_array_elements(COALESCE(p.meetings::jsonb,'[]'::jsonb)) m
                  WHERE p.tenant_id = $1 AND (m->>'startsAt') > to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI') AND m->>'closedAt' IS NULL) AS n`,
        [tenantId],
      ),
      one('sales_won_30d', `SELECT count(*) n FROM sales s WHERE s."tenantId" = $1 AND s.status IN ('paid','confirmed') AND COALESCE(s."saleDate", s."createdAt") > now() - interval '30 days'`, [tenantId]),
      one('tasks_overdue', `SELECT count(*) n FROM company_tasks t WHERE t."tenantId" = $1 AND t."dueDate" < now() AND COALESCE(t.status,'') NOT IN ('done','completed','cancelled','canceled')`, [tenantId]),
      one('tickets_open', `SELECT count(*) n FROM helpdesk_tickets h WHERE h."tenantId" = $1 AND COALESCE(h.status,'') NOT IN ('resolved','closed')`, [tenantId]),
      one('bookings_upcoming', `SELECT count(*) n FROM reservations r WHERE r."tenantId" = $1 AND r."startAt" > now() AND COALESCE(r.status,'') NOT IN ('cancelled','canceled','no_show')`, [tenantId]),
    ]);
    return out;
  }

  /** Сводка по отделам: счётчики задач, KPI, расход, открытая проблема. */
  async liveSummary(tenantId: string, depts: AiDepartment[]) {
    const ids = depts.map((d) => d.id);
    if (!ids.length) return {};
    const counts: Array<{ department_id: string; status: string; n: string }> = await this.tasks.query(
      `SELECT department_id, status, count(*) n FROM ai_office_tasks WHERE tenant_id = $1 AND department_id = ANY($2::uuid[])
          AND (status IN ('backlog','progress','waiting','blocked') OR finished_at >= $3) GROUP BY 1, 2`,
      [tenantId, ids, this.dayStart()],
    );
    const brainRows: Array<{ d: string; n: string }> = await this.tasks.query(
      `SELECT d::text AS d, count(*) n FROM ai_brain_files f, unnest($2::uuid[]) d
        WHERE f.tenant_id = $1 AND (f.scope @> ARRAY['all']::text[] OR f.scope @> ARRAY[d::text]) GROUP BY d`,
      [tenantId, ids],
    );
    const spend = await this.spendSince(tenantId, ids, this.monthStart());
    const wanted = new Set(depts.flatMap((d) => d.kpis));
    const tk = await this.tenantKpis(tenantId, wanted);
    const openIssues = await this.issues.find({ where: { tenantId, status: 'open', departmentId: In(ids) }, order: { createdAt: 'DESC' } });
    const out: Record<string, any> = {};
    for (const d of depts) {
      const c = (st: string) => Number(counts.find((r) => r.department_id === d.id && r.status === st)?.n ?? 0);
      const live = { next: c('backlog'), doing: c('progress'), waiting: c('waiting'), blocked: c('blocked'), doneToday: c('done'), spendMonthCents: spend[d.id] ?? 0 };
      const kpiVal = (k: OfficeKpi): number => {
        if (k === 'tasks_done_today') return live.doneToday;
        if (k === 'tasks_waiting') return live.waiting;
        if (k === 'brain_files') return Number(brainRows.find((r) => r.d === d.id)?.n ?? 0);
        if (k === 'spend_month') return live.spendMonthCents;
        return tk[k] ?? 0;
      };
      out[d.id] = {
        ...live,
        kpis: (d.kpis as OfficeKpi[]).map((k) => ({ key: k, value: kpiVal(k) })),
        issue: openIssues.find((i) => i.departmentId === d.id) ?? null,
      };
    }
    return out;
  }

  async getDepartment(tenantId: string, id: string) {
    const d = await this.getDeptEntity(tenantId, id);
    const agents = await this.deptAgents(tenantId, [d.id]);
    const [summary] = Object.values(await this.liveSummary(tenantId, [d]));
    const open = await this.tasks.find({ where: { tenantId, departmentId: d.id, status: In(OPEN_STATUSES) as any }, order: { priority: 'ASC', createdAt: 'ASC' } });
    const doneToday: Array<{ agent_id: string; n: string }> = await this.tasks.query(
      `SELECT agent_id, count(*) n FROM ai_office_tasks WHERE tenant_id = $1 AND department_id = $2 AND status = 'done' AND finished_at >= $3 GROUP BY 1`,
      [tenantId, d.id, this.dayStart()],
    );
    const dto = this.deptDto(d, agents);
    return {
      ...dto,
      live: summary,
      agents: dto.agents.map((a) => {
        const cur = open.find((t) => t.agentId === a.id && (t.status === 'progress' || t.status === 'waiting'));
        return {
          ...a,
          state: d.status !== 'active' ? 'paused' : cur ? (cur.status === 'waiting' ? 'waiting' : cur.step) : 'idle',
          currentTask: cur ? { id: cur.id, title: cur.title, progress: cur.progress, status: cur.status } : null,
          doneToday: Number(doneToday.find((r) => r.agent_id === a.id)?.n ?? 0),
        };
      }),
      issues: await this.issues.find({ where: { tenantId, departmentId: d.id, status: 'open' }, order: { createdAt: 'DESC' } }),
      curator: d.curatorAgentId ? await this.curatorDto(tenantId, d.curatorAgentId, d.id) : null,
    };
  }

  /** Куратор отдела + что он решил за 7 дней (сколько одобрил сам / вернул / передал владельцу). */
  private async curatorDto(tenantId: string, agentId: string, departmentId: string) {
    const a = await this.agents.findOne({ where: { tenantId, id: agentId } });
    if (!a) return null;
    const r: Array<{ approved: string; revised: string; escalated: string }> = await this.actions.query(
      `SELECT count(*) FILTER (WHERE payload ? 'approvedByCurator') approved, count(*) FILTER (WHERE payload ? 'rejectedByCurator') revised, count(*) FILTER (WHERE payload ? 'curatorNote') escalated
         FROM ai_agent_actions WHERE tenant_id = $1 AND created_at > now() - interval '7 days' AND agent_id IN (SELECT id FROM ai_agents WHERE department_id = $2)`,
      [tenantId, departmentId],
    );
    return { id: a.id, name: a.name, role: a.role, jobTitle: a.jobTitle, status: a.status, week: { approved: Number(r[0]?.approved ?? 0), revised: Number(r[0]?.revised ?? 0), escalated: Number(r[0]?.escalated ?? 0) } };
  }

  // ───────────────────────── задачи ─────────────────────────

  taskDto(t: AiOfficeTask, agents?: Map<string, AiAgent>) {
    const a = t.agentId ? agents?.get(t.agentId) : undefined;
    return {
      id: t.id,
      departmentId: t.departmentId,
      agentId: t.agentId,
      agentTitle: a ? a.jobTitle || a.name : null,
      title: t.title,
      details: t.details,
      source: t.source,
      entityType: t.entityType,
      entityId: t.entityId,
      status: t.status,
      progress: t.progress,
      step: t.step,
      priority: t.priority,
      pendingActionIds: t.pendingActionIds,
      resultSummary: t.resultSummary,
      resultReport: t.resultReport,
      dataUsed: t.dataUsed ?? [],
      artifacts: t.artifacts,
      issueId: t.issueId,
      fromDepartmentId: t.fromDepartmentId,
      costCents: t.costCents,
      error: t.error,
      attempts: t.attempts,
      startedAt: t.startedAt,
      finishedAt: t.finishedAt,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  async listTasks(tenantId: string, q: { departmentId?: string; status?: string; limit?: number; since?: string }) {
    const qb = this.tasks.createQueryBuilder('t').where('t.tenant_id = :tenantId', { tenantId });
    if (q.departmentId) qb.andWhere('t.department_id = :d', { d: q.departmentId });
    if (q.status === 'open') qb.andWhere(`t.status IN ('backlog','progress','waiting','blocked')`);
    else if (q.status) qb.andWhere('t.status = :s', { s: q.status });
    if (q.since) qb.andWhere('t.updated_at > :since', { since: new Date(q.since) });
    // открытые — все; закрытые — последние
    qb.orderBy(`CASE t.status WHEN 'progress' THEN 0 WHEN 'waiting' THEN 1 WHEN 'blocked' THEN 2 WHEN 'backlog' THEN 3 ELSE 4 END`, 'ASC')
      .addOrderBy('COALESCE(t.finished_at, t.updated_at)', 'DESC')
      .take(Math.max(1, Math.min(300, Number(q.limit) || 120)));
    const rows = await qb.getMany();
    const ag = await this.agents.find({ where: { tenantId, id: In([...new Set(rows.map((r) => r.agentId).filter(Boolean) as string[])]) } });
    const map = new Map(ag.map((a) => [a.id, a]));
    return rows.map((t) => this.taskDto(t, map));
  }

  private normTitle(s: string) {
    return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }

  async createTask(
    tenantId: string,
    input: {
      departmentId: string;
      title: string;
      details?: string;
      priority?: number;
      entityType?: string | null;
      entityId?: string | null;
      source?: string;
      sourceRef?: string | null;
      agentId?: string | null;
      parentTaskId?: string | null;
      fromDepartmentId?: string | null;
      handoffDepth?: number;
      createdBy?: string | null;
    },
  ) {
    const dept = await this.getDeptEntity(tenantId, input.departmentId);
    const title = this.cleanText(input.title, 255);
    if (!title) throw new BadRequestException('Task title is required');
    const source = input.source || 'manual';
    // одна и та же автоматизация/событие по той же записи — не плодим дубли
    if (source !== 'manual') {
      const norm = this.normTitle(title);
      const open = await this.tasks.find({ where: { tenantId, departmentId: dept.id, status: In(OPEN_STATUSES) as any }, select: ['id', 'title', 'entityId', 'sourceRef'] });
      const dup = open.find(
        (t) =>
          // одна и та же автоматизация/событие по той же записи — дубль; у плана отдела sourceRef общий на пачку
          (input.sourceRef && (source === 'automation' || source === 'event') && t.sourceRef === input.sourceRef && (t.entityId ?? null) === (input.entityId ?? null)) ||
          (this.normTitle(t.title) === norm && (t.entityId ?? null) === (input.entityId ?? null)),
      );
      if (dup) return this.taskDto((await this.tasks.findOne({ where: { id: dup.id } }))!);
    }
    let agentId: string | null = null;
    if (input.agentId) {
      const a = await this.agents.findOne({ where: { tenantId, id: input.agentId, departmentId: dept.id }, select: ['id'] });
      agentId = a?.id ?? null;
    }
    const t = await this.tasks.save(
      this.tasks.create({
        tenantId,
        departmentId: dept.id,
        agentId,
        title,
        details: this.cleanText(input.details, 8000),
        priority: Math.max(1, Math.min(3, Math.round(Number(input.priority) || 2))),
        entityType: input.entityType ? String(input.entityType).slice(0, 40) : null,
        entityId: input.entityId ? String(input.entityId).slice(0, 64) : null,
        source,
        sourceRef: input.sourceRef ? String(input.sourceRef).slice(0, 160) : null,
        parentTaskId: input.parentTaskId ?? null,
        fromDepartmentId: input.fromDepartmentId ?? null,
        handoffDepth: input.handoffDepth ?? 0,
        createdBy: input.createdBy ?? null,
        status: 'backlog',
        step: 'queued',
      }),
    );
    const lang = await this.langOf(tenantId, dept.id);
    await this.addEvent({ tenantId, departmentId: dept.id, taskId: t.id, kind: 'task_created', text: ot(lang, 'task_created', { title }) , meta: { source } });
    this.onTaskQueued?.();
    return this.taskDto(t);
  }

  async getTaskEntity(tenantId: string, id: string) {
    const t = await this.tasks.findOne({ where: { tenantId, id } });
    if (!t) throw new NotFoundException('Task not found');
    return t;
  }

  /** Поля действия, которые человек может поправить перед одобрением (тексты, не адресаты/id). */
  private static readonly EDITABLE_PAYLOAD = ['subject', 'textBody', 'bodyText', 'bodyHtml', 'text', 'title', 'description', 'content', 'contentMd', 'body', 'reason'];

  /** Карточка задачи: шаги (журнал), итог, действия с содержимым — чтобы решать, видя, что уйдёт. */
  async taskDetail(tenantId: string, id: string) {
    const t = await this.getTaskEntity(tenantId, id);
    const ids = (t.artifacts || []).map((a) => a.actionId).filter(Boolean) as string[];
    const acts = ids.length ? await this.actions.find({ where: { tenantId, id: In(ids) } }) : [];
    const events = await this.listEvents(tenantId, { departmentId: t.departmentId, limit: 300 });
    const ag = t.agentId ? await this.agents.findOne({ where: { id: t.agentId }, select: ['id', 'name', 'jobTitle'] }) : null;
    const issue = t.issueId ? await this.issues.findOne({ where: { tenantId, id: t.issueId } }) : null;
    return {
      task: this.taskDto(t, ag ? new Map([[ag.id, ag]]) : undefined),
      issue: issue && issue.status === 'open' ? { id: issue.id, kind: issue.kind, title: issue.title, detail: issue.detail, fix: issue.fix, target: issue.target, departmentId: issue.departmentId } : null,
      events: events.filter((e) => e.taskId === t.id).reverse(),
      actions: acts.map((a) => {
        const p = (a.payload || {}) as Record<string, any>;
        const shown: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(p)) {
          if (['execError', 'result', 'rejectionReason'].includes(k)) continue;
          if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || (Array.isArray(v) && v.every((x) => typeof x === 'string'))) shown[k] = v;
        }
        return {
          id: a.id,
          actionType: a.actionType,
          title: a.title,
          reason: a.reason,
          status: a.status,
          targetType: a.targetType,
          targetId: a.targetId,
          payload: shown,
          editable: a.status === 'pending' ? AiOfficeService.EDITABLE_PAYLOAD.filter((k) => typeof p[k] === 'string') : [],
          error: p.execError ?? null,
          resultUrl: p.result?.url ?? null,
          sendResult: p.result && typeof p.result === 'object' && (p.result.sent !== undefined || p.result.total !== undefined) ? { sent: Number(p.result.sent ?? 0), total: Number(p.result.total ?? 0), failed: Number(p.result.failed ?? 0) } : null,
          /** действие реально отправляет сообщение (после одобрения), а не готовит черновик */
          sends: /^send_/.test(a.actionType),
          /** черновик, который можно отправить из карточки (ещё не отправлен) */
          sendable: ['draft_email', 'draft_whatsapp'].includes(a.actionType) && a.status === 'executed' && !p.sentActionId,
          sentFromDraft: !!p.sentActionId,
          rejectionReason: p.rejectionReason ?? null,
          approvedByCurator: p.approvedByCurator ?? null,
          curatorComment: p.curatorComment ?? null,
          curatorNote: p.curatorNote ?? null,
        };
      }),
    };
  }

  /** Поправить текст действия, ждущего одобрения (письмо, сообщение, заметка, задача). */
  async editPendingAction(tenantId: string, taskId: string, actionId: string, patch: Record<string, unknown>) {
    const t = await this.getTaskEntity(tenantId, taskId);
    if (!t.pendingActionIds.includes(actionId)) throw new BadRequestException('This action is not waiting for a decision');
    const a = await this.actions.findOne({ where: { tenantId, id: actionId, status: 'pending' } });
    if (!a) throw new NotFoundException('Action not found');
    const p = { ...((a.payload || {}) as Record<string, any>) };
    for (const [k, v] of Object.entries(patch || {})) {
      // текст поста контент-плана: posts.N.text
      const m = k.match(/^posts\.(\d+)\.text$/);
      if (m && Array.isArray(p.posts) && p.posts[+m[1]] && typeof p.posts[+m[1]].text === 'string') {
        p.posts = p.posts.map((x: any, i: number) => (i === +m[1] ? { ...x, text: String(v ?? '').slice(0, 4000) } : x));
        continue;
      }
      if (!AiOfficeService.EDITABLE_PAYLOAD.includes(k) || typeof p[k] !== 'string') continue;
      p[k] = String(v ?? '').slice(0, 20_000);
    }
    p.editedByHuman = true;
    a.payload = p;
    if (typeof patch?.title === 'string' && patch.title.trim()) a.title = String(patch.title).slice(0, 255);
    await this.actions.save(a);
    return this.taskDetail(tenantId, taskId);
  }

  /** «Одобрить» = одобрить и выполнить все действия задачи, ждущие решения. */
  /** «Отправить» черновик из карточки задачи — уходит клиенту по-настоящему, результат в итог и журнал. */
  async sendDraft(tenantId: string, taskId: string, actionId: string, userId: string | null, edits: Record<string, unknown>) {
    const t = await this.getTaskEntity(tenantId, taskId);
    if (!(t.artifacts || []).some((a) => a.actionId === actionId)) throw new NotFoundException('Action not found in this task');
    const clean: Record<string, unknown> = {};
    for (const k of ['subject', 'textBody', 'bodyText', 'text']) if (typeof edits[k] === 'string') clean[k] = edits[k];
    const sent = await this.aiEmployees.sendDraft(tenantId, actionId, userId, clean);
    const lang = await this.langOf(tenantId, t.departmentId);
    const line = ot(lang, 'draft_sent', { title: sent.title });
    t.artifacts = [...(t.artifacts || []), { actionId: sent.id, actionType: sent.actionType, title: sent.title, status: 'executed', targetType: sent.targetType, targetId: sent.targetId, error: null, url: null }];
    t.resultSummary = `${line}\n\n${t.resultSummary ?? ''}`.trim();
    await this.tasks.save(t);
    await this.addEvent({ tenantId, departmentId: t.departmentId, taskId: t.id, agentId: sent.agentId, kind: 'approved', tool: sent.actionType, text: line, level: 'ok', meta: { actionId: sent.id } });
    return this.taskDetail(tenantId, taskId);
  }

  async approveTask(tenantId: string, id: string, userId: string | null) {
    const t = await this.getTaskEntity(tenantId, id);
    if (t.status !== 'waiting') throw new BadRequestException('Task is not waiting for a decision');
    const errors: string[] = [];
    for (const actionId of [...t.pendingActionIds]) {
      try {
        await this.aiEmployees.approveAction(tenantId, actionId, userId);
      } catch (e) {
        errors.push((e as any)?.response?.message || (e as Error).message);
      }
    }
    await this.tasks.update({ id: t.id }, { decidedBy: userId });
    return { ok: !errors.length, errors, task: this.taskDto(await this.getTaskEntity(tenantId, id)) };
  }

  async rejectTask(tenantId: string, id: string, userId: string | null, reason?: string) {
    const t = await this.getTaskEntity(tenantId, id);
    if (t.status !== 'waiting') throw new BadRequestException('Task is not waiting for a decision');
    for (const actionId of [...t.pendingActionIds]) {
      await this.aiEmployees.rejectAction(tenantId, actionId, userId, { reason }).catch(() => undefined);
    }
    await this.tasks.update({ id: t.id }, { decidedBy: userId });
    return this.taskDto(await this.getTaskEntity(tenantId, id));
  }

  async retryTask(tenantId: string, id: string) {
    const t = await this.getTaskEntity(tenantId, id);
    if (!['failed', 'rejected', 'blocked'].includes(t.status)) throw new BadRequestException('Only failed, rejected or blocked tasks can be retried');
    await this.tasks.update({ id: t.id }, { status: 'backlog', step: 'queued', progress: 0, attempts: 0, error: null, issueId: null, finishedAt: null, pendingActionIds: [] });
    this.onTaskQueued?.();
    return this.taskDto(await this.getTaskEntity(tenantId, id));
  }

  async cancelTask(tenantId: string, id: string, userId: string | null) {
    const t = await this.getTaskEntity(tenantId, id);
    if (!['backlog', 'blocked', 'waiting'].includes(t.status)) throw new BadRequestException('Only queued, blocked or waiting tasks can be cancelled');
    for (const actionId of t.pendingActionIds) {
      await this.actions.update({ tenantId, id: actionId, status: 'pending' }, { status: 'rejected' });
    }
    await this.tasks.update({ id: t.id }, { status: 'rejected', pendingActionIds: [], finishedAt: new Date(), decidedBy: userId });
    const lang = await this.langOf(tenantId, t.departmentId);
    await this.addEvent({ tenantId, departmentId: t.departmentId, taskId: t.id, kind: 'cancelled', text: ot(lang, 'cancelled', { title: t.title }), level: 'warn' });
    return this.taskDto(await this.getTaskEntity(tenantId, id));
  }

  /** Завершение задачи: журнал выводов в «Мозг», Slack, событие для автоматизаций. */
  async finalizeDone(t: AiOfficeTask, summary: string | null) {
    const dept = await this.depts.findOne({ where: { id: t.departmentId } });
    if (!dept) return;
    const lang = await this.langOf(t.tenantId, dept.id);
    t.status = 'done';
    t.step = 'done';
    t.progress = 100;
    t.finishedAt = new Date();
    if (summary) t.resultSummary = summary.slice(0, 8000);
    await this.tasks.save(t);
    const agent = t.agentId ? await this.agents.findOne({ where: { id: t.agentId } }) : null;
    const executed = (t.artifacts || []).filter((a) => a.status === 'executed').length;
    await this.addEvent({
      tenantId: t.tenantId,
      departmentId: t.departmentId,
      taskId: t.id,
      agentId: t.agentId,
      kind: 'done',
      text: executed || !t.resultSummary ? ot(lang, 'done', { title: t.title }) : ot(lang, 'done_no_action', { title: t.title, summary: t.resultSummary.slice(0, 200) }),
    });
    if (dept.rules.includes('write_brain_notes') && (t.resultSummary || executed)) {
      const date = new Date().toISOString().slice(0, 16).replace('T', ' ');
      const lines = (t.artifacts || []).map((a) => `- ${String(a.title ?? a.actionType)} — ${String(a.status)}`).join('\n');
      await this.brain
        .appendToDoc(t.tenantId, dept.id, ot(lang, 'journal_name'), `## ${date} · ${t.title}\n${agent ? `_${agent.jobTitle || agent.name}_\n\n` : ''}${t.resultSummary ?? ''}${lines ? `\n\n${lines}` : ''}`, t.agentId)
        .catch((e) => this.log.warn(`brain journal failed: ${(e as Error).message}`));
    }
    if (dept.rules.includes('notify_slack_on_done')) await this.notifySlack(t.tenantId, ot(lang, 'slack_done', { dept: dept.name, title: t.title, summary: (t.resultSummary ?? '').slice(0, 500) }));
    await this.emitAutomation(t.tenantId, 'ai_office.task_done', this.automationPayload(t, dept));
  }

  automationPayload(t: AiOfficeTask, dept: AiDepartment) {
    return {
      entityType: t.entityType ?? 'ai_office_task',
      entityId: t.entityId ?? t.id,
      taskId: t.id,
      title: t.title,
      summary: t.resultSummary ?? '',
      status: t.status,
      departmentId: dept.id,
      departmentName: dept.name,
      source: t.source,
      handoffDepth: t.handoffDepth,
      error: t.error ?? '',
    };
  }

  private async notifySlack(tenantId: string, text: string) {
    try {
      const slack = (await this.connectors.instances(tenantId, 'slack')).find((i) => i.status === 'ok');
      if (!slack) return;
      const { IntegrationsService } = await import('../integrations/integrations.service.js');
      const svc = this.moduleRef.get(IntegrationsService, { strict: false });
      const url = await svc.getSlackWebhookUrlForConnection(tenantId, slack.connectionId);
      if (url) await svc.sendSlackIncomingWebhookRaw(url, text);
    } catch (e) {
      this.log.warn(`slack notify failed: ${(e as Error).message}`);
    }
  }

  // ───────────────────────── проблемы («Нужна ваша помощь») ─────────────────────────

  async createIssue(input: {
    tenantId: string;
    departmentId: string;
    agentId?: string | null;
    taskId?: string | null;
    kind: 'error' | 'data' | 'access' | 'trust';
    title: string;
    detail?: string;
    fix: 'upload' | 'access' | 'reconnect' | 'billing' | 'settings' | 'grant' | 'connect' | 'autonomy';
    target?: string | null;
    dedupeKey?: string | null;
  }) {
    if (input.dedupeKey) {
      const ex = await this.issues.findOne({ where: { tenantId: input.tenantId, dedupeKey: input.dedupeKey, status: 'open' } });
      if (ex) return ex;
    }
    const issue = await this.issues.save(
      this.issues.create({
        tenantId: input.tenantId,
        departmentId: input.departmentId,
        agentId: input.agentId ?? null,
        taskId: input.taskId ?? null,
        kind: input.kind,
        title: input.title.slice(0, 255),
        detail: (input.detail ?? '').slice(0, 4000),
        fix: input.fix,
        target: input.target ?? null,
        dedupeKey: input.dedupeKey ?? null,
        status: 'open',
      }),
    );
    const lang = await this.langOf(input.tenantId, input.departmentId);
    await this.addEvent({ tenantId: input.tenantId, departmentId: input.departmentId, taskId: input.taskId ?? null, agentId: input.agentId ?? null, kind: 'issue', text: ot(lang, 'issue', { title: issue.title }), level: 'warn', meta: { issueId: issue.id } });
    const dept = await this.depts.findOne({ where: { id: input.departmentId }, select: ['id', 'name'] });
    void this.aiEmployees.notifyOwners(input.tenantId, `${dept?.name ?? 'AI'}: ${issue.title}`, issue.detail, { link: `/ai-office/departments/${input.departmentId}`, aiOfficeIssueId: issue.id }).catch?.(() => undefined);
    await this.emitAutomation(input.tenantId, 'ai_office.help_needed', {
      entityType: 'ai_office_issue', entityId: issue.id, issueId: issue.id, title: issue.title, detail: issue.detail, kind: issue.kind, departmentId: input.departmentId, departmentName: dept?.name ?? '',
    });
    return issue;
  }

  async listIssues(tenantId: string, status = 'open') {
    return this.issues.find({ where: { tenantId, status }, order: { createdAt: 'DESC' }, take: 200 });
  }

  /** Решить проблему: связанные задачи возвращаются в очередь. */
  async resolveIssue(tenantId: string, id: string, userId: string | null) {
    const issue = await this.issues.findOne({ where: { tenantId, id } });
    if (!issue) throw new NotFoundException('Issue not found');
    if (issue.status === 'resolved') return issue;
    issue.status = 'resolved';
    issue.resolvedBy = userId;
    issue.resolvedAt = new Date();
    await this.issues.save(issue);
    await this.tasks.update({ tenantId, issueId: issue.id, status: 'blocked' }, { status: 'backlog', step: 'queued', progress: 0, attempts: 0 });
    // пауза из-за квоты/бюджета снимается вместе с проблемой — дальше движок проверит лимиты сам
    if (issue.fix === 'billing' || issue.fix === 'settings') {
      await this.depts.update({ tenantId, id: issue.departmentId, status: 'paused', pausedReason: In(['budget', 'quota']) as any }, { status: 'active', pausedReason: null });
    }
    const lang = await this.langOf(tenantId, issue.departmentId);
    await this.addEvent({ tenantId, departmentId: issue.departmentId, kind: 'issue_resolved', text: ot(lang, 'issue_resolved', { title: issue.title }), meta: { issueId: issue.id } });
    this.invalidate(issue.departmentId);
    this.onTaskQueued?.();
    return issue;
  }

  /** Каналы, через которые отдел реально отвечает клиентам (по его включённым сценариям). */
  async replyChannels(tenantId: string, departmentId: string): Promise<Set<string>> {
    const rows: Array<{ triggerEvent: string }> = await this.depts.query(
      `SELECT DISTINCT "triggerEvent" FROM automations WHERE "tenantId" = $1 AND "isActive" = true AND meta->'aiOffice'->>'departmentId' = $2`,
      [tenantId, departmentId],
    );
    const ev = new Set(rows.map((r) => r.triggerEvent));
    const out = new Set<string>();
    if (['email.received', 'lead.created', 'lead.stale'].some((e) => ev.has(e))) out.add('email');
    if (ev.has('telegram.message_received')) out.add('telegram');
    if (ev.has('whatsapp.message_received')) out.add('whatsapp');
    return out;
  }

  /** Открытая проблема поменяла суть (например, кабинет подключили, но отделу не открыли) — обновляем кнопку и текст. */
  async refreshIssue(tenantId: string, dedupeKey: string, patch: { fix: string; title: string; detail: string }) {
    const issue = await this.issues.findOne({ where: { tenantId, dedupeKey, status: 'open' } });
    if (issue && issue.fix !== patch.fix) await this.issues.update({ id: issue.id }, { fix: patch.fix, title: patch.title.slice(0, 255), detail: patch.detail.slice(0, 4000) });
  }

  /** Уведомление владельцам (колокольчик) со ссылкой на отдел. */
  async notifyOwners(tenantId: string, departmentId: string, title: string, body: string) {
    await this.aiEmployees.notifyOwners(tenantId, title, body, { link: `/ai-office/departments/${departmentId}` }).catch(() => undefined);
  }

  /** Проблема ушла сама (например, канал подключили) — закрываем по ключу. */
  async resolveIssueByKey(tenantId: string, dedupeKey: string) {
    const issue = await this.issues.findOne({ where: { tenantId, dedupeKey, status: 'open' } });
    if (issue) await this.resolveIssue(tenantId, issue.id, null);
  }

  /** Загрузили файл в папку «Мозга» по запросу отдела — решаем этот запрос. */
  async resolveUploadRequest(tenantId: string, reqId: string | null | undefined, folder: string | null, userId: string | null) {
    if (!reqId) return;
    const issue = await this.issues.findOne({ where: { tenantId, id: reqId, status: 'open' } });
    if (!issue || issue.fix !== 'upload') return;
    if ((issue.target ?? 'common') !== (folder ?? 'common') && issue.departmentId !== folder) return;
    await this.resolveIssue(tenantId, issue.id, userId);
  }

  // ───────────────────────── журнал ─────────────────────────

  async listEvents(tenantId: string, q: { departmentId?: string; since?: string; limit?: number; before?: string }) {
    const qb = this.events.createQueryBuilder('e').where('e.tenant_id = :tenantId', { tenantId });
    if (q.departmentId) qb.andWhere('e.department_id = :d', { d: q.departmentId });
    if (q.since) qb.andWhere('e.created_at > :since', { since: new Date(q.since) });
    if (q.before) qb.andWhere('e.created_at < :before', { before: new Date(q.before) });
    const rows = await qb.orderBy('e.created_at', 'DESC').take(Math.max(1, Math.min(300, Number(q.limit) || 60))).getMany();
    const ids = [...new Set(rows.flatMap((r) => [r.agentId, r.toAgentId]).filter(Boolean) as string[])];
    const ag = ids.length ? await this.agents.find({ where: { tenantId, id: In(ids) }, select: ['id', 'name', 'jobTitle'] }) : [];
    const name = new Map(ag.map((a) => [a.id, a.jobTitle || a.name]));
    return rows.map((r) => ({
      id: r.id,
      departmentId: r.departmentId,
      taskId: r.taskId,
      agentId: r.agentId,
      agentTitle: r.agentId ? name.get(r.agentId) ?? null : null,
      toAgentId: r.toAgentId,
      toAgentTitle: r.toAgentId ? name.get(r.toAgentId) ?? null : null,
      kind: r.kind,
      tool: r.tool,
      text: r.text,
      level: r.level,
      createdAt: r.createdAt,
    }));
  }

  // ───────────────────────── офис целиком ─────────────────────────

  async overview(tenantId: string) {
    const plan = await this.planInfo(tenantId);
    const list = await this.depts.find({ where: { tenantId }, order: { sort: 'ASC', createdAt: 'ASC' } });
    const agents = await this.deptAgents(tenantId, list.map((d) => d.id));
    const live = await this.liveSummary(tenantId, list);
    return {
      plan,
      departments: list.map((d) => ({ ...this.deptDto(d, agents), live: live[d.id] })),
      tasks: await this.listTasks(tenantId, { limit: 150 }),
      issues: await this.listIssues(tenantId),
      events: await this.listEvents(tenantId, { limit: 40 }),
      brainFiles: await this.brain.countFor(tenantId),
      serverTime: new Date(),
    };
  }

  /** Лёгкий опрос раз в несколько секунд: что изменилось с момента since. */
  async live(tenantId: string, since?: string) {
    const list = await this.depts.find({ where: { tenantId }, order: { sort: 'ASC', createdAt: 'ASC' } });
    const live = await this.liveSummary(tenantId, list);
    return {
      departments: list.map((d) => ({ id: d.id, status: d.status, pausedReason: d.pausedReason, live: live[d.id] })),
      tasks: await this.listTasks(tenantId, { since: since || new Date(Date.now() - 60_000).toISOString(), limit: 200 }),
      events: await this.listEvents(tenantId, { since: since || new Date(Date.now() - 60_000).toISOString(), limit: 100 }),
      issues: await this.listIssues(tenantId),
      brainFiles: await this.brain.countFor(tenantId),
      serverTime: new Date(),
    };
  }

  // ───────────────────────── хуки движка ИИ-сотрудников ─────────────────────────

  async contextFor(tenantId: string, agentId: string, departmentId: string): Promise<OfficeRunContext | null> {
    let c = this.ctxCache.get(departmentId);
    if (!c || Date.now() - c.at > 15_000) {
      const dept = await this.depts.findOne({ where: { tenantId, id: departmentId } });
      if (!dept) return null;
      const agents = await this.agents.find({ where: { tenantId, departmentId } });
      const others = await this.depts.find({ where: { tenantId, id: Not(departmentId) }, select: ['id', 'name', 'mission', 'status'] });
      c = { at: Date.now(), dept, agents, others };
      this.ctxCache.set(departmentId, c);
    }
    const { dept, agents, others } = c;
    if (dept.tenantId !== tenantId) return null;
    const me = agents.find((a) => a.id === agentId);
    if (!me) return null;
    const matrix = normalizeMatrix(dept.permissions);
    const { allowed, approval } = matrixGrants(matrix);
    const colleagues = agents
      .sort((a, b) => Number(b.isLead) - Number(a.isLead) || a.officeSort - b.officeSort)
      .map((a) => `- ${a.jobTitle || a.name}${a.isLead ? ' (department lead)' : ''}${a.id === me.id ? ' ← you' : ''}`)
      .join('\n');
    const otherLines = others
      .map((o) => `- ${o.name} (departmentId: ${o.id})${o.status !== 'active' ? ' [paused]' : ''}: ${o.mission.replace(/\s+/g, ' ').slice(0, 220)}`)
      .join('\n');
    const matrixLine = OFFICE_PERM_CATEGORIES.map((cat) => `${cat.key}=${matrix[cat.key]}`).join(', ');
    const langName = { ru: 'Russian', tr: 'Turkish', en: 'English' }[normLang(dept.language) ?? 'en'];
    const curator = dept.curatorAgentId ? await this.agents.findOne({ where: { tenantId, id: dept.curatorAgentId } }) : null;
    const curatorCfg = curator ? readAiAgentConfig(curator.settings) : null;
    const curatorLine = curator
      ? `- Your department is run by the curator ${curator.name} (an AI employee of the company). The curator reviews every action before it goes out and may send it back with comments — follow the curator's feedback.${curatorCfg?.instructions ? `\n- Curator's standing instructions (apply them to all your work):\n<<<\n${curatorCfg.instructions}\n>>>` : ''}\n`
      : '';
    const promptBlock = `AI DEPARTMENT — your department is a hard boundary: you work only on its goal, with its permissions.
- LANGUAGE: write EVERYTHING in ${langName} — summary, titles, task and note texts, reports, Brain documents and messages to staff. Messages to a client: in the client's language if it is clear from their messages, otherwise ${langName}.
- Department: ${dept.name}
- Department goal (from the owner):
<<<
${dept.mission || '(not set — ask the owner via office_request_help if a task is unclear)'}
>>>
${dept.systemPrompt.trim() ? `- Department instructions (from the owner, shared by all agents):\n<<<\n${dept.systemPrompt.trim()}\n>>>\n` : ''}- Department rules:\n${dept.rules.map((r) => `  - ${RULE_TEXT[r] ?? r}`).join('\n') || '  - (none)'}
- Permission matrix (off/read/draft/appr = every action waits for human approval/auto): ${matrixLine}
${curatorLine}- Colleagues in your department:
${colleagues}
${me.isLead ? '- You are the department LEAD: you own the outcome, keep the queue moving and turn the goal into concrete tasks.\n' : ''}- Other AI departments (when a piece of work is THEIR job, pass it with office_handoff — never do another department's work yourself):
${otherLines || '- none yet'}
- Missing something you need (a document, price list, brand book, access to a service, a decision)? Do NOT invent it — call office_request_help and stop that part of the work.`;
    const usable = await this.connectors.usableFor(tenantId, dept).catch(() => new Set<string>());
    const quoteCatalog = allowed.has('send_email') ? await this.quoteCatalog(tenantId).catch(() => '') : '';
    const telegramBots: Array<{ id: string; username: string | null }> =
      allowed.has('publish_telegram_post') && dept.connectors.includes('telegram')
        ? await this.depts.query(`SELECT id, "botUsername" username FROM telegram_bots WHERE "tenantId" = $1 AND status <> 'error' ORDER BY "createdAt" LIMIT 5`, [tenantId]).catch(() => [])
        : [];
    return { department: dept, allowed, approval, promptBlock, taskId: null, connectorActions: this.connectors.actionsPrompt(usable, allowed), quoteCatalog, telegramBots };
  }

  /** Шаблоны КП (с таблицей позиций) и каталог товаров/услуг — чтобы агент мог выпустить коммерческое предложение. */
  private async quoteCatalog(tenantId: string): Promise<string> {
    const tpls: Array<{ id: string; name: string; body: string }> = await this.depts.query(`SELECT id, name, "bodyTemplate" body FROM esign_templates WHERE "tenantId" = $1`, [tenantId]);
    const quoteTpls = tpls.filter((t) => /\{QUOTE_ITEMS\}|\{QUOTE_TOTAL\}/.test(t.body ?? ''));
    if (!quoteTpls.length) return '';
    const products: Array<{ id: string; name: string; price: string; currency: string }> = await this.depts.query(
      `SELECT id, name, price, currency FROM products WHERE "tenantId" = $1 AND "isDeleted" = false AND COALESCE(status, 'active') NOT IN ('archived','deleted','draft') ORDER BY name LIMIT 40`,
      [tenantId],
    );
    const services: Array<{ id: string; name: string; price: string; currency: string }> = await this.depts
      .query(`SELECT id, name, price, currency FROM booking_services WHERE "tenantId" = $1 ORDER BY name LIMIT 30`, [tenantId])
      .catch(() => []);
    const line = (k: string, r: { id: string; name: string; price: string; currency: string }) => `  - ${k} ${r.id}: ${r.name} — ${r.price ?? '?'} ${r.currency ?? ''}`;
    return `- create_quote: payload { leadId, templateId, items: [{ kind: "product"|"service", refId, quantity?, discountPercent? }], discountPercent?, validUntil? (YYYY-MM-DD) } — issues a commercial offer (PDF) from "My documents" for that lead and emails the client a link to it. Prices come from the catalog — never invent them. Always goes to the owner for approval.
  Offer templates: ${quoteTpls.map((t) => `${t.id} ("${t.name}")`).join(', ')}
  Catalog:
${[...products.map((p) => line('product', p)), ...services.map((p) => line('service', p))].join('\n') || '  (empty — ask the owner via office_request_help to add products)'}`;
  }

  /** отправки, остановленные защитой, по задаче — движок дописывает их в итог */
  readonly blockedSends = new Map<string, string[]>();
  /** ответы safetyCheck — уже записаны как «НЕ отправлено», второй раз не пишем */
  private readonly safetyBlocked = new Set<string>();
  /** заявки, в которые агент уже ответил в этой задаче (taskId → ticketIds): второй ответ подряд — дубль */
  private readonly repliedTickets = new Map<string, Set<string>>();
  /** новый запуск задачи (в т.ч. доработка по замечанию куратора) — прежние ответы отклонены, можно отвечать снова */
  resetRunGuards(taskId: string) {
    this.repliedTickets.delete(taskId);
  }
  takeBlockedSends(taskId: string): string[] {
    const l = this.blockedSends.get(taskId) ?? [];
    this.blockedSends.delete(taskId);
    return l;
  }

  static normSafety(s: any): {
    dailySends: number;
    minHoursPerClient: number;
    stopList: string[];
    allowAdChanges: boolean;
    autoPurchaseOrders: boolean;
    autoKbReplies: boolean;
    autoBookingMessages: boolean;
    autoPosting: boolean;
  } {
    const n = (v: unknown, d: number, lo: number, hi: number) => (Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Math.round(Number(v)))) : d);
    return {
      dailySends: n(s?.dailySends, 50, 0, 5000),
      minHoursPerClient: n(s?.minHoursPerClient, 48, 0, 720),
      stopList: [...new Set((Array.isArray(s?.stopList) ? s.stopList : []).map((x: unknown) => String(x).trim().toLowerCase()).filter(Boolean))].slice(0, 500) as string[],
      // менять рекламу в кабинетах (бюджеты, пауза) — только если владелец явно включил
      allowAdChanges: s?.allowAdChanges === true,
      // самостоятельность по видам работ — всё выключено, пока владелец не включит
      autoPurchaseOrders: s?.autoPurchaseOrders === true,
      autoKbReplies: s?.autoKbReplies === true,
      autoBookingMessages: s?.autoBookingMessages === true,
      autoPosting: s?.autoPosting === true,
    };
  }

  /**
   * Защита клиентов перед любой отправкой отдела: стоп-лист, дневной лимит, частота на одного клиента.
   * Ответ на входящее сообщение клиента частотой не ограничивается — он написал сам.
   */
  private async safetyCheck(tenantId: string, ctx: OfficeRunContext, actionType: string, payload: Record<string, any>): Promise<{ code: 'stop' | 'daily' | 'freq'; vars: Record<string, string | number>; model: string } | null> {
    const dept = ctx.department;
    const s = AiOfficeService.normSafety(dept.safety);
    const leadId = String(payload.leadId ?? '') || null;
    // адреса получателей: явные + email лида
    const emails = new Set<string>((Array.isArray(payload.to) ? payload.to : payload.to ? [payload.to] : []).map((x: unknown) => String(x).trim().toLowerCase()));
    if (leadId) {
      const r: Array<{ email: string | null }> = await this.depts.query(`SELECT email FROM leads WHERE id::text = $1 AND "tenantId" = $2`, [leadId, tenantId]).catch(() => []);
      if (r[0]?.email) emails.add(String(r[0].email).trim().toLowerCase());
    }
    for (const e of emails) {
      const domain = e.split('@')[1] ?? '';
      if (s.stopList.some((x) => x === e || (domain && (x === domain || x === `@${domain}`)))) return { code: 'stop', vars: { email: e }, model: `recipient ${e} is on the department stop list — never contact them` };
    }
    const agentIds = (await this.agents.find({ where: { tenantId, departmentId: dept.id }, select: ['id'] })).map((a) => a.id);
    if (s.dailySends > 0 && agentIds.length) {
      const r: Array<{ n: string }> = await this.depts.query(
        `SELECT COALESCE(SUM(CASE WHEN action_type = 'send_bulk_email' THEN LEAST(COALESCE((payload->>'maxRecipients')::int, 50), 500) ELSE 1 END), 0) n
           FROM ai_agent_actions WHERE tenant_id = $1 AND agent_id = ANY($2) AND action_type LIKE 'send\_%' AND status IN ('pending','approved','executed') AND created_at > now() - interval '24 hours'`,
        [tenantId, agentIds],
      );
      const add = actionType === 'send_bulk_email' ? Math.min(Number(payload.maxRecipients) || 50, 500) : 1;
      if (Number(r[0]?.n ?? 0) + add > s.dailySends) return { code: 'daily', vars: { n: s.dailySends }, model: `the department daily send limit (${s.dailySends} per 24h) is reached — do not send more today; continue tomorrow` };
    }
    // письма по брони — сервисные (напоминание, подтверждение), их время задаёт сама бронь
    if (s.minHoursPerClient > 0 && leadId && actionType !== 'send_bulk_email' && actionType !== 'send_booking_message') {
      const task = ctx.taskId ? await this.tasks.findOne({ where: { id: ctx.taskId }, select: ['id', 'details', 'source'] }) : null;
      const isReply = /Incoming message:/i.test(task?.details ?? '');
      // программа дожима идёт по расписанию владельца (1-3-7 дней) — ей нужен только минимальный зазор
      const minHours = task && (task as any).source === 'program' ? Math.min(s.minHoursPerClient, 20) : s.minHoursPerClient;
      if (!isReply && minHours > 0) {
        const r: Array<{ at: Date }> = await this.depts.query(
          `SELECT created_at at FROM ai_agent_actions WHERE tenant_id = $1 AND action_type LIKE 'send\_%' AND status IN ('pending','approved','executed')
             AND (payload->>'leadId' = $2 OR (target_type = 'lead' AND target_id::text = $2)) AND created_at > now() - make_interval(hours => $3) ORDER BY created_at DESC LIMIT 1`,
          [tenantId, leadId, minHours],
        );
        if (r[0]) return { code: 'freq', vars: { h: minHours }, model: `this client was already contacted ${new Date(r[0].at).toISOString()} — the department allows one message per ${s.minHoursPerClient}h unless the client writes first` };
      }
    }
    return null;
  }

  /**
   * Канал Telegram, куда отдел может публиковать: бот компании должен быть в нём админом с правом
   * публикации (это и доказывает, что канал — компании). Возвращает chat id или текст ошибки.
   */
  private async telegramChannelCheck(tenantId: string, botId: string, channel: string): Promise<{ token: string; chatId: string; title: string } | string> {
    const ch = channel.trim();
    if (!/^@[A-Za-z0-9_]{4,64}$|^-100\d{5,20}$/.test(ch)) return 'channel must be "@channelname" or a "-100…" channel id from the Brain';
    const bots: Array<{ token: string; username: string | null }> = await this.depts.query(`SELECT "botToken" token, "botUsername" username FROM telegram_bots WHERE "tenantId" = $1 AND id::text = $2`, [tenantId, botId]);
    if (!bots[0]?.token) return 'botId must be one of the company bots listed in the action description';
    try {
      const chat = await axios.get(`https://api.telegram.org/bot${bots[0].token}/getChat`, { params: { chat_id: ch }, timeout: 15_000 });
      if (chat.data?.result?.type !== 'channel') return `${ch} is not a channel`;
      const me = await axios.get(`https://api.telegram.org/bot${bots[0].token}/getMe`, { timeout: 15_000 });
      const member = await axios.get(`https://api.telegram.org/bot${bots[0].token}/getChatMember`, { params: { chat_id: ch, user_id: me.data?.result?.id }, timeout: 15_000 });
      const m = member.data?.result;
      if (!(m?.status === 'creator' || (m?.status === 'administrator' && m?.can_post_messages))) return `the company bot is not an admin with "post messages" right in ${ch} — the owner must add it as a channel admin first`;
      return { token: bots[0].token, chatId: String(chat.data.result.id), title: String(chat.data.result.title ?? ch) };
    } catch (e: any) {
      return `Telegram: ${e?.response?.data?.description ?? e.message} — check the channel name and that the bot is its admin`;
    }
  }

  /** Инструкция для контента: md-файл, загруженный человеком в папку отдела (не заметки самих агентов). */
  async hasContentInstructions(tenantId: string, departmentId: string): Promise<boolean> {
    const r: any[] = await this.depts.query(
      `SELECT 1 FROM ai_brain_files WHERE tenant_id = $1 AND department_id = $2 AND type = 'md' AND COALESCE(source, '') <> 'agent' LIMIT 1`,
      [tenantId, departmentId],
    );
    return r.length > 0;
  }

  /** Публикация одного запланированного поста (условия автопостинга проверяет вызывающий). */
  async publishScheduledPost(post: { id: string; tenant_id: string; department_id: string; bot_id: string; channel: string; text: string; task_id: string | null }) {
    const lang = await this.langOf(post.tenant_id, post.department_id);
    const chk = await this.telegramChannelCheck(post.tenant_id, post.bot_id, post.channel);
    if (typeof chk === 'string') {
      await this.depts.query(`UPDATE ai_office_posts SET status = 'failed', error = $2 WHERE id = $1`, [post.id, chk.slice(0, 500)]);
      await this.addEvent({ tenantId: post.tenant_id, departmentId: post.department_id, taskId: post.task_id, kind: 'tool_failed', tool: 'content_plan', text: ot(lang, 'post_failed', { error: chk.slice(0, 200) }), level: 'error' });
      return;
    }
    try {
      const r = await axios.post(`https://api.telegram.org/bot${chk.token}/sendMessage`, { chat_id: chk.chatId, text: post.text.slice(0, 4096) }, { timeout: 20_000 });
      const msgId = r.data?.result?.message_id;
      const url = post.channel.startsWith('@') && msgId ? `https://t.me/${post.channel.slice(1)}/${msgId}` : null;
      await this.depts.query(`UPDATE ai_office_posts SET status = 'published', published_at = now(), url = $2, error = NULL WHERE id = $1`, [post.id, url]);
      await this.addEvent({ tenantId: post.tenant_id, departmentId: post.department_id, taskId: post.task_id, kind: 'tool', tool: 'publish_telegram_post', text: ot(lang, 'tg_posted', { channel: chk.title }), meta: { url } });
    } catch (e: any) {
      const err = String(e?.response?.data?.description ?? e.message).slice(0, 500);
      await this.depts.query(`UPDATE ai_office_posts SET status = 'failed', error = $2 WHERE id = $1`, [post.id, err]);
      await this.addEvent({ tenantId: post.tenant_id, departmentId: post.department_id, taskId: post.task_id, kind: 'tool_failed', tool: 'content_plan', text: ot(lang, 'post_failed', { error: err.slice(0, 200) }), level: 'error' });
    }
  }

  async listPosts(tenantId: string, departmentId: string) {
    return this.depts.query(
      `SELECT id, channel, text, publish_at "publishAt", status, error, url, published_at "publishedAt" FROM ai_office_posts
        WHERE tenant_id = $1 AND department_id = $2 AND (status = 'scheduled' OR publish_at > now() - interval '14 days') ORDER BY publish_at LIMIT 100`,
      [tenantId, departmentId],
    );
  }

  async cancelPost(tenantId: string, id: string) {
    const r: any[] = await this.depts.query(`UPDATE ai_office_posts SET status = 'cancelled' WHERE tenant_id = $1 AND id::text = $2 AND status = 'scheduled' RETURNING id`, [tenantId, id]);
    if (!r.length) throw new BadRequestException('Post is not scheduled');
    return { ok: true };
  }

  /** Шаблон письма ресепшена (может быть отредактирован владельцем в «Шаблонах писем»). */
  private async receptionTemplate(tenantId: string, key: string): Promise<{ subject: string; text: string } | null> {
    const [t] = await this.depts.query(
      `SELECT subject, "textBody" text FROM email_templates WHERE "tenantId" = $1 AND meta->>'aiOfficeStarter' = $2 AND "isActive" = true ORDER BY "updatedAt" DESC LIMIT 1`,
      [tenantId, `reception_${key}`],
    );
    return t && String(t.text ?? '').trim() ? { subject: String(t.subject ?? ''), text: String(t.text) } : null;
  }

  /**
   * Ответ человека в заявке (или одобренный человеком черновик ИИ) → задача отделу поддержки: обобщить в
   * вопрос-ответ и дописать в «Базу знаний поддержки» — дальше на такой вопрос отдел ответит сам.
   */
  async learnFromHumanReply(tenantId: string, ticketId: string, answer: string) {
    try {
      const text = String(answer ?? '').trim();
      if (text.length < 20) return;
      // отдел на паузе тоже копит такие задачи — выполнит, когда его включат
      const dept = await this.depts.findOne({ where: { tenantId, templateKey: 'support' } as any, order: { createdAt: 'ASC' } as any });
      if (!dept) return;
      const [t] = await this.depts.query(`SELECT subject FROM helpdesk_tickets WHERE "tenantId" = $1 AND id::text = $2`, [tenantId, ticketId]);
      const [q] = await this.depts.query(
        `SELECT text FROM helpdesk_ticket_messages WHERE "tenantId" = $1 AND "ticketId"::text = $2 AND direction = 'incoming' ORDER BY "createdAt" DESC LIMIT 1`,
        [tenantId, ticketId],
      );
      if (!t || !q) return;
      const lang = await this.langOf(tenantId, dept.id);
      const ref = `kb:${ticketId}:${createHash('sha1').update(text).digest('hex').slice(0, 12)}`;
      const ex = await this.tasks.count({ where: { tenantId, departmentId: dept.id, sourceRef: ref } as any });
      if (ex) return;
      await this.createTask(tenantId, {
        departmentId: dept.id,
        title: ot(lang, 'kb_learn_title', { subject: String(t.subject).slice(0, 120) }),
        details: `${ot(lang, 'kb_learn_details', { file: ot(lang, 'kb_file') })}\n\nQ: ${String(q.text).slice(0, 2000)}\n\nA: ${text.slice(0, 3000)}`,
        source: 'program',
        sourceRef: ref,
        priority: 3,
      });
    } catch (e) {
      this.log.warn(`kb learn failed: ${(e as Error).message}`);
    }
  }

  /** Действие агента заблокировано проверкой — владелец видит это в итоге задачи («❌ Не выполнено»), а не «сделано». */
  async preflight(tenantId: string, ctx: OfficeRunContext, actionType: string, payload: Record<string, any>) {
    // отметку «без согласования» ставит только система — то, что прислала модель, стираем
    delete payload.systemAutoApproved;
    const reason = await this.preflightCheck(tenantId, ctx, actionType, payload);
    // отправки, остановленные защитой, уже записаны (safetyCheck); остальное — «не выполнено»
    if (reason && ctx.taskId && !this.safetyBlocked.has(reason)) {
      const lang = await this.langOf(tenantId, ctx.department.id);
      const list = this.blockedSends.get(ctx.taskId) ?? [];
      list.push(ot(lang, 'not_done_blocked', { action: actionType }));
      this.blockedSends.set(ctx.taskId, list);
      await this.addEvent({ tenantId, departmentId: ctx.department.id, taskId: ctx.taskId, kind: 'tool_failed', tool: actionType, text: `${actionType}: ${reason.slice(0, 300)}`, level: 'warn' });
    }
    return reason;
  }

  private async preflightCheck(tenantId: string, ctx: OfficeRunContext, actionType: string, payload: Record<string, any>) {
    // записи в таблицу, которой ещё нет («подставится после создания») — действие сломано, не создаём его
    if (/^workspace_/.test(actionType) && 'objectId' in payload && !/^[0-9a-f-]{36}$/i.test(String(payload.objectId ?? ''))) {
      return 'objectId must be the id of an EXISTING table (from the snapshot) — a table created in this same run has no id yet; create the table now and fill it in the next task';
    }
    if (actionType === 'ads_campaign_control' && !AiOfficeService.normSafety(ctx.department.safety).allowAdChanges) {
      return 'changing ad accounts is turned off for this department — describe the recommended change in your report instead';
    }
    if (actionType === 'send_booking_message' || actionType === 'booking_update') {
      const kind: BookingKind = payload.kind === 'hotel' ? 'hotel' : 'booking';
      const id = String(payload.reservationId ?? payload.id ?? '');
      const b = await bookingContact(this.depts, tenantId, kind, id);
      if (!b) return 'reservationId must be the id of a booking from RECEPTION DATA (kind "booking" or "hotel")';
      if (ctx.taskId) {
        const task = await this.tasks.findOne({ where: { id: ctx.taskId }, select: ['id', 'entityType', 'entityId'] });
        if (task?.entityId && bookingKindOf(task.entityType) && task.entityId !== b.id) return 'this task is about another booking — act only on the booking of this task';
      }
      if (actionType === 'send_booking_message') {
        if (!b.email) return 'this guest has no email — the message cannot be delivered; leave a note for the front desk instead';
        const tplKey = String(payload.template ?? '');
        if (tplKey && !(RECEPTION_TEMPLATE_KEYS as readonly string[]).includes(tplKey)) return `template must be one of ${RECEPTION_TEMPLATE_KEYS.join(' | ')}`;
        const tpl = tplKey ? await this.receptionTemplate(tenantId, tplKey) : null;
        if (tplKey && !tpl) return `the "${tplKey}" email template was deleted — write the text yourself (it goes to approval)`;
        if (!tpl && !String(payload.text ?? '').trim()) return 'send_booking_message: text is empty';
        if (tpl && /\{\{\s*review_link\s*\}\}/.test(`${tpl.subject} ${tpl.text}`)) {
          const link = String(payload.vars?.review_link ?? '').trim();
          if (!/^https?:\/\/\S+$/.test(link) || !(await this.brain.hasText(tenantId, ctx.department.id, link))) {
            return 'vars.review_link must be the review link exactly as written in the Brain — if the Brain has no review link, do not send; ask the owner via office_request_help';
          }
        }
        // «Письма гостям сами»: письмо по шаблону компании, данные — из брони → без согласования
        if (tpl && AiOfficeService.normSafety(ctx.department.safety).autoBookingMessages) payload.systemAutoApproved = true;
        // для стоп-листа, лимитов и журнала — реальный получатель брони
        payload.to = [b.email];
        if (b.leadId) payload.leadId = b.leadId;
      } else {
        const allowed = kind === 'booking' ? ['confirm', 'cancel', 'no_show', 'complete'] : ['confirm', 'cancel'];
        if (!allowed.includes(String(payload.action))) return `booking_update: action must be one of ${allowed.join(' | ')} for a ${kind} booking`;
      }
    }
    if (/^send_/.test(actionType)) {
      const blocked = await this.safetyCheck(tenantId, ctx, actionType, payload).catch((e) => {
        this.log.warn(`safety check failed: ${(e as Error).message}`);
        return null;
      });
      if (blocked) {
        // владелец видит в задаче, что сообщение НЕ ушло и почему (модель в итоге может написать «отправлено»)
        const lang = await this.langOf(tenantId, ctx.department.id);
        const text = ot(lang, `safety_${blocked.code}`, blocked.vars);
        if (ctx.taskId) {
          const list = this.blockedSends.get(ctx.taskId) ?? [];
          list.push(ot(lang, 'not_sent_failed', { error: text }));
          this.blockedSends.set(ctx.taskId, list);
          await this.addEvent({ tenantId, departmentId: ctx.department.id, taskId: ctx.taskId, kind: 'tool_failed', tool: actionType, text: ot(lang, 'not_sent_failed', { error: text }), level: 'warn' });
        }
        this.safetyBlocked.add(blocked.model);
        if (this.safetyBlocked.size > 200) this.safetyBlocked.clear();
        return blocked.model;
      }
    }
    if (actionType === 'helpdesk_reply' || actionType === 'helpdesk_update') {
      const tid = String(payload.ticketId ?? '');
      if (!/^[0-9a-f-]{36}$/i.test(tid)) return 'ticketId must be the id of a ticket from HELPDESK data';
      const [t] = await this.depts.query(`SELECT id, channel, "contactId" FROM helpdesk_tickets WHERE "tenantId" = $1 AND id::text = $2`, [tenantId, tid]);
      if (!t) return 'ticket not found — use an id from HELPDESK data';
      if (ctx.taskId) {
        const task = await this.tasks.findOne({ where: { id: ctx.taskId }, select: ['id', 'entityType', 'entityId'] });
        if (task?.entityType === 'helpdesk_ticket' && task.entityId && task.entityId !== tid) return 'this task is about another ticket — act only on the ticket of this task';
      }
      if (actionType === 'helpdesk_reply' && !String(payload.text ?? '').trim()) return 'helpdesk_reply: text is empty';
      if (actionType === 'helpdesk_reply' && ctx.taskId) {
        const seen = this.repliedTickets.get(ctx.taskId) ?? new Set<string>();
        if (seen.has(tid)) return 'you already replied in this ticket in this task — one reply per ticket; put everything into that one reply';
        seen.add(tid);
        if (this.repliedTickets.size > 500) this.repliedTickets.clear();
        this.repliedTickets.set(ctx.taskId, seen);
      }
      // «Отвечать самостоятельно по базе знаний»: ответ уходит сам, только если опирается на дословную цитату
      // из md-файла «Мозга», а тема не возврат/жалоба/юристы. Иначе — черновик человеку на согласование.
      if (actionType === 'helpdesk_reply' && AiOfficeService.normSafety(ctx.department.safety).autoKbReplies) {
        const quote = String(payload.kbQuote ?? '');
        const [last] = await this.depts.query(
          `SELECT text FROM helpdesk_ticket_messages WHERE "ticketId" = $1 AND direction = 'incoming' ORDER BY "createdAt" DESC LIMIT 1`,
          [t.id],
        );
        if (!ESCALATE_RE.test(String(last?.text ?? '')) && (await this.brain.hasQuote(tenantId, ctx.department.id, quote))) payload.systemAutoApproved = true;
      }
      if (actionType === 'helpdesk_reply' && !['portal', 'internal'].includes(t.channel) && !t.contactId) return 'this ticket has no client contact — the reply cannot be delivered; assign a human instead';
    }
    if (actionType === 'sale_confirm_payment') {
      const sid = String(payload.saleId ?? '');
      const r: any[] = await this.depts.query(
        `SELECT s.status, s.amount sa, s.currency sc, p.amount pa, p.currency pc FROM sales s JOIN payments p ON p."saleId" = s.id AND p.status = 'paid'
          WHERE s."tenantId" = $1 AND s.id::text = $2 ORDER BY p."paidAt" DESC NULLS LAST LIMIT 1`,
        [tenantId, sid],
      ).catch(() => []);
      if (!r[0]) return 'sale_confirm_payment is only for a sale with a SUCCESSFUL online payment (see Reconciliation issues) — for cash/bank transfers a human marks the sale';
      if (['confirmed', 'paid'].includes(r[0].status)) return 'this sale is already marked as paid';
      if (String(r[0].pc) !== String(r[0].sc) || Math.abs(Number(r[0].pa) - Number(r[0].sa)) > 0.01) return 'payment amount/currency differs from the sale — a human must decide; describe the mismatch in the report';
    }
    if (actionType === 'content_plan') {
      if (!AiOfficeService.normSafety(ctx.department.safety).autoPosting) return 'autoposting is turned off for this department — publish posts one by one with publish_telegram_post (each is approved by the owner)';
      if (!(await this.hasContentInstructions(tenantId, ctx.department.id))) return 'autoposting needs the content instructions: an .md file uploaded by the owner into the department folder of the Brain — ask for it via office_request_help and stop';
      const posts = Array.isArray(payload.posts) ? payload.posts : [];
      if (!posts.length || posts.length > 31) return 'posts must contain 1–31 posts';
      const checked = new Map<string, string | null>();
      for (const [i, x] of posts.entries()) {
        const text = String(x?.text ?? '').trim();
        if (!text || text.length > 4000) return `posts[${i}].text must be 1–4000 characters`;
        if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/.test(String(x?.publishAt ?? ''))) return `posts[${i}].publishAt must be "YYYY-MM-DD HH:mm" in the department time zone`;
        const key = `${x?.botId}|${x?.channel}`;
        if (!checked.has(key)) {
          const chk = await this.telegramChannelCheck(tenantId, String(x?.botId ?? ''), String(x?.channel ?? ''));
          checked.set(key, typeof chk === 'string' ? chk : null);
        }
        if (checked.get(key)) return `posts[${i}]: ${checked.get(key)}`;
      }
      const [range] = await this.depts.query(
        `SELECT min(v::timestamp AT TIME ZONE $2) mn, max(v::timestamp AT TIME ZONE $2) mx FROM unnest($1::text[]) v`,
        [posts.map((x: any) => String(x.publishAt).replace('T', ' ')), ctx.department.timezone || 'UTC'],
      );
      if (new Date(range.mn).getTime() < Date.now() + 10 * 60_000) return 'every publishAt must be at least 10 minutes in the future (department time zone)';
      if (new Date(range.mx).getTime() > Date.now() + 62 * 86_400_000) return 'plan at most 2 months ahead';
    }
    if (actionType === 'publish_telegram_post') {
      if (!String(payload.text ?? '').trim()) return 'publish_telegram_post: text is empty';
      if (String(payload.text).length > 4000) return 'publish_telegram_post: text is longer than 4000 characters — shorten it';
      const chk = await this.telegramChannelCheck(tenantId, String(payload.botId ?? ''), String(payload.channel ?? ''));
      if (typeof chk === 'string') return chk;
    }
    if (actionType === 'stock_purchase_order') {
      const email = String(payload.supplierEmail ?? '').trim();
      if (!email || !(await knownSupplierEmail(this.depts, tenantId, email))) {
        return 'supplierEmail must be a supplier address the company gave you (Brain documents or CRM contacts/companies) — never guess it; if you do not have it, ask the owner via office_request_help (kind "data": supplier list with emails) and stop';
      }
      const ids = (Array.isArray(payload.items) ? payload.items : []).map((x: any) => String(x?.productId ?? ''));
      if (!ids.length || ids.some((x: string) => !/^[0-9a-f-]{36}$/i.test(x))) return 'items[].productId must be real product ids from the STOCK data';
      const found: any[] = await this.depts.query(`SELECT count(*) n FROM products WHERE "tenantId" = $1 AND id::text = ANY($2)`, [tenantId, ids]);
      if (Number(found[0]?.n ?? 0) !== new Set(ids).size) return 'some items[].productId are not products of this company — use ids from the STOCK data';
      // «Автозаказ у поставщиков»: поставщик и товары проверены выше — заказ уходит без согласования
      if (AiOfficeService.normSafety(ctx.department.safety).autoPurchaseOrders) payload.systemAutoApproved = true;
    }
    // просить у владельца файл с данными, которые отделу уже открыты (расходы рекламы и т.п.), — нельзя
    if (actionType === 'office_request_help') {
      const src = await this.data.matchSource(ctx.department, `${payload.title ?? ''} ${payload.detail ?? ''}`).catch(() => null);
      if (src?.status === 'ok') return 'this data is already given to you in DEPARTMENT DATA (ad accounts) — use those numbers and do the task, do not ask the owner for files';
    }
    // задача без конкретной записи не трогает чужие лиды: статус и ответственного меняют только
    // задачи, привязанные к этому лиду (событие CRM / автоматизация / явная привязка)
    // задача на анализ/отчёт выполняется самим агентом: «поставить задачу проанализировать» = переложить
    // работу на человека (gpt-4o-mini делает так вопреки промпту). Задачу в CRM — только если офисная задача
    // привязана к записи или прямо просит поставить задачу.
    if (ctx.taskId && actionType === 'create_task') {
      const task = await this.tasks.findOne({ where: { id: ctx.taskId }, select: ['id', 'entityId', 'title', 'details'] });
      if (task && !task.entityId && !/задач|task|görev|поручи|напомни/i.test(`${task.title} ${task.details}`)) {
        return 'do this work yourself and deliver the result with brain_write — do not create a CRM task for it';
      }
    }
    if (ctx.taskId && ['update_lead_status', 'assign_lead', 'assign_self'].includes(actionType)) {
      const task = await this.tasks.findOne({ where: { id: ctx.taskId }, select: ['id', 'entityType', 'entityId'] });
      const leadId = String(payload.leadId ?? payload.entityId ?? '');
      if (task && !(task.entityType === 'lead' && task.entityId && (!leadId || leadId === task.entityId))) {
        return 'this task is not about that lead — lead status and assignment change only in tasks linked to the lead';
      }
    }
    return this.connectors.preflight(tenantId, ctx.department, actionType, payload);
  }

  actionsPromptFor(ctx: OfficeRunContext): string {
    const payLine = ctx.allowed.has('send_email')
      ? `Payments:\n- send_payment_link: payload { saleId, subject, text } — creates a payment link for that CRM sale (the company's payment gateway) and emails it to the client; put {{link}} where the link goes (otherwise it is added at the end). Polite, short, no threats; mention the amount and what it is for. Always approved by the owner.\n`
      : '';
    const adsLine = ctx.allowed.has('ads_manage') && AiOfficeService.normSafety(ctx.department.safety).allowAdChanges
      ? `Ad accounts (real changes, always approved by the owner first):\n- ads_campaign_control: payload { platform: "google_ads"|"meta_ads", account?: "<customer id from the dataSource google_ads_<id>, Google only>", campaign: "<exact campaign name from DEPARTMENT DATA>", action: "pause"|"enable"|"set_daily_budget", dailyBudget?: <new daily budget in the account currency>, currency?: "<currency>" } — put the numbers that justify it (spend, conversions, ROAS for the period) into "reason". Never touch awareness/reach campaigns for lack of conversions; never raise a budget by more than 50% at once.\n`
      : '';
    const stockLine = ctx.allowed.has('stock_purchase_order')
      ? `Stock:\n- stock_purchase_order: payload { supplierName, supplierEmail (ONLY an address from the Brain or CRM contacts/companies — never guessed), subject, text (polite order email in the supplier's language; list every item with its quantity), items: [{ productId (from STOCK data), quantity }], note? (internal note for the owner — NOT sent to the supplier) } — emails a purchase order to the supplier. Stock levels do not change until the goods arrive (a human records the receipt). One order per supplier. ${AiOfficeService.normSafety(ctx.department.safety).autoPurchaseOrders ? 'Auto-ordering is ON: the order is sent right away — order only what the STOCK data justifies.' : 'Approved by the owner before sending.'}\n`
      : '';
    const hdLines = [
      ctx.allowed.has('helpdesk_reply')
        ? AiOfficeService.normSafety(ctx.department.safety).autoKbReplies
          ? '- helpdesk_reply: payload { ticketId, text, status?: "pending" | "resolved", kbFile, kbQuote } — replies in the ticket through its channel. SELF-REPLY MODE: when the answer is in a Brain .md file, copy the exact sentence(s) you rely on into kbQuote (verbatim, at least one full sentence) and the file name into kbFile — such a reply is sent at once. When the answer is NOT in the Brain files: do not answer from general knowledge — assign a human with helpdesk_update; you may add a short helpdesk_reply without kbQuote ("passed to a specialist"), it goes to a human for approval.'
          : '- helpdesk_reply: payload { ticketId, text, status?: "pending" (waiting for the client) | "resolved" (problem solved) } — replies in the ticket; it reaches the client through the ticket channel (portal / email / Telegram / WhatsApp / SMS) or the staff member for internal requests. Answer from the Brain knowledge base and the conversation only; if the answer is not there, do not guess — assign a human with helpdesk_update and say so in a short reply ("passed to a specialist").'
        : '',
      ctx.allowed.has('helpdesk_update')
        ? '- helpdesk_update: payload { ticketId, status?: "open"|"pending"|"resolved"|"closed", priority?: "low"|"medium"|"high"|"urgent", assignedUserId? (staff id from snapshot.channels.staff), category? } — triage the ticket: complaints/refunds/legal/angry clients → priority high + assign a human.'
        : '',
    ].filter(Boolean);
    const hdLine = hdLines.length ? `Helpdesk:\n${hdLines.join('\n')}\n` : '';
    const bkLines = [
      ctx.allowed.has('send_booking_message')
        ? `- send_booking_message: payload { kind: "booking"|"hotel", reservationId, template: "confirm"|"remind"|"noshow"|"review", vars?: { review_link } } — emails the guest using the company email template (date, time, service, place and address are filled by the system from the booking; the recipient is taken from the booking). For "review" put the review link exactly as written in the Brain into vars.review_link. ${AiOfficeService.normSafety(ctx.department.safety).autoBookingMessages ? 'Template emails are sent right away.' : 'Goes to the owner for approval.'} Only when no template fits: payload { kind, reservationId, subject, text } — free text, always approved by the owner. One message per booking per task.`
        : '',
      ctx.allowed.has('booking_update')
        ? '- booking_update: payload { kind: "booking"|"hotel", reservationId, action: "confirm"|"cancel"|"no_show"|"complete" (hotel: only confirm|cancel) } — changes the booking status in the CRM. no_show only when the start time has passed and the guest did not come; cancel ALWAYS goes to the owner — never cancel on your own idea, only when the guest asked.'
        : '',
    ].filter(Boolean);
    const bkLine = bkLines.length ? `Bookings:\n${bkLines.join('\n')}\n` : '';
    const finLine = ctx.allowed.has('sale_confirm_payment')
      ? `Finance:\n- sale_confirm_payment: payload { saleId } — marks a CRM sale as paid when the payment gateway confirmed the payment but the sale was not updated (Reconciliation issues: "not_marked"). Only with a successful online payment of the same amount; always approved by the owner.\n`
      : '';
    const planLine =
      ctx.allowed.has('content_plan') && ctx.telegramBots?.length && AiOfficeService.normSafety(ctx.department.safety).autoPosting
        ? `- content_plan: payload { title, posts: [{ publishAt: "YYYY-MM-DD HH:mm" (department time zone ${ctx.department.timezone || 'UTC'}), botId, channel, text (≤ 4000 chars, ready to publish) }] } — AUTOPOSTING: the owner approves the whole plan once, then every post is published by the system at its time. Follow the content instructions .md in the Brain (tone, rubrics, frequency, forbidden topics). Use this instead of publish_telegram_post for a content plan.\n`
        : '';
    const tgLine = ctx.allowed.has('publish_telegram_post') && ctx.telegramBots?.length
      ? `Publishing:\n- publish_telegram_post: payload { botId (one of: ${ctx.telegramBots.map((b) => `${b.id} = @${b.username ?? '?'}`).join(', ')}), channel ("@channelname" or "-100…" id — ONLY a channel named in the Brain), text (≤ 4000 chars, plain text, ready to publish) } — publishes a post to the company Telegram channel for all subscribers. Always approved by the owner. The bot must be an admin of the channel.\n${planLine}`
      : '';
    return `${ctx.connectorActions ? `${ctx.connectorActions}\n` : ''}${ctx.quoteCatalog ? `Commercial offers:\n${ctx.quoteCatalog}\n` : ''}${adsLine}${payLine}${finLine}${stockLine}${hdLine}${bkLine}${tgLine}AI Office actions (always available to you):
- office_handoff: payload { toDepartmentId (from "Other AI departments"), title, task: self-contained description of what they must do and why, entityType?, entityId? } — creates a task in that department's queue.
- office_request_help: payload { kind: "data"|"access", title: short, detail: what exactly is missing and why the task needs it, folder?: "common" or your department for documents, connector?: service key for access } — shows the owner a "needs your help" item; the current task waits until it is resolved.
- brain_write: payload { title, contentMd } — saves reusable knowledge (findings, procedures, data you collected) as a document in your department's folder of the Brain.
Your run "summary" is the task result shown to the owner and written to the department findings log — make it concrete (numbers, names, what was done).
HOW TO DELIVER: you are the one doing the work. If the task is analysis, a review, a plan, a script or a report — do it NOW from the CRM snapshot and knowledge you were given, and deliver the result with brain_write (or create_report if allowed): real numbers, findings and recommendations. NEVER answer an analysis task with create_task "analyse X" — that just hands your own job to a human. Use create_task only for work a human must physically do (a call, a meeting, a payment). If the data needed is missing, say exactly what is missing (office_request_help) instead of postponing.
SENDING: when send_email / send_whatsapp / send_telegram / send_bulk_email is in your actions, SEND (it goes to the owner for approval automatically if the department requires it) — the company pays you to contact clients, not to leave drafts. Use draft_* only when sending is not allowed for your department or the channel is not connected. For emails prefer a fitting template from snapshot.channels.emailTemplates (templateId); your own text is wrapped in the company email design automatically.
The "summary" must state only what was actually done in this run; anything that still waits for approval is described as waiting ("prepared for approval"), and a draft is a draft, not "sent".
Put the FULL deliverable (the analysis itself: numbers from DEPARTMENT DATA and the snapshot, findings, recommendations, the plan or text) into "reportPreview" as markdown with headings and tables where useful — it is the report the owner reads. "summary" is the 1–2 sentence headline. Never write "analysis started" — the analysis must be finished in this run.
SCOPE: if the task is mainly the job of another area (sales, marketing, content, ops, finance, stock, dev) than your department's area, do NOT do it and do NOT ask for access — return actions: [] and "outOfScope": { "area", "reason" }.
DATA ACCESS: if the task needs a data source of YOUR area that is marked NOT AVAILABLE, return actions: [] and "needsAccess": ["<source key>"] — never invent the numbers.`;
  }

  /** Задача отдела, которую агент выполняет сейчас (для офисных действий внутри запуска). */
  private async currentTaskOf(tenantId: string, agentId: string) {
    return this.tasks.findOne({ where: { tenantId, agentId, status: 'progress' }, order: { startedAt: 'DESC' } });
  }

  async dispatch(tenantId: string, action: AiAgentAction): Promise<void> {
    const p = (action.payload || {}) as Record<string, any>;
    const agent = await this.agents.findOne({ where: { tenantId, id: action.agentId } });
    if (!agent?.departmentId) throw new Error('Agent is not in an AI department');
    const lang = await this.langOf(tenantId, agent.departmentId);
    const current = await this.currentTaskOf(tenantId, agent.id);

    if (action.actionType === 'office_handoff') {
      const toId = String(p.toDepartmentId ?? '');
      if (!toId || toId === agent.departmentId) throw new Error('office_handoff: toDepartmentId must be another department');
      const target = await this.depts.findOne({ where: { tenantId, id: toId } });
      if (!target) throw new Error('office_handoff: unknown department');
      const depth = (current?.handoffDepth ?? 0) + 1;
      if (depth > 3) throw new Error('office_handoff: handoff chain is too long');
      if (current?.fromDepartmentId === target.id) throw new Error('office_handoff: never hand a task back to the department that handed it to you');
      const title = this.cleanText(p.title || p.task, 255);
      const t = await this.createTask(tenantId, {
        departmentId: target.id,
        title,
        details: this.cleanText(p.task, 8000),
        entityType: p.entityType ?? current?.entityType ?? null,
        entityId: p.entityId ?? current?.entityId ?? null,
        source: 'handoff',
        sourceRef: current?.id ?? null,
        parentTaskId: current?.id ?? null,
        fromDepartmentId: agent.departmentId,
        handoffDepth: depth,
      });
      await this.addEvent({ tenantId, departmentId: agent.departmentId, taskId: current?.id ?? null, agentId: agent.id, kind: 'handoff', tool: 'office_handoff', text: ot(lang, 'handoff', { to: target.name, title }), meta: { toDepartmentId: target.id, newTaskId: t.id } });
      return;
    }

    if (action.actionType === 'office_request_help') {
      // данные своей зоны (реклама) — не «загрузите файл», а «Предоставить доступ» / «Подключить»
      const dept = await this.depts.findOne({ where: { tenantId, id: agent.departmentId } });
      const src = dept ? await this.data.matchSource(dept, `${p.title ?? ''} ${p.detail ?? ''}`).catch(() => null) : null;
      if (src && src.status !== 'ok') {
        const text = accessIssueText(lang, src);
        const dedupeKey = `${agent.departmentId}:data:${src.key}`;
        const issue = await this.createIssue({ tenantId, departmentId: agent.departmentId, agentId: agent.id, taskId: current?.id ?? null, kind: 'access', title: text.title, detail: text.detail, fix: text.fix, target: src.key, dedupeKey });
        await this.refreshIssue(tenantId, dedupeKey, text);
        if (current) await this.tasks.update({ id: current.id }, { status: 'blocked', issueId: issue.id });
        return;
      }
      const kind = p.kind === 'access' ? 'access' : 'data';
      const folder = p.folder && p.folder !== 'common' ? agent.departmentId : 'common';
      const issue = await this.createIssue({
        tenantId,
        departmentId: agent.departmentId,
        agentId: agent.id,
        taskId: current?.id ?? null,
        kind,
        title: this.cleanText(p.title, 255) || (kind === 'access' ? 'Access needed' : 'Data needed'),
        detail: this.cleanText(p.detail, 4000),
        fix: kind === 'access' ? 'access' : 'upload',
        target: kind === 'access' ? this.cleanText(p.connector, 64) || null : folder,
        dedupeKey: `${agent.departmentId}:${kind}:${this.normTitle(String(p.title ?? '')).slice(0, 100)}`,
      });
      if (current) await this.tasks.update({ id: current.id }, { status: 'blocked', issueId: issue.id });
      return;
    }

    if (action.actionType === 'send_payment_link') {
      const saleId = String(p.saleId ?? (action.targetType === 'sale' ? action.targetId : '') ?? '');
      if (!saleId) throw new Error('send_payment_link: saleId is required');
      const r: Array<{ id: string; amount: number; currency: string; status: string; lead_id: string | null; name: string | null; email: string | null; phone: string | null }> = await this.depts.query(
        `SELECT s.id, s.amount, s.currency, s.status, s.lead_id, COALESCE(NULLIF(c."fullName", ''), l.name) name, COALESCE(NULLIF(c.email, ''), l.email) email, COALESCE(NULLIF(c.phone, ''), l.phone) phone
           FROM sales s LEFT JOIN contacts c ON c.id = s.contact_id LEFT JOIN leads l ON l.id = s.lead_id WHERE s.id::text = $1 AND s."tenantId" = $2`,
        [saleId, tenantId],
      );
      const sale = r[0];
      if (!sale) throw new Error('send_payment_link: sale not found');
      if (['paid', 'refunded', 'canceled', 'cancelled'].includes(sale.status)) throw new Error(`send_payment_link: the sale is already ${sale.status}`);
      const paidOnline: any[] = await this.depts.query(`SELECT 1 FROM payments WHERE "tenantId" = $1 AND "saleId" = $2 AND status = 'paid' LIMIT 1`, [tenantId, sale.id]);
      if (paidOnline.length) throw new Error('send_payment_link: this sale is already paid online — no reminder needed');
      if (!sale.email) throw new Error('send_payment_link: the client has no email');
      const { PaymentsService } = await import('../payments/payments.service.js');
      const pay = this.moduleRef.get(PaymentsService, { strict: false });
      const payment = await pay.createSalePaymentLink(tenantId, sale.id, { buyerName: sale.name || 'Client', buyerEmail: sale.email, buyerPhone: sale.phone || undefined, city: '-', address: '-' }, '127.0.0.1');
      const link = payment.paymentPageUrl;
      if (!link) throw new Error('send_payment_link: the payment gateway returned no link — check the payment integration');
      const text = String(p.text ?? '').trim();
      const body = text.includes('{{link}}') ? text.replace(/\{\{link\}\}/g, link) : `${text}\n\n${link}`.trim();
      const { EmailService } = await import('../email/email.service.js');
      const email = this.moduleRef.get(EmailService, { strict: false });
      const accounts = (await email.findAllAccounts(tenantId, undefined, 'owner')) as any[];
      const accountId = accounts.find((x) => x.status !== 'error')?.id ?? accounts[0]?.id;
      if (!accountId) throw new Error('send_payment_link: no mailbox connected');
      await email.sendStyledTransactionalMail(tenantId, { accountId, to: [sale.email], subject: String(p.subject || action.title), bodyText: body, leadId: sale.lead_id ?? undefined } as any);
      action.payload = { ...p, result: { ok: true, sent: 1, total: 1, paymentId: payment.id, url: link } };
      await this.addEvent({ tenantId, departmentId: agent.departmentId, taskId: current?.id ?? null, agentId: agent.id, kind: 'tool', tool: 'send_payment_link', text: ot(lang, 'pay_link_sent', { client: sale.name ?? sale.email, amount: `${sale.amount} ${sale.currency}` }) });
      return;
    }

    if (action.actionType === 'helpdesk_reply' || action.actionType === 'helpdesk_update') {
      const ticketId = String(p.ticketId ?? '');
      const { HelpdeskService } = await import('../helpdesk/helpdesk.service.js');
      const hd = this.moduleRef.get(HelpdeskService, { strict: false });
      const status = ['open', 'pending', 'resolved', 'closed'].includes(String(p.status)) ? (String(p.status) as 'open' | 'pending' | 'resolved' | 'closed') : undefined;
      if (action.actionType === 'helpdesk_reply') {
        const text = String(p.text ?? '').trim();
        if (!text) throw new Error('helpdesk_reply: text is empty');
        // отправка в канал заявки (почта/TG/WA/SMS) — если не дошло, сообщение не сохраняется и действие падает
        await hd.addStaffMessage(tenantId, ticketId, agent.name || 'AI', text);
        if (status) await hd.updateTicket(tenantId, ticketId, { status });
        action.payload = { ...p, result: { ok: true, sent: 1, total: 1, url: `/helpdesk?ticket=${ticketId}` } };
        await this.addEvent({ tenantId, departmentId: agent.departmentId, taskId: current?.id ?? null, agentId: agent.id, kind: 'tool', tool: 'helpdesk_reply', text: ot(lang, 'hd_replied', { status: status ?? '—' }) });
      } else {
        const priority = ['low', 'medium', 'high', 'urgent'].includes(String(p.priority)) ? (String(p.priority) as 'low' | 'medium' | 'high' | 'urgent') : undefined;
        const patch: Record<string, unknown> = {};
        if (status) patch.status = status;
        if (priority) patch.priority = priority;
        if (p.assignedUserId) patch.assignedUserId = String(p.assignedUserId);
        if (p.category) patch.category = String(p.category).slice(0, 64);
        if (!Object.keys(patch).length) throw new Error('helpdesk_update: nothing to change');
        await hd.updateTicket(tenantId, ticketId, patch as any);
        action.payload = { ...p, result: { ok: true, url: `/helpdesk?ticket=${ticketId}` } };
        await this.addEvent({ tenantId, departmentId: agent.departmentId, taskId: current?.id ?? null, agentId: agent.id, kind: 'tool', tool: 'helpdesk_update', text: ot(lang, 'hd_updated', { what: Object.entries(patch).map(([k, v]) => `${k}: ${v}`).join(', ') }) });
      }
      return;
    }

    if (action.actionType === 'sale_confirm_payment') {
      const sid = String(p.saleId ?? '');
      const r: any[] = await this.depts.query(
        `SELECT s.id, s.status, s.amount sa, s.currency sc FROM sales s WHERE s."tenantId" = $1 AND s.id::text = $2
            AND EXISTS (SELECT 1 FROM payments p WHERE p."saleId" = s.id AND p.status = 'paid' AND p.currency = s.currency AND abs(p.amount - s.amount) <= 0.01)`,
        [tenantId, sid],
      );
      if (!r[0]) throw new Error('sale_confirm_payment: no successful payment of the same amount for this sale');
      // так же, как это делает сам платёжный модуль после успешной оплаты (PaymentsService.markSalePaidIfNeeded)
      await this.depts.query(`UPDATE sales SET status = 'confirmed', "updatedAt" = now() WHERE id = $1 AND "tenantId" = $2`, [r[0].id, tenantId]);
      action.payload = { ...p, result: { ok: true, from: r[0].status, to: 'confirmed' } };
      await this.addEvent({ tenantId, departmentId: agent.departmentId, taskId: current?.id ?? null, agentId: agent.id, kind: 'tool', tool: 'sale_confirm_payment', text: ot(lang, 'sale_confirmed', { amount: `${r[0].sa} ${r[0].sc}` }) });
      return;
    }

    if (action.actionType === 'content_plan') {
      // владелец одобрил план — посты встают в расписание; публикует AiOfficeProgramsService.publishDuePosts
      const dept = await this.depts.findOne({ where: { tenantId, id: agent.departmentId } });
      const posts = (Array.isArray(p.posts) ? p.posts : []).filter((x: any) => String(x?.text ?? '').trim());
      for (const x of posts) {
        await this.depts.query(
          `INSERT INTO ai_office_posts (tenant_id, department_id, plan_action_id, task_id, bot_id, channel, text, publish_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, ($8::timestamp AT TIME ZONE $9))`,
          [tenantId, agent.departmentId, action.id, current?.id ?? null, String(x.botId), String(x.channel), String(x.text).slice(0, 4096), String(x.publishAt).replace('T', ' '), dept?.timezone || 'UTC'],
        );
      }
      action.payload = { ...p, result: { ok: true, scheduled: posts.length } };
      await this.addEvent({ tenantId, departmentId: agent.departmentId, taskId: current?.id ?? null, agentId: agent.id, kind: 'tool', tool: 'content_plan', text: ot(lang, 'plan_scheduled', { n: posts.length }) });
      return;
    }

    if (action.actionType === 'publish_telegram_post') {
      const chk = await this.telegramChannelCheck(tenantId, String(p.botId ?? ''), String(p.channel ?? ''));
      if (typeof chk === 'string') throw new Error(`publish_telegram_post: ${chk}`);
      const r = await axios.post(`https://api.telegram.org/bot${chk.token}/sendMessage`, { chat_id: chk.chatId, text: String(p.text ?? '').slice(0, 4096) }, { timeout: 20_000 });
      const msgId = r.data?.result?.message_id;
      const ch = String(p.channel ?? '');
      action.payload = { ...p, result: { ok: true, messageId: msgId, url: ch.startsWith('@') && msgId ? `https://t.me/${ch.slice(1)}/${msgId}` : null } };
      await this.addEvent({ tenantId, departmentId: agent.departmentId, taskId: current?.id ?? null, agentId: agent.id, kind: 'tool', tool: 'publish_telegram_post', text: ot(lang, 'tg_posted', { channel: chk.title }) });
      return;
    }

    if (action.actionType === 'send_booking_message' || action.actionType === 'booking_update') {
      const kind: BookingKind = p.kind === 'hotel' ? 'hotel' : 'booking';
      const id = String(p.reservationId ?? p.id ?? '');
      const b = await bookingContact(this.depts, tenantId, kind, id);
      if (!b) throw new Error(`${action.actionType}: booking not found`);
      if (action.actionType === 'send_booking_message') {
        if (!b.email) throw new Error('send_booking_message: the guest has no email');
        const { EmailService } = await import('../email/email.service.js');
        const email = this.moduleRef.get(EmailService, { strict: false });
        const accounts = (await email.findAllAccounts(tenantId, undefined, 'owner')) as any[];
        const accountId = accounts.find((x) => x.status !== 'error')?.id ?? accounts[0]?.id;
        if (!accountId) throw new Error('send_booking_message: no mailbox connected');
        let subject = String(p.subject || action.title);
        let bodyText = String(p.text ?? '').trim();
        const tpl = p.template ? await this.receptionTemplate(tenantId, String(p.template)) : null;
        if (tpl) {
          // письмо собирается из шаблона «Шаблоны писем» (его правит владелец); данные — из брони
          const dept = await this.depts.findOne({ where: { id: agent.departmentId } });
          const vars = await bookingVars(this.depts, tenantId, kind, b.id, dept?.timezone || 'UTC');
          if (!vars) throw new Error('send_booking_message: booking not found');
          const all = { ...vars, review_link: String(p.vars?.review_link ?? '') };
          subject = fillTemplate(tpl.subject, all);
          bodyText = fillTemplate(tpl.text, all);
        }
        await email.sendStyledTransactionalMail(tenantId, { accountId, to: [b.email], subject, bodyText, leadId: b.leadId ?? undefined } as any);
        action.payload = { ...p, sentSubject: subject, sentText: bodyText };
        if (kind === 'booking') {
          const { ReservationsService } = await import('../bookings/reservations.service.js');
          await this.moduleRef.get(ReservationsService, { strict: false }).addNote(tenantId, b.id, `ИИ-отдел: письмо гостю — «${subject.slice(0, 120)}»`).catch(() => undefined);
        }
        action.payload = { ...(action.payload as any), result: { ok: true, sent: 1, total: 1 } };
        await this.addEvent({ tenantId, departmentId: agent.departmentId, taskId: current?.id ?? null, agentId: agent.id, kind: 'tool', tool: 'send_booking_message', text: ot(lang, 'bk_mailed', { guest: b.name || b.email }) });
        return;
      }
      const act = String(p.action);
      if (kind === 'booking') {
        const { ReservationsService } = await import('../bookings/reservations.service.js');
        const rs = this.moduleRef.get(ReservationsService, { strict: false });
        if (act === 'confirm') await rs.confirm(tenantId, b.id, null);
        else if (act === 'cancel') await rs.cancelByBusiness(tenantId, b.id, null);
        else if (act === 'no_show') await rs.markNoShow(tenantId, b.id, null);
        else if (act === 'complete') await rs.complete(tenantId, b.id, null);
        else throw new Error('booking_update: unknown action');
      } else {
        if (!['confirm', 'cancel'].includes(act)) throw new Error('booking_update: hotel bookings support only confirm | cancel');
        const { HotelReservationsService } = await import('../hotels/hotel-reservations.service.js');
        await this.moduleRef.get(HotelReservationsService, { strict: false }).update(tenantId, b.id, { status: act === 'confirm' ? 'confirmed' : 'cancelled' } as any, null);
      }
      action.payload = { ...p, result: { ok: true, from: b.status, action: act } };
      await this.addEvent({ tenantId, departmentId: agent.departmentId, taskId: current?.id ?? null, agentId: agent.id, kind: 'tool', tool: 'booking_update', text: ot(lang, 'bk_updated', { guest: b.name || '—', action: act }) });
      return;
    }

    if (action.actionType === 'stock_purchase_order') {
      const to = String(p.supplierEmail ?? '').trim();
      if (!to || !(await knownSupplierEmail(this.depts, tenantId, to))) throw new Error('stock_purchase_order: unknown supplier email — add the supplier to the Brain or CRM contacts');
      const want = (Array.isArray(p.items) ? p.items : [])
        .map((x: any) => ({ productId: String(x?.productId ?? ''), quantity: Math.round(Number(x?.quantity) || 0) }))
        .filter((x: { productId: string; quantity: number }) => x.productId && x.quantity > 0);
      if (!want.length) throw new Error('stock_purchase_order: items with quantity > 0 are required');
      const prods: Array<{ id: string; name: string; sku: string | null; unit: string | null }> = await this.depts.query(
        `SELECT id, name, sku, unit FROM products WHERE "tenantId" = $1 AND id::text = ANY($2)`,
        [tenantId, want.map((x: { productId: string }) => x.productId)],
      );
      const byId = new Map(prods.map((x) => [x.id, x]));
      const text = String(p.text ?? '').trim();
      const low = text.toLowerCase();
      const known = want.filter((x: { productId: string }) => byId.has(x.productId));
      // позиции, которые модель уже перечислила в письме, второй раз не дописываем
      const lines = known
        .filter((x: { productId: string }) => !low.includes(byId.get(x.productId)!.name.toLowerCase()))
        .map((x: { productId: string; quantity: number }) => {
          const pr = byId.get(x.productId)!;
          return `• ${pr.name}${pr.sku ? ` (SKU ${pr.sku})` : ''} — ${x.quantity}${pr.unit ? ` ${pr.unit}` : ''}`;
        });
      if (!known.length) throw new Error('stock_purchase_order: products not found');
      const body = `${text}${lines.length ? `\n\n${lines.join('\n')}` : ''}`.trim();
      const { EmailService } = await import('../email/email.service.js');
      const email = this.moduleRef.get(EmailService, { strict: false });
      const accounts = (await email.findAllAccounts(tenantId, undefined, 'owner')) as any[];
      const accountId = accounts.find((x) => x.status !== 'error')?.id ?? accounts[0]?.id;
      if (!accountId) throw new Error('stock_purchase_order: no mailbox connected');
      await email.sendStyledTransactionalMail(tenantId, { accountId, to: [to], subject: String(p.subject || action.title), bodyText: body } as any);
      action.payload = { ...p, result: { ok: true, sent: 1, total: 1, lines: known.length } };
      await this.addEvent({ tenantId, departmentId: agent.departmentId, taskId: current?.id ?? null, agentId: agent.id, kind: 'tool', tool: 'stock_purchase_order', text: ot(lang, 'po_sent', { supplier: String(p.supplierName || to), n: known.length }) });
      return;
    }

    if (action.actionType === 'ads_campaign_control') {
      // выключатель владельца проверяем и при исполнении: одобрение старого предложения тоже ничего не меняет
      const deptRow = await this.depts.findOne({ where: { tenantId, id: agent.departmentId } });
      if (!AiOfficeService.normSafety(deptRow?.safety).allowAdChanges) {
        throw new Error('Изменения рекламы выключены: включите «Разрешить ИИ-отделам менять рекламу» в настройках отдела → Защита');
      }
      const act = ['pause', 'enable', 'set_daily_budget'].includes(String(p.action)) ? (String(p.action) as 'pause' | 'enable' | 'set_daily_budget') : null;
      if (!act) throw new Error('ads_campaign_control: action must be pause | enable | set_daily_budget');
      const { MarketingService } = await import('../marketing/marketing.service.js');
      const mk = this.moduleRef.get(MarketingService, { strict: false });
      const r = await mk.adsCampaignControl(tenantId, { platform: String(p.platform ?? ''), account: p.account ? String(p.account) : null, campaign: String(p.campaign ?? ''), action: act, dailyBudget: p.dailyBudget != null ? Number(p.dailyBudget) : null });
      action.payload = { ...p, result: r };
      const what =
        act === 'set_daily_budget'
          ? ot(lang, 'ads_budget_changed', { campaign: r.campaign, from: r.before.dailyBudget ?? '—', to: r.after.dailyBudget ?? '—', cur: String(p.currency ?? '') })
          : ot(lang, act === 'pause' ? 'ads_paused' : 'ads_enabled', { campaign: r.campaign });
      await this.addEvent({ tenantId, departmentId: agent.departmentId, taskId: current?.id ?? null, agentId: agent.id, kind: 'tool', tool: 'ads_campaign_control', text: what });
      return;
    }

    if (action.actionType === 'create_quote') {
      const leadId = String(p.leadId ?? (action.targetType === 'lead' ? action.targetId : '') ?? '');
      if (!leadId) throw new Error('create_quote: leadId is required');
      const lead: Array<{ id: string; name: string; email: string | null; phone: string | null; contactId: string | null }> = await this.depts.query(
        `SELECT id, name, email, phone, "contactId" FROM leads WHERE id::text = $1 AND "tenantId" = $2`,
        [leadId, tenantId],
      );
      if (!lead[0]) throw new Error('create_quote: lead not found');
      let contactId = lead[0].contactId;
      if (!contactId) {
        // КП выписывается на контакт — у лида его нет, заводим из данных лида и связываем
        const c: Array<{ id: string }> = await this.depts.query(
          `INSERT INTO contacts ("tenantId", "fullName", email, phone) VALUES ($1, $2, $3, $4) RETURNING id`,
          [tenantId, lead[0].name, lead[0].email, lead[0].phone],
        );
        contactId = c[0].id;
        await this.depts.query(`UPDATE leads SET "contactId" = $1 WHERE id = $2`, [contactId, lead[0].id]);
      }
      const items = (Array.isArray(p.items) ? p.items : [])
        .map((x: any) => ({ kind: x?.kind === 'service' ? 'service' : 'product', refId: String(x?.refId ?? ''), quantity: Number(x?.quantity) || 1, discountPercent: Number(x?.discountPercent) || 0 }))
        .filter((x: any) => x.refId);
      if (!items.length) throw new Error('create_quote: items are required (from the catalog)');
      const { EsignService } = await import('../esign/esign.service.js');
      const esign = this.moduleRef.get(EsignService, { strict: false });
      const dept = await this.depts.findOne({ where: { id: agent.departmentId } });
      const owner: Array<{ id: string }> = await this.depts.query(`SELECT id FROM users WHERE "tenantId" = $1 AND role = 'owner' ORDER BY "createdAt" LIMIT 1`, [tenantId]);
      const doc: any = await esign.issueDocument(tenantId, dept?.createdBy ?? owner[0]?.id ?? '', {
        templateId: String(p.templateId ?? ''),
        contactId,
        leadId: lead[0].id,
        items: items as any,
        extraFields: {
          ...(p.discountPercent ? { DISCOUNT_PERCENT: String(p.discountPercent) } : {}),
          ...(p.validUntil ? { VALID_UNTIL: String(p.validUntil) } : {}),
        },
      });
      await esign.sendOrRemind(tenantId, doc.id);
      action.payload = { ...p, result: { ok: true, documentId: doc.id, url: `/esign?doc=${doc.id}` } };
      await this.addEvent({ tenantId, departmentId: agent.departmentId, taskId: current?.id ?? null, agentId: agent.id, kind: 'tool', tool: 'create_quote', text: ot(lang, 'quote_sent', { title: doc.title ?? action.title }) });
      return;
    }

    if (action.actionType === 'brain_write') {
      const title = this.cleanText(p.title, 200) || 'Note';
      const content = String(p.contentMd ?? p.content ?? '').slice(0, 100_000);
      if (!content.trim()) throw new Error('brain_write: contentMd is empty');
      await this.brain.appendToDoc(tenantId, agent.departmentId, /\.md$/i.test(title) ? title : `${title}.md`, content, agent.id);
      await this.addEvent({ tenantId, departmentId: agent.departmentId, taskId: current?.id ?? null, agentId: agent.id, kind: 'brain_write', tool: 'brain_write', text: ot(lang, 'brain_write', { title }) });
      return;
    }

    // коннекторы Notion / Canva / GitHub
    await this.connectors.dispatch(tenantId, agent, action);
  }

  /** Человек решил по действию агента: двигаем задачу (ждёт → готово/отклонено). */
  async onActionDecided(tenantId: string, action: AiAgentAction, decision: 'executed' | 'rejected' | 'failed'): Promise<void> {
    // черновик ответа в заявке, одобренный человеком (возможно, с правками), — проверенный ответ для базы знаний
    if (decision === 'executed' && action.actionType === 'helpdesk_reply' && !(action.payload as any)?.systemAutoApproved) {
      await this.learnFromHumanReply(tenantId, String((action.payload as any)?.ticketId ?? ''), String((action.payload as any)?.text ?? ''));
    }
    const rows: AiOfficeTask[] = await this.tasks
      .createQueryBuilder('t')
      .where('t.tenant_id = :tenantId', { tenantId })
      .andWhere(':aid = ANY(t.pending_action_ids)', { aid: action.id })
      .getMany();
    const t = rows[0];
    if (!t) return;
    const lang = await this.langOf(tenantId, t.departmentId);
    t.pendingActionIds = t.pendingActionIds.filter((x) => x !== action.id);
    // итог модель писала ДО решения владельца — дописываем, что реально произошло (отправлено N из M)
    const res = (action.payload as any)?.result;
    const sentLine =
      decision === 'executed' && /^send_|^create_quote$/.test(action.actionType) && res && typeof res === 'object'
        ? ot(lang, 'sent_after_approval', { sent: Number(res.sent ?? (res.ok ? 1 : 0)), total: Number(res.total ?? res.sent ?? 1), failed: Number(res.failed ?? 0) > 0 ? ` · ${ot(lang, 'failed_n', { n: Number(res.failed) })}` : '' })
        : decision === 'rejected' && /^send_|^create_quote$/.test(action.actionType)
          ? ot(lang, 'not_sent_rejected')
          : decision === 'failed' && /^send_|^create_quote$/.test(action.actionType)
            ? ot(lang, 'not_sent_failed', { error: String((action.payload as any)?.execError ?? '').replace(/^Action execution failed:\s*/i, '').slice(0, 200) })
            : null;
    if (sentLine) {
      const waitMark = ot(lang, 'awaiting_send');
      const rest = (t.resultSummary ?? '').startsWith(waitMark) ? (t.resultSummary ?? '').slice(waitMark.length) : t.resultSummary ?? '';
      t.resultSummary = `${sentLine}\n\n${rest.trim()}`.trim();
    }
    t.artifacts = (t.artifacts || []).map((a) =>
      a.actionId === action.id
        ? { ...a, status: decision, error: decision === 'failed' ? (action.payload as any)?.execError ?? null : null, url: (action.payload as any)?.result?.url ?? null }
        : a,
    );
    await this.addEvent({
      tenantId,
      departmentId: t.departmentId,
      taskId: t.id,
      agentId: action.agentId,
      kind: decision === 'executed' ? 'approved' : decision === 'rejected' ? 'rejected' : 'failed',
      tool: action.actionType,
      text:
        decision === 'executed'
          ? `${ot(lang, 'approved', { title: action.title })}${sentLine ? ` — ${sentLine}` : ''}`
          : decision === 'rejected'
            ? ot(lang, 'rejected', { title: action.title })
            : ot(lang, 'action_failed', { title: action.title, error: String((action.payload as any)?.execError ?? '').slice(0, 160) }),
      level: decision === 'executed' ? 'ok' : 'warn',
    });
    if (t.pendingActionIds.length || this.revising.has(t.id)) {
      await this.tasks.save(t);
      return;
    }
    const statuses = (t.artifacts || []).map((a) => a.status);
    if (statuses.length && statuses.every((s) => s === 'rejected')) {
      t.status = 'rejected';
      t.finishedAt = new Date();
      await this.tasks.save(t);
      const dept = await this.depts.findOne({ where: { id: t.departmentId } });
      if (dept) await this.emitAutomation(tenantId, 'ai_office.task_rejected', this.automationPayload(t, dept));
      return;
    }
    await this.finalizeDone(t, t.resultSummary);
  }
}
