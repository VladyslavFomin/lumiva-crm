import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Lead } from '../leads/lead.entity';
import { LeadActivity } from '../leads/lead-activity.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, Lead, LeadActivity, StaffUser])],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
