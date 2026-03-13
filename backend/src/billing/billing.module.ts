import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant]), PlatformSettingsModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
