// src/helpdesk/helpdesk.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HelpdeskTicket } from './helpdesk-ticket.entity';
import { HelpdeskTicketMessage } from './helpdesk-ticket-message.entity';
import { Contact } from '../contacts/contact.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { User } from '../users/user.entity';
import { Lead } from '../leads/lead.entity';
import { Company } from '../companies/company.entity';
import { Project } from '../projects/project.entity';
import { Department } from '../departments/department.entity';
import { EmailAccount } from '../email/email-account.entity';
import { TelegramContact } from '../telegram-crm/telegram-contact.entity';
import { WhatsappContact } from '../whatsapp-crm/whatsapp-contact.entity';
import { RbacModule } from '../rbac/rbac.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
import { TelegramCrmModule } from '../telegram-crm/telegram-crm.module';
import { WhatsappCrmModule } from '../whatsapp-crm/whatsapp-crm.module';
import { SmsModule } from '../sms/sms.module';
import { HelpdeskService } from './helpdesk.service';
import { HelpdeskController, HelpdeskLinkOptionsController, HelpdeskInternalRequestsController } from './helpdesk.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HelpdeskTicket,
      HelpdeskTicketMessage,
      Contact,
      StaffUser,
      User,
      Lead,
      Company,
      Project,
      Department,
      EmailAccount,
      TelegramContact,
      WhatsappContact,
    ]),
    RbacModule,
    NotificationsModule,
    EmailModule,
    forwardRef(() => TelegramCrmModule),
    WhatsappCrmModule,
    SmsModule,
  ],
  providers: [HelpdeskService],
  controllers: [HelpdeskController, HelpdeskLinkOptionsController, HelpdeskInternalRequestsController],
  exports: [HelpdeskService],
})
export class HelpdeskModule {}
