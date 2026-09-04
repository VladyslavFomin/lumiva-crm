// backend/src/tenants/tenants.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Tenant } from './tenant.entity';
import { TenantStorageFile } from './tenant-storage-file.entity';
import { User } from '../users/user.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { TenantLog } from './tenant-log.entity';
import { Site } from '../sites/site.entity';
import { IntegrationConnection } from '../integrations/integration-connection.entity';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { PlatformTenantsController } from './platform-tenants.controller';
import { TenantLogsService } from './tenant-logs.service';
import { TenantTrialSchedulerService } from './tenant-trial.scheduler';

import { StaffUsersModule } from '../staff/staff-users.module';
import { RbacModule } from '../rbac/rbac.module';
import { PlatformAdminModule } from '../platform-admin/platform-admin.module';
import { MailModule } from '../mail/mail.module';
import { UserSessionsModule } from '../auth/user-sessions.module';
import { TenantStorageService } from './tenant-storage.service';
import { CompanyFilesService } from './company-files.service';
import { ChatMessage } from '../online-chat/chat-message.entity';
import { EmailMessage } from '../email/email-message.entity';
import { TelegramMessage } from '../telegram-crm/telegram-message.entity';
import { CustomObjectRecord } from '../custom-objects/custom-object-record.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      TenantLog,
      Site,
      IntegrationConnection,
      TenantStorageFile,
      User,
      StaffUser,
      ChatMessage,
      EmailMessage,
      TelegramMessage,
      CustomObjectRecord,
    ]),

    UserSessionsModule,

    // чтобы TenantsService мог использовать StaffUsersService
    forwardRef(() => StaffUsersModule),

    // RBAC для обычных /tenants (внутри CRM)
    RbacModule,

    // чтобы PlatformTenantsController мог использовать PlatformAdminGuard
    PlatformAdminModule,

    // чтобы TenantsService мог инжектить MailService
    MailModule,
  ],
  providers: [
    TenantsService,
    TenantLogsService,
    TenantStorageService,
    CompanyFilesService,
    TenantTrialSchedulerService,
  ],
  controllers: [
    TenantsController,          // обычные ручки для CRM
    PlatformTenantsController,  // админ-панель pl1
  ],
  exports: [TenantsService, TenantLogsService, TypeOrmModule],
})
export class TenantsModule {}
