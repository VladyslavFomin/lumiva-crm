import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PlatformAdminGuard } from '../platform-admin/platform-admin.guard';
import { SalesPanelService } from './sales-panel.service';
import { SalesInvitationsService } from './sales-invitations.service';
import { SalesReplyPollService } from './sales-reply-poll.service';
import { SalesAttachmentsService } from './sales-attachments.service';
import { SearchProspectsDto } from './dto/search-prospects.dto';
import { ListProspectsDto } from './dto/list-prospects.dto';
import { SendInvitationDto } from './dto/send-invitation.dto';
import { TestInvitationDto } from './dto/test-invitation.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import type { SalesInvitationLanguage } from './sales-invitation.entity';
import { MulterSalesUploadFilter, SALES_ATTACHMENT_MAX_BYTES } from './multer-sales-upload.filter';

@Controller('platform/sales-panel')
@UseGuards(PlatformAdminGuard)
export class SalesPanelController {
  constructor(
    private readonly salesPanel: SalesPanelService,
    private readonly invitations: SalesInvitationsService,
    private readonly replyPoll: SalesReplyPollService,
    private readonly attachmentsService: SalesAttachmentsService,
  ) {}

  @Get('search')
  async search(@Query() query: SearchProspectsDto) {
    return this.salesPanel.search({
      city: query.city,
      businessType: query.businessType,
      pageToken: query.pageToken,
      refresh: query.refresh === 'true',
    });
  }

  @Get('prospects')
  async list(@Query() query: ListProspectsDto) {
    return this.salesPanel.list(query);
  }

  @Get('prospects/:id')
  async findOne(@Param('id') id: string) {
    return this.salesPanel.findOne(id);
  }

  @Get('prospects/:id/invitations')
  async invitationsForProspect(@Param('id') id: string) {
    return this.invitations.listForProspect(id);
  }

  @Post('prospects/:id/invitations')
  async sendInvitation(
    @Param('id') id: string,
    @Body() body: SendInvitationDto,
    @Request() req: any,
  ) {
    return this.invitations.sendToProspect(
      id,
      body.language,
      { id: req.user?.id, email: req.user?.email },
      { subject: body.subject, bodyHtml: body.bodyHtml, attachments: body.attachments },
    );
  }

  @Patch('prospects/:id/mark-contacted')
  async markContacted(@Param('id') id: string) {
    return this.salesPanel.markContacted(id);
  }

  @Patch('prospects/:id/mark-skipped')
  async markSkipped(@Param('id') id: string) {
    return this.salesPanel.markSkipped(id);
  }

  @Patch('prospects/:id/unmark-skipped')
  async unmarkSkipped(@Param('id') id: string) {
    return this.salesPanel.unmarkSkipped(id);
  }

  @Patch('invitations/:id/mark-replied')
  async markReplied(@Param('id') id: string) {
    return this.invitations.markReplied(id);
  }

  @Get('templates')
  async templates() {
    return this.invitations.listTemplates();
  }

  @Put('templates/:language')
  async updateTemplate(
    @Param('language') language: string,
    @Body() body: UpdateTemplateDto,
  ) {
    if (!['en', 'ru', 'tr'].includes(language)) {
      throw new BadRequestException('Unknown language');
    }
    return this.invitations.updateTemplate(language as SalesInvitationLanguage, body);
  }

  @Post('attachments')
  @UseFilters(MulterSalesUploadFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: SALES_ATTACHMENT_MAX_BYTES },
    }),
  )
  async uploadAttachment(@UploadedFile() file: { buffer: Buffer; originalname?: string }) {
    return this.attachmentsService.upload(file);
  }

  @Post('reply-poll/run')
  async runReplyPoll() {
    return this.replyPoll.pollNow();
  }

  @Post('test-invitation')
  async testInvitation(@Body() body: TestInvitationDto) {
    return this.invitations.sendTest(body.to, body.language, {
      subject: body.subject,
      bodyHtml: body.bodyHtml,
      attachments: body.attachments,
    });
  }
}
