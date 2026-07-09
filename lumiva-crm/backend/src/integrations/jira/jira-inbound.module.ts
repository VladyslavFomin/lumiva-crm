import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationConnection } from '../integration-connection.entity';
import { JiraInboundService } from './jira-inbound.service';
import { JiraInboundController } from './jira-inbound.controller';
import { LeadsModule } from '../../leads/leads.module';
import { NotesModule } from '../../notes/notes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IntegrationConnection]),
    forwardRef(() => LeadsModule),
    forwardRef(() => NotesModule),
  ],
  controllers: [JiraInboundController],
  providers: [JiraInboundService],
  exports: [JiraInboundService],
})
export class JiraInboundModule {}
