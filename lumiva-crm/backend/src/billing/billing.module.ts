import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { IyzicoApiService } from '../integrations/iyzico/iyzico-api.service';
import { YookassaApiService } from '../integrations/yookassa/yookassa-api.service';
import { IyzicoBillingCheckout } from './providers/iyzico-billing-checkout.entity';
import { TenantPlanActivationService } from './providers/tenant-plan-activation.service';
import { PaymentProviderResolverService } from './providers/payment-provider-resolver.service';
import { YookassaBillingProvider } from './providers/yookassa-billing.provider';
import { IyzicoBillingProvider } from './providers/iyzico-billing.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, IyzicoBillingCheckout]),
    PlatformSettingsModule,
  ],
  controllers: [BillingController],
  providers: [
    BillingService,
    IyzicoApiService,
    YookassaApiService,
    TenantPlanActivationService,
    PaymentProviderResolverService,
    YookassaBillingProvider,
    IyzicoBillingProvider,
  ],
})
export class BillingModule {}
