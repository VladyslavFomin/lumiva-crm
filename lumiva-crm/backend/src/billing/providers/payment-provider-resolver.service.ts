import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../tenants/tenant.entity';
import type { BillingProviderCode } from './tenant-plan-activation.service';

/**
 * Резолвит и один раз фиксирует провайдера оплаты тарифа на тенанте: ru→yookassa, tr→iyzico,
 * иначе→stripe; тенанты, уже платившие через Stripe до этой фичи (есть stripeCustomerId),
 * принудительно остаются на stripe — чтобы не сорвать уже работающую оплату сменой языка
 * интерфейса. После первого резолва значение больше не пересчитывается — переопределить можно
 * только вручную из pl1 (Tenant.paymentProvider).
 */
@Injectable()
export class PaymentProviderResolverService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantsRepo: Repository<Tenant>,
  ) {}

  async resolveForTenant(tenant: Tenant): Promise<BillingProviderCode> {
    if (tenant.paymentProvider) return tenant.paymentProvider;

    let resolved: BillingProviderCode;
    if (tenant.stripeCustomerId) {
      resolved = 'stripe';
    } else if (tenant.uiLanguage === 'ru') {
      resolved = 'yookassa';
    } else if (tenant.uiLanguage === 'tr') {
      resolved = 'iyzico';
    } else {
      resolved = 'stripe';
    }

    tenant.paymentProvider = resolved;
    await this.tenantsRepo.save(tenant);
    return resolved;
  }
}
