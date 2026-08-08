// src/marketing-broadcasts/marketing-broadcasts.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketingBroadcastsController } from './marketing-broadcasts.controller';
import { MarketingBroadcastsService } from './marketing-broadcasts.service';
import { MarketingBroadcastsSchedulerService } from './marketing-broadcasts-scheduler.service';
import { MarketingBroadcast } from './marketing-broadcast.entity';
import { MarketingBroadcastRecipient } from './marketing-broadcast-recipient.entity';
import { Lead } from '../leads/lead.entity';
import { RbacModule } from '../rbac/rbac.module';
import { MarketingModule } from '../marketing/marketing.module';
import { EmailModule } from '../email/email.module';
import { SmsModule } from '../sms/sms.module';
import { LeadsModule } from '../leads/leads.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MarketingBroadcast, MarketingBroadcastRecipient, Lead]),
    RbacModule,
    MarketingModule,
    forwardRef(() => EmailModule),
    SmsModule,
    forwardRef(() => LeadsModule),
  ],
  controllers: [MarketingBroadcastsController],
  providers: [MarketingBroadcastsService, MarketingBroadcastsSchedulerService],
  exports: [MarketingBroadcastsService],
})
export class MarketingBroadcastsModule {}
