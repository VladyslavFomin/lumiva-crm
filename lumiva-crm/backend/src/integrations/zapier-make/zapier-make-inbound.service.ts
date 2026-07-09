// src/integrations/zapier-make/zapier-make-inbound.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationConnection } from '../integration-connection.entity';
import { LeadsService } from '../../leads/leads.service';
import { NotesService } from '../../notes/notes.service';
import { EntityType, NoteType } from '../../notes/dto/create-note.dto';

type ZapierMakeCfg = {
  catalogId?: string;
  /** Token used to authenticate inbound webhooks (stored as inboundToken) */
  inboundToken?: string;
  /** Fallback lead source label */
  defaultLeadSource?: string;
};

function parseCfg(entity: IntegrationConnection): ZapierMakeCfg | null {
  if (!entity.configJson) return null;
  try {
    return JSON.parse(entity.configJson) as ZapierMakeCfg;
  } catch {
    return null;
  }
}

function asFlatRecord(body: unknown): Record<string, string> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    if (v == null) continue;
    if (typeof v === 'string') out[k] = v;
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = String(v);
    else {
      try { out[k] = JSON.stringify(v); } catch { out[k] = String(v); }
    }
  }
  return out;
}

function pickField(flat: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = flat[k];
    if (v?.trim()) return v.trim();
    const found = Object.keys(flat).find((x) => x.toLowerCase() === k.toLowerCase());
    if (found && flat[found]?.trim()) return flat[found].trim();
  }
  return '';
}

@Injectable()
export class ZapierMakeInboundService {
  private readonly log = new Logger(ZapierMakeInboundService.name);

  constructor(
    @InjectRepository(IntegrationConnection)
    private readonly integrationRepo: Repository<IntegrationConnection>,
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
    if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
      return auth.slice(7).trim();
    }
    const x = headers['x-lumiva-token'] || headers['x-lumiva-secret'];
    return typeof x === 'string' ? x.trim() : '';
  }

  async loadConnection(
    connectionId: string,
  ): Promise<{ entity: IntegrationConnection; cfg: ZapierMakeCfg } | null> {
    const entity = await this.integrationRepo.findOne({
      where: { id: connectionId, isDeleted: false, isEnabled: true } as any,
    });
    if (!entity || entity.kind !== 'third_party_link') return null;
    const cfg = parseCfg(entity);
    if (!cfg || (cfg.catalogId !== 'zapier' && cfg.catalogId !== 'make')) return null;
    return { entity, cfg };
  }

  async handleInbound(
    connectionId: string,
    headers: Record<string, string | string[] | undefined>,
    query: Record<string, string | string[] | undefined>,
    body: unknown,
  ): Promise<void> {
    const loaded = await this.loadConnection(connectionId);
    if (!loaded) {
      this.log.warn(`Unknown or disabled zapier/make connection ${connectionId}`);
      return;
    }
    const { entity, cfg } = loaded;

    // Verify token if configured
    const expectedToken = (cfg.inboundToken || '').trim();
    if (expectedToken) {
      const provided = this.extractToken(headers, query);
      if (provided !== expectedToken) {
        this.log.warn(`Rejected inbound webhook (bad token) for connection ${connectionId}`);
        return;
      }
    }

    const flat = asFlatRecord(body);
    if (!Object.keys(flat).length) {
      this.log.warn(`Empty payload received for connection ${connectionId}`);
      return;
    }

    // Smart field extraction - works with any common field naming convention
    const name =
      pickField(flat, [
        'name', 'full_name', 'fullname', 'contact_name', 'lead_name',
        'customer_name', 'client_name', 'first_name', 'firstname',
        'your-name', 'subject', 'title',
      ]) || 'Lead from ' + (cfg.catalogId === 'make' ? 'Make' : 'Zapier');

    const email = pickField(flat, [
      'email', 'mail', 'e-mail', 'your-email', 'email_address', 'contact_email',
    ]);

    const phone = pickField(flat, [
      'phone', 'tel', 'mobile', 'telephone', 'your-phone', 'phone_number',
      'contact_phone', 'cell',
    ]);

    const message = pickField(flat, [
      'message', 'comment', 'comments', 'body', 'description', 'details',
      'notes', 'your-message', 'text', 'content',
    ]);

    const rawStatus = pickField(flat, ['status', 'lead_status', 'state']).toLowerCase();
    const leadStatus: 'new' | 'in_progress' | 'won' | 'lost' =
      rawStatus === 'in_progress' ? 'in_progress'
        : rawStatus === 'won' ? 'won'
          : rawStatus === 'lost' ? 'lost'
            : 'new';

    if (!email && !phone && !name) {
      this.log.warn(`Inbound ${connectionId}: no identifiable fields in payload`);
      return;
    }

    const source =
      pickField(flat, ['source', 'lead_source', 'utm_source']) ||
      cfg.defaultLeadSource ||
      (cfg.catalogId === 'make' ? 'make' : 'zapier');

    const lead = await this.leadsService.createForTenant(entity.tenantId, {
      name: name.slice(0, 250),
      email: email ? email.slice(0, 250) : undefined,
      phone: phone ? phone.slice(0, 50) : undefined,
      source,
      status: leadStatus,
      meta: {
        integrationConnectionId: entity.id,
        catalogId: cfg.catalogId,
        payloadKeys: Object.keys(flat).slice(0, 40),
      },
    });

    const platformLabel = cfg.catalogId === 'make' ? 'Make (Integromat)' : 'Zapier';
    const lines = [`Лид из ${platformLabel}.`];
    if (message) lines.push('', message);
    lines.push('', '---', 'Исходные поля:');
    try {
      const raw = JSON.stringify(flat, null, 2);
      lines.push(raw.length > 8000 ? raw.slice(0, 8000) + '\n…' : raw);
    } catch {
      lines.push('[ошибка сериализации]');
    }

    try {
      await this.notesService.create(
        entity.tenantId,
        {
          entityType: EntityType.LEAD,
          entityId: lead.id,
          content: lines.join('\n'),
          title: `Webhook ${platformLabel}`,
          type: NoteType.NOTE,
        },
        undefined,
        `integration:${cfg.catalogId}`,
      );
    } catch (e) {
      this.log.error(`Note for ${platformLabel} lead: ${(e as Error).message}`);
    }
  }
}
