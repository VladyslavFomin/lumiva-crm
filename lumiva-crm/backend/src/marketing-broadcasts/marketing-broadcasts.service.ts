// src/marketing-broadcasts/marketing-broadcasts.service.ts
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MarketingBroadcast, BroadcastChannel, BroadcastStep } from './marketing-broadcast.entity';
import { MarketingBroadcastRecipient } from './marketing-broadcast-recipient.entity';
import { Lead } from '../leads/lead.entity';
import { MarketingService } from '../marketing/marketing.service';
import { EmailService } from '../email/email.service';
import { SmsService } from '../sms/sms.service';

const RECIPIENT_BATCH_PER_TICK = 200;

export interface BroadcastStats {
  total: number;
  pending: number;
  active: number;
  completed: number;
  failed: number;
  unsubscribed: number;
}

export interface CreateBroadcastDto {
  name: string;
  channel: BroadcastChannel;
  segmentId?: string | null;
  steps?: BroadcastStep[];
  fromEmailAccountId?: string | null;
  trackOpens?: boolean;
}

@Injectable()
export class MarketingBroadcastsService {
  private readonly log = new Logger(MarketingBroadcastsService.name);

  constructor(
    @InjectRepository(MarketingBroadcast)
    private readonly broadcastRepo: Repository<MarketingBroadcast>,
    @InjectRepository(MarketingBroadcastRecipient)
    private readonly recipientRepo: Repository<MarketingBroadcastRecipient>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    private readonly marketingService: MarketingService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
  ) {}

  private validateSteps(channel: BroadcastChannel, steps: BroadcastStep[]): void {
    for (const step of steps) {
      if (!step.body || !step.body.trim()) {
        throw new BadRequestException(`Step ${step.order + 1}: body is required`);
      }
      if (channel === 'email' && !step.subject?.trim()) {
        throw new BadRequestException(`Step ${step.order + 1}: subject is required for email`);
      }
      if (step.delayDays < 0) {
        throw new BadRequestException(`Step ${step.order + 1}: delayDays cannot be negative`);
      }
    }
  }

  async create(tenantId: string, dto: CreateBroadcastDto): Promise<MarketingBroadcast> {
    if (!dto.name?.trim()) throw new BadRequestException('name is required');
    if (dto.channel !== 'email' && dto.channel !== 'sms') {
      throw new BadRequestException("channel must be 'email' or 'sms'");
    }
    const steps = (dto.steps || []).map((s, i) => ({ ...s, order: i }));
    this.validateSteps(dto.channel, steps);
    const entity = this.broadcastRepo.create({
      tenantId,
      name: dto.name.trim(),
      channel: dto.channel,
      status: 'draft',
      segmentId: dto.segmentId || null,
      steps,
      fromEmailAccountId: dto.fromEmailAccountId || null,
      trackOpens: !!dto.trackOpens,
    });
    return this.broadcastRepo.save(entity);
  }

  private async findEntity(tenantId: string, id: string): Promise<MarketingBroadcast> {
    const b = await this.broadcastRepo.findOne({ where: { id, tenantId } });
    if (!b) throw new NotFoundException('Broadcast not found');
    return b;
  }

  async update(tenantId: string, id: string, dto: Partial<CreateBroadcastDto>): Promise<MarketingBroadcast> {
    const b = await this.findEntity(tenantId, id);
    if (b.status !== 'draft') throw new BadRequestException('Only draft broadcasts can be edited');
    if (dto.name !== undefined) b.name = dto.name.trim();
    if (dto.segmentId !== undefined) b.segmentId = dto.segmentId || null;
    if (dto.fromEmailAccountId !== undefined) b.fromEmailAccountId = dto.fromEmailAccountId || null;
    if (dto.trackOpens !== undefined) b.trackOpens = dto.trackOpens;
    if (dto.steps !== undefined) {
      const steps = dto.steps.map((s, i) => ({ ...s, order: i }));
      this.validateSteps(b.channel, steps);
      b.steps = steps;
    }
    return this.broadcastRepo.save(b);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const b = await this.findEntity(tenantId, id);
    if (b.status === 'running') throw new BadRequestException('Cancel the broadcast before deleting it');
    await this.recipientRepo.delete({ tenantId, broadcastId: id });
    await this.broadcastRepo.delete({ id, tenantId });
  }

  async getStats(tenantId: string, broadcastId: string): Promise<BroadcastStats> {
    const rows = await this.recipientRepo.createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('r.tenantId = :tenantId AND r.broadcastId = :broadcastId', { tenantId, broadcastId })
      .groupBy('r.status')
      .getRawMany<{ status: string; count: string }>();
    const stats: BroadcastStats = { total: 0, pending: 0, active: 0, completed: 0, failed: 0, unsubscribed: 0 };
    for (const row of rows) {
      const n = parseInt(row.count, 10);
      (stats as any)[row.status] = n;
      stats.total += n;
    }
    return stats;
  }

  async list(tenantId: string): Promise<Array<MarketingBroadcast & { stats: BroadcastStats }>> {
    const items = await this.broadcastRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
    const out: Array<MarketingBroadcast & { stats: BroadcastStats }> = [];
    for (const b of items) {
      out.push({ ...b, stats: await this.getStats(tenantId, b.id) });
    }
    return out;
  }

  async findOne(tenantId: string, id: string): Promise<MarketingBroadcast & { stats: BroadcastStats }> {
    const b = await this.findEntity(tenantId, id);
    return { ...b, stats: await this.getStats(tenantId, id) };
  }

  async cancel(tenantId: string, id: string): Promise<MarketingBroadcast> {
    const b = await this.findEntity(tenantId, id);
    if (b.status === 'completed' || b.status === 'cancelled') {
      throw new BadRequestException(`Broadcast is already ${b.status}`);
    }
    b.status = 'cancelled';
    return this.broadcastRepo.save(b);
  }

  async schedule(tenantId: string, id: string, scheduledAt?: string | null): Promise<MarketingBroadcast> {
    const b = await this.findEntity(tenantId, id);
    if (b.status !== 'draft') throw new BadRequestException('Only draft broadcasts can be scheduled');
    if (!b.steps?.length) throw new BadRequestException('Add at least one step before scheduling');
    if (b.channel === 'email' && !b.fromEmailAccountId) {
      throw new BadRequestException('Select a sending email account before scheduling');
    }
    const when = scheduledAt ? new Date(scheduledAt) : new Date();
    if (Number.isNaN(when.getTime())) throw new BadRequestException('Invalid scheduledAt');
    b.scheduledAt = when;
    b.status = 'scheduled';
    await this.broadcastRepo.save(b);
    if (when.getTime() <= Date.now()) {
      await this.activateIfDue(b);
    }
    return b;
  }

  // ─── Audience materialization ────────────────────────────────────────────

  private async materializeRecipients(b: MarketingBroadcast): Promise<void> {
    let leads: Array<{ id: string; email: string | null; phone: string | null }>;
    if (b.segmentId) {
      leads = await this.marketingService.runSegment(b.tenantId, b.segmentId);
    } else {
      const qb = this.leadRepo.createQueryBuilder('l').where('l.tenantId = :tenantId', { tenantId: b.tenantId });
      if (b.channel === 'email') qb.andWhere("l.email IS NOT NULL AND l.email != ''");
      else qb.andWhere("l.phone IS NOT NULL AND l.phone != ''");
      const rows = await qb.getMany();
      leads = rows.map((l) => ({ id: l.id, email: l.email, phone: l.phone }));
    }
    const filtered = leads.filter((l) => (b.channel === 'email' ? !!l.email : !!l.phone));
    if (!filtered.length) return;
    const recipients = filtered.map((l) => this.recipientRepo.create({
      tenantId: b.tenantId,
      broadcastId: b.id,
      leadId: l.id,
      email: l.email ?? null,
      phone: l.phone ?? null,
      status: 'pending',
    }));
    await this.recipientRepo.save(recipients);
  }

  private async activateIfDue(b: MarketingBroadcast): Promise<void> {
    const already = await this.recipientRepo.count({ where: { tenantId: b.tenantId, broadcastId: b.id } });
    if (already === 0) await this.materializeRecipients(b);
    if (b.status !== 'running') {
      b.status = 'running';
      b.startedAt = b.startedAt || new Date();
      await this.broadcastRepo.save(b);
    }
    await this.processStepsForBroadcast(b);
    await this.maybeComplete(b);
  }

  // ─── Sending ──────────────────────────────────────────────────────────────

  private async processStepsForBroadcast(b: MarketingBroadcast): Promise<void> {
    const steps = b.steps || [];
    if (!steps.length) return;
    const now = Date.now();
    const pending = await this.recipientRepo.find({
      where: { tenantId: b.tenantId, broadcastId: b.id, status: In(['pending', 'active']) },
      take: RECIPIENT_BATCH_PER_TICK,
    });
    for (const r of pending) {
      const nextIdx = r.lastStepSent + 1;
      if (nextIdx >= steps.length) {
        r.status = 'completed';
        await this.recipientRepo.save(r);
        continue;
      }
      const step = steps[nextIdx];
      const base = r.lastSentAt ? r.lastSentAt.getTime() : (b.startedAt ? b.startedAt.getTime() : now);
      const dueAt = base + step.delayDays * 24 * 60 * 60 * 1000;
      if (dueAt > now) continue;

      try {
        if (b.channel === 'email') {
          if (!r.email) throw new Error('No email on file');
          await this.emailService.sendEmail(b.tenantId, {
            accountId: b.fromEmailAccountId as string,
            to: [r.email],
            subject: step.subject || b.name,
            htmlBody: step.body,
            leadId: r.leadId ?? undefined,
          });
        } else {
          if (!r.phone) throw new Error('No phone on file');
          await this.smsService.sendFromAutomation(b.tenantId, r.phone, step.body, 'lead', r.leadId ?? undefined);
        }
        r.lastStepSent = nextIdx;
        r.lastSentAt = new Date();
        r.status = nextIdx >= steps.length - 1 ? 'completed' : 'active';
        r.lastError = null;
      } catch (e: any) {
        r.status = 'failed';
        r.lastError = String(e?.message || e).slice(0, 500);
        this.log.warn(`Broadcast ${b.id} recipient ${r.id} step ${nextIdx} failed: ${r.lastError}`);
      }
      await this.recipientRepo.save(r);
    }
  }

  private async maybeComplete(b: MarketingBroadcast): Promise<void> {
    const outstanding = await this.recipientRepo.count({
      where: { tenantId: b.tenantId, broadcastId: b.id, status: In(['pending', 'active']) },
    });
    if (outstanding === 0) {
      b.status = 'completed';
      b.completedAt = new Date();
      await this.broadcastRepo.save(b);
    }
  }

  /** Cron entry point: activates due `scheduled` broadcasts and advances `running` ones. */
  async runDueSteps(): Promise<void> {
    const now = Date.now();
    const dueToStart = await this.broadcastRepo.find({ where: { status: 'scheduled' } });
    for (const b of dueToStart) {
      if (b.scheduledAt && b.scheduledAt.getTime() <= now) {
        await this.activateIfDue(b).catch((e) => this.log.error(`activateIfDue(${b.id}) failed: ${e.message}`));
      }
    }
    const running = await this.broadcastRepo.find({ where: { status: 'running' } });
    for (const b of running) {
      await this.processStepsForBroadcast(b).catch((e) => this.log.error(`processStepsForBroadcast(${b.id}) failed: ${e.message}`));
      await this.maybeComplete(b).catch(() => undefined);
    }
  }
}
