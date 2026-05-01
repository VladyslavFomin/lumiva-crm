// backend/src/mail/mail.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MailService } from './mail.service';
import { MailQueueProcessor } from './mail.processor';
import { MAIL_QUEUE } from './mail.constants';

const useQueue = !!process.env.REDIS_URL;

@Module({
  imports: [
    ...(useQueue ? [BullModule.registerQueue({ name: MAIL_QUEUE })] : []),
  ],
  providers: [
    MailService,
    ...(useQueue ? [MailQueueProcessor] : []),
  ],
  exports: [MailService],
})
export class MailModule {}
