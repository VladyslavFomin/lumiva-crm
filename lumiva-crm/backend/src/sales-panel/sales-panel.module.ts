import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesProspect } from './sales-prospect.entity';
import { SalesInvitation } from './sales-invitation.entity';
import { SalesApiUsage } from './sales-api-usage.entity';
import { SalesReplyPollState } from './sales-reply-poll-state.entity';
import { SalesEmailTemplate } from './sales-email-template.entity';
import { GooglePlacesService } from './google-places.service';
import { WebsiteEmailScraperService } from './website-email-scraper.service';
import { SalesPanelService } from './sales-panel.service';
import { SalesInvitationsService } from './sales-invitations.service';
import { SalesReplyPollService } from './sales-reply-poll.service';
import { SalesAttachmentsService } from './sales-attachments.service';
import { SalesPanelController } from './sales-panel.controller';
import { MailModule } from '../mail/mail.module';
import { PlatformAdminModule } from '../platform-admin/platform-admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SalesProspect,
      SalesInvitation,
      SalesApiUsage,
      SalesReplyPollState,
      SalesEmailTemplate,
    ]),
    MailModule,
    PlatformAdminModule,
  ],
  controllers: [SalesPanelController],
  providers: [
    GooglePlacesService,
    WebsiteEmailScraperService,
    SalesPanelService,
    SalesInvitationsService,
    SalesReplyPollService,
    SalesAttachmentsService,
  ],
})
export class SalesPanelModule {}
