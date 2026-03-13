import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

import { Tenant } from '../tenants/tenant.entity';
import { User } from '../users/user.entity';
import { StaffUser } from '../staff/staff-user.entity';

import { RolesGuard } from './roles.guard';
import { StaffUsersModule } from '../staff/staff-users.module';
import { TenantsModule } from '../tenants/tenants.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, User, StaffUser]),

    // ⬇️ ВАЖНО! Без этого StaffUsersService будет undefined
    StaffUsersModule,
    TenantsModule,
    MailModule,

    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET || 'changeme',
        signOptions: {
          expiresIn:
            process.env.JWT_EXPIRES_IN !== undefined
              ? Number(process.env.JWT_EXPIRES_IN)
              : 60 * 60 * 24 * 7,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesGuard],
  exports: [AuthService, RolesGuard],
})
export class AuthModule {}
