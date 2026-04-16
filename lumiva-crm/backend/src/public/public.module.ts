// src/public/public.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PublicController } from './public.controller';
import { ApiToken } from '../api-tokens/api-token.entity';
import { Tenant } from '../tenants/tenant.entity';
import { ApiTokenGuard } from '../api-tokens/api-token.guard';
import { TenantsModule } from '../tenants/tenants.module';
import { SitesModule } from '../sites/sites.module';

@Module({
  imports: [
    // Нужен, чтобы ApiTokenGuard мог инжектить репозитории ApiToken и Tenant
    TypeOrmModule.forFeature([ApiToken, Tenant]),

    // Для TenantLogsService внутри ApiTokenGuard
    TenantsModule,
    SitesModule,
  ],
  controllers: [PublicController],
  providers: [ApiTokenGuard],
  exports: [ApiTokenGuard], // на будущее, если где-то ещё понадобится
})
export class PublicModule {}
