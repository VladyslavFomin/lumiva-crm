// src/telephony/telephony.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelephonyController } from './telephony.controller';
import { TelephonyStatusController } from './telephony-status.controller';
import { TelephonyWebhookController } from './telephony-webhook.controller';
import { TelephonyService } from './telephony.service';
import { TelephonyAddonGuard } from './telephony-addon.guard';
import { TelephonySchedulerService } from './telephony-scheduler.service';
import { TelephonyConfig } from './telephony-config.entity';
import { Call } from './call.entity';
import { Tenant } from '../tenants/tenant.entity';
import { SmsMessage } from '../sms/sms-message.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TelephonyConfig, Call, Tenant, SmsMessage, StaffUser]),
    RbacModule,
  ],
  controllers: [TelephonyController, TelephonyStatusController, TelephonyWebhookController],
  providers: [TelephonyService, TelephonyAddonGuard, TelephonySchedulerService],
  exports: [TelephonyService],
})
export class TelephonyModule {}
