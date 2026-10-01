import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { StorageQuotaService } from './storage-quota.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Tenant])],
  providers: [StorageQuotaService],
  exports: [StorageQuotaService],
})
export class StorageQuotaModule {}
