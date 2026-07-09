import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationConnection } from '../integration-connection.entity';
import { SapInboundService } from './sap-inbound.service';
import { SapInboundController } from './sap-inbound.controller';
import { LeadsModule } from '../../leads/leads.module';
import { NotesModule } from '../../notes/notes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IntegrationConnection]),
    forwardRef(() => LeadsModule),
    forwardRef(() => NotesModule),
  ],
  controllers: [SapInboundController],
  providers: [SapInboundService],
  exports: [SapInboundService],
})
export class SapInboundModule {}
