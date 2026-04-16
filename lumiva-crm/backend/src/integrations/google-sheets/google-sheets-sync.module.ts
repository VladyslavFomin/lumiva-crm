import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IntegrationConnection } from '../integration-connection.entity';
import { IntegrationGoogleSheetSyncState } from './integration-google-sheet-sync-state.entity';
import { IntegrationGoogleSheetSyncJob } from './integration-google-sheet-sync-job.entity';
import { GoogleSheetsTokenService } from './google-sheets-token.service';
import { GoogleSheetsHttpService } from './google-sheets-http.service';
import { GoogleSheetsSyncService } from './google-sheets-sync.service';
import { GoogleSheetsSyncScheduler } from './google-sheets-sync.scheduler';
import { Lead } from '../../leads/lead.entity';
import { CustomObjectRecord } from '../../custom-objects/custom-object-record.entity';
import { LeadsModule } from '../../leads/leads.module';
import { CustomObjectsModule } from '../../custom-objects/custom-objects.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IntegrationConnection,
      IntegrationGoogleSheetSyncState,
      IntegrationGoogleSheetSyncJob,
      Lead,
      CustomObjectRecord,
    ]),
    forwardRef(() => LeadsModule),
    forwardRef(() => CustomObjectsModule),
  ],
  providers: [
    GoogleSheetsTokenService,
    GoogleSheetsHttpService,
    GoogleSheetsSyncService,
    GoogleSheetsSyncScheduler,
  ],
  exports: [GoogleSheetsSyncService],
})
export class GoogleSheetsSyncModule {}
