// src/integrations/zapier-make/zapier-make-inbound.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IntegrationConnection } from '../integration-connection.entity';
import { LeadsModule } from '../../leads/leads.module';
import { NotesModule } from '../../notes/notes.module';
import { ZapierMakeInboundController } from './zapier-make-inbound.controller';
import { ZapierMakeInboundService } from './zapier-make-inbound.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IntegrationConnection]),
    forwardRef(() => LeadsModule),
    forwardRef(() => NotesModule),
  ],
  controllers: [ZapierMakeInboundController],
  providers: [ZapierMakeInboundService],
  exports: [ZapierMakeInboundService],
})
export class ZapierMakeInboundModule {}
