// backend/src/staff/staff-users.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StaffUser } from './staff-user.entity';
import { User } from '../users/user.entity';
import { StaffUsersService } from './staff-users.service';
import { StaffUsersController } from './staff-users.controller';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StaffUser, User]),
    MailModule, // 👈 даём StaffUsersService доступ к MailService
  ],
  controllers: [StaffUsersController],
  providers: [StaffUsersService],
  exports: [StaffUsersService],
})
export class StaffUsersModule {}