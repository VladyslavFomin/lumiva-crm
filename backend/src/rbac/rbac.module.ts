// src/rbac/rbac.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StaffRolePermission } from './staff-role-permission.entity';
import { StaffUserPermission } from './staff-user-permission.entity';
import { RbacService } from './rbac.service';
import { RbacController } from './rbac.controller';
import { RbacGuard } from './rbac.guard';

@Module({
  imports: [TypeOrmModule.forFeature([StaffRolePermission, StaffUserPermission])],
  providers: [RbacService, RbacGuard],
  controllers: [RbacController],
  // ВАЖНО: экспортируем, чтобы другие модули могли использовать
  exports: [RbacService, RbacGuard],
})
export class RbacModule {}
