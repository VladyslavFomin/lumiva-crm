import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AiAgent } from '../ai-employees/ai-agent.entity';
import { AiDepartment } from './ai-department.entity';
import { Tenant } from '../tenants/tenant.entity';
import { isComponentAllowedByPlan } from '../tenants/plan-entitlements';
import { AiEmployeesService } from '../ai-employees/ai-employees.service';
import type { EmployeeBrainContext, EmployeeBrainHooks, EmployeeBrainWrite } from '../ai-employees/ai-employee-brain';
import { AiBrainService } from './ai-brain.service';
import { AiOfficeService } from './ai-office.service';

/** Сколько текста «Мозга» сотрудника идёт в промпт (символы). */
const OWNER_DOCS_BUDGET = 14_000;
const AI_NOTES_BUDGET = 6_000;
const SEARCH_BUDGET = 6_000;
const NOTES_FILE = 'Заметки ИИ.md';

export type EmployeeBrainSettings = {
  /** ИИ может дописывать в свой мозг (brain_write). */
  aiWrites: boolean;
  /** Отделы ИИ-офиса, чей «Мозг» сотрудник читает (общий с консультантами: settings.officeLink.brain). */
  departmentIds: string[];
  /** Общие файлы офиса (scope «все отделы»). */
  includeShared: boolean;
  /** Может записывать выводы в мозг подключённых/курируемых отделов. */
  writeToDepartments: boolean;
};

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cleanIds = (v: unknown, max = 50): string[] =>
  Array.isArray(v) ? [...new Set(v.map(String).filter((x) => uuidRe.test(x)))].slice(0, max) : [];

/**
 * «Мозг» ИИ-сотрудника: личная папка файлов + связка с «Мозгом» ИИ-офиса.
 * - Перед каждым действием сотрудник читает ВСЕ md-документы своей папки (то, что положили люди —
 *   целиком, его собственные заметки — свежие сверху), по теме — загруженные файлы и мозг отделов.
 * - brain_write: сотрудник дописывает выводы в свою папку или в мозг отдела, который курирует или к
 *   которому подключён (если владелец разрешил).
 * - Обратно: курируемый отдел читает файлы людей из папки куратора (AiBrainService.search).
 */
@Injectable()
export class AiEmployeeBrainService implements OnModuleInit, EmployeeBrainHooks {
  private readonly log = new Logger(AiEmployeeBrainService.name);

  constructor(
    @InjectRepository(AiAgent) private readonly agents: Repository<AiAgent>,
    @InjectRepository(AiDepartment) private readonly depts: Repository<AiDepartment>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    private readonly brain: AiBrainService,
    private readonly office: AiOfficeService,
    private readonly employees: AiEmployeesService,
  ) {}

  onModuleInit(): void {
    this.employees.registerBrainHooks(this);
  }

  // ───────────────────────── настройки ─────────────────────────

  readSettings(agent: AiAgent): EmployeeBrainSettings {
    const s = (agent.settings || {}) as Record<string, any>;
    const b = (s.brain || {}) as Record<string, any>;
    const link = (s.officeLink?.brain || {}) as Record<string, any>;
    return {
      aiWrites: b.aiWrites !== false,
      departmentIds: cleanIds(link.departmentIds),
      includeShared: link.includeShared === true,
      writeToDepartments: b.writeToDepartments !== false,
    };
  }

  async officeAvailable(tenantId: string): Promise<boolean> {
    const t = await this.tenants.findOne({ where: { id: tenantId }, select: ['id', 'plan', 'enabledComponents'] as any });
    return !!t && isComponentAllowedByPlan('ai_office', t.plan) && (t.enabledComponents as any)?.ai_office !== false;
  }

  /** Отделы, связанные с сотрудником: курирует (curated) или подключён к их мозгу (linked). */
  private async linkedDepartments(tenantId: string, agent: AiAgent, cfg: EmployeeBrainSettings) {
    if (!(await this.officeAvailable(tenantId))) return [] as Array<{ id: string; name: string; curated: boolean; linked: boolean }>;
    const rows = await this.depts.find({ where: { tenantId }, select: ['id', 'name', 'curatorAgentId'] as any, order: { sort: 'ASC' } as any });
    return rows
      .map((d: any) => ({ id: d.id as string, name: d.name as string, curated: d.curatorAgentId === agent.id, linked: cfg.departmentIds.includes(d.id) }))
      .filter((d) => d.curated || d.linked);
  }

  private async agentOr404(tenantId: string, agentId: string): Promise<AiAgent> {
    if (!uuidRe.test(agentId)) throw new NotFoundException('AI employee not found');
    const a = await this.agents.findOne({ where: { tenantId, id: agentId } });
    if (!a) throw new NotFoundException('AI employee not found');
    if (a.departmentId) throw new BadRequestException('Агент отдела работает с «Мозгом» своего отдела в ИИ-офисе');
    return a;
  }

  // ───────────────────────── API профиля ─────────────────────────

  async overview(tenantId: string, agentId: string) {
    const agent = await this.agentOr404(tenantId, agentId);
    const settings = this.readSettings(agent);
    const officeOn = await this.officeAvailable(tenantId);
    const departments = officeOn
      ? (await this.depts.find({ where: { tenantId }, select: ['id', 'name', 'color', 'curatorAgentId'] as any, order: { sort: 'ASC' } as any })).map((d: any) => ({
          id: d.id,
          name: d.name,
          color: d.color ?? null,
          curated: d.curatorAgentId === agent.id,
          linked: settings.departmentIds.includes(d.id),
        }))
      : [];
    return { files: await this.brain.listForAgent(tenantId, agent.id), settings, officeAvailable: officeOn, departments };
  }

  async getFile(tenantId: string, agentId: string, id: string) {
    await this.agentOr404(tenantId, agentId);
    const f = await this.brain.rawAgentFile(tenantId, agentId, id);
    return this.brain.get(tenantId, f.id);
  }

  async rawFile(tenantId: string, agentId: string, id: string) {
    await this.agentOr404(tenantId, agentId);
    return this.brain.rawAgentFile(tenantId, agentId, id);
  }

  async createDoc(tenantId: string, agentId: string, userId: string | null, body: { name?: string; bodyMd?: string }) {
    const agent = await this.agentOr404(tenantId, agentId);
    return this.brain.createDoc(tenantId, { name: body?.name, bodyMd: body?.bodyMd, userId, ownerAgentId: agent.id, source: 'editor' });
  }

  async upload(tenantId: string, agentId: string, userId: string | null, file: { buffer: Buffer; originalname: string; mimetype: string; size: number }) {
    const agent = await this.agentOr404(tenantId, agentId);
    return this.brain.upload(tenantId, userId, file, null, undefined, agent.id);
  }

  async update(tenantId: string, agentId: string, id: string, body: { name?: string; bodyMd?: string }) {
    await this.agentOr404(tenantId, agentId);
    await this.brain.rawAgentFile(tenantId, agentId, id);
    return this.brain.update(tenantId, id, { name: body?.name, bodyMd: body?.bodyMd });
  }

  async remove(tenantId: string, agentId: string, id: string) {
    await this.agentOr404(tenantId, agentId);
    await this.brain.rawAgentFile(tenantId, agentId, id);
    return this.brain.remove(tenantId, id);
  }

  async saveSettings(tenantId: string, agentId: string, body: Partial<EmployeeBrainSettings>) {
    const agent = await this.agentOr404(tenantId, agentId);
    const cur = this.readSettings(agent);
    let departmentIds = body.departmentIds !== undefined ? cleanIds(body.departmentIds) : cur.departmentIds;
    if (departmentIds.length) {
      const own = await this.depts.find({ where: { tenantId, id: In(departmentIds) }, select: ['id'] });
      const ok = new Set(own.map((d) => d.id));
      departmentIds = departmentIds.filter((id) => ok.has(id));
    }
    const next = {
      aiWrites: body.aiWrites !== undefined ? !!body.aiWrites : cur.aiWrites,
      writeToDepartments: body.writeToDepartments !== undefined ? !!body.writeToDepartments : cur.writeToDepartments,
    };
    const linkBrain = {
      departmentIds,
      includeShared: body.includeShared !== undefined ? !!body.includeShared : cur.includeShared,
    };
    // officeLink.brain — общая настройка с консультантами (они отвечают клиентам по тем же отделам)
    await this.agents.manager.query(
      `UPDATE ai_agents
          SET settings = jsonb_set(
                COALESCE(settings, '{}'::jsonb) || jsonb_build_object('brain', COALESCE(settings->'brain', '{}'::jsonb) || $2::jsonb),
                '{officeLink}',
                COALESCE(settings->'officeLink', '{}'::jsonb) || jsonb_build_object('brain', $3::jsonb))
        WHERE id = $1`,
      [agent.id, JSON.stringify(next), JSON.stringify(linkBrain)],
    );
    return this.overview(tenantId, agentId);
  }

  /** Что сотрудник прочитает перед действием по этой теме — для кнопки «Проверить» в профиле. */
  async preview(tenantId: string, agentId: string, query: string) {
    const agent = await this.agentOr404(tenantId, agentId);
    const ctx = await this.contextFor(tenantId, agent, query, { dryRun: true });
    return { block: ctx.block, fileIds: ctx.fileIds, writeTargets: ctx.writeTargets, canWrite: ctx.canWrite };
  }

  // ───────────────────────── хуки движка ─────────────────────────

  async contextFor(
    tenantId: string,
    agent: AiAgent,
    query: string,
    opts?: { clientFacing?: boolean; dryRun?: boolean },
  ): Promise<EmployeeBrainContext> {
    const empty: EmployeeBrainContext = { block: '', fileIds: [], writeTargets: [], canWrite: false };
    if (agent.departmentId) return empty; // у агентов отделов — мозг отдела (движок офиса)
    const cfg = this.readSettings(agent);
    const clientFacing = !!opts?.clientFacing;
    const fileIds: string[] = [];
    const parts: string[] = [];

    try {
      // 1) свои md-документы: файлы людей — целиком (это инструкции), заметки ИИ — свежие сверху
      const docs = await this.brain.agentDocs(tenantId, agent.id);
      const ownerDocs = docs.filter((d) => d.source !== 'agent');
      const aiNotes = clientFacing ? [] : docs.filter((d) => d.source === 'agent');
      let budget = OWNER_DOCS_BUDGET;
      const ownerParts: string[] = [];
      for (const d of ownerDocs) {
        const body = d.body.trim();
        if (!body) continue;
        const piece = `### ${d.name}\n${body.length > budget ? `${body.slice(0, Math.max(0, budget - 40))}\n…(обрезано)` : body}`;
        ownerParts.push(piece);
        fileIds.push(d.id);
        budget -= piece.length;
        if (budget <= 200) break;
      }
      let nb = AI_NOTES_BUDGET;
      const noteParts: string[] = [];
      for (const d of aiNotes) {
        const body = d.body.trim();
        if (!body) continue;
        // журнал растёт снизу — берём хвост (свежие записи)
        const piece = `### ${d.name}\n${body.length > nb ? `…${body.slice(-(nb - 40))}` : body}`;
        noteParts.push(piece);
        fileIds.push(d.id);
        nb -= piece.length;
        if (nb <= 200) break;
      }
      // 2) загруженные файлы (pdf, таблицы, docx) — по теме
      const q = query.trim();
      const uploadHits = q ? await this.brain.searchAgentFiles(tenantId, agent.id, q, 4) : [];
      let sb = SEARCH_BUDGET;
      const uploadParts: string[] = [];
      for (const h of uploadHits) {
        const piece = `— ${h.fileName}:\n${h.text.trim()}`;
        if (piece.length > sb) break;
        sb -= piece.length;
        uploadParts.push(piece);
        fileIds.push(h.fileId);
      }
      // 3) мозг ИИ-офиса: курируемые и подключённые отделы, общие файлы
      const linked = await this.linkedDepartments(tenantId, agent, cfg);
      const officeOn = linked.length > 0 || (cfg.includeShared && (await this.officeAvailable(tenantId)));
      const officeParts: string[] = [];
      if (officeOn && q) {
        const hits = await this.brain.searchForEmployee(tenantId, linked.map((d) => d.id), q, { includeShared: cfg.includeShared, clientFacing, k: 6 });
        const nameOf = new Map(linked.map((d) => [d.id, d.name]));
        for (const h of hits) {
          const where = h.folder ? nameOf.get(h.folder) ?? 'офис' : 'общие файлы офиса';
          const piece = `— [${where}] ${h.fileName}:\n${h.text.trim()}`;
          if (piece.length > sb) break;
          sb -= piece.length;
          officeParts.push(piece);
          fileIds.push(h.fileId);
        }
      }

      const writeTargets = cfg.writeToDepartments ? linked.map((d) => ({ id: d.id, name: d.name })) : [];
      const canWrite = cfg.aiWrites && !clientFacing;
      if (ownerParts.length) {
        parts.push(
          `YOUR BRAIN — INSTRUCTIONS FROM THE COMPANY (files the owner/team keep for you; read them before EVERY action and follow them — they never override safety rules, permissions or approval rules):\n${ownerParts.join('\n\n')}`,
        );
      }
      if (noteParts.length) {
        parts.push(
          `YOUR BRAIN — YOUR OWN NOTES (written by you earlier; use them, but fresh CRM data and the company's files above always win over an old note):\n${noteParts.join('\n\n')}`,
        );
      }
      if (uploadParts.length) parts.push(`YOUR BRAIN — FROM YOUR FILES (matching this run):\n${uploadParts.join('\n\n')}`);
      if (officeParts.length) parts.push(`AI OFFICE BRAIN (departments you curate or are connected to; matching this run):\n${officeParts.join('\n\n')}`);
      if (canWrite) {
        const targets = [`"own" (your brain)`, ...writeTargets.map((d) => `"${d.id}" (brain of department «${d.name}»)`)].join(', ');
        parts.push(
          `WRITING TO THE BRAIN: you may save reusable knowledge with the action brain_write: payload { title, contentMd, target: ${targets} }. Use it for things worth remembering next time — a working procedure, a confirmed fact about how this company works, a finding with numbers, a mistake to avoid. Do NOT store personal data of clients (phones, emails, documents), passwords or one-off details of a single record; do not repeat what is already written above. Without a target it goes to your own notes ("${NOTES_FILE}"). brain_write never needs approval and is the only action allowed in read-only (suggest) mode.`,
        );
      }
      if (fileIds.length && !opts?.dryRun) await this.brain.markRead(tenantId, [...new Set(fileIds)], agent.id).catch(() => undefined);
      return { block: parts.join('\n\n'), fileIds: [...new Set(fileIds)], writeTargets, canWrite };
    } catch (e) {
      this.log.warn(`employee brain context failed agent=${agent.id}: ${(e as Error).message}`);
      return empty;
    }
  }

  async write(tenantId: string, agent: AiAgent, payload: EmployeeBrainWrite): Promise<{ fileName: string; target: string }> {
    if (agent.departmentId) throw new Error('brain_write of department agents is handled by the AI office');
    const cfg = this.readSettings(agent);
    if (!cfg.aiWrites) throw new Error('The owner has not allowed this AI employee to write to its Brain');
    const content = String(payload?.contentMd ?? '').trim().slice(0, 20_000);
    if (!content) throw new Error('brain_write: contentMd is empty');
    let title = String(payload?.title ?? '').trim().slice(0, 200) || NOTES_FILE;
    if (!/\.md$/i.test(title)) title = `${title}.md`;
    const target = String(payload?.target ?? 'own').trim();
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const entry = `### ${stamp} · ${agent.name}\n${content}`;
    if (!target || target === 'own') {
      await this.brain.appendToDoc(tenantId, null, title, entry, agent.id, agent.id);
      return { fileName: title, target: 'own' };
    }
    const linked = await this.linkedDepartments(tenantId, agent, cfg);
    const dept = linked.find((d) => d.id === target);
    if (!dept || !cfg.writeToDepartments) {
      throw new Error('brain_write: this department is not connected to the employee (or writing to departments is off)');
    }
    await this.brain.appendToDoc(tenantId, dept.id, title, entry, agent.id);
    await this.office.addEvent({ tenantId, departmentId: dept.id, agentId: agent.id, kind: 'brain_write', tool: 'brain_write', text: `${agent.name} → «Мозг»: ${title}` });
    return { fileName: title, target: dept.id };
  }
}
