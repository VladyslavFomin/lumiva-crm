// src/automations/automations.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutomationsController } from './automations.controller';
import { AutomationsService } from './automations.service';
import { Automation } from './automation.entity';
import { AutomationExecution } from './automation-execution.entity';
import { ReportsService } from './reports.service';
import { AutomationsSchedulerService } from './scheduler.service';
import { RbacModule } from '../rbac/rbac.module';
import { EmailModule } from '../email/email.module';
import { TelegramCrmModule } from '../telegram-crm/telegram-crm.module';
import { NotesModule } from '../notes/notes.module';
import { Lead } from '../leads/lead.entity';
import { Project } from '../projects/project.entity';
import { CompanyTask } from '../companies/company-task.entity';
import { SalesModule } from '../sales/sales.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Automation,
      AutomationExecution,
      Lead,
      Project,
      CompanyTask,
    ]),
    RbacModule,
    forwardRef(() => EmailModule),
    forwardRef(() => TelegramCrmModule),
    forwardRef(() => NotesModule),
    forwardRef(() => SalesModule),
  ],
  controllers: [AutomationsController],
  providers: [AutomationsService, ReportsService, AutomationsSchedulerService],
  exports: [AutomationsService], // Экспортируем для использования в других модулях
})
export class AutomationsModule {}
