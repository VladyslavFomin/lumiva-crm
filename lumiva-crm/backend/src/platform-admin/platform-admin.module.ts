// src/platform-admin/platform-admin.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';

import { PlatformAdminUser } from './admin-user.entity';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformAdminGuard } from './platform-admin.guard';
import { PlatformAdminStrategy } from './platform-admin.strategy';
import { Tenant } from '../tenants/tenant.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlatformAdminUser, Tenant]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: '8h' },
    }),
  ],
  providers: [PlatformAdminService, PlatformAuthService, PlatformAdminGuard, PlatformAdminStrategy],
  controllers: [PlatformAdminController, PlatformAuthController],
})
export class PlatformAdminModule {}