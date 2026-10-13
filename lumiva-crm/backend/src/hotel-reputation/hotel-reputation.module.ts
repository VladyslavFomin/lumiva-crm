import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hotel } from '../hotels/hotel.entity';
import { TelegramBot } from '../telegram-crm/telegram-bot.entity';
import { User } from '../users/user.entity';
import { IntegrationConnection } from '../integrations/integration-connection.entity';
import { RbacModule } from '../rbac/rbac.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import {
  HotelBrand,
  HotelReputationSettings,
  HotelReview,
  HotelReviewAlert,
  HotelReviewReply,
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
import { ReputationSyncService } from './reputation-sync.service';
import { ReputationReviewsService } from './reputation-reviews.service';
import { ReputationAnalyticsService } from './reputation-analytics.service';
import { ReputationScheduler } from './reputation.scheduler';
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
      Hotel,
      TelegramBot,
      User,
      IntegrationConnection,
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
    ReputationSyncService,
    ReputationReviewsService,
    ReputationAnalyticsService,
    ReputationScheduler,
  ],
})
export class HotelReputationModule {}
