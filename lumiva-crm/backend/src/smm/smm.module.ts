// src/smm/smm.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';

import { SmmController } from './smm.controller';
import { SmmService } from './smm.service';
import { SmmSyncService } from './smm-sync.service';
import { SmmProfile } from './smm-profile.entity';
import { SmmProfileStat } from './smm-profile-stat.entity';
import { SmmIntegration } from './smm-integration.entity';
import { ApiTokensModule } from '../api-tokens/api-tokens.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SmmProfile, SmmProfileStat, SmmIntegration]),
    PlatformSettingsModule,
    ApiTokensModule, // чтобы ApiTokenGuard и репозиторий были доступны
  ],
  controllers: [SmmController],
  providers: [SmmService, SmmSyncService],
  exports: [SmmService],
})
export class SmmModule {}
