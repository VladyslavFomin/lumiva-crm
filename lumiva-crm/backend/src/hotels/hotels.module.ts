import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelMarket } from './hotel-market.entity';
import { HotelRoomMarketPrice } from './hotel-room-market-price.entity';
import { HotelRoomDateOverride } from './hotel-room-date-override.entity';
import { HotelMarketGroup } from './hotel-market-group.entity';
import { HotelPricingPeriod } from './hotel-pricing-period.entity';
import { HotelDailyMarketRate } from './hotel-daily-market-rate.entity';
import { HotelRoomOccupancyType } from './hotel-room-occupancy-type.entity';
import { HotelRoomStopSaleDate } from './hotel-room-stop-sale-date.entity';
import { HotelSeasonPacingTarget } from './hotel-season-pacing-target.entity';
import { HotelAgency } from './hotel-agency.entity';
import { HotelReservation } from './hotel-reservation.entity';
import { HotelReservationImportSession } from './hotel-reservation-import-session.entity';
import { HotelPricingImportSession } from './hotel-pricing-import-session.entity';
import { HotelRoomPricingImportSession } from './hotel-room-pricing-import-session.entity';
import { HotelGalleryCategory } from './hotel-gallery-category.entity';
import { HotelPhoto } from './hotel-photo.entity';
import { HotelFactsheetItem } from './hotel-factsheet-item.entity';
import { HotelInfoImportSession } from './hotel-info-import-session.entity';
import { HotelRoomUnit } from './hotel-room-unit.entity';

import { HotelsService } from './hotels.service';
import { HotelRoomTypesService } from './hotel-room-types.service';
import { HotelsPricingService } from './hotels-pricing.service';
import { HotelsAgenciesService } from './hotels-agencies.service';
import { HotelsGalleryService } from './hotels-gallery.service';
import { HotelsFactsheetService } from './hotels-factsheet.service';
import { HotelsInfoImportService } from './hotels-info-import.service';
import { HotelFeedService } from './hotel-feed.service';
import { HotelAnalyticsService } from './hotel-analytics.service';
import { HotelReservationsService } from './hotel-reservations.service';
import { HotelsReservationsImportService } from './hotels-reservations-import.service';
import { HotelsPricingImportService } from './hotels-pricing-import.service';
import { HotelsRoomPricingImportService } from './hotels-room-pricing-import.service';
import { HotelRoomUnitsService } from './hotel-room-units.service';
import { HotelAvailabilityService } from './hotel-availability.service';
import { HotelFrontDeskService } from './hotel-frontdesk.service';
import { HotelsPublicStorefrontService } from './hotels-public-storefront.service';

import { HotelsController } from './hotels.controller';
import { HotelAnalyticsController } from './hotel-analytics.controller';
import { HotelReservationsController } from './hotel-reservations.controller';
import { HotelRoomUnitsController } from './hotel-room-units.controller';
import { HotelFrontDeskController } from './hotel-frontdesk.controller';
import { HotelsReservationsImportController } from './hotels-reservations-import.controller';
import { HotelsPricingImportController } from './hotels-pricing-import.controller';
import { HotelsRoomPricingImportController } from './hotels-room-pricing-import.controller';
import { HotelsInfoImportController } from './hotels-info-import.controller';
import { HotelFeedController } from './hotel-feed.controller';
import { HotelsPublicStorefrontController } from './hotels-public-storefront.controller';

import { RbacModule } from '../rbac/rbac.module';
import { AutomationsModule } from '../automations/automations.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { MailModule } from '../mail/mail.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Hotel,
      HotelRoomType,
      HotelMarket,
      HotelRoomMarketPrice,
      HotelRoomDateOverride,
      HotelMarketGroup,
      HotelPricingPeriod,
      HotelDailyMarketRate,
      HotelRoomOccupancyType,
      HotelRoomStopSaleDate,
      HotelSeasonPacingTarget,
      HotelAgency,
      HotelReservation,
      HotelReservationImportSession,
      HotelPricingImportSession,
      HotelRoomPricingImportSession,
      HotelGalleryCategory,
      HotelPhoto,
      HotelFactsheetItem,
      HotelInfoImportSession,
      HotelRoomUnit,
    ]),
    RbacModule,
    forwardRef(() => AutomationsModule),
    AuditLogModule,
    MailModule,
    TenantsModule,
  ],
  controllers: [
    // Order matters: HotelReservationsController's bare `GET hotels/reservations` must be
    // registered before HotelsController's `GET hotels/:id` catch-all, or Nest/Express would
    // match "reservations" as the :id param first (same gotcha as within a single controller,
    // but here it spans two controllers under the same 'hotels' prefix).
    HotelReservationsController,
    HotelRoomUnitsController,
    HotelFrontDeskController,
    HotelAnalyticsController,
    HotelsReservationsImportController,
    HotelsPricingImportController,
    HotelsRoomPricingImportController,
    HotelsInfoImportController,
    HotelFeedController,
    HotelsPublicStorefrontController,
    HotelsController,
  ],
  providers: [
    HotelsService,
    HotelRoomTypesService,
    HotelsPricingService,
    HotelsAgenciesService,
    HotelsGalleryService,
    HotelsFactsheetService,
    HotelsInfoImportService,
    HotelFeedService,
    HotelAnalyticsService,
    HotelReservationsService,
    HotelsReservationsImportService,
    HotelsPricingImportService,
    HotelsRoomPricingImportService,
    HotelRoomUnitsService,
    HotelAvailabilityService,
    HotelFrontDeskService,
    HotelsPublicStorefrontService,
  ],
  exports: [
    HotelReservationsService,
    HotelsService,
    HotelAnalyticsService,
    HotelsPricingService,
    HotelRoomTypesService,
    HotelsPublicStorefrontService,
  ],
})
export class HotelsModule {}
