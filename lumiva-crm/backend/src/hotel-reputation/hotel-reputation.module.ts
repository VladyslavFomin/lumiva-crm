import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hotel } from '../hotels/hotel.entity';
import { HotelReservation } from '../hotels/hotel-reservation.entity';
import { HotelRoomUnit } from '../hotels/hotel-room-unit.entity';
import { HotelRoomType } from '../hotels/hotel-room-type.entity';
import { TelegramBot } from '../telegram-crm/telegram-bot.entity';
import { User } from '../users/user.entity';
import { IntegrationConnection } from '../integrations/integration-connection.entity';
import { AiAgent } from '../ai-employees/ai-agent.entity';
import { AiAgentReport } from '../ai-employees/ai-agent-report.entity';
import { RbacModule } from '../rbac/rbac.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import {
  HotelBrand,
  HotelReputationSettings,
  HotelReview,
  HotelReviewAlert,
  HotelReviewDuplicate,
  HotelReviewReply,
  HotelCompetitor,
  HotelCompetitorSource,
  HotelCompetitorReview,
  HotelReviewSource,
  HotelReviewSyncRun,
  HotelReviewTopic,
  HotelReviewVersion,
} from './reputation.entities';
import { ReputationSettingsService } from './reputation-settings.service';
import { GoogleBusinessService } from './google-business.service';
import { ApifyService } from './apify.service';
import { ReputationAiService } from './reputation-ai.service';
import { ReputationAlertsService } from './reputation-alerts.service';
import { ReputationEventsService } from './reputation-events.service';
import { ReputationAgentService } from './reputation-agent.service';
import { ReputationSyncService } from './reputation-sync.service';
import { ReputationReviewsService } from './reputation-reviews.service';
import { ReputationAnalyticsService } from './reputation-analytics.service';
import { ReputationScheduler } from './reputation.scheduler';
import { ReputationDuplicatesService } from './reputation-duplicates.service';
import { ReputationReportService } from './reputation-report.service';
import { ReputationCompetitorsService } from './reputation-competitors.service';
import { ReputationReservationsService } from './reputation-reservations.service';
import { ReputationController, ReputationPublicController } from './reputation.controller';

/**
 * Отели → Отзывы: отзывы с 8 площадок (Google, HolidayCheck, Tripadvisor, Яндекс, Expedia, Check24, Otelpuan, Booking.com)
 * в одной базе, ИИ-темы, дашборд репутации, ответы из CRM (Google, HolidayCheck), алерты.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      HotelBrand,
      HotelReviewSource,
      HotelReview,
      HotelReviewVersion,
      HotelReviewReply,
      HotelReviewTopic,
      HotelReviewSyncRun,
      HotelReputationSettings,
      HotelReviewAlert,
      HotelReviewDuplicate,
      HotelCompetitor,
      HotelCompetitorSource,
      HotelCompetitorReview,
      Hotel,
      HotelReservation,
      HotelRoomUnit,
      HotelRoomType,
      TelegramBot,
      User,
      IntegrationConnection,
      AiAgent,
      AiAgentReport,
    ]),
    RbacModule,
    NotificationsModule,
    MailModule,
    PlatformSettingsModule,
  ],
  controllers: [ReputationController, ReputationPublicController],
  providers: [
    ReputationSettingsService,
    GoogleBusinessService,
    ApifyService,
    ReputationAiService,
    ReputationAlertsService,
    ReputationEventsService,
    ReputationAgentService,
    ReputationSyncService,
    ReputationReviewsService,
    ReputationAnalyticsService,
    ReputationDuplicatesService,
    ReputationReportService,
    ReputationCompetitorsService,
    ReputationReservationsService,
    ReputationScheduler,
  ],
})
export class HotelReputationModule {}
