import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { User } from '../users/user.entity';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { IyzicoApiService } from '../integrations/iyzico/iyzico-api.service';
import { YookassaApiService } from '../integrations/yookassa/yookassa-api.service';
import { IyzicoBillingCheckout } from './providers/iyzico-billing-checkout.entity';
import { TenantPlanActivationService } from './providers/tenant-plan-activation.service';
import { PaymentProviderResolverService } from './providers/payment-provider-resolver.service';
import { YookassaBillingProvider } from './providers/yookassa-billing.provider';
import { IyzicoBillingProvider } from './providers/iyzico-billing.provider';
import { BillingAlertsService } from './billing-alerts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, IyzicoBillingCheckout, StaffUser, User]),
    PlatformSettingsModule,
    MailModule,
    NotificationsModule,
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
    BillingAlertsService,
  ],
  exports: [BillingAlertsService],
})
export class BillingModule {}
