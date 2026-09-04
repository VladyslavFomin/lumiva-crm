import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationConnection } from '../integration-connection.entity';
import { Lead } from '../../leads/lead.entity';
import { Sale } from '../../sales/sale.entity';
import { Project } from '../../projects/project.entity';
import { JiraInboundService } from './jira-inbound.service';
import { JiraInboundController } from './jira-inbound.controller';
import { JiraLinkService } from './jira-link.service';
import { JiraLinkController } from './jira-link.controller';
import { LeadsModule } from '../../leads/leads.module';
import { NotesModule } from '../../notes/notes.module';
import { IntegrationsModule } from '../integrations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IntegrationConnection, Lead, Sale, Project]),
    forwardRef(() => LeadsModule),
    forwardRef(() => NotesModule),
    forwardRef(() => IntegrationsModule),
  ],
  controllers: [JiraInboundController, JiraLinkController],
  providers: [JiraInboundService, JiraLinkService],
  exports: [JiraInboundService, JiraLinkService],
})
export class JiraInboundModule {}
