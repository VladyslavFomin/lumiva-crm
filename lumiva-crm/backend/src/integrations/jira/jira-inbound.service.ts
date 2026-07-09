import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationConnection } from '../integration-connection.entity';
import { LeadsService } from '../../leads/leads.service';
import { NotesService } from '../../notes/notes.service';
import { EntityType, NoteType } from '../../notes/dto/create-note.dto';

type JiraCfg = {
  catalogId?: string;
  jiraUrl?: string;
  email?: string;
  apiToken?: string;
  projectKey?: string;
  inboundToken?: string;
  defaultLeadSource?: string;
};

function parseCfg(entity: IntegrationConnection): JiraCfg | null {
  if (!entity.configJson) return null;
  try { return JSON.parse(entity.configJson) as JiraCfg; } catch { return null; }
}

type JiraWebhookPayload = {
  webhookEvent?: string;          // e.g. "jira:issue_created", "jira:issue_updated"
  issue_event_type_name?: string; // e.g. "issue_created", "issue_status_changed"
  issue?: {
    id?: string;
    key?: string;
    self?: string;
    fields?: {
      summary?: string;
      description?: unknown;
      status?: { name?: string };
      issuetype?: { name?: string };
      priority?: { name?: string };
      assignee?: { displayName?: string; emailAddress?: string };
      reporter?: { displayName?: string; emailAddress?: string };
      project?: { key?: string; name?: string };
      comment?: { comments?: Array<{ body?: unknown; author?: { displayName?: string } }> };
      [key: string]: unknown;
    };
  };
  user?: { displayName?: string; emailAddress?: string };
  changelog?: { items?: Array<{ field?: string; fromString?: string; toString?: string }> };
  comment?: { body?: unknown; author?: { displayName?: string } };
};

function extractDescText(desc: unknown): string {
  if (!desc) return '';
  if (typeof desc === 'string') return desc;
  // Atlassian Document Format
  if (typeof desc === 'object' && desc !== null) {
    const d = desc as { content?: Array<{ content?: Array<{ text?: string }> }> };
    return (d.content ?? [])
      .flatMap((b) => b.content ?? [])
      .map((n) => n.text ?? '')
      .join(' ')
      .trim();
  }
  return '';
}

@Injectable()
export class JiraInboundService {
  private readonly log = new Logger(JiraInboundService.name);

  constructor(
    @InjectRepository(IntegrationConnection)
    private readonly connectionRepo: Repository<IntegrationConnection>,
    private readonly leadsService: LeadsService,
    private readonly notesService: NotesService,
  ) {}

  extractToken(headers: Record<string, string | string[] | undefined>, query: Record<string, string | string[] | undefined>): string {
    const q = query['token'];
    if (typeof q === 'string' && q.trim()) return q.trim();
    for (const h of ['x-lumiva-token', 'x-jira-token', 'authorization']) {
      const v = headers[h];
      if (typeof v === 'string') {
        const s = v.toLowerCase().startsWith('bearer ') ? v.slice(7).trim() : v.trim();
        if (s) return s;
      }
    }
    return '';
  }

  async loadConnection(connectionId: string): Promise<{ entity: IntegrationConnection; cfg: JiraCfg } | null> {
    const entity = await this.connectionRepo.findOne({
      where: { id: connectionId, isDeleted: false, isEnabled: true } as any,
    });
    if (!entity || entity.kind !== 'third_party_link') return null;
    const cfg = parseCfg(entity);
    if (!cfg || cfg.catalogId !== 'jira') return null;
    return { entity, cfg };
  }

  async handleInbound(
    connectionId: string,
    headers: Record<string, string | string[] | undefined>,
    query: Record<string, string | string[] | undefined>,
    body: unknown,
  ): Promise<{ ok: true }> {
    const loaded = await this.loadConnection(connectionId);
    if (!loaded) {
      this.log.warn(`Unknown or disabled Jira connection ${connectionId}`);
      return { ok: true };
    }
    const { entity, cfg } = loaded;

    const expected = (cfg.inboundToken ?? '').trim();
    if (expected) {
      const provided = this.extractToken(headers, query);
      if (provided !== expected) {
        this.log.warn(`Rejected Jira inbound (bad token) for connection ${connectionId}`);
        return { ok: true };
      }
    }

    const payload = body as JiraWebhookPayload;
    const event = payload?.webhookEvent ?? payload?.issue_event_type_name ?? 'unknown';
    const issue = payload?.issue;

    if (!issue?.key) {
      this.log.warn(`Jira inbound ${connectionId}: no issue key in payload`);
      return { ok: true };
    }

    const issueKey = issue.key;
    const issueSummary = issue.fields?.summary ?? 'Jira Issue';
    const issueStatus = issue.fields?.status?.name ?? '';
    const issueType = issue.fields?.issuetype?.name ?? 'Task';
    const reporter = issue.fields?.reporter;
    const assignee = issue.fields?.assignee;
    const description = extractDescText(issue.fields?.description);
    const changelog = payload.changelog?.items ?? [];
    const user = payload.user;

    // Build note content
    const lines: string[] = [
      `Jira ${event}: ${issueKey} — ${issueSummary}`,
      '',
    ];
    if (issueStatus) lines.push(`Статус: ${issueStatus}`);
    if (issueType) lines.push(`Тип: ${issueType}`);
    if (assignee) lines.push(`Исполнитель: ${assignee.displayName} (${assignee.emailAddress ?? ''})`);
    if (reporter) lines.push(`Автор: ${reporter.displayName} (${reporter.emailAddress ?? ''})`);
    if (user) lines.push(`Действие выполнил: ${user.displayName ?? user.emailAddress ?? ''}`);
    if (description) lines.push('', 'Описание:', description);
    if (changelog.length > 0) {
      lines.push('', 'Изменения:');
      for (const ch of changelog) {
        lines.push(`  ${ch.field}: ${ch.fromString ?? '?'} → ${ch.toString ?? '?'}`);
      }
    }

    const source = cfg.defaultLeadSource || 'jira';
    const reporterEmail = reporter?.emailAddress ?? '';
    const reporterName = reporter?.displayName ?? '';

    // Create or update lead
    const lead = await this.leadsService.createForTenant(entity.tenantId, {
      name: (reporterName || issueKey).slice(0, 250),
      email: reporterEmail ? reporterEmail.slice(0, 250) : undefined,
      source,
      status: 'new',
      meta: { integrationConnectionId: entity.id, catalogId: 'jira', jiraKey: issueKey, jiraEvent: event },
    });

    try {
      await this.notesService.create(
        entity.tenantId,
        {
          entityType: EntityType.LEAD,
          entityId: lead.id,
          content: lines.join('\n'),
          title: `Jira: ${issueKey}`,
          type: NoteType.NOTE,
        },
        undefined,
        'integration:jira',
      );
    } catch (e) {
      this.log.error(`Jira note: ${(e as Error).message}`);
    }

    return { ok: true };
  }
}
