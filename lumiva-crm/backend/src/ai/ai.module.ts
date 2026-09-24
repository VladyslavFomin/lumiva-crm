import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { User } from '../users/user.entity';
import { Lead } from '../leads/lead.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { Company } from '../companies/company.entity';
import { Sale } from '../sales/sale.entity';
import { Project } from '../projects/project.entity';
import { IntegrationConnection } from '../integrations/integration-connection.entity';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { LeadsModule } from '../leads/leads.module';
import { NotesModule } from '../notes/notes.module';
import { ProjectsModule } from '../projects/projects.module';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module';
import { MarketingModule } from '../marketing/marketing.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { CustomObjectsModule } from '../custom-objects/custom-objects.module';
import { SalesModule } from '../sales/sales.module';
import { CompaniesModule } from '../companies/companies.module';
import { ContactsModule } from '../contacts/contacts.module';
import { EmailModule } from '../email/email.module';
import { AutomationsModule } from '../automations/automations.module';
import { WorkspaceAreasModule } from '../workspace-areas/workspace-areas.module';
import { ProductsModule } from '../products/products.module';
import { BookingsModule } from '../bookings/bookings.module';
import { HotelsModule } from '../hotels/hotels.module';
import { RbacModule } from '../rbac/rbac.module';
import { CurrencyModule } from '../currency/currency.module';
import { ProjectTablesModule } from '../project-tables/project-tables.module';
import { TenantsModule } from '../tenants/tenants.module';
import { DataVisibilityModule } from '../data-visibility/data-visibility.module';
import { AiUsageLog } from './ai-usage-log.entity';
import { AiMemoryChunk } from './ai-memory-chunk.entity';
import { AiChatSession } from './ai-chat-session.entity';
import { AiChatMessage } from './ai-chat-message.entity';
import { AiAgent } from '../ai-employees/ai-agent.entity';
import { AiAgentAction } from '../ai-employees/ai-agent-action.entity';
import { AiAgentLog } from '../ai-employees/ai-agent-log.entity';
import { AiAgentPermission } from '../ai-employees/ai-agent-permission.entity';
import { AiQuotaService } from './ai-quota.service';
import { AiOpenAiService } from './ai-openai.service';
import { AiAnthropicService } from './ai-anthropic.service';
import { AiToolsService } from './ai-tools.service';
import { AiAssistantService } from './ai-assistant.service';
import { AiController } from './ai.controller';
import { WorkspaceSyncService } from '../workspace-sync/workspace-sync.service';
import { WorkspaceSyncScheduler } from '../workspace-sync/workspace-sync.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      User,
      AiUsageLog,
      AiMemoryChunk,
      AiChatSession,
      AiChatMessage,
      Lead,
      StaffUser,
      Company,
      Sale,
      Project,
      IntegrationConnection,
      AiAgent,
      AiAgentAction,
      AiAgentLog,
      AiAgentPermission,
    ]),
    PlatformSettingsModule,
    forwardRef(() => LeadsModule),
    NotesModule,
    ProjectsModule,
    CustomFieldsModule,
    MarketingModule,
    IntegrationsModule,
    CustomObjectsModule,
    SalesModule,
    CompaniesModule,
    ContactsModule,
    EmailModule,
    AutomationsModule,
    WorkspaceAreasModule,
    ProductsModule,
    BookingsModule,
    HotelsModule,
    RbacModule,
    CurrencyModule,
    ProjectTablesModule,
    forwardRef(() => TenantsModule), // TenantLogsService — security-event visibility for pl1
    DataVisibilityModule, // own-only/masking rules for AI-tool reads of sales/contacts/companies
  ],
  controllers: [AiController],
  providers: [
    AiQuotaService,
    AiOpenAiService,
    AiAnthropicService,
    AiToolsService,
    AiAssistantService,
    WorkspaceSyncService,
    WorkspaceSyncScheduler,
  ],
  exports: [AiQuotaService, AiOpenAiService, AiAssistantService, AiToolsService, WorkspaceSyncService],
})
export class AiModule {}
