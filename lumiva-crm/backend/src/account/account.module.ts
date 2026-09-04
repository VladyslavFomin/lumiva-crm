import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { Tenant } from '../tenants/tenant.entity';
import { AuthModule } from '../auth/auth.module';
import { UserSessionsModule } from '../auth/user-sessions.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ApiTokensModule } from '../api-tokens/api-tokens.module';
import { MailModule } from '../mail/mail.module';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { AccountDigestScheduler } from './account-digest.scheduler';
import { InAppNotification } from '../notifications/in-app-notification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, StaffUser, Tenant, InAppNotification]),
    AuthModule,
    UserSessionsModule,
    AuditLogModule,
    ApiTokensModule,
    MailModule,
  ],
  controllers: [AccountController],
  providers: [AccountService, AccountDigestScheduler],
  exports: [AccountService],
})
export class AccountModule {}
