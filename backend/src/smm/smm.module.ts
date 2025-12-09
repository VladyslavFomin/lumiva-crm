// src/smm/smm.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SmmController } from './smm.controller';
import { SmmService } from './smm.service';
import { SmmProfile } from './smm-profile.entity';
import { SmmProfileStat } from './smm-profile-stat.entity';
import { ApiTokensModule } from '../api-tokens/api-tokens.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SmmProfile, SmmProfileStat]),
    ApiTokensModule, // чтобы ApiTokenGuard и репозиторий были доступны
  ],
  controllers: [SmmController],
  providers: [SmmService],
  exports: [SmmService],
})
export class SmmModule {}