import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DemoRequest } from './demo-request.entity';
import {
  DemoRequestsPlatformController,
  DemoRequestsPublicController,
} from './demo-requests.controller';
import { DemoRequestsService } from './demo-requests.service';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DemoRequest]),
    PlatformSettingsModule,
    TenantsModule,
  ],
  providers: [DemoRequestsService],
  controllers: [DemoRequestsPublicController, DemoRequestsPlatformController],
  exports: [DemoRequestsService],
})
export class DemoRequestsModule {}
