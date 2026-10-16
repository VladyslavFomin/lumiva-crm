// backend/src/mail/mail.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MailService } from './mail.service';
import { MailQueueProcessor } from './mail.processor';
import { MAIL_QUEUE } from './mail.constants';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailAccount } from '../email/email-account.entity';
import { EmailOAuthService } from '../email/email-oauth.service';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { TenantMailService } from './tenant-mail.service';

const useQueue = !!process.env.REDIS_URL;

@Module({
  imports: [
    ...(useQueue ? [BullModule.registerQueue({ name: MAIL_QUEUE })] : []),
    // письма от имени клиента — с его подключённой почты (TenantMailService)
    TypeOrmModule.forFeature([EmailAccount]),
    PlatformSettingsModule,
  ],
  providers: [
    MailService,
    EmailOAuthService,
    TenantMailService,
    ...(useQueue ? [MailQueueProcessor] : []),
  ],
  exports: [MailService, TenantMailService],
})
export class MailModule {}
