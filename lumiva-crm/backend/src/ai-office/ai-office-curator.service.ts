import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { AiDepartment } from './ai-department.entity';
import { AiOfficeTask } from './ai-office-task.entity';
import { AiAgent } from '../ai-employees/ai-agent.entity';
import { AiAgentAction } from '../ai-employees/ai-agent-action.entity';
import { AiEmployeesService } from '../ai-employees/ai-employees.service';
import { readAiAgentConfig } from '../ai-employees/ai-employee-triggers';
import { AiOfficeService } from './ai-office.service';
import { SENSITIVE_SEND_RE } from './ai-office-catalog';
import { ot } from './ai-office-i18n';

/** Сколько раз куратор может вернуть задачу на доработку, прежде чем передать её владельцу. */
const MAX_REVISIONS = 2;
const REVISION_MARK = 'CURATOR FEEDBACK';

type Verdict = { decision: 'approve' | 'revise' | 'escalate'; comment: string; ownerNote: string };

/**
 * Куратор отдела — ИИ-сотрудник, который руководит отделом: его инструкции становятся правилами
 * отдела, и он сам решает по действиям агентов (одобрить / вернуть на доработку / передать владельцу).
 * Владельцу остаются деньги и договоры, массовые рассылки и сомнения куратора.
 */
@Injectable()
export class AiOfficeCuratorService {
  private readonly log = new Logger(AiOfficeCuratorService.name);

  constructor(
    @InjectRepository(AiDepartment) private readonly depts: Repository<AiDepartment>,
    @InjectRepository(AiOfficeTask) private readonly tasks: Repository<AiOfficeTask>,
    @InjectRepository(AiAgent) private readonly agents: Repository<AiAgent>,
    @InjectRepository(AiAgentAction) private readonly actions: Repository<AiAgentAction>,
    private readonly office: AiOfficeService,
    private readonly aiEmployees: AiEmployeesService,
  ) {}

  async curatorOf(dept: AiDepartment): Promise<AiAgent | null> {
    if (!dept.curatorAgentId) return null;
    return this.agents.findOne({ where: { tenantId: dept.tenantId, id: dept.curatorAgentId, departmentId: IsNull(), status: 'active' } });
  }

  /** Только владелец: деньги/условия, массовые рассылки. */
  private ownerOnly(a: AiAgentAction): boolean {
    if (a.actionType === 'send_bulk_email' || a.actionType === 'create_quote' || a.actionType === 'ads_campaign_control' || a.actionType === 'send_payment_link' || a.actionType === 'stock_purchase_order' || a.actionType === 'publish_telegram_post' || a.actionType === 'content_plan' || a.actionType === 'sale_confirm_payment') return true;
    if (/^send_/.test(a.actionType) && SENSITIVE_SEND_RE.test(`${a.title} ${JSON.stringify(a.payload ?? {})}`)) return true;
    return false;
  }

  /**
   * Задача ждёт решения: куратор смотрит каждое действие. Возвращает true, если после проверки
   * у задачи не осталось ничего для владельца.
   */
  async review(dept: AiDepartment, taskId: string): Promise<void> {
    const curator = await this.curatorOf(dept);
    if (!curator) return;
    const task = await this.tasks.findOne({ where: { id: taskId } });
    if (!task || task.status !== 'waiting' || !task.pendingActionIds.length) return;
    const lang = await this.office.langOf(dept.tenantId, dept.id);
    const acts = await this.actions.find({ where: { tenantId: dept.tenantId, id: In(task.pendingActionIds), status: 'pending' } });
    const lead = (await this.agents.findOne({ where: { tenantId: dept.tenantId, departmentId: dept.id, isLead: true } })) ?? (await this.agents.findOne({ where: { tenantId: dept.tenantId, departmentId: dept.id } }));
    if (!lead) return;
    const rounds = (task.details ?? '').split(REVISION_MARK).length - 1;
    const revise: string[] = [];

    for (const a of acts) {
      if (this.ownerOnly(a)) {
        await this.office.addEvent({ tenantId: dept.tenantId, departmentId: dept.id, taskId, agentId: a.agentId, kind: 'curator', text: ot(lang, 'curator_owner_only', { curator: curator.name, title: a.title }), level: 'warn' });
        continue;
      }
      const v = await this.verdict(dept, curator, lead, task, a, lang);
      if (!v) continue; // модель не ответила — остаётся владельцу
      if (v.decision === 'approve') {
        a.payload = { ...(a.payload || {}), approvedByCurator: curator.name, curatorComment: v.comment };
        await this.actions.save(a);
        await this.office.addEvent({ tenantId: dept.tenantId, departmentId: dept.id, taskId, agentId: a.agentId, kind: 'curator', text: ot(lang, 'curator_approved', { curator: curator.name, title: a.title, comment: v.comment ? ` — ${v.comment}` : '' }), level: 'ok' });
        await this.aiEmployees.approveAction(dept.tenantId, a.id, null).catch(async (e) => {
          this.log.warn(`curator approve ${a.id}: ${(e as Error).message}`);
        });
      } else if (v.decision === 'revise' && rounds < MAX_REVISIONS) {
        revise.push(`${a.title}: ${v.comment}`);
        this.office.revising.add(taskId);
        a.payload = { ...(a.payload || {}), rejectedByCurator: curator.name };
        await this.actions.save(a);
        await this.office.addEvent({ tenantId: dept.tenantId, departmentId: dept.id, taskId, agentId: a.agentId, kind: 'curator', text: ot(lang, 'curator_revise', { curator: curator.name, title: a.title, comment: v.comment }), level: 'warn' });
        await this.aiEmployees.rejectAction(dept.tenantId, a.id, null, { reason: `${curator.name}: ${v.comment}` }).catch(() => undefined);
      } else {
        // сомнение куратора (или кончились круги доработки) — владельцу, с пометкой, на что смотреть
        const note = v.ownerNote || v.comment;
        a.payload = { ...(a.payload || {}), curatorNote: note };
        await this.actions.save(a);
        await this.office.addEvent({ tenantId: dept.tenantId, departmentId: dept.id, taskId, agentId: a.agentId, kind: 'curator', text: ot(lang, 'curator_escalated', { curator: curator.name, title: a.title, note }), level: 'warn' });
      }
    }

    // доработка: задача возвращается агенту с замечаниями куратора
    if (revise.length) {
      const fresh = await this.tasks.findOne({ where: { id: taskId } });
      if (fresh && !fresh.pendingActionIds.length) {
        fresh.details = `${fresh.details ?? ''}\n\n${REVISION_MARK} (${curator.name}, round ${rounds + 1}) — redo the work taking this into account:\n${revise.map((r) => `- ${r}`).join('\n')}`.trim().slice(0, 8000);
        Object.assign(fresh, { status: 'backlog', step: 'queued', progress: 0, finishedAt: null, resultSummary: null, resultReport: null });
        await this.tasks.save(fresh);
        this.office.onTaskQueued?.();
      }
      this.office.revising.delete(taskId);
    }
  }

  private async verdict(dept: AiDepartment, curator: AiAgent, lead: AiAgent, task: AiOfficeTask, a: AiAgentAction, lang: string): Promise<Verdict | null> {
    const cfg = readAiAgentConfig(curator.settings);
    const p = (a.payload || {}) as Record<string, any>;
    const leadId = String(p.leadId ?? (a.targetType === 'lead' ? a.targetId : '') ?? '');
    let record = '';
    if (leadId) {
      const r: any[] = await this.tasks.query(`SELECT name, email, phone, status, source, "createdAt" FROM leads WHERE id::text = $1 AND "tenantId" = $2`, [leadId, dept.tenantId]).catch(() => []);
      const prev: Array<{ n: string }> = await this.tasks
        .query(`SELECT count(*) n FROM ai_agent_actions WHERE tenant_id = $1 AND action_type LIKE 'send\\_%' AND status = 'executed' AND (payload->>'leadId' = $2 OR (target_type = 'lead' AND target_id::text = $2))`, [dept.tenantId, leadId])
        .catch(() => [{ n: '0' }]);
      if (r[0]) record = `CLIENT (CRM record): ${JSON.stringify(r[0])}; messages already sent to this client by AI: ${prev[0]?.n ?? 0}`;
    }
    const langName = lang === 'ru' ? 'Russian' : lang === 'tr' ? 'Turkish' : 'English';
    const system = `You are ${curator.name}, the curator (manager) of the AI department "${dept.name}". Your agents prepared an action; you decide instead of the owner.
Department goal: ${dept.mission || '-'}
${dept.systemPrompt?.trim() ? `Department instructions: ${dept.systemPrompt.trim()}\n` : ''}${cfg.instructions ? `Your own standing instructions (from the owner): ${cfg.instructions}\n` : ''}Your role in the company: ${curator.role}${curator.jobTitle ? ` (${curator.jobTitle})` : ''}
Decide:
- "approve" — correct, useful, polite, in the client's language, no invented facts/prices/promises, not a duplicate, fits the task.
- "revise" — fixable problems (tone, missing answer to the client's question, wrong language, too long, generic, invented details): say exactly what to change.
- "escalate" — the owner must decide: complaints/conflict, legal or money questions, anything risky or you are unsure about.
Return strict JSON: {"decision":"approve|revise|escalate","comment":"<one short sentence in ${langName}>","ownerNote":"<for escalate: what the owner should check, in ${langName}>"}`;
    const prompt = `TASK: ${task.title}
${task.details ? `DETAILS:\n${task.details.slice(0, 3000)}\n` : ''}${record ? `${record}\n` : ''}
ACTION BY AGENT: ${a.actionType} — ${a.title}
${a.reason ? `Agent's reason: ${a.reason}\n` : ''}PAYLOAD:
${JSON.stringify(p, null, 1).slice(0, 6000)}`;
    try {
      const r = await this.aiEmployees.completeForAgent(dept.tenantId, lead, system, prompt, { departmentId: dept.id, taskId: task.id }, { json: true });
      await this.tasks.increment({ id: task.id }, 'costCents', Number((r as any).costCents) || 0);
      const parsed = JSON.parse(String(r.text).replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim()) as Partial<Verdict>;
      const decision = parsed.decision === 'approve' || parsed.decision === 'revise' || parsed.decision === 'escalate' ? parsed.decision : null;
      if (!decision) return null;
      return { decision, comment: String(parsed.comment ?? '').slice(0, 400), ownerNote: String(parsed.ownerNote ?? '').slice(0, 600) };
    } catch (e) {
      this.log.warn(`curator verdict task=${task.id}: ${(e as Error).message}`);
      return null;
    }
  }

}
