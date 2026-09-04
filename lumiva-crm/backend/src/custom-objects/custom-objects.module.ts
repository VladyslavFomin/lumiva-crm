import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomObject } from './custom-object.entity';
import { CustomObjectField } from './custom-object-field.entity';
import { CustomObjectRecord } from './custom-object-record.entity';
import { CustomObjectView } from './custom-object-view.entity';
import { CustomObjectImportSession } from './custom-object-import-session.entity';
import { CustomObjectsService } from './custom-objects.service';
import { CustomObjectsController } from './custom-objects.controller';
import { CustomObjectsPublicController } from './custom-objects-public.controller';
import { AutomationsModule } from '../automations/automations.module';
import { ApiTokensModule } from '../api-tokens/api-tokens.module';
import { Tenant } from '../tenants/tenant.entity';
import { ApiToken } from '../api-tokens/api-token.entity';
import { ApiTokenGuard } from '../api-tokens/api-token.guard';
import { TenantsModule } from '../tenants/tenants.module';
import { WorkspaceAreasModule } from '../workspace-areas/workspace-areas.module';
import { WorkspaceAreaAccessGuard } from '../workspace-areas/workspace-area-access.guard';
import { WorkspaceAreaActivityLogModule } from '../workspace-areas/workspace-area-activity-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomObject,
      CustomObjectField,
      CustomObjectRecord,
      CustomObjectView,
      CustomObjectImportSession,
      Tenant,
      ApiToken,
    ]),
    forwardRef(() => AutomationsModule),
    ApiTokensModule,
    TenantsModule,
    WorkspaceAreasModule,
    WorkspaceAreaActivityLogModule,
  ],
  controllers: [CustomObjectsController, CustomObjectsPublicController],
  providers: [CustomObjectsService, ApiTokenGuard, WorkspaceAreaAccessGuard],
  exports: [CustomObjectsService],
})
export class CustomObjectsModule {}

