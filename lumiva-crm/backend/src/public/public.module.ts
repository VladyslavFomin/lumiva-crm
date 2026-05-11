// src/public/public.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PublicController } from './public.controller';
import { ApiToken } from '../api-tokens/api-token.entity';
import { Tenant } from '../tenants/tenant.entity';
import { ApiTokenGuard } from '../api-tokens/api-token.guard';
import { TenantsModule } from '../tenants/tenants.module';
import { SitesModule } from '../sites/sites.module';
import { LeadsModule } from '../leads/leads.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiToken, Tenant]),
    TenantsModule,
    SitesModule,
    forwardRef(() => LeadsModule),
  ],
  controllers: [PublicController],
  providers: [ApiTokenGuard],
  exports: [ApiTokenGuard],
})
export class PublicModule {}
