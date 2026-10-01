import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { Lead } from '../leads/lead.entity';
import { Project } from '../projects/project.entity';
import { Sale } from '../sales/sale.entity';
import { CompanyTask } from '../companies/company-task.entity';
import { Contact } from '../contacts/contact.entity';
import { Company } from '../companies/company.entity';
import { Note } from '../notes/note.entity';
import { Reservation } from '../bookings/reservation.entity';
import { HotelReservation } from '../hotels/hotel-reservation.entity';
import { HelpdeskTicket } from '../helpdesk/helpdesk-ticket.entity';
import { TelegramBot } from '../telegram-crm/telegram-bot.entity';
import { TelegramContact } from '../telegram-crm/telegram-contact.entity';
import { TelegramMessage } from '../telegram-crm/telegram-message.entity';
import { WhatsappContact } from '../whatsapp-crm/whatsapp-contact.entity';
import { WhatsappMessage } from '../whatsapp-crm/whatsapp-message.entity';
import { WhatsappCrmModule } from '../whatsapp-crm/whatsapp-crm.module';
import { EmailMessage } from '../email/email-message.entity';
import { AiModule } from '../ai/ai.module';
import { TenantsModule } from '../tenants/tenants.module';
import { MarketingModule } from '../marketing/marketing.module';
import { EmailModule } from '../email/email.module';
import { TelegramCrmModule } from '../telegram-crm/telegram-crm.module';
import { LeadsModule } from '../leads/leads.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { AiAgent } from './ai-agent.entity';
import { SeoAiAgent } from '../seo-ai/seo-ai-agent.entity';
import { SeoAiReport } from '../seo-ai/seo-ai-report.entity';
import { ReviewPlace } from '../reviews-ai/review-place.entity';
import { ReviewItem } from '../reviews-ai/review-item.entity';
import { AiAgentPermission } from './ai-agent-permission.entity';
import { AiAgentApprovalRule } from './ai-agent-approval-rule.entity';
import { AiAgentAction } from './ai-agent-action.entity';
import { AiAgentLog } from './ai-agent-log.entity';
import { AiAgentReport } from './ai-agent-report.entity';
import { AiAgentAssignment } from './ai-agent-assignment.entity';
import { AiKnowledgeItem } from './ai-knowledge-item.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { Department } from '../departments/department.entity';
import { RbacModule } from '../rbac/rbac.module';
import { CustomObject } from '../custom-objects/custom-object.entity';
import { CustomObjectRecord } from '../custom-objects/custom-object-record.entity';
import { CustomObjectField } from '../custom-objects/custom-object-field.entity';
import {
  AiActionsController,
  AiActivityController,
  AiAgentsController,
  AiAssignmentsController,
  AiInsightsController,
  AiKnowledgeController,
  AiEmployeesUsageController,
  AiLogsController,
  AiPlanLimitsController,
  AiReportsController,
  AiRolesController,
  AiMissedWorkController,
} from './ai-employees.controller';
import { AiEmployeesSchemaService } from './ai-employees-schema.service';
import { AiEmployeesService } from './ai-employees.service';
import { AiEmployeesSchedulerService } from './ai-employees.scheduler';
import { AiAnalystReportService } from './ai-analyst-report.service';
import { AiMissedWorkDaily } from './ai-missed-work.entity';
import { Payment } from '../payments/payment.entity';
import { Hotel } from '../hotels/hotel.entity';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiMissedWorkDaily,
      SeoAiAgent, // снапшот ИИ SEO-менеджера (последние SEO-отчёты)
      SeoAiReport,
      ReviewPlace, // снапшот ИИ-менеджера отзывов
      ReviewItem,
      Payment, // отчёт CRM-аналитика: оплаты
      Hotel, // отчёт CRM-аналитика: валюта отелей для скидок/выручки
      Tenant,
      Lead,
      Project,
      Sale,
      CompanyTask,
      Contact,
      Company,
      Note,
      Reservation,
      HotelReservation,
      HelpdeskTicket,
      TelegramBot,
      TelegramContact,
      TelegramMessage,
      WhatsappContact,
      WhatsappMessage,
      EmailMessage,
      AiAgent,
      AiAgentPermission,
      AiAgentApprovalRule,
      AiAgentAction,
      AiAgentLog,
      AiAgentReport,
      AiAgentAssignment,
      AiKnowledgeItem,
      StaffUser,
      Department,
      CustomObject,
      CustomObjectRecord,
      CustomObjectField,
    ]),
    forwardRef(() => AiModule),
    MarketingModule,
    MailModule, // рассылка отчёта CRM-аналитика
    forwardRef(() => EmailModule),
    forwardRef(() => TelegramCrmModule),
    forwardRef(() => WhatsappCrmModule),
    forwardRef(() => LeadsModule),
    forwardRef(() => IntegrationsModule),
    forwardRef(() => TenantsModule), // TenantLogsService — security-event visibility for pl1
    RbacModule, // RbacGuard на всех ai-* контроллерах + Department-репозиторий для «ответственного»
  ],
  controllers: [
    AiRolesController,
    AiPlanLimitsController,
    AiEmployeesUsageController,
    AiAgentsController,
    AiAssignmentsController,
    AiKnowledgeController,
    AiInsightsController,
    AiActivityController,
    AiActionsController,
    AiLogsController,
    AiReportsController, AiMissedWorkController],
  providers: [AiEmployeesSchemaService, AiEmployeesService, AiEmployeesSchedulerService, AiAnalystReportService],
  exports: [AiEmployeesService],
})
export class AiEmployeesModule {}
