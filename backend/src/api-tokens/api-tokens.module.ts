// backend/src/api-tokens/api-tokens.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiToken } from './api-token.entity';
import { ApiTokensService } from './api-tokens.service';
import { ApiTokensController } from './api-tokens.controller';
import { Tenant } from '../tenants/tenant.entity';

@Module({
  imports: [
    // 👇 Тут важно: добавили Tenant, чтобы TenantRepository был доступен
    TypeOrmModule.forFeature([ApiToken, Tenant]),
  ],
  controllers: [ApiTokensController],
  providers: [ApiTokensService],
  exports: [
    ApiTokensService,
    TypeOrmModule, // чтобы другие модули могли использовать ApiToken/Tenant репозитории, если надо
  ],
})
export class ApiTokensModule {}