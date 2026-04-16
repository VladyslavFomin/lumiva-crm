import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IntegrationConnection } from '../integration-connection.entity';
import { Lead } from '../../leads/lead.entity';
import { LeadsService } from '../../leads/leads.service';
import { NotesService } from '../../notes/notes.service';
import { EntityType, NoteType } from '../../notes/dto/create-note.dto';

type WaCfg = {
  catalogId?: string;
  apiToken?: string;
  phoneNumberId?: string;
  webhookVerifyToken?: string;
};

@Injectable()
export class WhatsappWebhookService {
  private readonly log = new Logger(WhatsappWebhookService.name);

  constructor(
    @InjectRepository(IntegrationConnection)
    private readonly integrationRepo: Repository<IntegrationConnection>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    private readonly leadsService: LeadsService,
    private readonly notesService: NotesService,
  ) {}

  parseConfig(entity: IntegrationConnection): WaCfg | null {
    if (!entity.configJson) return null;
    try {
      return JSON.parse(entity.configJson) as WaCfg;
    } catch {
      return null;
    }
  }

  async loadWhatsappConnection(
    connectionId: string,
  ): Promise<{ entity: IntegrationConnection; cfg: WaCfg } | null> {
    const entity = await this.integrationRepo.findOne({
      where: { id: connectionId, isDeleted: false, isEnabled: true } as any,
    });
    if (!entity || entity.kind !== 'third_party_link') return null;
    const cfg = this.parseConfig(entity);
    if (!cfg || cfg.catalogId !== 'whatsapp') return null;
    return { entity, cfg };
  }

  async verifyTokenOrThrow(connectionId: string, token: string): Promise<void> {
    const row = await this.loadWhatsappConnection(connectionId);
    if (!row) throw new Error('Connection not found');
    const expected = String(row.cfg.webhookVerifyToken || '').trim();
    if (!expected || token !== expected) {
      throw new Error('Verify token mismatch');
    }
  }

  async verifyAndReturnChallenge(
    connectionId: string,
    query: Record<string, string | string[] | undefined>,
  ): Promise<string> {
    const mode = String(query['hub.mode'] ?? '');
    const token = String(query['hub.verify_token'] ?? '');
    const challenge = String(query['hub.challenge'] ?? '');
    if (mode !== 'subscribe' || !challenge) {
      throw new Error('Invalid verification request');
    }
    await this.verifyTokenOrThrow(connectionId, token);
    return challenge;
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

  async handleInbound(connectionId: string, body: unknown): Promise<void> {
    const row = await this.loadWhatsappConnection(connectionId);
    if (!row) {
      this.log.warn(`WhatsApp webhook: connection ${connectionId} not found or not whatsapp`);
      return;
    }
    const { entity, cfg } = row;
    const tenantId = entity.tenantId;
    const expectedPnId = String(cfg.phoneNumberId || '').trim();
    if (!expectedPnId) {
      this.log.warn(`WhatsApp webhook: no phoneNumberId on connection ${connectionId}`);
      return;
    }

    const root = body as Record<string, unknown>;
    const entries = Array.isArray(root.entry) ? root.entry : [];
    for (const ent of entries) {
      if (!ent || typeof ent !== 'object') continue;
      const changes = Array.isArray((ent as any).changes) ? (ent as any).changes : [];
      for (const ch of changes) {
        if (!ch || typeof ch !== 'object') continue;
        const field = String((ch as any).field || '');
        if (field !== 'messages') continue;
        const value = (ch as any).value;
        if (!value || typeof value !== 'object') continue;
        const meta = (value as any).metadata;
        const pnId = meta && typeof meta === 'object' ? String(meta.phone_number_id || '').trim() : '';
        if (pnId && pnId !== expectedPnId) {
          this.log.warn(
            `WhatsApp webhook: phone_number_id ${pnId} does not match connection ${connectionId}`,
          );
          continue;
        }
        const messages = Array.isArray((value as any).messages) ? (value as any).messages : [];
        for (const msg of messages) {
          if (!msg || typeof msg !== 'object') continue;
          const from = String((msg as any).from || '').trim();
          const digits = this.normalizeDigits(from);
          if (!digits) continue;
          const type = String((msg as any).type || 'text');
          let textBody = '';
          if (type === 'text' && (msg as any).text && typeof (msg as any).text === 'object') {
            textBody = String((msg as any).text.body || '').trim();
          } else {
            textBody = `[${type}]`;
          }
          const waName =
            (value as any).contacts &&
            Array.isArray((value as any).contacts) &&
            (value as any).contacts[0]?.profile?.name
              ? String((value as any).contacts[0].profile.name)
              : '';
          const displayPhone =
            meta && typeof meta === 'object' ? String(meta.display_phone_number || '') : '';

          let lead = await this.findLeadByPhoneDigits(tenantId, digits);
          if (!lead) {
            lead = await this.leadsService.createForTenant(tenantId, {
              name: waName || `WhatsApp +${digits}`,
              phone: from.startsWith('+') ? from : `+${digits}`,
              source: 'whatsapp',
              status: 'new',
            });
          }

          const lines = [
            'Входящее сообщение WhatsApp',
            displayPhone ? `Линия: ${displayPhone}` : null,
            waName ? `Имя в WhatsApp: ${waName}` : null,
            '',
            textBody || '(пустое тело)',
          ]
            .filter((x) => x != null)
            .join('\n');

          await this.notesService.create(
            tenantId,
            {
              entityType: EntityType.LEAD,
              entityId: lead.id,
              content: lines,
              title: 'WhatsApp · входящее',
              type: NoteType.NOTE,
              metadata: {
                channel: 'whatsapp_inbound',
                messageId: (msg as any).id ?? null,
                connectionId,
              },
            },
            undefined,
            'WhatsApp',
          );
        }
      }
    }
  }
}
