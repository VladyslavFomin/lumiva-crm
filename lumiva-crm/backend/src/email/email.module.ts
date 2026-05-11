// src/email/email.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { EmailOAuthService } from './email-oauth.service';
import { EmailSyncService } from './email-sync.service';
import { EmailImapSyncService } from './email-imap-sync.service';
import { EmailOAuthPublicController } from './email-oauth-public.controller';
import { EmailOAuthActionsController } from './email-oauth-actions.controller';
import { EmailAccount } from './email-account.entity';
import { EmailMessage } from './email-message.entity';
import { EmailFolder } from './email-folder.entity';
import { EmailTemplate } from './email-template.entity';
import { EmailFoldersService } from './email-folders.service';
import { Tenant } from '../tenants/tenant.entity';
import { Contact } from '../contacts/contact.entity';
import { Lead } from '../leads/lead.entity';
import { Company } from '../companies/company.entity';
import { Sale } from '../sales/sale.entity';
import { CustomObject } from '../custom-objects/custom-object.entity';
import { CustomObjectField } from '../custom-objects/custom-object-field.entity';
import { CustomObjectRecord } from '../custom-objects/custom-object-record.entity';
import { CustomObjectView } from '../custom-objects/custom-object-view.entity';
import { WorkspaceArea } from '../workspace-areas/workspace-area.entity';
import { RbacModule } from '../rbac/rbac.module';
import { AutomationsModule } from '../automations/automations.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { LeadsModule } from '../leads/leads.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StaffUsersModule } from '../staff/staff-users.module';
import { EmailNotificationsService } from './email-notifications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmailAccount,
      EmailMessage,
      EmailFolder,
      EmailTemplate,
      Tenant,
      Contact,
      Lead,
      Company,
      Sale,
      CustomObject,
      CustomObjectField,
      CustomObjectRecord,
      CustomObjectView,
      WorkspaceArea,
    ]),
    RbacModule,
    PlatformSettingsModule,
    NotificationsModule,
    StaffUsersModule,
    forwardRef(() => AutomationsModule),
    forwardRef(() => LeadsModule),
  ],
  controllers: [
    EmailController,
    EmailOAuthPublicController,
    EmailOAuthActionsController,
  ],
  providers: [
    EmailService,
    EmailOAuthService,
    EmailSyncService,
    EmailImapSyncService,
    EmailFoldersService,
    EmailNotificationsService,
  ],
  exports: [
    EmailService,
    EmailOAuthService,
    EmailSyncService,
    EmailImapSyncService,
    EmailFoldersService,
    EmailNotificationsService,
  ],
})
export class EmailModule {}
