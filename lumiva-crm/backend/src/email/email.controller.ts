// src/email/email.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { EmailService } from './email.service';
import { EmailSyncService } from './email-sync.service';
import { EmailImapSyncService } from './email-imap-sync.service';
import { CreateEmailAccountDto } from './dto/create-email-account.dto';
import { UpdateEmailAccountDto } from './dto/update-email-account.dto';
import { SendEmailDto } from './dto/send-email.dto';
import { CreateEmailFolderDto } from './dto/create-email-folder.dto';
import { PatchEmailFolderDto } from './dto/patch-email-folder.dto';
import { ReorderEmailFoldersDto } from './dto/reorder-email-folders.dto';
import { PatchEmailSignatureDto } from './dto/patch-email-signature.dto';
import { EmailFoldersService } from './email-folders.service';
import { PreviewStyledMailDto } from './dto/preview-styled-mail.dto';
import { SendStyledEmailDto } from './dto/send-styled-email.dto';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';

@Controller('email')
@UseGuards(JwtAuthGuard, RbacGuard)
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    private readonly emailSync: EmailSyncService,
    private readonly emailImapSync: EmailImapSyncService,
    private readonly emailFolders: EmailFoldersService,
  ) {}

  private parseBooleanQuery(value: string | undefined): boolean | undefined {
    if (value === undefined) return undefined;
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return undefined;
  }

  // ==== ACCOUNTS ====
  @Get('accounts')
  @RequirePermission('email', 'read')
  async findAllAccounts(@CurrentUser() user: CurrentUserPayload) {
    const actorUserId = (user.userId ?? user.id ?? user.sub) as string | undefined;
    return this.emailService.findAllAccounts(user.tenantId, actorUserId, user.role);
  }

  @Get('accounts/:id')
  @RequirePermission('email', 'read')
  async findAccount(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const actorUserId = (user.userId ?? user.id ?? user.sub) as string | undefined;
    return this.emailService.findAccount(user.tenantId, id, actorUserId, user.role);
  }

  @Post('accounts')
  @RequirePermission('email', 'write')
  async createAccount(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateEmailAccountDto,
  ) {
    const actorUserId = (user.userId ?? user.id ?? user.sub) as string | undefined;
    return this.emailService.createAccount(user.tenantId, dto, actorUserId);
  }

  @Patch('accounts/:id')
  @RequirePermission('email', 'write')
  async updateAccount(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEmailAccountDto,
  ) {
    const actorUserId = (user.userId ?? user.id ?? user.sub) as string | undefined;
    return this.emailService.updateAccount(user.tenantId, id, dto, actorUserId, user.role);
  }

  @Patch('accounts/:id/signature')
  @RequirePermission('email', 'write')
  async patchSignature(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PatchEmailSignatureDto,
  ) {
    const actorUserId = (user.userId ?? user.id ?? user.sub) as string | undefined;
    return this.emailService.patchAccountSignature(user.tenantId, id, dto, actorUserId, user.role);
  }

  @Delete('accounts/:id')
  @RequirePermission('email', 'delete')
  async deleteAccount(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const actorUserId = (user.userId ?? user.id ?? user.sub) as string | undefined;
    await this.emailService.deleteAccount(user.tenantId, id, actorUserId, user.role);
    return { success: true };
  }

  @Post('accounts/:id/sync-imap')
  @RequirePermission('email', 'write')
  async syncImapAccount(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.emailImapSync.syncAccount(id, user.tenantId);
  }

  @Post('accounts/:id/test-smtp')
  @RequirePermission('email', 'write')
  async testSmtpConnection(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const actorUserId = (user.userId ?? user.id ?? user.sub) as string | undefined;
    try {
      const success = await this.emailService.testSmtpConnection(user.tenantId, id, actorUserId, user.role);
      return { success };
    } catch (error: any) {
      // Возвращаем ошибку с деталями, но не бросаем исключение, чтобы не было 500
      return { 
        success: false, 
        error: error.message || 'SMTP connection failed',
        message: error.message || 'SMTP connection failed',
      };
    }
  }

  // ==== FOLDERS (CRM) ====
  @Get('folders')
  @RequirePermission('email', 'read')
  async listFolders(
    @CurrentUser() user: CurrentUserPayload,
    @Query('accountId', new ParseUUIDPipe({ optional: true })) accountId?: string,
  ) {
    if (!accountId) return [];
    return this.emailFolders.listTree(user.tenantId, accountId);
  }

  @Post('folders')
  @RequirePermission('email', 'write')
  async createFolder(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateEmailFolderDto,
  ) {
    return this.emailFolders.createUserFolder(
      user.tenantId,
      dto.accountId,
      dto.name,
      dto.parentId,
    );
  }

  @Patch('folders/:id')
  @RequirePermission('email', 'write')
  async patchFolder(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PatchEmailFolderDto,
  ) {
    if (dto.name !== undefined) {
      await this.emailFolders.renameFolder(user.tenantId, id, dto.name);
    }
    if (dto.parentId !== undefined || dto.sortOrder !== undefined) {
      const current = await this.emailFolders.findFolder(user.tenantId, id);
      if (!current) throw new NotFoundException('Folder not found');
      return this.emailFolders.moveFolder(
        user.tenantId,
        id,
        dto.parentId !== undefined ? dto.parentId : current.parentId,
        dto.sortOrder,
      );
    }
    const f = await this.emailFolders.findFolder(user.tenantId, id);
    if (!f) throw new NotFoundException('Folder not found');
    return f;
  }

  @Delete('folders/:id')
  @RequirePermission('email', 'delete')
  async deleteFolder(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.emailFolders.deleteFolder(user.tenantId, id);
    return { success: true };
  }

  @Post('folders/reorder')
  @RequirePermission('email', 'write')
  async reorderFolders(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ReorderEmailFoldersDto,
  ) {
    await this.emailFolders.reorderFolders(user.tenantId, dto.accountId, dto.items);
    return { success: true };
  }

  // ==== MESSAGES ====
  @Get('messages')
  @RequirePermission('email', 'read')
  async findMessages(
    @CurrentUser() user: CurrentUserPayload,
    @Query('accountId') accountId?: string,
    @Query('folderId') folderId?: string,
    @Query('direction') direction?: 'incoming' | 'outgoing',
    @Query('contactId') contactId?: string,
    @Query('companyId') companyId?: string,
    @Query('leadId') leadId?: string,
    @Query('saleId') saleId?: string,
    @Query('search') search?: string,
    @Query('read') read?: string,
    @Query('starred') starred?: string,
    @Query('hasCalendarInvite') hasCalendarInvite?: string,
    @Query('hasLead') hasLead?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.emailService.findMessages(user.tenantId, {
      accountId,
      folderId,
      direction,
      contactId,
      companyId,
      leadId,
      saleId,
      search,
      read: this.parseBooleanQuery(read),
      starred: this.parseBooleanQuery(starred),
      hasCalendarInvite: this.parseBooleanQuery(hasCalendarInvite),
      hasLead: this.parseBooleanQuery(hasLead),
      from,
      to,
      dateFrom,
      dateTo,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('messages/:id')
  @RequirePermission('email', 'read')
  async getMessage(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.emailService.findOneMessage(user.tenantId, id);
  }

  @Post('messages/:id/calendar-invite/import')
  @RequirePermission('email', 'write')
  async importCalendarInviteForMessage(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.emailSync.importCalendarInviteForMessage(user.tenantId, id);
  }

  @Post('calendar-invites/backfill')
  @RequirePermission('email', 'write')
  async backfillCalendarInvites(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { accountId?: string; limit?: number },
  ) {
    return this.emailSync.backfillCalendarInvites(user.tenantId, {
      accountId:
        body?.accountId && /^[0-9a-f-]{36}$/i.test(body.accountId)
          ? body.accountId
          : undefined,
      limit: body?.limit,
    });
  }

  @Patch('messages/:id')
  @RequirePermission('email', 'write')
  async patchMessage(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body()
    body: {
      isRead?: boolean;
      isStarred?: boolean;
      leadId?: string | null;
      crmFolderId?: string | null;
    },
  ) {
    return this.emailService.patchMessage(user.tenantId, id, body);
  }

  @Delete('messages/:id')
  @RequirePermission('email', 'delete')
  async deleteMessage(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.emailService.deleteMessage(user.tenantId, id);
    return { success: true };
  }

  @Post('send')
  @RequirePermission('email', 'write')
  async sendEmail(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SendEmailDto,
  ) {
    return this.emailService.sendEmail(user.tenantId, dto);
  }

  /** Черновик: тема + HTML/текст с единой фирменной обёрткой (без отправки) */
  @Post('preview-styled')
  @RequirePermission('email', 'read')
  async previewStyled(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: PreviewStyledMailDto,
  ) {
    return this.emailService.previewStyledMail(user.tenantId, dto);
  }

  /** Отправка с той же обёрткой, что preview-styled */
  @Post('send-styled')
  @RequirePermission('email', 'write')
  async sendStyled(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SendStyledEmailDto,
  ) {
    return this.emailService.sendStyledTransactionalMail(user.tenantId, dto);
  }

  // ==== TEMPLATES ====
  @Get('templates')
  @RequirePermission('email', 'read')
  async findAllTemplates(
    @CurrentUser() user: CurrentUserPayload,
    @Query('isActive') isActive?: string,
  ) {
    const active = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.emailService.findAllTemplates(user.tenantId, active);
  }

  @Get('templates/:id')
  @RequirePermission('email', 'read')
  async findTemplate(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.emailService.findTemplate(user.tenantId, id);
  }

  @Post('templates')
  @RequirePermission('email', 'write')
  async createTemplate(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateEmailTemplateDto,
  ) {
    return this.emailService.createTemplate(user.tenantId, dto);
  }

  @Patch('templates/:id')
  @RequirePermission('email', 'write')
  async updateTemplate(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEmailTemplateDto,
  ) {
    return this.emailService.updateTemplate(user.tenantId, id, dto);
  }

  @Delete('templates/:id')
  @RequirePermission('email', 'delete')
  async deleteTemplate(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.emailService.deleteTemplate(user.tenantId, id);
    return { success: true };
  }

  @Post('templates/:id/preview')
  @RequirePermission('email', 'read')
  async previewTemplate(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() data: Record<string, any>,
  ) {
    return this.emailService.applyTemplate(user.tenantId, id, data);
  }

  // ==== BULK SEND ====
  @Post('bulk-send')
  @RequirePermission('email', 'write')
  async bulkSend(
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    dto: {
      templateId?: string;
      subject: string;
      html: string;
      leadFilters?: { source?: string; status?: string; tag?: string };
      recipientEmails?: string[];
      fromAccountId: string;
      trackOpens?: boolean;
    },
  ): Promise<{ sent: number; failed: number; jobId: string }> {
    return this.emailService.sendBulk(user.tenantId, dto);
  }

  // ==== OPEN TRACKING PIXEL (public, no auth) ====
  @Get('track/:messageId')
  async trackOpen(
    @Param('messageId') _messageId: string,
    @Res() res: Response,
  ): Promise<void> {
    const gif = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64',
    );
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.end(gif);
  }
}
