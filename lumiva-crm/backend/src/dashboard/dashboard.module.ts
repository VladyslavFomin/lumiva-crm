import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Lead } from '../leads/lead.entity';
import { LeadActivity } from '../leads/lead-activity.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { Tenant } from '../tenants/tenant.entity';
import { Project } from '../projects/project.entity';
import { Reservation } from '../bookings/reservation.entity';
import { AuraModule } from '../aura/aura.module';
import { MediaModule } from '../media/media.module';
import { RbacModule } from '../rbac/rbac.module';
import { DashboardService } from './dashboard.service';
import { DashboardOverviewService } from './dashboard-overview.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Lead, LeadActivity, StaffUser, Tenant, Project, Reservation]),
    AuraModule,
    MediaModule,
    RbacModule,
  ],
  providers: [DashboardService, DashboardOverviewService],
  controllers: [DashboardController],
})
export class DashboardModule {}
