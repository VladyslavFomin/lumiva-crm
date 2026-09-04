import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IntegrationConnection } from '../integration-connection.entity';
import { Lead } from '../../leads/lead.entity';
import { LeadsService } from '../../leads/leads.service';
import { NotesService } from '../../notes/notes.service';
import { EntityType, NoteType } from '../../notes/dto/create-note.dto';
import { BitrixRestService } from './bitrix-rest.service';

type BitrixCfg = {
  catalogId?: string;
  /** Базовый URL входящего вебхука (…/rest/1/код/) — используется, чтобы дозапросить детали лида */
  webhookUrl?: string;
  /** Секрет в query ?secret= — из настроек исходящего вебхука Bitrix24 добавляется прямо в URL */
  bitrixWebhookSecret?: string;
};

function parseCfg(entity: IntegrationConnection): BitrixCfg | null {
  if (!entity.configJson) return null;
  try {
    return JSON.parse(entity.configJson) as BitrixCfg;
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

/**
 * Входящие исходящие вебхуки Bitrix24 (ONCRMLEADADD / ONCRMLEADUPDATE) содержат только ID
 * изменённого лида (data[FIELDS][ID]) — за деталями (имя/телефон/статус) нужно дозапросить
 * crm.lead.get через тот же входящий REST-вебхук, что использует и исходящая интеграция.
 * Находит/обновляет уже привязанный лид CRM по meta.bitrixLeadId — не плодит дубликаты при
 * повторных событиях по тому же Bitrix-лиду (тот же принцип, что и у amoCRM/Jira inbound).
 */
@Injectable()
export class BitrixInboundWebhookService {
  private readonly log = new Logger(BitrixInboundWebhookService.name);

  constructor(
    @InjectRepository(IntegrationConnection)
    private readonly integrationRepo: Repository<IntegrationConnection>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    private readonly leadsService: LeadsService,
    private readonly notesService: NotesService,
    private readonly bitrixRest: BitrixRestService,
  ) {}

  extractProvidedSecret(
    headers: Record<string, string | string[] | undefined>,
    query: Record<string, string | string[] | undefined>,
  ): string {
    const q = query['secret'];
    if (typeof q === 'string' && q.trim()) return q.trim();
    const x = headers['x-lumiva-secret'];
    return typeof x === 'string' ? x.trim() : '';
  }

  async loadBitrixConnection(
    connectionId: string,
  ): Promise<{ entity: IntegrationConnection; cfg: BitrixCfg } | null> {
    const entity = await this.integrationRepo.findOne({
      where: { id: connectionId, isDeleted: false, isEnabled: true } as any,
    });
    if (!entity || entity.kind !== 'third_party_link') return null;
    const cfg = parseCfg(entity);
    if (!cfg || cfg.catalogId !== 'bitrix') return null;
    return { entity, cfg };
  }

  verifySecretIfConfigured(cfg: BitrixCfg, provided: string): boolean {
    const expected = String(cfg.bitrixWebhookSecret || '').trim();
    if (!expected) return true;
    return provided === expected;
  }

  private normalizeDigits(phone: string): string {
    return String(phone || '').replace(/\D/g, '');
  }

  private async findLeadByBitrixId(tenantId: string, bitrixLeadId: string): Promise<Lead | null> {
    if (!bitrixLeadId) return null;
    return this.leadRepo
      .createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere("l.meta->>'bitrixLeadId' = :bitrixLeadId", { bitrixLeadId })
      .orderBy('l.updatedAt', 'DESC')
      .getOne();
  }

  private async findLeadByPhoneDigits(tenantId: string, digits: string): Promise<Lead | null> {
    if (!digits) return null;
    return this.leadRepo
      .createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere("regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g') = :digits", { digits })
      .orderBy('l.updatedAt', 'DESC')
      .getOne();
  }

  /** Bitrix MULTIFIELD (PHONE/EMAIL) — массив {VALUE, VALUE_TYPE}. Берём первое значение. */
  private extractMultifield(fields: Record<string, unknown>, key: string): string {
    const arr = fields[key];
    if (!Array.isArray(arr) || !arr.length) return '';
    const v0 = arr[0];
    if (v0 && typeof v0 === 'object' && 'VALUE' in (v0 as object)) {
      return String((v0 as Record<string, unknown>).VALUE ?? '').trim();
    }
    return '';
  }

  private async fetchLeadDetails(
    webhookBase: string,
    bitrixLeadId: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      const res = await this.bitrixRest.callMethod(webhookBase, 'crm.lead.get', {
        ID: bitrixLeadId,
      });
      const fields = (res as { result?: Record<string, unknown> })?.result;
      return fields && typeof fields === 'object' ? fields : null;
    } catch (e) {
      this.log.warn(`Bitrix crm.lead.get failed for ${bitrixLeadId}: ${(e as Error).message}`);
      return null;
    }
  }

  private async ensureLeadForBitrixRow(
    tenantId: string,
    connectionId: string,
    bitrixLeadId: string,
    fields: Record<string, unknown>,
  ): Promise<Lead> {
    const nameParts = [fields.NAME, fields.LAST_NAME].filter(Boolean).map(String);
    const title = fields.TITLE != null ? String(fields.TITLE).trim() : '';
    const phone = this.extractMultifield(fields, 'PHONE');
    const email = this.extractMultifield(fields, 'EMAIL');
    const digits = this.normalizeDigits(phone);

    let lead = await this.findLeadByBitrixId(tenantId, bitrixLeadId);
    if (!lead && digits) {
      lead = await this.findLeadByPhoneDigits(tenantId, digits);
    }

    const displayName =
      nameParts.join(' ').trim() ||
      title ||
      (email ? email.split('@')[0] : '') ||
      (digits ? `+${digits}` : `Bitrix24 #${bitrixLeadId}`);

    if (!lead) {
      const phoneE164 = digits ? `+${digits}` : undefined;
      lead = await this.leadsService.createForTenant(tenantId, {
        name: displayName,
        ...(phoneE164 ? { phone: phoneE164 } : {}),
        ...(email ? { email } : {}),
        source: 'bitrix24',
        status: 'new',
        meta: {
          bitrixLeadId,
          bitrixInboundConnectionId: connectionId,
        },
      });
      if (!(lead.meta && (lead.meta as any).bitrixLeadId)) {
        lead.meta = { ...(lead.meta || {}), bitrixLeadId };
        await this.leadRepo.save(lead);
      }
    } else {
      const prev = (lead.meta || {}) as Record<string, unknown>;
      if (String(prev.bitrixLeadId || '') !== bitrixLeadId) {
        lead.meta = { ...prev, bitrixLeadId };
        await this.leadRepo.save(lead);
      }
    }

    return lead;
  }

  async handleInbound(
    connectionId: string,
    headers: Record<string, string | string[] | undefined>,
    query: Record<string, string | string[] | undefined>,
    body: unknown,
  ): Promise<void> {
    const row = await this.loadBitrixConnection(connectionId);
    if (!row) {
      this.log.warn(`Bitrix webhook: connection ${connectionId} not found or not bitrix`);
      return;
    }
    const { entity, cfg } = row;
    const tenantId = entity.tenantId;
    const provided = this.extractProvidedSecret(headers, query);
    if (!this.verifySecretIfConfigured(cfg, provided)) {
      this.log.warn(`Bitrix webhook: secret mismatch for ${connectionId}`);
      return;
    }

    const payload = asRecord(body);
    const event = String(payload.event || '').toUpperCase();
    if (event !== 'ONCRMLEADADD' && event !== 'ONCRMLEADUPDATE') {
      // Другие события (deal/contact/task и т.п.) пока не обрабатываем — см. приоритизацию.
      return;
    }
    const data = asRecord(payload.data);
    const fieldsBlock = asRecord(data.FIELDS);
    const bitrixLeadId = fieldsBlock.ID != null ? String(fieldsBlock.ID) : '';
    if (!bitrixLeadId) {
      this.log.warn(`Bitrix webhook ${event}: no data[FIELDS][ID] in payload`);
      return;
    }

    const webhookBase = String(cfg.webhookUrl || '').trim();
    if (!webhookBase) {
      this.log.warn(`Bitrix webhook: connection ${connectionId} has no webhookUrl to fetch lead details`);
      return;
    }

    const fields = await this.fetchLeadDetails(webhookBase, bitrixLeadId);
    if (!fields) return;

    try {
      const lead = await this.ensureLeadForBitrixRow(tenantId, connectionId, bitrixLeadId, fields);
      const statusId = fields.STATUS_ID != null ? String(fields.STATUS_ID) : '';
      const opportunity = fields.OPPORTUNITY != null ? String(fields.OPPORTUNITY) : '';
      const lines = [
        'Bitrix24 · лид',
        `Подключение: ${entity.name} (${connectionId.slice(0, 8)}…)`,
        `Событие: ${event}`,
        `Bitrix ID: ${bitrixLeadId}`,
        fields.TITLE ? `Название: ${String(fields.TITLE)}` : null,
        statusId ? `STATUS_ID: ${statusId}` : null,
        opportunity ? `Сумма: ${opportunity}` : null,
      ]
        .filter((x) => x != null)
        .join('\n');
      await this.notesService.create(
        tenantId,
        {
          entityType: EntityType.LEAD,
          entityId: lead.id,
          content: lines,
          title: 'Bitrix24 · лид',
          type: NoteType.NOTE,
          metadata: { channel: 'bitrix_inbound', connectionId, bitrixEvent: event, bitrixLeadId },
        },
        undefined,
        'Bitrix24',
      );
    } catch (e) {
      this.log.warn(`Bitrix inbound: ${(e as Error).message}`);
    }
  }
}
