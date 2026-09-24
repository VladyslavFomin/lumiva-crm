// src/rbac/rbac.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StaffRolePermission } from './staff-role-permission.entity';
import { StaffUserPermission } from './staff-user-permission.entity';
import { Department } from '../departments/department.entity';
import { RbacService } from './rbac.service';
import { RbacController } from './rbac.controller';
import { RbacGuard } from './rbac.guard';

@Module({
  // Department — только регистрация репозитория (не весь DepartmentsModule, во избежание
  // цикла), нужен RbacService.isDepartmentHead() для автодоступа руководителей отделов к
  // 'ai_employees' — см. комментарий там.
  imports: [TypeOrmModule.forFeature([StaffRolePermission, StaffUserPermission, Department])],
  providers: [RbacService, RbacGuard],
  controllers: [RbacController],
  // ВАЖНО: экспортируем, чтобы другие модули могли использовать
  exports: [RbacService, RbacGuard],
})
export class RbacModule {}
