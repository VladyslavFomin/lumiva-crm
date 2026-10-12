import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiDepartment } from './ai-department.entity';
import { AiOfficeTask } from './ai-office-task.entity';
import { AiOfficeIssue } from './ai-office-issue.entity';
import { AiOfficeEvent } from './ai-office-event.entity';
import { AiOfficeAccess } from './ai-office-access.entity';
import { AiBrainFile } from './ai-brain-file.entity';
import { AiBrainChunk } from './ai-brain-chunk.entity';
import { AiAgent } from '../ai-employees/ai-agent.entity';
import { AiAgentAction } from '../ai-employees/ai-agent-action.entity';
import { Tenant } from '../tenants/tenant.entity';
import { IntegrationConnection } from '../integrations/integration-connection.entity';
import { AiEmployeesModule } from '../ai-employees/ai-employees.module';
import { AiModule } from '../ai/ai.module';
import { StorageQuotaModule } from '../storage-quota/storage-quota.module';
import { RbacModule } from '../rbac/rbac.module';
import { AiOfficeSchemaService } from './ai-office-schema.service';
import { AiOfficeService } from './ai-office.service';
import { AiOfficeEngineService } from './ai-office-engine.service';
import { AiBrainService } from './ai-brain.service';
import { AiOfficeConnectorsService } from './ai-office-connectors.service';
import { AiOfficeDataService } from './ai-office-data.service';
import { AiOfficeAutonomyService, AiOfficeDecideController } from './ai-office-autonomy.service';
import { MailModule } from '../mail/mail.module';
import { AiOfficeCuratorService } from './ai-office-curator.service';
import { AiOfficeProgramsService } from './ai-office-programs.service';
import { AiOfficeController, AiOfficeOAuthCallbackController } from './ai-office.controller';
import { AiOfficeOAuthService } from './ai-office-oauth.service';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { CurrencyModule } from '../currency/currency.module';

/**
 * ИИ-офис (ИИ-отделы). Зависит от AiEmployeesModule (движок агентов), а не наоборот: обратная связь —
 * через хуки (AiEmployeesService.registerOfficeHooks), автоматизации — лениво через ModuleRef.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiDepartment,
      AiOfficeTask,
      AiOfficeIssue,
      AiOfficeEvent,
      AiOfficeAccess,
      AiBrainFile,
      AiBrainChunk,
      AiAgent,
      AiAgentAction,
      Tenant,
      IntegrationConnection,
    ]),
    forwardRef(() => AiEmployeesModule),
    forwardRef(() => AiModule),
    StorageQuotaModule,
    RbacModule,
    PlatformSettingsModule,
    CurrencyModule,
    MailModule,
  ],
  controllers: [AiOfficeController, AiOfficeOAuthCallbackController, AiOfficeDecideController],
  providers: [AiOfficeSchemaService, AiOfficeService, AiOfficeEngineService, AiBrainService, AiOfficeConnectorsService,
    AiOfficeDataService, AiOfficeOAuthService, AiOfficeAutonomyService, AiOfficeCuratorService, AiOfficeProgramsService],
  exports: [AiOfficeService],
})
export class AiOfficeModule {}
