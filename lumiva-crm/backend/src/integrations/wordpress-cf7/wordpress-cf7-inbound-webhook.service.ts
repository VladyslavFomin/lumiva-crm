import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IntegrationConnection } from '../integration-connection.entity';
import { LeadsService } from '../../leads/leads.service';
import { NotesService } from '../../notes/notes.service';
import { EntityType, NoteType } from '../../notes/dto/create-note.dto';

type WpCfg = {
  catalogId?: string;
  /** Совпадает с query ?secret= или X-Lumiva-Secret / Bearer */
  webhookInboundSecret?: string;
  /** Источник лида (поле source), по умолчанию wordpress_cf7 */
  defaultLeadSource?: string;
};

function parseCfg(entity: IntegrationConnection): WpCfg | null {
  if (!entity.configJson) return null;
  try {
    return JSON.parse(entity.configJson) as WpCfg;
  } catch {
    return null;
  }
}

function asFlatRecord(body: unknown): Record<string, string> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string') {
      out[k] = v;
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      out[k] = String(v);
    } else if (typeof v === 'object') {
      try {
        out[k] = JSON.stringify(v);
      } catch {
        out[k] = String(v);
      }
    }
  }
  return out;
}

function pickField(flat: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = flat[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    const lower = Object.keys(flat).find((x) => x.toLowerCase() === k.toLowerCase());
    if (lower) {
      const vv = flat[lower];
      if (typeof vv === 'string' && vv.trim()) return vv.trim();
    }
  }
  return '';
}

@Injectable()
export class WordpressCf7InboundWebhookService {
  private readonly log = new Logger(WordpressCf7InboundWebhookService.name);

  constructor(
    @InjectRepository(IntegrationConnection)
    private readonly integrationRepo: Repository<IntegrationConnection>,
    private readonly leadsService: LeadsService,
    private readonly notesService: NotesService,
  ) {}

  extractProvidedSecret(
    headers: Record<string, string | string[] | undefined>,
    query: Record<string, string | string[] | undefined>,
  ): string {
    const q = query['secret'];
    if (typeof q === 'string' && q.trim()) return q.trim();
    const auth = headers['authorization'];
    if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
      return auth.slice(7).trim();
    }
    const x = headers['x-lumiva-secret'];
    return typeof x === 'string' ? x.trim() : '';
  }

  verifySecretIfConfigured(cfg: WpCfg, provided: string): boolean {
    const expected = String(cfg.webhookInboundSecret || '').trim();
    if (!expected) return true;
    return provided === expected;
  }

  async loadConnection(
    connectionId: string,
  ): Promise<{ entity: IntegrationConnection; cfg: WpCfg } | null> {
    const entity = await this.integrationRepo.findOne({
      where: { id: connectionId, isDeleted: false, isEnabled: true } as any,
    });
    if (!entity || entity.kind !== 'third_party_link') return null;
    const cfg = parseCfg(entity);
    if (!cfg || cfg.catalogId !== 'wordpress_cf7') return null;
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
      this.log.warn(`Unknown or disabled site-forms connection ${connectionId}`);
      return;
    }
    const { entity, cfg } = loaded;
    const provided = this.extractProvidedSecret(headers, query);
    if (!this.verifySecretIfConfigured(cfg, provided)) {
      this.log.warn(`Rejected site-forms webhook (secret) for ${connectionId}`);
      return;
    }

    const flat = asFlatRecord(body);
    const name =
      pickField(flat, [
        'your-name',
        'name',
        'fullname',
        'full_name',
        'contact-name',
        'lead_name',
        'subject',
      ]) || 'Website form';
    const email = pickField(flat, ['your-email', 'email', 'mail', 'e-mail', 'your_mail']);
    const phone = pickField(flat, [
      'your-phone',
      'your-tel',
      'tel',
      'phone',
      'mobile',
      'telephone',
    ]);
    const message = pickField(flat, [
      'your-message',
      'message',
      'comments',
      'body',
      'details',
    ]);

    if (!email && !phone) {
      this.log.warn(`Site-forms ${connectionId}: need email or phone in payload`);
      return;
    }

    const source =
      (typeof cfg.defaultLeadSource === 'string' && cfg.defaultLeadSource.trim()) ||
      'wordpress_cf7';

    const meta: Record<string, unknown> = {
      siteForm: true,
      integrationConnectionId: entity.id,
      siteFormKeys: Object.keys(flat).slice(0, 40),
    };

    const lead = await this.leadsService.createForTenant(entity.tenantId, {
      name: name.slice(0, 250),
      email: email ? email.slice(0, 250) : undefined,
      phone: phone ? phone.slice(0, 50) : undefined,
      source,
      status: 'new',
      meta,
    });

    const lines: string[] = ['Заявка с сайта (WordPress / CF7).'];
    if (message) lines.push('', message);
    lines.push('', '---', 'Поля (сырой набор):');
    try {
      const raw = JSON.stringify(flat, null, 2);
      lines.push(raw.length > 12000 ? raw.slice(0, 12000) + '\n…' : raw);
    } catch {
      lines.push('[не удалось сериализовать поля]');
    }

    try {
      await this.notesService.create(
        entity.tenantId,
        {
          entityType: EntityType.LEAD,
          entityId: lead.id,
          content: lines.join('\n'),
          title: 'Форма сайта',
          type: NoteType.NOTE,
        },
        undefined,
        'integration:wordpress_cf7',
      );
    } catch (e) {
      this.log.error(`Note for site-form lead: ${(e as Error).message}`);
    }
  }
}
