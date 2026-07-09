import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationConnection } from '../integration-connection.entity';
import { LeadsService } from '../../leads/leads.service';
import { NotesService } from '../../notes/notes.service';
import { EntityType, NoteType } from '../../notes/dto/create-note.dto';

type SlackCfg = {
  catalogId?: string;
  inboundToken?: string;
  defaultLeadSource?: string;
};

function parseCfg(entity: IntegrationConnection): SlackCfg | null {
  if (!entity.configJson) return null;
  try { return JSON.parse(entity.configJson) as SlackCfg; } catch { return null; }
}

function asFlatRecord(body: unknown): Record<string, string> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    if (v == null) continue;
    if (typeof v === 'string') out[k] = v;
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = String(v);
    else { try { out[k] = JSON.stringify(v); } catch { out[k] = String(v); } }
  }
  return out;
}

function pick(flat: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = flat[k];
    if (v?.trim()) return v.trim();
    const found = Object.keys(flat).find((x) => x.toLowerCase() === k.toLowerCase());
    if (found && flat[found]?.trim()) return flat[found].trim();
  }
  return '';
}

@Injectable()
export class SlackInboundService {
  private readonly log = new Logger(SlackInboundService.name);

  constructor(
    @InjectRepository(IntegrationConnection)
    private readonly connectionRepo: Repository<IntegrationConnection>,
    private readonly leadsService: LeadsService,
    private readonly notesService: NotesService,
  ) {}

  extractToken(
    headers: Record<string, string | string[] | undefined>,
    query: Record<string, string | string[] | undefined>,
  ): string {
    const q = query['token'];
    if (typeof q === 'string' && q.trim()) return q.trim();
    const auth = headers['authorization'];
    if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer '))
      return auth.slice(7).trim();
    const x = headers['x-lumiva-token'] || headers['x-lumiva-secret'];
    return typeof x === 'string' ? x.trim() : '';
  }

  /**
   * Returns the Slack URL-verification challenge string if the payload is a challenge request.
   * Slack sends this when you first configure an Event Subscription.
   */
  extractChallenge(body: unknown): string | null {
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const b = body as Record<string, unknown>;
      if (b['type'] === 'url_verification' && typeof b['challenge'] === 'string') {
        return b['challenge'];
      }
    }
    return null;
  }

  async loadConnection(connectionId: string): Promise<{ entity: IntegrationConnection; cfg: SlackCfg } | null> {
    const entity = await this.connectionRepo.findOne({
      where: { id: connectionId, isDeleted: false, isEnabled: true } as any,
    });
    if (!entity || entity.kind !== 'third_party_link') return null;
    const cfg = parseCfg(entity);
    if (!cfg || cfg.catalogId !== 'slack') return null;
    return { entity, cfg };
  }

  async handleInbound(
    connectionId: string,
    headers: Record<string, string | string[] | undefined>,
    query: Record<string, string | string[] | undefined>,
    body: unknown,
  ): Promise<{ ok: true } | { challenge: string }> {
    // Respond to Slack URL verification immediately (no auth needed)
    const challenge = this.extractChallenge(body);
    if (challenge) return { challenge };

    const loaded = await this.loadConnection(connectionId);
    if (!loaded) {
      this.log.warn(`Unknown or disabled Slack connection ${connectionId}`);
      return { ok: true };
    }
    const { entity, cfg } = loaded;

    // Verify inbound token if configured
    const expected = (cfg.inboundToken || '').trim();
    if (expected) {
      const provided = this.extractToken(headers, query);
      if (provided !== expected) {
        this.log.warn(`Rejected Slack inbound (bad token) for connection ${connectionId}`);
        return { ok: true };
      }
    }

    // Extract text from Slack Event API or plain JSON payload
    const flat = asFlatRecord(body);

    // Slack Event API wraps in event.text / event.user
    const eventObj = (body as any)?.event || body;
    const eventFlat = asFlatRecord(eventObj);

    const name =
      pick(flat, ['user_name', 'name', 'full_name', 'username']) ||
      pick(eventFlat, ['user', 'username']) ||
      'Lead from Slack';

    const email = pick(flat, ['email', 'mail', 'user_email', 'email_address']);
    const phone = pick(flat, ['phone', 'tel', 'telephone', 'mobile']);
    const message =
      pick(flat, ['message', 'text', 'comment', 'body', 'description']) ||
      pick(eventFlat, ['text']);

    if (!name && !email && !phone && !message) {
      this.log.warn(`Slack inbound ${connectionId}: no usable fields in payload`);
      return { ok: true };
    }

    const source = pick(flat, ['source', 'lead_source']) || cfg.defaultLeadSource || 'slack';

    const lead = await this.leadsService.createForTenant(entity.tenantId, {
      name: (name || 'Slack').slice(0, 250),
      email: email ? email.slice(0, 250) : undefined,
      phone: phone ? phone.slice(0, 50) : undefined,
      source,
      status: 'new',
      meta: { integrationConnectionId: entity.id, catalogId: 'slack', payloadKeys: Object.keys(flat).slice(0, 40) },
    });

    const lines = ['Лид из Slack.'];
    if (message) lines.push('', message);
    lines.push('', '---', 'Исходные поля:');
    try {
      const raw = JSON.stringify(flat, null, 2);
      lines.push(raw.length > 8000 ? raw.slice(0, 8000) + '\n…' : raw);
    } catch { lines.push('[ошибка сериализации]'); }

    try {
      await this.notesService.create(
        entity.tenantId,
        {
          entityType: EntityType.LEAD,
          entityId: lead.id,
          content: lines.join('\n'),
          title: 'Webhook Slack',
          type: NoteType.NOTE,
        },
        undefined,
        'integration:slack',
      );
    } catch (e) {
      this.log.error(`Note for Slack lead: ${(e as Error).message}`);
    }

    return { ok: true };
  }
}
