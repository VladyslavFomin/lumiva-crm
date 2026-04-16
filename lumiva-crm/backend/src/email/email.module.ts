// src/email/email.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { EmailOAuthService } from './email-oauth.service';
import { EmailSyncService } from './email-sync.service';
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
import { RbacModule } from '../rbac/rbac.module';
import { AutomationsModule } from '../automations/automations.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { LeadsModule } from '../leads/leads.module';

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
    ]),
    RbacModule,
    PlatformSettingsModule,
    forwardRef(() => AutomationsModule),
    forwardRef(() => LeadsModule),
  ],
  controllers: [
    EmailController,
    EmailOAuthPublicController,
    EmailOAuthActionsController,
  ],
  providers: [EmailService, EmailOAuthService, EmailSyncService, EmailFoldersService],
  exports: [EmailService, EmailOAuthService, EmailSyncService, EmailFoldersService],
})
export class EmailModule {}

