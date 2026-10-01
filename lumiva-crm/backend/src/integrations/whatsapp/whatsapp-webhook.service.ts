import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IntegrationConnection } from '../integration-connection.entity';
import { WhatsappCrmService } from '../../whatsapp-crm/whatsapp-crm.service';

type WaCfg = {
  catalogId?: string;
  apiToken?: string;
  phoneNumberId?: string;
  webhookVerifyToken?: string;
  /** App Secret приложения Meta — ключ HMAC для заголовка X-Hub-Signature-256 */
  appSecret?: string;
};

@Injectable()
export class WhatsappWebhookService {
  private readonly log = new Logger(WhatsappWebhookService.name);

  constructor(
    @InjectRepository(IntegrationConnection)
    private readonly integrationRepo: Repository<IntegrationConnection>,
    private readonly whatsappCrmService: WhatsappCrmService,
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

  /**
   * Подлинность входящего вебхука: Meta подписывает каждое POST-уведомление HMAC-SHA256 от сырого
   * тела с ключом App Secret. Раньше подпись не проверялась вовсе — любой, кто знает URL вебхука
   * (в нём только id подключения), мог слать поддельные «сообщения клиентов», и CRM заводила по
   * ним контакты и лиды. Без App Secret в подключении входящие не принимаются (fail closed).
   */
  async verifySignature(connectionId: string, rawBody: Buffer | undefined, header: string | undefined): Promise<boolean> {
    const row = await this.loadWhatsappConnection(connectionId);
    if (!row) return false;
    const secret = String(row.cfg.appSecret || '').trim();
    if (!secret) {
      this.log.warn(`WhatsApp webhook ${connectionId}: rejected — no App Secret in connection settings`);
      return false;
    }
    if (!rawBody?.length || !header?.startsWith('sha256=')) return false;
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest();
    const got = Buffer.from(header.slice('sha256='.length).trim(), 'hex');
    return got.length === expected.length && crypto.timingSafeEqual(got, expected);
  }

  private normalizeDigits(phone: string): string {
    return String(phone || '').replace(/\D/g, '');
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
        const statuses = Array.isArray((value as any).statuses) ? (value as any).statuses : [];
        // Без текста и номеров — только что пришло, чтобы при «сообщение не дошло до CRM» было видно,
        // присылала ли Meta вообще входящее или только статусы доставки исходящих.
        this.log.log(
          `WhatsApp webhook ${connectionId}: ${messages.length} message(s) [${messages.map((m: any) => m?.type).join(',')}], ` +
            `${statuses.length} status(es) [${statuses.map((s: any) => s?.status).join(',')}]`,
        );
        for (const msg of messages) {
          if (!msg || typeof msg !== 'object') continue;
          const from = String((msg as any).from || '').trim();
          const digits = this.normalizeDigits(from);
          if (!digits) continue;
          const type = String((msg as any).type || 'text');
          let textBody: string | null = null;
          if (type === 'text' && (msg as any).text && typeof (msg as any).text === 'object') {
            textBody = String((msg as any).text.body || '').trim();
          }
          const waName =
            (value as any).contacts &&
            Array.isArray((value as any).contacts) &&
            (value as any).contacts[0]?.profile?.name
              ? String((value as any).contacts[0].profile.name)
              : '';
          const displayPhone =
            meta && typeof meta === 'object' ? String(meta.display_phone_number || '') : '';
          const timestampRaw = (msg as any).timestamp;
          const timestamp = timestampRaw != null ? parseInt(String(timestampRaw), 10) : null;

          await this.whatsappCrmService.recordInboundMessage(tenantId, connectionId, {
            waMessageId: String((msg as any).id ?? ''),
            fromDigits: digits,
            profileName: waName || null,
            type,
            text: textBody,
            displayPhone: displayPhone || null,
            timestamp: Number.isFinite(timestamp) ? timestamp : null,
            raw: msg,
          });
        }
      }
    }
  }
}
