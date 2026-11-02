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
import { BookingZone } from './booking-zone.entity';
import { BookingMenuCategory } from './booking-menu-category.entity';
import { BookingMenuItem } from './booking-menu-item.entity';
import { BookingOrder } from './booking-order.entity';
import { BookingOrderItem } from './booking-order-item.entity';
import { BookingClassSession } from './booking-class-session.entity';
import { BookingPassPlan } from './booking-pass-plan.entity';
import { BookingPass } from './booking-pass.entity';
import { Payment } from '../payments/payment.entity';
import { PaymentsModule } from '../payments/payments.module';
import { BookingsPassLedgerService } from './bookings-pass-ledger.service';
import { BookingsOrdersService } from './bookings-orders.service';
import { BookingsRestaurantService } from './bookings-restaurant.service';
import { BookingsClassesService } from './bookings-classes.service';
import { BookingsPassesService } from './bookings-passes.service';
import { BookingsRentalService } from './bookings-rental.service';
import { BookingsVerticalService } from './bookings-vertical.service';
import {
  BookingOrdersController,
  BookingRestaurantController,
  BookingClassesController,
  BookingPassesController,
  BookingRentalController,
  BookingVerticalController,
} from './booking-verticals.controller';

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

import { BookingsAiService } from './bookings-ai.service';
import { ApiTokensModule } from '../api-tokens/api-tokens.module';
import { ApiTokenGuard } from '../api-tokens/api-token.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { RbacModule } from '../rbac/rbac.module';
import { AutomationsModule } from '../automations/automations.module';
import { TenantsModule } from '../tenants/tenants.module';
import { CurrencyModule } from '../currency/currency.module';
import { Tenant } from '../tenants/tenant.entity';
import { StaffUsersModule } from '../staff/staff-users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      BookingProject,
      BookingLocation,
      BookingService,
      BookingResource,
      BookingStaffProfile,
      Reservation,
      ReservationActivity,
      BookingWaitlistEntry,
      ReservationImportSession,
      BookingZone,
      BookingMenuCategory,
      BookingMenuItem,
      BookingOrder,
      BookingOrderItem,
      BookingClassSession,
      BookingPassPlan,
      BookingPass,
      Payment,
      Lead,
      Contact,
      StaffUser,
    ]),
    ApiTokensModule,
    NotificationsModule,
    RbacModule,
    forwardRef(() => AutomationsModule),
    TenantsModule,
    CurrencyModule,
    PaymentsModule,
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
    BookingOrdersController,
    BookingRestaurantController,
    BookingClassesController,
    BookingPassesController,
    BookingRentalController,
    BookingVerticalController,
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
    BookingsAiService,
    BookingsPassLedgerService,
    BookingsOrdersService,
    BookingsRestaurantService,
    BookingsClassesService,
    BookingsPassesService,
    BookingsRentalService,
    BookingsVerticalService,
    ApiTokenGuard,
  ],
  exports: [
    BookingsAiService,
    ReservationsService,
    BookingsProjectsService,
    BookingsAnalyticsService,
    BookingsCatalogService,
    BookingsAvailabilityService,
    BookingsStaffService,
    BookingsOrdersService,
    BookingsRestaurantService,
    BookingsClassesService,
    BookingsPassesService,
    BookingsRentalService,
    BookingsVerticalService,
  ],
})
export class BookingsModule {}
