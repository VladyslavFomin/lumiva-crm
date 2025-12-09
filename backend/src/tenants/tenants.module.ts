// backend/src/tenants/tenants.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Tenant } from './tenant.entity';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { PlatformTenantsController } from './platform-tenants.controller';

import { StaffUsersModule } from '../staff/staff-users.module';
import { RbacModule } from '../rbac/rbac.module';
import { PlatformAdminModule } from '../platform-admin/platform-admin.module';
import { MailModule } from '../mail/mail.module'; // <-- добавили

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant]),

    // чтобы TenantsService мог использовать StaffUsersService
    forwardRef(() => StaffUsersModule),

    // RBAC для обычных /tenants (внутри CRM)
    RbacModule,

    // чтобы PlatformTenantsController мог использовать PlatformAdminGuard
    PlatformAdminModule,

    // чтобы TenantsService мог инжектить MailService
    MailModule,
  ],
  providers: [TenantsService],
  controllers: [
    TenantsController,          // обычные ручки для CRM
    PlatformTenantsController,  // админ-панель pl1
  ],
  exports: [TenantsService],
})
export class TenantsModule {}