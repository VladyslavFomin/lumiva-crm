import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationConnection } from '../integration-connection.entity';
import { SlackInboundService } from './slack-inbound.service';
import { SlackInboundController } from './slack-inbound.controller';
import { LeadsModule } from '../../leads/leads.module';
import { NotesModule } from '../../notes/notes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IntegrationConnection]),
    forwardRef(() => LeadsModule),
    forwardRef(() => NotesModule),
  ],
  controllers: [SlackInboundController],
  providers: [SlackInboundService],
  exports: [SlackInboundService],
})
export class SlackInboundModule {}
