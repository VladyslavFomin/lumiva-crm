import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { Lead } from '../leads/lead.entity';
import { Project } from '../projects/project.entity';
import { Sale } from '../sales/sale.entity';
import { CompanyTask } from '../companies/company-task.entity';
import { AiModule } from '../ai/ai.module';
import { MarketingModule } from '../marketing/marketing.module';
import { EmailModule } from '../email/email.module';
import { TelegramCrmModule } from '../telegram-crm/telegram-crm.module';
import { LeadsModule } from '../leads/leads.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { AiAgent } from './ai-agent.entity';
import { AiAgentPermission } from './ai-agent-permission.entity';
import { AiAgentApprovalRule } from './ai-agent-approval-rule.entity';
import { AiAgentAction } from './ai-agent-action.entity';
import { AiAgentLog } from './ai-agent-log.entity';
import { AiAgentReport } from './ai-agent-report.entity';
import {
  AiActionsController,
  AiAgentsController,
  AiEmployeesUsageController,
  AiLogsController,
  AiPlanLimitsController,
  AiReportsController,
  AiRolesController,
} from './ai-employees.controller';
import { AiEmployeesSchemaService } from './ai-employees-schema.service';
import { AiEmployeesService } from './ai-employees.service';
import { AiEmployeesSchedulerService } from './ai-employees.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      Lead,
      Project,
      Sale,
      CompanyTask,
      AiAgent,
      AiAgentPermission,
      AiAgentApprovalRule,
      AiAgentAction,
      AiAgentLog,
      AiAgentReport,
    ]),
    forwardRef(() => AiModule),
    MarketingModule,
    forwardRef(() => EmailModule),
    forwardRef(() => TelegramCrmModule),
    forwardRef(() => LeadsModule),
    forwardRef(() => IntegrationsModule),
  ],
  controllers: [
    AiRolesController,
    AiPlanLimitsController,
    AiEmployeesUsageController,
    AiAgentsController,
    AiActionsController,
    AiLogsController,
    AiReportsController,
  ],
  providers: [AiEmployeesSchemaService, AiEmployeesService, AiEmployeesSchedulerService],
  exports: [AiEmployeesService],
})
export class AiEmployeesModule {}
