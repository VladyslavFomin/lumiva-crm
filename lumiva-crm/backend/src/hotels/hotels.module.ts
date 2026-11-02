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
import { HotelContract } from './hotel-contract.entity';
import { HotelRoomBlock } from './hotel-room-block.entity';
import { HotelContractsService } from './hotel-contracts.service';
import { HotelDemoDataService } from './hotel-demo-data.service';
import { HotelPartnerStatementService } from './hotel-partner-statement.service';
import { HotelGuestRegisterService } from './hotel-guest-register.service';
import { HotelPartnersController } from './hotel-partners.controller';
import { HotelsGalleryService } from './hotels-gallery.service';
import { HotelsFactsheetService } from './hotels-factsheet.service';
import { HotelsInfoImportService } from './hotels-info-import.service';
import { HotelFeedService } from './hotel-feed.service';
import { HotelAnalyticsService } from './hotel-analytics.service';
import { HotelReservationsService } from './hotel-reservations.service';
import { HotelsReservationsImportService } from './hotels-reservations-import.service';
import { HotelsPricingImportService } from './hotels-pricing-import.service';
import { HotelsRoomPricingImportService } from './hotels-room-pricing-import.service';
import { HotelsPriceListImportService } from './hotels-price-list-import.service';
import { HotelRoomUnitsService } from './hotel-room-units.service';
import { HotelAvailabilityService } from './hotel-availability.service';
import { HotelFrontDeskService } from './hotel-frontdesk.service';
import { HotelsPublicStorefrontService } from './hotels-public-storefront.service';

import { HotelsController } from './hotels.controller';
import { HotelAnalyticsController } from './hotel-analytics.controller';
import { HotelReservationsController } from './hotel-reservations.controller';
import { HotelRoomUnitsController } from './hotel-room-units.controller';
import { HotelRackService } from './hotel-rack.service';
import { HotelLifecycleScheduler } from './hotel-lifecycle.scheduler';
import { HotelHousekeepingService } from './hotel-housekeeping.service';
import { HotelHousekeepingController } from './hotel-housekeeping.controller';
import { HotelCashierController } from './hotel-cashier.controller';
import { HotelNightAuditController } from './hotel-night-audit.controller';
import { HotelNightAuditService } from './hotel-night-audit.service';
import { HotelReportsController } from './hotel-reports.controller';
import { HotelReportsService } from './hotel-reports.service';
import { HotelRateEngineService } from './hotel-rate-engine.service';
import { HotelFolioService } from './hotel-folio.service';
import { HotelFolioLine, HotelExtraService, HotelCashShift, HotelNightAudit } from './hotel-folio.entities';
import { HotelRoomOutage, HotelHousekeepingTask, HotelMaintenanceIssue, HotelLostFound } from './hotel-housekeeping.entities';
import { HotelFrontDeskController } from './hotel-frontdesk.controller';
import { HotelsReservationsImportController } from './hotels-reservations-import.controller';
import { HotelsPricingImportController } from './hotels-pricing-import.controller';
import { HotelsRoomPricingImportController } from './hotels-room-pricing-import.controller';
import { HotelsPriceListImportController } from './hotels-price-list-import.controller';
import { HotelsInfoImportController } from './hotels-info-import.controller';
import { HotelFeedController } from './hotel-feed.controller';
import { HotelsPublicStorefrontController } from './hotels-public-storefront.controller';

import { RbacModule } from '../rbac/rbac.module';
import { AutomationsModule } from '../automations/automations.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { MailModule } from '../mail/mail.module';
import { TenantsModule } from '../tenants/tenants.module';
import { CurrencyModule } from '../currency/currency.module';
import { Tenant } from '../tenants/tenant.entity';
import { HotelLiveController } from './hotel-live.controller';
import { HotelLiveService } from './hotel-live.service';
import { HotelLiveSubscriber } from './hotel-live.subscriber';
import { User } from '../users/user.entity';
import { HotelChannelsController, HotelChannelsPublicController } from './hotel-channels.controller';
import { HotelAriController } from './hotel-ari.controller';
import { HotelAriService } from './hotel-ari.service';
import { HotelRatePlan } from './hotel-rate-plan.entity';
import { HotelRatePlansService } from './hotel-rate-plans.service';
import { HotelRatePlansController } from './hotel-rate-plans.controller';
import { HotelPromotion } from './hotel-promotion.entity';
import { HotelPromotionsService } from './hotel-promotions.service';
import { HotelPromotionsController } from './hotel-promotions.controller';
import { HotelGuestProfile } from './hotel-guest-profile.entity';
import { HotelGuestProfilesService } from './hotel-guest-profiles.service';
import { HotelGuestProfilesController } from './hotel-guest-profiles.controller';
import { HotelGroup } from './hotel-group.entity';
import { HotelGroupsService } from './hotel-groups.service';
import { HotelGroupsController } from './hotel-groups.controller';
import { HotelPrecheckin, HotelUpsellRequest } from './hotel-precheckin.entities';
import { HotelRevenueRule } from './hotel-revenue-rule.entity';
import { HotelRevenueService } from './hotel-revenue.service';
import { HotelRevenueController } from './hotel-revenue.controller';
import { HotelPosCheck, HotelPosOutlet } from './hotel-pos.entities';
import { HotelPosService } from './hotel-pos.service';
import { HotelPosController } from './hotel-pos.controller';
import { HotelPrecheckinService } from './hotel-precheckin.service';
import { HotelPrecheckinController, HotelPrecheckinPublicController } from './hotel-precheckin.controller';
import { HotelChannelsService } from './hotel-channels.service';
import { HotelChannelsScheduler } from './hotel-channels.scheduler';
import { HotelChannelAriState, HotelChannelConnection, HotelChannelLog, HotelChannelMapping } from './hotel-channel.entities';
import { HotelGuestCareController, HotelGuestCarePublicController } from './hotel-guest-care.controller';
import { HotelGuestCareService } from './hotel-guest-care.service';
import { HotelGuestRequest } from './hotel-guest-care.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      User,
      HotelChannelConnection,
      HotelChannelMapping,
      HotelChannelLog,
      HotelChannelAriState,
      HotelRatePlan,
      HotelPromotion,
      HotelGuestProfile,
      HotelGroup,
      HotelPrecheckin,
      HotelUpsellRequest,
      HotelRevenueRule,
      HotelPosOutlet,
      HotelPosCheck,
      HotelGuestRequest,
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
      HotelContract,
      HotelRoomBlock,
      HotelRoomOutage,
      HotelHousekeepingTask,
      HotelMaintenanceIssue,
      HotelLostFound,
      HotelFolioLine,
      HotelExtraService,
      HotelCashShift,
      HotelNightAudit,
    ]),
    RbacModule,
    forwardRef(() => AutomationsModule),
    AuditLogModule,
    MailModule,
    TenantsModule,
    CurrencyModule,
  ],
  controllers: [
    // Order matters: HotelReservationsController's bare `GET hotels/reservations` must be
    // registered before HotelsController's `GET hotels/:id` catch-all, or Nest/Express would
    // match "reservations" as the :id param first (same gotcha as within a single controller,
    // but here it spans two controllers under the same 'hotels' prefix).
    HotelReservationsController,
    HotelPartnersController,
    HotelRoomUnitsController,
    HotelFrontDeskController,
    HotelLiveController,
    HotelChannelsController,
    HotelChannelsPublicController,
    HotelAriController,
    HotelRatePlansController,
    HotelPromotionsController,
    HotelGuestProfilesController,
    HotelGroupsController,
    HotelPrecheckinController,
    HotelPrecheckinPublicController,
    HotelRevenueController,
    HotelPosController,
    HotelGuestCareController,
    HotelGuestCarePublicController,
    HotelHousekeepingController,
    HotelCashierController,
    HotelNightAuditController,
    HotelReportsController,
    HotelAnalyticsController,
    HotelsReservationsImportController,
    HotelsPricingImportController,
    HotelsRoomPricingImportController,
    HotelsPriceListImportController,
    HotelsInfoImportController,
    HotelFeedController,
    HotelsPublicStorefrontController,
    HotelsController,
  ],
  providers: [
    HotelLiveService,
    HotelLiveSubscriber,
    HotelChannelsService,
    HotelAriService,
    HotelRatePlansService,
    HotelPromotionsService,
    HotelGuestProfilesService,
    HotelGroupsService,
    HotelPrecheckinService,
    HotelRevenueService,
    HotelPosService,
    HotelGuestCareService,
    HotelChannelsScheduler,
    HotelsService,
    HotelRoomTypesService,
    HotelsPricingService,
    HotelsAgenciesService,
    HotelContractsService,
    HotelDemoDataService,
    HotelPartnerStatementService,
    HotelGuestRegisterService,
    HotelsGalleryService,
    HotelsFactsheetService,
    HotelsInfoImportService,
    HotelFeedService,
    HotelAnalyticsService,
    HotelReservationsService,
    HotelsReservationsImportService,
    HotelsPricingImportService,
    HotelsRoomPricingImportService,
    HotelsPriceListImportService,
    HotelRoomUnitsService,
    HotelAvailabilityService,
    HotelFrontDeskService,
    HotelRackService,
    HotelLifecycleScheduler,
    HotelHousekeepingService,
    HotelFolioService,
    HotelNightAuditService,
    HotelReportsService,
    HotelRateEngineService,
    HotelsPublicStorefrontService,
  ],
  exports: [
    HotelReservationsService,
    HotelsService,
    HotelAnalyticsService,
    HotelsPricingService,
    HotelRoomTypesService,
    HotelsPublicStorefrontService,
    HotelRoomUnitsService,
  ],
})
export class HotelsModule {}
