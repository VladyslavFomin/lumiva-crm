// src/telephony/telephony.service.ts
import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, MoreThanOrEqual, Repository } from 'typeorm';
import { ModuleRef } from '@nestjs/core';
import axios from 'axios';
import { Tenant } from '../tenants/tenant.entity';
import { TelephonyConfig } from './telephony-config.entity';
import { Call, CallStatus } from './call.entity';
import { validateTwilioSignature } from '../common/twilio-signature.util';
import { isTelephonyIncludedInPlan } from '../tenants/plan-entitlements';
import { SmsMessage } from '../sms/sms-message.entity';
import { StaffUser } from '../staff/staff-user.entity';

const RETENTION_YEARS = 3;
const TWILIO_API = 'https://api.twilio.com/2010-04-01';

type AiOpenAiService = import('../ai/ai-openai.service').AiOpenAiService;

@Injectable()
export class TelephonyService {
  private readonly log = new Logger(TelephonyService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(TelephonyConfig)
    private readonly configRepo: Repository<TelephonyConfig>,
    @InjectRepository(Call)
    private readonly callRepo: Repository<Call>,
    @InjectRepository(SmsMessage)
    private readonly smsMessageRepo: Repository<SmsMessage>,
    @InjectRepository(StaffUser)
    private readonly staffRepo: Repository<StaffUser>,
    private readonly moduleRef: ModuleRef,
  ) {}

  // Lazy accessor — same reason telegram-crm.service.ts does this: avoids a circular module
  // import with AiModule at boot time.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  private oai(): AiOpenAiService { return this.moduleRef.get(require('../ai/ai-openai.service').AiOpenAiService, { strict: false }); }

  // ─── Add-on gate ────────────────────────────────────────────────────────────

  async assertAddonEnabled(tenantId: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!tenant.telephonyAddonEnabled && !isTelephonyIncludedInPlan(tenant.plan)) {
      throw new ForbiddenException('Telephony is not enabled for this tenant — it is a paid add-on');
    }
    return tenant;
  }

  // ─── Config ───────────────────────────────────────────────────────────────

  async getConfig(tenantId: string): Promise<TelephonyConfig | null> {
    return this.configRepo.findOne({ where: { tenantId } });
  }

  async saveConfig(
    tenantId: string,
    dto: { accountSid?: string; authToken?: string; voiceNumber?: string; forwardToNumbers?: string[]; isEnabled?: boolean },
  ): Promise<TelephonyConfig> {
    let config = await this.configRepo.findOne({ where: { tenantId } });
    if (!config) config = this.configRepo.create({ tenantId });
    if (dto.accountSid !== undefined) config.accountSid = dto.accountSid || null;
    if (dto.authToken !== undefined) config.authToken = dto.authToken || null;
    if (dto.voiceNumber !== undefined) config.voiceNumber = dto.voiceNumber || null;
    if (dto.forwardToNumbers !== undefined) config.forwardToNumbers = dto.forwardToNumbers.filter(Boolean);
    if (dto.isEnabled !== undefined) config.isEnabled = dto.isEnabled;
    return this.configRepo.save(config);
  }

  async deleteConfig(tenantId: string): Promise<void> {
    await this.configRepo.delete({ tenantId });
  }

  private async requireConfig(tenantId: string): Promise<TelephonyConfig> {
    const config = await this.configRepo.findOne({ where: { tenantId, isEnabled: true } });
    if (!config?.accountSid || !config?.authToken || !config?.voiceNumber) {
      throw new BadRequestException('Telephony is not configured. Add Twilio settings in Настройки → Телефония.');
    }
    return config;
  }

  private twilioAuth(config: TelephonyConfig) {
    return { username: config.accountSid as string, password: config.authToken as string };
  }

  private publicBase(): string {
    return (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
  }

  // ─── Outbound click-to-call ───────────────────────────────────────────────

  /** "Call me, then connect me" flow: Twilio calls the staff member's own phone first; once they
   * pick up, `connectLegTwiml` bridges the call to `toNumber` and starts recording. No browser
   * WebRTC/mic access needed — the staff member's own phone rings like any other call. */
  async initiateCall(
    tenantId: string,
    staffUserId: string | undefined,
    toNumber: string,
    leadId?: string,
  ): Promise<Call> {
    await this.assertAddonEnabled(tenantId);
    const config = await this.requireConfig(tenantId);
    const connectTo = config.forwardToNumbers[0];
    if (!connectTo) {
      throw new BadRequestException('Add at least one staff number to call first (Настройки → Телефония)');
    }
    const base = this.publicBase();
    if (!base) throw new BadRequestException('PUBLIC_API_URL is not configured on the server');

    const voiceUrl = `${base}/v1/webhooks/telephony/connect/${tenantId}?to=${encodeURIComponent(toNumber)}${leadId ? `&leadId=${encodeURIComponent(leadId)}` : ''}`;
    const statusCallback = `${base}/v1/webhooks/telephony/status/${tenantId}`;

    const params = new URLSearchParams({
      To: connectTo,
      From: config.voiceNumber as string,
      Url: voiceUrl,
      StatusCallback: statusCallback,
      StatusCallbackEvent: 'initiated ringing answered completed',
      StatusCallbackMethod: 'POST',
    });

    const res = await axios.post(
      `${TWILIO_API}/Accounts/${config.accountSid}/Calls.json`,
      params.toString(),
      { auth: this.twilioAuth(config), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000, validateStatus: () => true },
    );
    if (res.status >= 300) {
      throw new BadRequestException(`Twilio: ${res.data?.message || JSON.stringify(res.data).slice(0, 300)}`);
    }

    return this.callRepo.save(this.callRepo.create({
      tenantId,
      direction: 'outbound',
      fromNumber: config.voiceNumber,
      toNumber,
      status: 'queued',
      twilioCallSid: res.data.sid,
      linkedLeadId: leadId || null,
      staffUserId: staffUserId || null,
    }));
  }

  /** TwiML for the connect leg — once the staff member answers, dial the real destination and record. */
  connectLegTwiml(tenantId: string, toNumber: string): string {
    const base = this.publicBase();
    const recCallback = `${base}/v1/webhooks/telephony/recording/${tenantId}`;
    const esc = (s: string) => s.replace(/&/g, '&amp;');
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial record="record-from-answer" recordingStatusCallback="${esc(recCallback)}" recordingStatusCallbackEvent="completed"><Number>${esc(toNumber)}</Number></Dial></Response>`;
  }

  /** TwiML for an inbound call — ring the tenant's configured staff numbers, record. */
  async inboundTwiml(tenantId: string): Promise<string> {
    const config = await this.configRepo.findOne({ where: { tenantId, isEnabled: true } });
    const base = this.publicBase();
    const recCallback = `${base}/v1/webhooks/telephony/recording/${tenantId}`;
    const esc = (s: string) => s.replace(/&/g, '&amp;');
    if (!config?.forwardToNumbers?.length) {
      return `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="ru-RU">Извините, сейчас никто не может ответить.</Say></Response>`;
    }
    const numbers = config.forwardToNumbers.map((n) => `<Number>${esc(n)}</Number>`).join('');
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial record="record-from-answer" recordingStatusCallback="${esc(recCallback)}" recordingStatusCallbackEvent="completed">${numbers}</Dial></Response>`;
  }

  // ─── Webhooks ─────────────────────────────────────────────────────────────

  async verifyWebhookSignature(
    tenantId: string,
    publicUrl: string,
    params: Record<string, string>,
    signature: string,
  ): Promise<boolean> {
    const config = await this.configRepo.findOne({ where: { tenantId } });
    if (!config?.authToken) return false;
    return validateTwilioSignature(config.authToken, publicUrl, params, signature);
  }

  async recordInboundCall(tenantId: string, params: Record<string, string>): Promise<void> {
    const callSid = params.CallSid;
    if (!callSid) return;
    const existing = await this.callRepo.findOne({ where: { tenantId, twilioCallSid: callSid } });
    if (existing) return;
    await this.callRepo.save(this.callRepo.create({
      tenantId,
      direction: 'inbound',
      fromNumber: params.From || null,
      toNumber: params.To || null,
      status: 'ringing',
      twilioCallSid: callSid,
      startedAt: new Date(),
    }));
  }

  async handleStatusCallback(tenantId: string, params: Record<string, string>): Promise<void> {
    const callSid = params.CallSid;
    if (!callSid) return;
    const call = await this.callRepo.findOne({ where: { tenantId, twilioCallSid: callSid } });
    if (!call) return;

    const twilioStatus = String(params.CallStatus || '').toLowerCase();
    const statusMap: Record<string, CallStatus> = {
      queued: 'queued', initiated: 'queued', ringing: 'ringing', 'in-progress': 'in-progress',
      completed: 'completed', busy: 'busy', failed: 'failed', 'no-answer': 'no-answer', canceled: 'canceled',
    };
    call.status = statusMap[twilioStatus] || call.status;
    if (params.CallDuration) call.durationSeconds = parseInt(params.CallDuration, 10) || null;
    if (call.status === 'completed' || call.status === 'busy' || call.status === 'failed' || call.status === 'no-answer' || call.status === 'canceled') {
      call.endedAt = new Date();
    }
    if (!call.startedAt && (call.status === 'in-progress' || call.status === 'completed')) call.startedAt = new Date();
    await this.callRepo.save(call);
  }

  async handleRecordingCallback(tenantId: string, params: Record<string, string>): Promise<void> {
    const callSid = params.CallSid;
    const recordingSid = params.RecordingSid;
    const recordingUrlBase = params.RecordingUrl;
    if (!callSid || String(params.RecordingStatus || '').toLowerCase() !== 'completed') return;

    const call = await this.callRepo.findOne({ where: { tenantId, twilioCallSid: callSid } });
    if (!call) return;

    call.recordingSid = recordingSid || null;
    call.recordingUrl = `/v1/telephony/calls/${call.id}/recording`;
    call.transcriptStatus = 'pending';
    await this.callRepo.save(call);

    if (!recordingUrlBase) return;
    try {
      const config = await this.configRepo.findOne({ where: { tenantId } });
      if (!config?.accountSid || !config?.authToken) return;
      const audioRes = await axios.get(`${recordingUrlBase}.mp3`, {
        auth: this.twilioAuth(config as TelephonyConfig),
        responseType: 'arraybuffer',
        timeout: 30000,
      });
      const buffer = Buffer.from(audioRes.data);
      const transcript = await this.oai().transcribeAudio(buffer, 'call.mp3');
      call.transcript = transcript || null;
      call.transcriptStatus = 'done';
    } catch (e: any) {
      this.log.warn(`Telephony transcription failed for call ${call.id}: ${e.message}`);
      call.transcriptStatus = 'failed';
    }
    await this.callRepo.save(call);

    if (call.transcriptStatus === 'done' && call.transcript?.trim()) {
      await this.analyzeSentiment(call);
    }
  }

  private static readonly SENTIMENT_VALUES = new Set(['positive', 'neutral', 'negative']);
  private static readonly TOPIC_VALUES = new Set(['pricing', 'scheduling', 'service_quality', 'technical_issue', 'wait_time', 'other']);

  /** Real AI classification of the call transcript — same OpenAI path as transcription, so it
   * inherits that service's current insufficient_quota outage until the platform key is topped up. */
  private async analyzeSentiment(call: Call): Promise<void> {
    call.sentimentStatus = 'pending';
    await this.callRepo.save(call);

    try {
      const result = await this.oai().chatCompletion({
        messages: [
          {
            role: 'system',
            content:
              'Ты — аналитик качества обслуживания в CRM. Тебе дают транскрипт телефонного разговора ' +
              'между сотрудником компании и клиентом. Оцени тональность разговора СО СТОРОНЫ КЛИЕНТА ' +
              '(доволен ли клиент) и определи одну наиболее релевантную тему разговора. ' +
              'Ответь СТРОГО в формате JSON без каких-либо пояснений: {"sentiment":"positive|neutral|negative","topic":"pricing|scheduling|service_quality|technical_issue|wait_time|other"}',
          },
          { role: 'user', content: call.transcript!.slice(0, 6000) },
        ],
      });
      const raw = (result.message.content || '').trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in AI response');
      const parsed = JSON.parse(jsonMatch[0]);
      const sentiment = String(parsed.sentiment || '').toLowerCase();
      const topic = String(parsed.topic || '').toLowerCase();
      if (!TelephonyService.SENTIMENT_VALUES.has(sentiment)) throw new Error(`Unexpected sentiment "${sentiment}"`);

      call.sentiment = sentiment as Call['sentiment'];
      call.sentimentTopic = TelephonyService.TOPIC_VALUES.has(topic) ? (topic as Call['sentimentTopic']) : 'other';
      call.sentimentStatus = 'done';
    } catch (e: any) {
      this.log.warn(`Telephony sentiment analysis failed for call ${call.id}: ${e.message}`);
      call.sentimentStatus = 'failed';
    }
    await this.callRepo.save(call);
  }

  /** Streams the recording audio from Twilio through our own API, so staff never need Twilio
   * credentials in the browser and recordings aren't re-hosted in our own storage. */
  async fetchRecordingAudio(tenantId: string, callId: string): Promise<{ buffer: Buffer; contentType: string }> {
    const call = await this.callRepo.findOne({ where: { id: callId, tenantId } });
    if (!call?.recordingSid) throw new NotFoundException('Recording not found');
    const config = await this.configRepo.findOne({ where: { tenantId } });
    if (!config?.accountSid || !config?.authToken) throw new BadRequestException('Telephony is not configured');
    const url = `${TWILIO_API}/Accounts/${config.accountSid}/Recordings/${call.recordingSid}.mp3`;
    const res = await axios.get(url, { auth: this.twilioAuth(config), responseType: 'arraybuffer', timeout: 30000 });
    return { buffer: Buffer.from(res.data), contentType: 'audio/mpeg' };
  }

  // ─── Query / tags / stats ───────────────────────────────────────────────────

  async findCalls(
    tenantId: string,
    options?: {
      search?: string;
      tag?: string;
      linkedLeadId?: string;
      /** 'missed' isn't a real direction in the schema — it's a status group (no-answer/busy/
       * failed/canceled) that the UI treats as a third bucket alongside inbound/outbound. */
      direction?: 'inbound' | 'outbound' | 'missed';
      limit?: number;
      offset?: number;
    },
  ): Promise<{ items: Call[]; total: number }> {
    const qb = this.callRepo.createQueryBuilder('c').where('c.tenantId = :tenantId', { tenantId });
    if (options?.search) {
      qb.andWhere('(c.transcript ILIKE :s OR c.fromNumber ILIKE :s OR c.toNumber ILIKE :s)', { s: `%${options.search}%` });
    }
    if (options?.tag) qb.andWhere(':tag = ANY(c.tags)', { tag: options.tag });
    if (options?.linkedLeadId) qb.andWhere('c.linkedLeadId = :leadId', { leadId: options.linkedLeadId });
    if (options?.direction === 'inbound' || options?.direction === 'outbound') {
      qb.andWhere('c.direction = :dir', { dir: options.direction });
    } else if (options?.direction === 'missed') {
      qb.andWhere('c.status IN (:...st)', { st: ['no-answer', 'busy', 'failed', 'canceled'] });
    }
    const total = await qb.getCount();
    qb.orderBy('c.createdAt', 'DESC').take(options?.limit ?? 50).skip(options?.offset ?? 0);
    return { items: await qb.getMany(), total };
  }

  async updateTags(tenantId: string, callId: string, tags: string[]): Promise<Call> {
    const call = await this.callRepo.findOne({ where: { id: callId, tenantId } });
    if (!call) throw new NotFoundException('Call not found');
    call.tags = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
    return this.callRepo.save(call);
  }

  async getStats(
    tenantId: string,
    days = 30,
  ): Promise<{
    totalCalls: number;
    avgDurationSeconds: number;
    pickupRate: number;
    missedCalls: number;
    recordedCalls: number;
  }> {
    const since = new Date(Date.now() - days * 86400000);
    const missedStatuses = ['no-answer', 'busy', 'failed', 'canceled'];
    const [rows, recordedCalls] = await Promise.all([
      this.callRepo.createQueryBuilder('c')
        .select('c.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .addSelect('AVG(c.durationSeconds)', 'avgDuration')
        .where('c.tenantId = :tenantId', { tenantId })
        .andWhere('c.createdAt >= :since', { since })
        .groupBy('c.status')
        .getRawMany<{ status: string; count: string; avgDuration: string | null }>(),
      this.callRepo.createQueryBuilder('c')
        .where('c.tenantId = :tenantId', { tenantId })
        .andWhere('c.createdAt >= :since', { since })
        .andWhere('c.recordingUrl IS NOT NULL')
        .getCount(),
    ]);

    let totalCalls = 0;
    let answered = 0;
    let missedCalls = 0;
    let durationSum = 0;
    let durationCount = 0;
    for (const row of rows) {
      const n = parseInt(row.count, 10);
      totalCalls += n;
      if (row.status === 'completed') {
        answered += n;
        if (row.avgDuration) { durationSum += parseFloat(row.avgDuration) * n; durationCount += n; }
      }
      if (missedStatuses.includes(row.status)) missedCalls += n;
    }
    return {
      totalCalls,
      avgDurationSeconds: durationCount ? Math.round(durationSum / durationCount) : 0,
      pickupRate: totalCalls ? Math.round((answered / totalCalls) * 1000) / 10 : 0,
      missedCalls,
      recordedCalls,
    };
  }

  /**
   * Combined calls+SMS analytics for the merged "SMS и телефония" section. Not behind
   * `TelephonyAddonGuard` — SMS metrics must stay visible for tenants without the telephony
   * add-on, so this returns `telephonyEnabled` and zeroes out the call-only slices itself instead
   * of the whole endpoint being blocked.
   */
  async getAnalytics(
    tenantId: string,
    days = 30,
  ): Promise<{
    telephonyEnabled: boolean;
    kpis: {
      totalCalls: number;
      totalSms: number;
      pickupRate: number;
      smsDeliveryRate: number;
      avgCallDurationSeconds: number;
    };
    dailySeries: Array<{ date: string; calls: number; sms: number }>;
    hourlyLoad: Array<{ hour: number; count: number }>;
    byManager: Array<{ staffUserId: string | null; name: string; calls: number; sms: number }>;
    sentiment: {
      positive: number;
      neutral: number;
      negative: number;
      analyzed: number;
      topNegativeTopics: Array<{ topic: string; count: number }>;
    };
  }> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const telephonyEnabled = !!tenant?.telephonyAddonEnabled || isTelephonyIncludedInPlan(tenant?.plan);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const calls = telephonyEnabled
      ? await this.callRepo.find({ where: { tenantId, createdAt: MoreThanOrEqual(since) }, order: { createdAt: 'ASC' }, take: 5000 })
      : [];
    const smsMessages = await this.smsMessageRepo.find({
      where: { tenantId, createdAt: MoreThanOrEqual(since) } as any,
      order: { createdAt: 'ASC' },
      take: 5000,
    });

    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const dayMap = new Map<string, { calls: number; sms: number }>();
    for (let i = 0; i < days; i++) {
      dayMap.set(dayKey(new Date(since.getTime() + i * 86400000)), { calls: 0, sms: 0 });
    }
    for (const c of calls) {
      const bucket = dayMap.get(dayKey(c.createdAt));
      if (bucket) bucket.calls++;
    }
    for (const m of smsMessages) {
      const bucket = dayMap.get(dayKey(m.createdAt));
      if (bucket) bucket.sms++;
    }
    const dailySeries = Array.from(dayMap.entries()).map(([date, v]) => ({ date, ...v }));

    const hourCounts = new Array(24).fill(0);
    for (const c of calls) hourCounts[c.createdAt.getHours()]++;
    const hourlyLoad = hourCounts.map((count, hour) => ({ hour, count }));

    const staffIds = new Set<string>();
    for (const c of calls) if (c.staffUserId) staffIds.add(c.staffUserId);
    for (const m of smsMessages) if (m.sentByUserId) staffIds.add(m.sentByUserId);
    const staffRows = staffIds.size ? await this.staffRepo.find({ where: { id: In([...staffIds]) } }) : [];
    const staffNameById = new Map(staffRows.map((s) => [s.id, s.fullName]));

    const managerMap = new Map<string, { staffUserId: string | null; name: string; calls: number; sms: number }>();
    const ensure = (id: string | null) => {
      const key = id || '_unassigned';
      if (!managerMap.has(key)) {
        managerMap.set(key, {
          staffUserId: id,
          name: id ? staffNameById.get(id) || 'Сотрудник' : 'Без менеджера',
          calls: 0,
          sms: 0,
        });
      }
      return managerMap.get(key)!;
    };
    for (const c of calls) ensure(c.staffUserId).calls++;
    for (const m of smsMessages) ensure(m.sentByUserId).sms++;
    const byManager = Array.from(managerMap.values()).sort((a, b) => (b.calls + b.sms) - (a.calls + a.sms));

    const totalCalls = calls.length;
    const totalSms = smsMessages.length;
    const answered = calls.filter((c) => c.status === 'completed').length;
    const pickupRate = totalCalls ? Math.round((answered / totalCalls) * 1000) / 10 : 0;
    const deliveredSms = smsMessages.filter((m) => m.status === 'delivered' || m.status === 'sent').length;
    const smsDeliveryRate = totalSms ? Math.round((deliveredSms / totalSms) * 1000) / 10 : 0;
    const durations = calls.filter((c) => c.durationSeconds != null).map((c) => c.durationSeconds as number);
    const avgCallDurationSeconds = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

    const analyzedCalls = calls.filter((c) => c.sentimentStatus === 'done' && c.sentiment);
    const positive = analyzedCalls.filter((c) => c.sentiment === 'positive').length;
    const neutral = analyzedCalls.filter((c) => c.sentiment === 'neutral').length;
    const negative = analyzedCalls.filter((c) => c.sentiment === 'negative').length;
    const topicCounts = new Map<string, number>();
    for (const c of analyzedCalls) {
      if (c.sentiment !== 'negative' || !c.sentimentTopic) continue;
      topicCounts.set(c.sentimentTopic, (topicCounts.get(c.sentimentTopic) || 0) + 1);
    }
    const topNegativeTopics = Array.from(topicCounts.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      telephonyEnabled,
      kpis: { totalCalls, totalSms, pickupRate, smsDeliveryRate, avgCallDurationSeconds },
      dailySeries,
      hourlyLoad,
      byManager,
      sentiment: { positive, neutral, negative, analyzed: analyzedCalls.length, topNegativeTopics },
    };
  }

  // ─── Retention ────────────────────────────────────────────────────────────

  /** Enforces the advertised 3-year retention: deletes call rows (and best-effort the Twilio
   * recording itself) older than the cutoff. Runs daily, see TelephonySchedulerService. */
  async enforceRetention(): Promise<void> {
    const cutoff = new Date(Date.now() - RETENTION_YEARS * 365 * 24 * 60 * 60 * 1000);
    const old = await this.callRepo.find({ where: { createdAt: LessThan(cutoff) }, take: 500 });
    if (!old.length) return;

    const byTenant = new Map<string, Call[]>();
    for (const call of old) {
      if (!byTenant.has(call.tenantId)) byTenant.set(call.tenantId, []);
      byTenant.get(call.tenantId)!.push(call);
    }
    for (const [tenantId, calls] of byTenant) {
      const config = await this.configRepo.findOne({ where: { tenantId } });
      if (config?.accountSid && config?.authToken) {
        for (const call of calls) {
          if (!call.recordingSid) continue;
          await axios.delete(`${TWILIO_API}/Accounts/${config.accountSid}/Recordings/${call.recordingSid}.json`, {
            auth: this.twilioAuth(config), timeout: 15000, validateStatus: () => true,
          }).catch(() => undefined);
        }
      }
    }
    await this.callRepo.delete({ id: In(old.map((c) => c.id)) });
    this.log.log(`Telephony retention: deleted ${old.length} call(s) older than ${RETENTION_YEARS} years`);
  }
}
