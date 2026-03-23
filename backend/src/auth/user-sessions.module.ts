import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSession } from './user-session.entity';
import { User } from '../users/user.entity';
import { UserSessionsService } from './user-sessions.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserSession, User])],
  providers: [UserSessionsService],
  exports: [UserSessionsService],
})
export class UserSessionsModule {}
