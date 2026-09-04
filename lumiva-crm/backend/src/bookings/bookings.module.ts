import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BookingProject } from './booking-project.entity';
import { BookingLocation } from './booking-location.entity';
import { BookingService } from './booking-service.entity';
import { BookingResource } from './booking-resource.entity';
import { BookingStaffProfile } from './booking-staff-profile.entity';
import { Reservation } from './reservation.entity';
import { ReservationActivity } from './reservation-activity.entity';
import { BookingWaitlistEntry } from './booking-waitlist-entry.entity';
import { ReservationImportSession } from './reservation-import-session.entity';

import { Lead } from '../leads/lead.entity';
import { Contact } from '../contacts/contact.entity';
import { StaffUser } from '../staff/staff-user.entity';

import { BookingsProjectsService } from './bookings-projects.service';
import { BookingsCatalogService } from './bookings-catalog.service';
import { BookingsStaffService } from './bookings-staff.service';
import { BookingsAvailabilityService } from './bookings-availability.service';
import { ReservationsService } from './reservations.service';
import { BookingsWaitlistService } from './bookings-waitlist.service';
import { BookingsAnalyticsService } from './bookings-analytics.service';
import { ReservationsImportService } from './reservations-import.service';

import { BookingsController } from './bookings.controller';
import { BookingsPublicController } from './bookings-public.controller';
import { BookingsPublicStorefrontController } from './bookings-public-storefront.controller';
import { BookingWaitlistController } from './booking-waitlist.controller';
import { BookingAnalyticsController } from './booking-analytics.controller';
import { BookingLogsController } from './booking-logs.controller';
import { ReservationsImportController } from './reservations-import.controller';

import { ApiTokensModule } from '../api-tokens/api-tokens.module';
import { ApiTokenGuard } from '../api-tokens/api-token.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { RbacModule } from '../rbac/rbac.module';
import { AutomationsModule } from '../automations/automations.module';
import { TenantsModule } from '../tenants/tenants.module';
import { StaffUsersModule } from '../staff/staff-users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BookingProject,
      BookingLocation,
      BookingService,
      BookingResource,
      BookingStaffProfile,
      Reservation,
      ReservationActivity,
      BookingWaitlistEntry,
      ReservationImportSession,
      Lead,
      Contact,
      StaffUser,
    ]),
    ApiTokensModule,
    NotificationsModule,
    RbacModule,
    forwardRef(() => AutomationsModule),
    TenantsModule,
    forwardRef(() => StaffUsersModule),
  ],
  controllers: [
    BookingsController,
    BookingsPublicController,
    BookingsPublicStorefrontController,
    BookingWaitlistController,
    BookingAnalyticsController,
    BookingLogsController,
    ReservationsImportController,
  ],
  providers: [
    BookingsProjectsService,
    BookingsCatalogService,
    BookingsStaffService,
    BookingsAvailabilityService,
    ReservationsService,
    BookingsWaitlistService,
    BookingsAnalyticsService,
    ReservationsImportService,
    ApiTokenGuard,
  ],
  exports: [
    ReservationsService,
    BookingsProjectsService,
    BookingsAnalyticsService,
    BookingsCatalogService,
    BookingsAvailabilityService,
    BookingsStaffService,
  ],
})
export class BookingsModule {}
