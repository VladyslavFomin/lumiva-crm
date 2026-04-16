// backend/src/mail/mail.module.ts
import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

@Module({
  providers: [MailService],
  exports: [MailService], // экспортируем, чтобы TenantsModule мог инжектить MailService
})
export class MailModule {}