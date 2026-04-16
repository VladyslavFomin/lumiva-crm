import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IntegrationConnection } from '../integration-connection.entity';
import { Lead } from '../../leads/lead.entity';
import { LeadsService } from '../../leads/leads.service';
import { NotesService } from '../../notes/notes.service';
import { EntityType, NoteType } from '../../notes/dto/create-note.dto';

type AmoCfg = {
  catalogId?: string;
  /** Секрет в query ?secret= или заголовке X-Lumiva-Secret / Bearer */
  amoWebhookSecret?: string;
};

function parseCfg(entity: IntegrationConnection): AmoCfg | null {
  if (!entity.configJson) return null;
  try {
    return JSON.parse(entity.configJson) as AmoCfg;
  } catch {
    return null;
  }
}

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

@Injectable()
export class AmocrmInboundWebhookService {
  private readonly log = new Logger(AmocrmInboundWebhookService.name);

  constructor(
    @InjectRepository(IntegrationConnection)
    private readonly integrationRepo: Repository<IntegrationConnection>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
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

  async loadAmocrmConnection(
    connectionId: string,
  ): Promise<{ entity: IntegrationConnection; cfg: AmoCfg } | null> {
    const entity = await this.integrationRepo.findOne({
      where: { id: connectionId, isDeleted: false, isEnabled: true } as any,
    });
    if (!entity || entity.kind !== 'third_party_link') return null;
    const cfg = parseCfg(entity);
    if (!cfg || cfg.catalogId !== 'amocrm') return null;
    return { entity, cfg };
  }

  verifySecretIfConfigured(cfg: AmoCfg, provided: string): boolean {
    const expected = String(cfg.amoWebhookSecret || '').trim();
    if (!expected) return true;
    return provided === expected;
  }

  private normalizeDigits(phone: string): string {
    return String(phone || '').replace(/\D/g, '');
  }

  private async findLeadByPhoneDigits(
    tenantId: string,
    digits: string,
  ): Promise<Lead | null> {
    if (!digits) return null;
    return this.leadRepo
      .createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere("regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g') = :digits", {
        digits,
      })
      .orderBy('l.updatedAt', 'DESC')
      .getOne();
  }

  private async findLeadByAmoId(
    tenantId: string,
    amoLeadId: string,
  ): Promise<Lead | null> {
    if (!amoLeadId) return null;
    return this.leadRepo
      .createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere("l.meta->>'amocrmLeadId' = :amoLeadId", { amoLeadId })
      .orderBy('l.updatedAt', 'DESC')
      .getOne();
  }

  private async findLeadByAmoUnsortedUid(
    tenantId: string,
    uid: string,
  ): Promise<Lead | null> {
    if (!uid) return null;
    return this.leadRepo
      .createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere("l.meta->>'amocrmUnsortedUid' = :uid", { uid })
      .orderBy('l.updatedAt', 'DESC')
      .getOne();
  }

  /** Разбор вложенных блоков amo (add/update/status как объект с числовыми ключами или массив). */
  private materializeRows(block: unknown): Record<string, unknown>[] {
    if (block == null) return [];
    if (typeof block === 'string') {
      try {
        return this.materializeRows(JSON.parse(block));
      } catch {
        return [];
      }
    }
    if (Array.isArray(block)) {
      return block
        .map((x) => (x && typeof x === 'object' ? this.flattenRow(x as Record<string, unknown>) : null))
        .filter((x): x is Record<string, unknown> => !!x);
    }
    if (typeof block === 'object') {
      const vals = Object.values(block as object);
      return vals.flatMap((v) => this.materializeRows(v));
    }
    return [];
  }

  /** Снимает обёртку вида { "0": { реальные поля } } (часть вебхуков задач). */
  private flattenRow(row: Record<string, unknown>): Record<string, unknown> | null {
    if ('id' in row || 'name' in row || 'custom_fields' in row) return row;
    const vals = Object.values(row);
    if (vals.length === 1 && vals[0] && typeof vals[0] === 'object' && !Array.isArray(vals[0])) {
      return this.flattenRow(vals[0] as Record<string, unknown>);
    }
    return Object.keys(row).length ? row : null;
  }

  private extractFromCustomFields(
    row: Record<string, unknown>,
    codeMatch: (code: string, name: string) => boolean,
  ): string {
    const cf = row.custom_fields;
    if (!Array.isArray(cf)) return '';
    for (const f of cf) {
      if (!f || typeof f !== 'object') continue;
      const fld = f as Record<string, unknown>;
      const code = String(fld.code || '').toUpperCase();
      const name = String(fld.name || '').toLowerCase();
      if (!codeMatch(code, name)) continue;
      const vals = fld.values;
      if (!Array.isArray(vals) || !vals.length) continue;
      const v0 = vals[0];
      if (v0 && typeof v0 === 'object' && 'value' in (v0 as object)) {
        const s = String((v0 as Record<string, unknown>).value ?? '').trim();
        if (s) return s;
      }
      if (typeof v0 === 'string' && v0.trim()) return v0.trim();
    }
    return '';
  }

  private extractPhone(row: Record<string, unknown>): string {
    return this.extractFromCustomFields(
      row,
      (code, name) =>
        code === 'PHONE' ||
        code === 'MOB' ||
        name.includes('телеф') ||
        name.includes('phone') ||
        name.includes('mobile'),
    );
  }

  private extractEmail(row: Record<string, unknown>): string {
    return this.extractFromCustomFields(
      row,
      (code, name) => code === 'EMAIL' || name.includes('email') || name.includes('почт'),
    );
  }

  private buildNoteLines(
    title: string,
    connectionName: string,
    connectionId: string,
    eventPath: string,
    row: Record<string, unknown>,
  ): string {
    const id = row.id != null ? String(row.id) : '';
    const name = row.name != null ? String(row.name) : '';
    const price = row.price != null ? String(row.price) : '';
    const statusId = row.status_id != null ? String(row.status_id) : '';
    let json: string;
    try {
      const s = JSON.stringify(row, null, 0);
      json = s.length > 6000 ? `${s.slice(0, 6000)}…` : s;
    } catch {
      json = String(row);
    }
    return [
      title,
      `Подключение: ${connectionName} (${connectionId.slice(0, 8)}…)`,
      `Событие: ${eventPath}`,
      id ? `amo ID: ${id}` : null,
      name ? `Название: ${name}` : null,
      price ? `Бюджет: ${price}` : null,
      statusId ? `status_id: ${statusId}` : null,
      '',
      '--- JSON (фрагмент) ---',
      json,
    ]
      .filter((x) => x != null)
      .join('\n');
  }

  private async ensureLeadForAmoRow(
    tenantId: string,
    connectionId: string,
    row: Record<string, unknown>,
    kind: 'lead' | 'contact' | 'unsorted',
  ): Promise<Lead> {
    const amoId = row.id != null ? String(row.id) : '';
    const unsortedUid = row.uid != null ? String(row.uid) : '';
    const name = row.name != null ? String(row.name).trim() : '';
    const phone = this.extractPhone(row);
    const email = this.extractEmail(row);
    const digits = this.normalizeDigits(phone);

    let lead: Lead | null = null;
    if (kind === 'unsorted' && unsortedUid) {
      lead = await this.findLeadByAmoUnsortedUid(tenantId, unsortedUid);
    }
    if (!lead && kind === 'lead' && amoId) {
      lead = await this.findLeadByAmoId(tenantId, amoId);
    }
    if (!lead && digits) {
      lead = await this.findLeadByPhoneDigits(tenantId, digits);
    }

    const displayName =
      name ||
      (email ? email.split('@')[0] : '') ||
      (digits ? `+${digits}` : amoId ? `amoCRM #${amoId}` : 'amoCRM');

    if (!lead) {
      const phoneE164 =
        phone && phone.trim().startsWith('+')
          ? phone.trim()
          : digits
            ? `+${digits}`
            : undefined;
      lead = await this.leadsService.createForTenant(tenantId, {
        name: displayName,
        ...(phoneE164 ? { phone: phoneE164 } : {}),
        ...(email ? { email } : {}),
        source: 'amocrm',
        status: 'new',
        meta: {
          ...(amoId && kind === 'lead' ? { amocrmLeadId: amoId } : {}),
          ...(kind === 'unsorted' && unsortedUid ? { amocrmUnsortedUid: unsortedUid } : {}),
          amocrmInboundConnectionId: connectionId,
          amocrmInboundKind: kind,
        },
      });
      if (amoId && kind === 'lead' && !(lead.meta && (lead.meta as any).amocrmLeadId)) {
        lead.meta = { ...(lead.meta || {}), amocrmLeadId: amoId };
        await this.leadRepo.save(lead);
      }
    } else if (amoId && kind === 'lead') {
      const prev = (lead.meta || {}) as Record<string, unknown>;
      const meta = { ...prev, amocrmLeadId: amoId };
      if (String(prev.amocrmLeadId || '') !== amoId) {
        lead.meta = meta;
        await this.leadRepo.save(lead);
      }
    } else if (kind === 'unsorted' && unsortedUid) {
      const prev = (lead.meta || {}) as Record<string, unknown>;
      const meta = { ...prev, amocrmUnsortedUid: unsortedUid };
      if (String(prev.amocrmUnsortedUid || '') !== unsortedUid) {
        lead.meta = meta;
        await this.leadRepo.save(lead);
      }
    }

    return lead;
  }

  private async processEntityRoot(
    tenantId: string,
    connectionId: string,
    entityName: string,
    root: unknown,
    kind: 'lead' | 'contact',
  ): Promise<void> {
    const R = asRecord(root);
    for (const [action, block] of Object.entries(R)) {
      if (action === 'delete' || action === 'restore') continue;
      const rows = this.materializeRows(block);
      for (const row of rows) {
        const r = this.flattenRow(row);
        if (!r) continue;
        try {
          const lead = await this.ensureLeadForAmoRow(tenantId, connectionId, r, kind);
          const lines = this.buildNoteLines(
            kind === 'lead' ? 'amoCRM · сделка' : 'amoCRM · контакт',
            entityName,
            connectionId,
            `${entityName}.${action}`,
            r,
          );
          await this.notesService.create(
            tenantId,
            {
              entityType: EntityType.LEAD,
              entityId: lead.id,
              content: lines,
              title: kind === 'lead' ? 'amoCRM · сделка' : 'amoCRM · контакт',
              type: NoteType.NOTE,
              metadata: {
                channel: 'amocrm_inbound',
                connectionId,
                amoEntity: entityName,
                amoAction: action,
                amoId: r.id != null ? String(r.id) : null,
              },
            },
            undefined,
            'amoCRM',
          );
        } catch (e) {
          this.log.warn(
            `amoCRM inbound: skip row ${entityName}.${action}: ${(e as Error).message}`,
          );
        }
      }
    }
  }

  private async processUnsorted(
    tenantId: string,
    connectionId: string,
    connectionName: string,
    root: unknown,
  ): Promise<void> {
    const R = asRecord(root);
    for (const [action, block] of Object.entries(R)) {
      if (action === 'delete') continue;
      const rows = this.materializeRows(block);
      for (const row of rows) {
        const r = this.flattenRow(row);
        if (!r) continue;
        try {
          const source = r.source != null ? String(r.source) : '';
          const sd = r.source_data;
          let name = '';
          let phone = '';
          let email = '';
          if (sd && typeof sd === 'object') {
            for (const v of Object.values(sd as object)) {
              if (!v || typeof v !== 'object') continue;
              const o = v as Record<string, unknown>;
              const n = String(o.name || '').toLowerCase();
              const val = o.value != null ? String(o.value).trim() : '';
              if (!val) continue;
              if (o.type === 'text' && (n.includes('имя') || n.includes('фио') || n === 'name')) {
                name = name || val;
              }
              if (
                o.type === 'multitext' &&
                (n.includes('телеф') || n.includes('phone') || n.includes('mobile'))
              ) {
                phone = phone || val;
              }
              if (o.type === 'multitext' && (n.includes('email') || n.includes('почт'))) {
                email = email || val;
              }
            }
          }
          const cf: unknown[] = [];
          if (phone) {
            cf.push({ code: 'PHONE', name: 'Телефон', values: [{ value: phone }] });
          }
          if (email) {
            cf.push({ code: 'EMAIL', name: 'Email', values: [{ value: email }] });
          }
          const synthetic: Record<string, unknown> = {
            ...r,
            id: r.uid != null ? String(r.uid) : `unsorted-${Date.now()}`,
            name: name || source || 'Неразобранное',
            custom_fields: cf.length ? cf : ((r.custom_fields as unknown[]) ?? []),
          };
          const lead = await this.ensureLeadForAmoRow(
            tenantId,
            connectionId,
            synthetic,
            'unsorted',
          );
          const lines = this.buildNoteLines(
            'amoCRM · неразобранное',
            connectionName,
            connectionId,
            `unsorted.${action}`,
            r,
          );
          await this.notesService.create(
            tenantId,
            {
              entityType: EntityType.LEAD,
              entityId: lead.id,
              content: lines,
              title: 'amoCRM · неразобранное',
              type: NoteType.NOTE,
              metadata: {
                channel: 'amocrm_inbound',
                connectionId,
                amoEntity: 'unsorted',
                amoAction: action,
              },
            },
            undefined,
            'amoCRM',
          );
        } catch (e) {
          this.log.warn(`amoCRM inbound: unsorted skip: ${(e as Error).message}`);
        }
      }
    }
  }

  async handleInbound(
    connectionId: string,
    headers: Record<string, string | string[] | undefined>,
    query: Record<string, string | string[] | undefined>,
    body: unknown,
  ): Promise<void> {
    const row = await this.loadAmocrmConnection(connectionId);
    if (!row) {
      this.log.warn(`amoCRM webhook: connection ${connectionId} not found or not amocrm`);
      return;
    }
    const { entity, cfg } = row;
    const tenantId = entity.tenantId;
    const provided = this.extractProvidedSecret(headers, query);
    if (!this.verifySecretIfConfigured(cfg, provided)) {
      this.log.warn(`amoCRM webhook: secret mismatch for ${connectionId}`);
      return;
    }

    let payload: Record<string, unknown> = asRecord(body);
    if (Object.keys(payload).length === 1) {
      const only = Object.values(payload)[0];
      if (typeof only === 'string') {
        try {
          payload = asRecord(JSON.parse(only));
        } catch {
          /* keep */
        }
      }
    }

    try {
      if (payload.leads) {
        await this.processEntityRoot(
          tenantId,
          connectionId,
          entity.name,
          payload.leads,
          'lead',
        );
      }
      if (payload.contacts) {
        await this.processEntityRoot(
          tenantId,
          connectionId,
          entity.name,
          payload.contacts,
          'contact',
        );
      }
      if (payload.unsorted) {
        await this.processUnsorted(tenantId, connectionId, entity.name, payload.unsorted);
      }
    } catch (e) {
      this.log.warn(`amoCRM inbound: ${(e as Error).message}`);
    }
  }
}
