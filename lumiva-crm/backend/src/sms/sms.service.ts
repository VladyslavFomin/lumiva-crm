import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { SmsConfig, SmsProvider, TwilioCredentials, SmscCredentials, SmsruCredentials } from './sms-config.entity';
import { SmsMessage, SmsEntityType } from './sms-message.entity';
import { SendSmsDto } from './dto/send-sms.dto';
import { SaveSmsConfigDto } from './dto/save-sms-config.dto';

export interface SmsListQuery {
  entityType?: SmsEntityType;
  entityId?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class SmsService {
  constructor(
    @InjectRepository(SmsConfig)
    private readonly configRepo: Repository<SmsConfig>,
    @InjectRepository(SmsMessage)
    private readonly messageRepo: Repository<SmsMessage>,
  ) {}

  // ─── Config ───────────────────────────────────────────────────────────────

  async getConfig(tenantId: string): Promise<SmsConfig | null> {
    return this.configRepo.findOne({ where: { tenantId } });
  }

  async saveConfig(tenantId: string, dto: SaveSmsConfigDto): Promise<SmsConfig> {
    let config = await this.configRepo.findOne({ where: { tenantId } });
    if (!config) {
      config = this.configRepo.create({ tenantId });
    }
    config.provider = dto.provider;
    config.credentials = dto.credentials as any;
    if (dto.senderName !== undefined) config.senderName = dto.senderName ?? null;
    if (dto.isEnabled !== undefined) config.isEnabled = dto.isEnabled;
    return this.configRepo.save(config);
  }

  async deleteConfig(tenantId: string): Promise<void> {
    await this.configRepo.delete({ tenantId });
  }

  // ─── Send ─────────────────────────────────────────────────────────────────

  async send(
    tenantId: string,
    dto: SendSmsDto,
    sentByUserId?: string,
  ): Promise<SmsMessage> {
    const config = await this.configRepo.findOne({ where: { tenantId, isEnabled: true } });
    if (!config) {
      throw new BadRequestException('SMS не настроен. Добавьте настройки в Интеграции → SMS.');
    }

    const record = this.messageRepo.create({
      tenantId,
      direction: 'outbound',
      toPhone: dto.to,
      body: dto.body,
      status: 'pending',
      provider: config.provider,
      entityType: dto.entityType ?? null,
      entityId: dto.entityId ?? null,
      sentByUserId: sentByUserId ?? null,
    });
    await this.messageRepo.save(record);

    try {
      const result = await this.dispatch(config, dto.to, dto.body);
      record.externalId = result.externalId ?? null;
      record.status = 'sent';
      if (result.cost != null) {
        record.cost = Math.abs(result.cost);
        record.costUnit = result.costUnit ?? null;
      }
    } catch (err: any) {
      record.status = 'failed';
      record.meta = { error: String(err?.message || err) };
    }

    return this.messageRepo.save(record);
  }

  /** Внутренний метод для вызова из AutomationsService без userId */
  async sendFromAutomation(
    tenantId: string,
    to: string,
    body: string,
    entityType?: SmsEntityType,
    entityId?: string,
  ): Promise<SmsMessage> {
    return this.send(tenantId, { to, body, entityType, entityId });
  }

  private async dispatch(
    config: SmsConfig,
    to: string,
    body: string,
  ): Promise<{ externalId?: string; cost?: number; costUnit?: string }> {
    switch (config.provider) {
      case 'twilio': return this.sendTwilio(config.credentials as TwilioCredentials, to, body);
      case 'smsc':   return this.sendSmsc(config.credentials as SmscCredentials, to, body);
      case 'smsru':  return this.sendSmsru(config.credentials as SmsruCredentials, to, body);
      default:
        throw new BadRequestException(`Неизвестный SMS провайдер: ${config.provider}`);
    }
  }

  // ─── Twilio ───────────────────────────────────────────────────────────────

  private async sendTwilio(
    creds: TwilioCredentials,
    to: string,
    body: string,
  ): Promise<{ externalId: string; cost?: number; costUnit?: string }> {
    const { accountSid, authToken, fromPhone } = creds;
    if (!accountSid || !authToken || !fromPhone) {
      throw new BadRequestException('Twilio: не заполнены accountSid, authToken или fromPhone');
    }
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const params = new URLSearchParams({ To: to, From: fromPhone, Body: body });
    const res = await axios.post(url, params.toString(), {
      auth: { username: accountSid, password: authToken },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
      validateStatus: () => true,
    });
    const data = res.data as any;
    if (res.status >= 400 || data?.status === 'failed') {
      throw new Error(`Twilio ${res.status}: ${data?.message || data?.error_message || JSON.stringify(data).slice(0, 300)}`);
    }
    const cost = data.price != null ? Math.abs(parseFloat(data.price)) : undefined;
    return { externalId: data.sid, cost: isNaN(cost as number) ? undefined : cost, costUnit: data.price_unit ?? undefined };
  }

  // ─── SMSC.ru ──────────────────────────────────────────────────────────────

  private async sendSmsc(
    creds: SmscCredentials,
    to: string,
    body: string,
  ): Promise<{ externalId: string; cost?: number; costUnit?: string }> {
    const { login, password, sender } = creds;
    if (!login || !password) {
      throw new BadRequestException('SMSC: не заполнены login или password');
    }
    const params = new URLSearchParams({
      login, psw: password, phones: to, mes: body,
      fmt: '3', charset: 'utf-8', cost: '1',
      ...(sender ? { sender } : {}),
    });
    const res = await axios.get(`https://smsc.ru/sys/send.php?${params.toString()}`, {
      timeout: 15000, validateStatus: () => true,
    });
    const data = res.data as any;
    if (data?.error_code) throw new Error(`SMSC ошибка ${data.error_code}: ${data.error}`);
    const cost = data.cost != null ? parseFloat(data.cost) : undefined;
    return { externalId: String(data?.id ?? ''), cost: isNaN(cost as number) ? undefined : cost, costUnit: 'RUB' };
  }

  // ─── SMS.ru ───────────────────────────────────────────────────────────────

  private async sendSmsru(
    creds: SmsruCredentials,
    to: string,
    body: string,
  ): Promise<{ externalId: string; cost?: number; costUnit?: string }> {
    const { apiId, from } = creds;
    if (!apiId) throw new BadRequestException('SMS.ru: не заполнен api_id');
    const params = new URLSearchParams({
      api_id: apiId, to, msg: body, json: '1',
      ...(from ? { from } : {}),
    });
    const res = await axios.post('https://sms.ru/sms/send', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000, validateStatus: () => true,
    });
    const data = res.data as any;
    if (data?.status !== 'OK') throw new Error(`SMS.ru: ${data?.status_text || JSON.stringify(data).slice(0, 200)}`);
    const first = Object.values(data?.sms || {})[0] as any;
    const cost = first?.cost != null ? parseFloat(first.cost) : undefined;
    return { externalId: String(first?.sms_id ?? ''), cost: isNaN(cost as number) ? undefined : cost, costUnit: 'RUB' };
  }

  // ─── Query ────────────────────────────────────────────────────────────────

  async findMessages(
    tenantId: string,
    query: SmsListQuery = {},
  ): Promise<{ items: SmsMessage[]; total: number }> {
    const qb = this.messageRepo
      .createQueryBuilder('m')
      .where('m.tenantId = :tenantId', { tenantId })
      .orderBy('m.createdAt', 'DESC');

    if (query.entityType) qb.andWhere('m.entityType = :et', { et: query.entityType });
    if (query.entityId) qb.andWhere('m.entityId = :eid', { eid: query.entityId });

    const total = await qb.getCount();
    qb.take(query.limit ?? 50).skip(query.offset ?? 0);
    const items = await qb.getMany();
    return { items, total };
  }

  async findOne(tenantId: string, id: string): Promise<SmsMessage> {
    const msg = await this.messageRepo.findOne({ where: { tenantId, id } });
    if (!msg) throw new NotFoundException('SMS сообщение не найдено');
    return msg;
  }
}
