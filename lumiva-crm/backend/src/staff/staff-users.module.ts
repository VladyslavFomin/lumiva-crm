// backend/src/staff/staff-users.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StaffUser } from './staff-user.entity';
import { User } from '../users/user.entity';
import { Tenant } from '../tenants/tenant.entity';
import { Department } from '../departments/department.entity';
import { StaffUsersService } from './staff-users.service';
import { StaffUsersController } from './staff-users.controller';
import { MailModule } from '../mail/mail.module';
import { TenantsModule } from '../tenants/tenants.module';
import { UserSessionsModule } from '../auth/user-sessions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StaffUser, User, Tenant, Department]),
    MailModule, // 👈 даём StaffUsersService доступ к MailService
    forwardRef(() => TenantsModule), // для TenantLogsService, избегаем циклов
    UserSessionsModule,
  ],
  controllers: [StaffUsersController],
  providers: [StaffUsersService],
  exports: [StaffUsersService],
})
export class StaffUsersModule {}
