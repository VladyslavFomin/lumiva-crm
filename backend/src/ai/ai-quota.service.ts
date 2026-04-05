import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { defaultMonthlyAiIncludedCents } from './ai-plan-quota';
import { AiUsageLog } from './ai-usage-log.entity';

function currentPeriodYm(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

@Injectable()
export class AiQuotaService {
  private readonly log = new Logger(AiQuotaService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenants: Repository<Tenant>,
    @InjectRepository(AiUsageLog)
    private readonly usageRepo: Repository<AiUsageLog>,
  ) {}

  effectiveMonthlyIncludedCents(tenant: Tenant): number {
    if (tenant.aiMonthlyIncludedCents > 0) {
      return tenant.aiMonthlyIncludedCents;
    }
    return defaultMonthlyAiIncludedCents(tenant.plan);
  }

  async ensurePeriod(tenant: Tenant): Promise<Tenant> {
    const ym = currentPeriodYm();
    if (tenant.aiPeriodYm === ym) return tenant;
    tenant.aiPeriodYm = ym;
    tenant.aiSpentIncludedCents = 0;
    await this.tenants.save(tenant);
    return tenant;
  }

  includedRemainingCents(tenant: Tenant): number {
    const cap = this.effectiveMonthlyIncludedCents(tenant);
    return Math.max(0, cap - (tenant.aiSpentIncludedCents || 0));
  }

  async getQuotaSnapshot(tenantId: string) {
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    if (!tenant) throw new BadRequestException('Tenant not found');
    await this.ensurePeriod(tenant);
    const t = await this.tenants.findOne({ where: { id: tenantId } });
    if (!t) throw new BadRequestException('Tenant not found');
    const includedMonthly = this.effectiveMonthlyIncludedCents(t);
    const includedLeft = this.includedRemainingCents(t);
    const prepaid = t.aiPrepaidCents || 0;
    const storageExtra = BigInt(t.storageExtraBytes || '0');
    const storageUsed = BigInt(t.storageUsedBytes || '0');
    const quotaTotal = BigInt(512 * 1024 * 1024) + storageExtra;
    return {
      periodYm: t.aiPeriodYm,
      includedMonthlyCents: includedMonthly,
      includedRemainingCents: includedLeft,
      spentIncludedCents: t.aiSpentIncludedCents || 0,
      prepaidCents: prepaid,
      totalAvailableCents: includedLeft + prepaid,
      storageUsedBytes: storageUsed.toString(),
      storageQuotaBytes: quotaTotal.toString(),
    };
  }

  /**
   * Списать стоимость в центах: сначала из месячного пула, затем из prepaid.
   */
  async chargeCents(
    tenantId: string,
    costCents: number,
    meta: {
      userId?: string;
      kind: 'chat' | 'image' | 'embedding';
      model?: string | null;
      promptTokens?: number;
      completionTokens?: number;
      sessionId?: string | null;
    },
  ): Promise<void> {
    if (costCents <= 0) return;
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    if (!tenant) throw new BadRequestException('Tenant not found');
    await this.ensurePeriod(tenant);
    let t = await this.tenants.findOne({ where: { id: tenantId } });
    if (!t) throw new BadRequestException('Tenant not found');

    let left = costCents;
    const includedLeft = this.includedRemainingCents(t);
    const fromIncluded = Math.min(left, includedLeft);
    t.aiSpentIncludedCents = (t.aiSpentIncludedCents || 0) + fromIncluded;
    left -= fromIncluded;

    if (left > 0) {
      const prepaid = t.aiPrepaidCents || 0;
      if (prepaid < left) {
        this.log.warn(
          `AI quota exceeded tenant=${tenantId} need=${costCents} prepaid=${prepaid} includedLeft=${includedLeft}`,
        );
        throw new BadRequestException({
          code: 'AI_QUOTA_EXCEEDED',
          message:
            'Недостаточно AI-квоты. Включённый лимит месяца и баланс докупки исчерпаны. Пополните квоту в разделе оплаты.',
          includedRemainingCents: this.includedRemainingCents(t),
          prepaidCents: prepaid,
        });
      }
      t.aiPrepaidCents = prepaid - left;
      left = 0;
    }

    await this.tenants.save(t);
    await this.usageRepo.save(
      this.usageRepo.create({
        tenantId,
        userId: meta.userId ?? null,
        kind: meta.kind,
        model: meta.model ?? null,
        promptTokens: meta.promptTokens ?? 0,
        completionTokens: meta.completionTokens ?? 0,
        costCents,
        sessionId: meta.sessionId ?? null,
      }),
    );
  }

  async addPrepaidCents(tenantId: string, cents: number) {
    if (cents <= 0) return;
    await this.tenants.increment({ id: tenantId }, 'aiPrepaidCents', cents);
  }

  async addStorageExtraBytes(tenantId: string, bytes: bigint) {
    if (bytes <= 0n) return;
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    if (!tenant) return;
    const cur = BigInt(tenant.storageExtraBytes || '0');
    tenant.storageExtraBytes = (cur + bytes).toString();
    await this.tenants.save(tenant);
  }

  /** Учёт «памяти» в объёме хранилища тенанта */
  async addStorageUsedBytes(tenantId: string, bytes: bigint) {
    if (bytes <= 0n) return;
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    if (!tenant) return;
    const cur = BigInt(tenant.storageUsedBytes || '0');
    tenant.storageUsedBytes = (cur + bytes).toString();
    await this.tenants.save(tenant);
  }

  async subtractStorageUsedBytes(tenantId: string, bytes: bigint) {
    if (bytes <= 0n) return;
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    if (!tenant) return;
    const used = BigInt(tenant.storageUsedBytes || '0');
    const next = used > bytes ? used - bytes : 0n;
    tenant.storageUsedBytes = next.toString();
    await this.tenants.save(tenant);
  }

  async assertStorageHeadroom(tenantId: string, addBytes: bigint) {
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    if (!tenant) throw new BadRequestException('Tenant not found');
    const used = BigInt(tenant.storageUsedBytes || '0');
    const extra = BigInt(tenant.storageExtraBytes || '0');
    const base = BigInt(512 * 1024 * 1024);
    const quota = base + extra;
    if (used + addBytes > quota) {
      throw new BadRequestException({
        code: 'AI_STORAGE_FULL',
        message:
          'Превышена квота хранилища для контекста AI. Докупите объём или удалите фрагменты памяти.',
      });
    }
  }
}
