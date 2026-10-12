import { Body, Controller, Get, Injectable, Logger, Param, Post, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { In, Repository } from 'typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Response } from 'express';
import { AiDepartment } from './ai-department.entity';
import { AiOfficeTask } from './ai-office-task.entity';
import { AiAgent } from '../ai-employees/ai-agent.entity';
import { AiAgentAction } from '../ai-employees/ai-agent-action.entity';
import { MailService } from '../mail/mail.service';
import { escapeMailHtml, renderMailShell } from '../mail/mail-template.util';
import { AiOfficeService } from './ai-office.service';
import { normalizeMatrix } from './ai-office-catalog';
import { ot } from './ai-office-i18n';
import { normPrograms } from './ai-office-programs';

const TOKEN_TTL_H = 72;
const TRUST_STREAK = 10;
const front = () => (process.env.FRONTEND_URL || 'https://crm.lumiva.agency').replace(/\/$/, '');

/**
 * Больше самостоятельности, меньше ручных одобрений:
 * — сводное письмо владельцу «ждут вашего решения» с кнопками (страница решения по подписанной ссылке);
 * — «доверие по истории»: N одобренных подряд без правок → предложение разрешить отделу отправлять самому.
 */
@Injectable()
export class AiOfficeAutonomyService {
  private readonly log = new Logger(AiOfficeAutonomyService.name);
  private ticking = false;

  constructor(
    @InjectRepository(AiDepartment) private readonly depts: Repository<AiDepartment>,
    @InjectRepository(AiOfficeTask) private readonly tasks: Repository<AiOfficeTask>,
    @InjectRepository(AiAgent) private readonly agents: Repository<AiAgent>,
    @InjectRepository(AiAgentAction) private readonly actions: Repository<AiAgentAction>,
    private readonly office: AiOfficeService,
    private readonly mail: MailService,
  ) {}

  // ───────────────────────── подписанные ссылки ─────────────────────────

  private secret() {
    return process.env.AI_OFFICE_DECIDE_SECRET || process.env.JWT_SECRET || 'lumiva-ai-office';
  }

  token(taskId: string): string {
    const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_H * 3600;
    const body = `${taskId}.${exp}`;
    const sig = createHmac('sha256', this.secret()).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  verify(token: string): string | null {
    const [taskId, exp, sig] = String(token || '').split('.');
    if (!taskId || !exp || !sig || !/^[0-9a-f-]{36}$/i.test(taskId)) return null;
    if (Number(exp) * 1000 < Date.now()) return null;
    const want = createHmac('sha256', this.secret()).update(`${taskId}.${exp}`).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(want);
    return a.length === b.length && timingSafeEqual(a, b) ? taskId : null;
  }

  // ───────────────────────── фоновая работа ─────────────────────────

  @Cron('*/5 * * * *')
  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      await this.mailApprovals().catch((e) => this.log.warn(`approval mail: ${(e as Error).message}`));
      await this.trustLadder().catch((e) => this.log.warn(`trust ladder: ${(e as Error).message}`));
    } finally {
      this.ticking = false;
    }
  }

  /** Одно письмо на компанию со всеми задачами, которые ждут решения (не чаще раза в 5 минут). */
  async mailApprovals(): Promise<void> {
    const waiting = await this.tasks
      .createQueryBuilder('t')
      .where(`t.status = 'waiting'`)
      .andWhere('t.approval_mailed_at IS NULL')
      .andWhere(`t.updated_at < now() - interval '2 minutes'`)
      .orderBy('t.created_at', 'ASC')
      .limit(500)
      .getMany();
    const byTenant = new Map<string, AiOfficeTask[]>();
    for (const t of waiting) byTenant.set(t.tenantId, [...(byTenant.get(t.tenantId) ?? []), t]);
    for (const [tenantId, list] of byTenant) {
      const owners: Array<{ email: string }> = await this.tasks.query(
        `SELECT email FROM users WHERE "tenantId" = $1 AND role IN ('owner','admin') AND status = 'active' AND email IS NOT NULL`,
        [tenantId],
      );
      const ids = list.map((t) => t.id);
      // помечаем сразу — даже если владельцев нет, чтобы не перебирать эти задачи каждые 5 минут
      await this.tasks.update({ id: In(ids) }, { approvalMailedAt: new Date() } as any);
      if (!owners.length) continue;
      const lang = await this.office.langOf(tenantId);
      const depts = await this.depts.find({ where: { tenantId, id: In([...new Set(list.map((t) => t.departmentId))]) }, select: ['id', 'name'] });
      const actionIds = list.flatMap((t) => t.pendingActionIds);
      const acts = actionIds.length ? await this.actions.find({ where: { tenantId, id: In(actionIds) } }) : [];
      const blocks = list.slice(0, 20).map((t) => {
        const dept = depts.find((d) => d.id === t.departmentId)?.name ?? '';
        const items = acts
          .filter((a) => t.pendingActionIds.includes(a.id))
          .map((a) => {
            const p = (a.payload || {}) as Record<string, any>;
            const to = Array.isArray(p.to) ? p.to.join(', ') : p.to ? String(p.to) : '';
            const text = String(p.textBody ?? p.bodyText ?? p.text ?? p.description ?? '').slice(0, 280);
            const note = p.curatorNote ? `<br><span style="color:#8a5d0f">⚑ ${escapeMailHtml(String(p.curatorNote))}</span>` : '';
            return `<li style="margin:0 0 6px"><b>${escapeMailHtml(a.title)}</b>${to ? ` → ${escapeMailHtml(to)}` : ''}${note}${text ? `<br><span style="color:#64748b">${escapeMailHtml(text)}${text.length >= 280 ? '…' : ''}</span>` : ''}</li>`;
          })
          .join('');
        const link = `${front()}/v1/ai-office/decide/${this.token(t.id)}`;
        return `<div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin:0 0 12px">
<div style="font-size:12px;color:#64748b;margin-bottom:4px">${escapeMailHtml(dept)}</div>
<div style="font-weight:600;margin-bottom:8px">${escapeMailHtml(t.title)}</div>
<ul style="margin:0 0 10px;padding-left:18px">${items}</ul>
<a href="${link}" style="display:inline-block;padding:9px 18px;background:#111827;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">${escapeMailHtml(ot(lang, 'mail_decide_btn'))}</a>
</div>`;
      });
      const more = list.length > 20 ? `<p>${escapeMailHtml(ot(lang, 'mail_more', { n: list.length - 20 }))}</p>` : '';
      const html = renderMailShell({
        headline: ot(lang, 'mail_title', { n: list.length }),
        bodyHtml: `<p>${escapeMailHtml(ot(lang, 'mail_intro'))}</p>${blocks.join('')}${more}`,
        cta: { label: ot(lang, 'mail_open_office'), href: `${front()}/ai-office` },
      });
      for (const o of owners) {
        await this.mail.sendMail({ to: o.email, subject: ot(lang, 'mail_subject', { n: list.length }), html }).catch((e) => this.log.warn(`mail ${o.email}: ${(e as Error).message}`));
      }
    }
  }

  /**
   * Утренняя сводка владельцу: одно письмо на компанию около 8:00 по времени отдела + колокольчик.
   * По каждому отделу — что сдано за сутки (главные итоги), что ждёт решения, проблемы, расход, план.
   * Пустые сутки — без письма. От имени куратора, если он назначен.
   */
  @Cron('*/10 * * * *')
  async morningDigest(): Promise<void> {
    const depts = await this.depts.find({ where: { status: 'active' } });
    const byTenant = new Map<string, AiDepartment[]>();
    for (const d of depts) if (normPrograms(d.programs, d.templateKey).digest.enabled) byTenant.set(d.tenantId, [...(byTenant.get(d.tenantId) ?? []), d]);
    for (const [tenantId, list] of byTenant) {
      const tz = list[0].timezone || 'UTC';
      let hour = 0;
      let today = '';
      try {
        hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: tz }).format(new Date()));
        today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
      } catch {
        hour = new Date().getUTCHours();
        today = new Date().toISOString().slice(0, 10);
      }
      if (hour < 8 || hour > 11) continue;
      const sent: Array<{ d: string | null }> = await this.tasks.query(`SELECT to_char(ai_office_digest_on, 'YYYY-MM-DD') d FROM tenants WHERE id = $1`, [tenantId]);
      if (sent[0]?.d === today) continue;
      await this.tasks.query(`UPDATE tenants SET ai_office_digest_on = $2 WHERE id = $1`, [tenantId, today]);
      await this.sendDigest(tenantId, list).catch((e) => this.log.warn(`digest ${tenantId}: ${(e as Error).message}`));
    }
  }

  async sendDigest(tenantId: string, list: AiDepartment[]): Promise<boolean> {
    const lang = await this.office.langOf(tenantId);
    const since = new Date(Date.now() - 24 * 3600_000);
    const spend = await this.office.spendSince(tenantId, list.map((d) => d.id), since);
    const blocks: string[] = [];
    const lines: string[] = [];
    let anything = false;
    for (const d of list) {
      const done = await this.tasks
        .createQueryBuilder('t')
        .where('t.department_id = :id', { id: d.id })
        .andWhere(`t.status = 'done'`)
        .andWhere('t.finished_at >= :since', { since })
        .orderBy('t.finished_at', 'DESC')
        .getMany();
      const counts: Array<{ status: string; n: string }> = await this.tasks.query(
        `SELECT status, count(*) n FROM ai_office_tasks WHERE department_id = $1 AND (status IN ('waiting','backlog','blocked') OR (status = 'failed' AND finished_at >= $2)) GROUP BY 1`,
        [d.id, since],
      );
      const c = (s: string) => Number(counts.find((x) => x.status === s)?.n ?? 0);
      const issues: Array<{ title: string }> = await this.tasks.query(`SELECT title FROM ai_office_issues WHERE department_id = $1 AND status = 'open' ORDER BY created_at DESC LIMIT 3`, [d.id]);
      const next: Array<{ title: string }> = await this.tasks.query(`SELECT title FROM ai_office_tasks WHERE department_id = $1 AND status = 'backlog' ORDER BY priority, created_at LIMIT 3`, [d.id]);
      if (!done.length && !c('waiting') && !issues.length && !c('failed')) continue;
      anything = true;
      const curator = d.curatorAgentId ? await this.agents.findOne({ where: { id: d.curatorAgentId } }) : null;
      const first = (s: string | null) => String(s ?? '').replace(/^[⏳✉️❌].*\n+/u, '').split(/(?<=[.!?])\s/)[0].slice(0, 200);
      const top = done.slice(0, 3).map((t) => `<li><b>${escapeMailHtml(t.title)}</b>${t.resultSummary ? ` — ${escapeMailHtml(first(t.resultSummary))}` : ''}</li>`).join('');
      const cents = spend[d.id] ?? 0;
      blocks.push(`<div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin:0 0 12px">
<div style="font-weight:700;font-size:15px;margin-bottom:2px">${escapeMailHtml(d.name)}</div>
${curator ? `<div style="font-size:12px;color:#6d28d9;margin-bottom:6px">${escapeMailHtml(ot(lang, 'dg_from_curator', { name: curator.name }))}</div>` : ''}
<div style="font-size:13px;color:#334155;margin-bottom:6px">${escapeMailHtml(ot(lang, 'dg_counts', { done: done.length, waiting: c('waiting'), failed: c('failed'), queue: c('backlog'), spend: (cents / 100).toFixed(2) }))}</div>
${top ? `<ul style="margin:0 0 6px;padding-left:18px;font-size:13px">${top}</ul>` : ''}
${c('waiting') ? `<div style="font-size:13px;color:#8a5d0f">⏳ ${escapeMailHtml(ot(lang, 'dg_waiting', { n: c('waiting') }))}</div>` : ''}
${issues.length ? `<div style="font-size:13px;color:#b4232a">⚑ ${escapeMailHtml(issues.map((i) => i.title).join(' · '))}</div>` : ''}
${next.length ? `<div style="font-size:12.5px;color:#64748b;margin-top:6px">${escapeMailHtml(ot(lang, 'dg_today'))}: ${escapeMailHtml(next.map((x) => x.title).join(' · '))}</div>` : ''}
<a href="${front()}/ai-office/departments/${d.id}" style="font-size:13px;color:#111827">${escapeMailHtml(ot(lang, 'decide_open'))} →</a>
</div>`);
      lines.push(`${d.name}: ${ot(lang, 'dg_counts', { done: done.length, waiting: c('waiting'), failed: c('failed'), queue: c('backlog'), spend: (cents / 100).toFixed(2) })}`);
    }
    if (!anything) return false;
    const owners: Array<{ email: string }> = await this.tasks.query(
      `SELECT email FROM users WHERE "tenantId" = $1 AND role IN ('owner','admin') AND status = 'active' AND email IS NOT NULL`,
      [tenantId],
    );
    const html = renderMailShell({ headline: ot(lang, 'dg_title'), bodyHtml: blocks.join(''), cta: { label: ot(lang, 'mail_open_office'), href: `${front()}/ai-office` } });
    for (const o of owners) await this.mail.sendMail({ to: o.email, subject: ot(lang, 'dg_subject'), html }).catch((e) => this.log.warn(`digest mail ${o.email}: ${(e as Error).message}`));
    await this.office.notifyOwners(tenantId, list[0].id, ot(lang, 'dg_title'), lines.join('\n'));
    return true;
  }

  /**
   * «Доверие по истории»: последние N решений по отправкам отдела — все одобрены без правок →
   * предложение «разрешить отправлять самому» (не чаще раза в 30 дней на отдел).
   */
  async trustLadder(): Promise<void> {
    const depts = await this.depts.find({ where: { status: 'active' } });
    for (const d of depts) {
      const m = normalizeMatrix(d.permissions);
      const needsApproval = m.msg === 'appr' || (m.msg === 'auto' && d.rules.includes('no_client_send_without_approval'));
      if (!needsApproval) continue;
      const agentIds = (await this.agents.find({ where: { tenantId: d.tenantId, departmentId: d.id }, select: ['id'] })).map((a) => a.id);
      if (!agentIds.length) continue;
      const rows: Array<{ status: string; edited: boolean }> = await this.actions.query(
        `SELECT status, COALESCE((payload->>'editedByHuman')::boolean, false) edited FROM ai_agent_actions
          WHERE tenant_id = $1 AND agent_id = ANY($2) AND action_type IN ('send_email','send_telegram','send_whatsapp','helpdesk_reply','send_booking_message') AND requires_approval = true
            AND status IN ('executed','rejected','failed') ORDER BY updated_at DESC LIMIT ${TRUST_STREAK}`,
        [d.tenantId, agentIds],
      );
      if (rows.length < TRUST_STREAK || rows.some((r) => r.status === 'rejected' || r.edited)) continue;
      const key = `${d.id}:trust:msg`;
      const recent: Array<{ n: string }> = await this.actions.query(
        `SELECT count(*) n FROM ai_office_issues WHERE tenant_id = $1 AND dedupe_key = $2 AND created_at > now() - interval '30 days'`,
        [d.tenantId, key],
      );
      if (Number(recent[0]?.n ?? 0) > 0) continue;
      const lang = await this.office.langOf(d.tenantId, d.id);
      await this.office.createIssue({
        tenantId: d.tenantId,
        departmentId: d.id,
        kind: 'trust',
        title: ot(lang, 'trust_title', { n: TRUST_STREAK }),
        detail: ot(lang, 'trust_detail', { n: TRUST_STREAK }),
        fix: 'autonomy',
        target: 'msg',
        dedupeKey: key,
      });
    }
  }

  /** «Разрешить отправлять самому»: сообщения — «Сам», деньги/условия — по-прежнему через владельца. */
  async grantAutonomy(tenantId: string, departmentId: string, userId: string | null) {
    const d = await this.office.getDeptEntity(tenantId, departmentId);
    const permissions = { ...normalizeMatrix(d.permissions), msg: 'auto' as const };
    const rules = [...new Set([...d.rules.filter((r) => r !== 'no_client_send_without_approval'), 'approve_sensitive'])];
    const out = await this.office.updateDepartment(tenantId, departmentId, userId, { permissions, rules } as any);
    await this.office.resolveIssueByKey(tenantId, `${departmentId}:trust:msg`);
    return out;
  }

  // ───────────────────────── решение по ссылке из письма ─────────────────────────

  async decisionPage(token: string): Promise<{ status: number; html: string }> {
    const taskId = this.verify(token);
    const t = taskId ? await this.tasks.findOne({ where: { id: taskId } }) : null;
    if (!t) return { status: 404, html: this.page('ru', '—', `<p>${escapeMailHtml(ot('ru', 'decide_bad_link'))}</p>`) };
    const lang = await this.office.langOf(t.tenantId, t.departmentId);
    if (t.status !== 'waiting' || !t.pendingActionIds.length) {
      return { status: 200, html: this.page(lang, t.title, `<p>${escapeMailHtml(ot(lang, 'decide_already'))}</p>${this.openLink(lang, t)}`) };
    }
    const acts = await this.actions.find({ where: { tenantId: t.tenantId, id: In(t.pendingActionIds) } });
    const items = acts
      .map((a) => {
        const p = (a.payload || {}) as Record<string, any>;
        const to = Array.isArray(p.to) ? p.to.join(', ') : p.to ? String(p.to) : '';
        const subject = p.subject ? String(p.subject) : '';
        const text = String(p.textBody ?? p.bodyText ?? p.text ?? p.description ?? '');
        return `<div class="a"><b>${escapeMailHtml(a.title)}</b>${p.curatorNote ? `<div class="m" style="color:#8a5d0f">⚑ ${escapeMailHtml(String(p.curatorNote))}</div>` : ''}${to ? `<div class="m">${escapeMailHtml(ot(lang, 'decide_to'))}: ${escapeMailHtml(to)}</div>` : ''}${subject ? `<div class="m">${escapeMailHtml(ot(lang, 'decide_subject'))}: ${escapeMailHtml(subject)}</div>` : ''}${text ? `<pre>${escapeMailHtml(text.slice(0, 6000))}</pre>` : ''}</div>`;
      })
      .join('');
    const form = `<form method="post" class="f">
<button name="decision" value="approve" class="ok">${escapeMailHtml(ot(lang, 'decide_approve'))}</button>
<button name="decision" value="reject" class="no">${escapeMailHtml(ot(lang, 'decide_reject'))}</button>
</form>`;
    return { status: 200, html: this.page(lang, t.title, `<p class="m">${escapeMailHtml(ot(lang, 'decide_intro'))}</p>${items}${form}${this.openLink(lang, t)}`) };
  }

  async decide(token: string, decision: string): Promise<{ status: number; html: string }> {
    const taskId = this.verify(token);
    const t = taskId ? await this.tasks.findOne({ where: { id: taskId } }) : null;
    if (!t) return { status: 404, html: this.page('ru', '—', `<p>${escapeMailHtml(ot('ru', 'decide_bad_link'))}</p>`) };
    const lang = await this.office.langOf(t.tenantId, t.departmentId);
    if (t.status !== 'waiting') return { status: 200, html: this.page(lang, t.title, `<p>${escapeMailHtml(ot(lang, 'decide_already'))}</p>${this.openLink(lang, t)}`) };
    if (decision === 'approve') {
      const r = await this.office.approveTask(t.tenantId, t.id, null);
      const msg = r.errors.length ? `${ot(lang, 'decide_done_errors')}: ${r.errors.join('; ')}` : ot(lang, 'decide_done_ok');
      return { status: 200, html: this.page(lang, t.title, `<p>${escapeMailHtml(msg)}</p>${this.openLink(lang, t)}`) };
    }
    await this.office.rejectTask(t.tenantId, t.id, null, ot(lang, 'decide_reject_reason'));
    return { status: 200, html: this.page(lang, t.title, `<p>${escapeMailHtml(ot(lang, 'decide_done_rejected'))}</p>${this.openLink(lang, t)}`) };
  }

  private openLink(lang: Parameters<typeof ot>[0], t: AiOfficeTask) {
    return `<p><a href="${front()}/ai-office/departments/${t.departmentId}">${escapeMailHtml(ot(lang, 'decide_open'))} →</a></p>`;
  }

  private page(lang: string, title: string, body: string) {
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeMailHtml(title)}</title>
<style>body{margin:0;background:#f4f3ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1d1f20}
.w{max-width:640px;margin:0 auto;padding:24px 16px}.c{background:#fff;border:1px solid #e5e2da;border-radius:14px;padding:20px}
h1{font-size:19px;margin:0 0 12px}.m{color:#6b6b6b;font-size:13px;margin:2px 0}.a{border:1px solid #ece9e2;border-radius:10px;padding:12px;margin:10px 0}
pre{white-space:pre-wrap;font-family:inherit;font-size:14px;background:#faf9f6;border-radius:8px;padding:10px;margin:8px 0 0}
.f{display:flex;gap:10px;margin:16px 0}.f button{flex:1;padding:12px;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;border:1px solid #1d1f20}
.ok{background:#1d1f20;color:#fff}.no{background:#fff;color:#1d1f20}a{color:#1d1f20}</style></head>
<body><div class="w"><div class="c"><div class="m">Lumiva · ИИ-отделы</div><h1>${escapeMailHtml(title)}</h1>${body}</div></div></body></html>`;
  }
}

/** Публичная страница решения по ссылке из письма (без входа — подпись ссылки и есть доступ). */
@Controller('ai-office/decide')
export class AiOfficeDecideController {
  constructor(private readonly autonomy: AiOfficeAutonomyService) {}

  @Get(':token')
  async page(@Param('token') token: string, @Res() res: Response) {
    const r = await this.autonomy.decisionPage(token);
    res.status(r.status).type('html').send(r.html);
  }

  @Post(':token')
  async decide(@Param('token') token: string, @Body() body: Record<string, unknown>, @Res() res: Response) {
    const r = await this.autonomy.decide(token, String(body?.decision ?? ''));
    res.status(r.status).type('html').send(r.html);
  }
}
