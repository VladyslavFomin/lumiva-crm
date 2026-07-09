import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationConnection } from '../integration-connection.entity';
import { LeadsService } from '../../leads/leads.service';
import { NotesService } from '../../notes/notes.service';
import { EntityType, NoteType } from '../../notes/dto/create-note.dto';

type SapCfg = {
  catalogId?: string;
  apiKey?: string;
  inboundToken?: string;
  defaultLeadSource?: string;
};

function parseCfg(entity: IntegrationConnection): SapCfg | null {
  if (!entity.configJson) return null;
  try { return JSON.parse(entity.configJson) as SapCfg; } catch { return null; }
}

function flat(body: unknown): Record<string, string> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const out: Record<string, string> = {};
  const obj = body as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    if (typeof v === 'string') out[k] = v;
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = String(v);
    else try { out[k] = JSON.stringify(v); } catch { out[k] = String(v); }
  }
  return out;
}

function pick(f: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = f[k];
    if (v?.trim()) return v.trim();
    const found = Object.keys(f).find((x) => x.toLowerCase() === k.toLowerCase());
    if (found && f[found]?.trim()) return f[found].trim();
  }
  return '';
}

@Injectable()
export class SapInboundService {
  private readonly log = new Logger(SapInboundService.name);

  constructor(
    @InjectRepository(IntegrationConnection)
    private readonly connectionRepo: Repository<IntegrationConnection>,
    private readonly leadsService: LeadsService,
    private readonly notesService: NotesService,
  ) {}

  extractToken(headers: Record<string, string | string[] | undefined>, query: Record<string, string | string[] | undefined>): string {
    const q = query['token'];
    if (typeof q === 'string' && q.trim()) return q.trim();
    for (const h of ['x-sap-token', 'x-lumiva-token', 'x-api-key', 'authorization']) {
      const v = headers[h];
      if (typeof v === 'string') {
        const s = v.toLowerCase().startsWith('bearer ') ? v.slice(7).trim() : v.trim();
        if (s) return s;
      }
    }
    return '';
  }

  async loadConnection(connectionId: string): Promise<{ entity: IntegrationConnection; cfg: SapCfg } | null> {
    const entity = await this.connectionRepo.findOne({
      where: { id: connectionId, isDeleted: false, isEnabled: true } as any,
    });
    if (!entity || entity.kind !== 'third_party_link') return null;
    const cfg = parseCfg(entity);
    if (!cfg || cfg.catalogId !== 'sap') return null;
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
      this.log.warn(`Unknown or disabled SAP connection ${connectionId}`);
      return { ok: true };
    }
    const { entity, cfg } = loaded;

    const expected = ((cfg.apiKey || cfg.inboundToken) ?? '').trim();
    if (expected) {
      const provided = this.extractToken(headers, query);
      if (provided !== expected) {
        this.log.warn(`Rejected SAP inbound (bad token) for connection ${connectionId}`);
        return { ok: true };
      }
    }

    const topFlat = flat(body);
    // SAP Business One nested structures
    const bp = (body as any)?.BusinessPartner ?? {};
    const bpFlat = flat(bp);
    const dataFlat = flat((body as any)?.data ?? (body as any)?.Data ?? {});
    const eventFlat = flat((body as any)?.event ?? {});

    const name =
      pick(topFlat, ['CardName', 'customerName', 'clientName', 'name', 'fullName', 'Name']) ||
      pick(bpFlat, ['CardName', 'CardCode']) ||
      pick(dataFlat, ['name', 'customerName']) ||
      'Lead from SAP';

    const email =
      pick(topFlat, ['EmailAddress', 'email', 'Email', 'mail']) ||
      pick(bpFlat, ['EmailAddress']) ||
      pick(dataFlat, ['email']);

    const phone =
      pick(topFlat, ['Phone1', 'Phone2', 'phone', 'Phone', 'tel', 'mobile']) ||
      pick(bpFlat, ['Phone1', 'Phone2']) ||
      pick(dataFlat, ['phone']);

    const message =
      pick(topFlat, ['Notes', 'Description', 'description', 'message', 'text', 'comment']) ||
      pick(dataFlat, ['description', 'message']);

    const amount = pick(topFlat, ['DocTotal', 'Amount', 'amount', 'total', 'Total']);

    const source = pick(topFlat, ['source', 'Source']) || cfg.defaultLeadSource || 'sap';

    const lead = await this.leadsService.createForTenant(entity.tenantId, {
      name: (name || 'SAP').slice(0, 250),
      email: email ? email.slice(0, 250) : undefined,
      phone: phone ? phone.slice(0, 50) : undefined,
      source,
      status: 'new',
      meta: {
        integrationConnectionId: entity.id,
        catalogId: 'sap',
        sapAmount: amount || undefined,
        payloadKeys: Object.keys(topFlat).slice(0, 40),
      },
    });

    const lines = ['Лид из SAP.'];
    if (message) lines.push('', message);
    if (amount) lines.push('', `Сумма: ${amount}`);
    lines.push('', '---', 'Исходный payload:');
    try {
      const raw = JSON.stringify(body, null, 2);
      lines.push(raw.length > 8000 ? raw.slice(0, 8000) + '\n…' : raw);
    } catch { lines.push('[ошибка сериализации]'); }

    try {
      await this.notesService.create(
        entity.tenantId,
        { entityType: EntityType.LEAD, entityId: lead.id, content: lines.join('\n'), title: 'Webhook SAP', type: NoteType.NOTE },
        undefined,
        'integration:sap',
      );
    } catch (e) {
      this.log.error(`SAP note: ${(e as Error).message}`);
    }

    return { ok: true };
  }
}
