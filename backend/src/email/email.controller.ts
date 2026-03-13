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
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { EmailService } from './email.service';
import { CreateEmailAccountDto } from './dto/create-email-account.dto';
import { UpdateEmailAccountDto } from './dto/update-email-account.dto';
import { SendEmailDto } from './dto/send-email.dto';
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
  constructor(private readonly emailService: EmailService) {}

  // ==== ACCOUNTS ====
  @Get('accounts')
  @RequirePermission('email', 'read')
  async findAllAccounts(@CurrentUser() user: CurrentUserPayload) {
    return this.emailService.findAllAccounts(user.tenantId);
  }

  @Get('accounts/:id')
  @RequirePermission('email', 'read')
  async findAccount(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.emailService.findAccount(user.tenantId, id);
  }

  @Post('accounts')
  @RequirePermission('email', 'write')
  async createAccount(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateEmailAccountDto,
  ) {
    return this.emailService.createAccount(user.tenantId, dto);
  }

  @Patch('accounts/:id')
  @RequirePermission('email', 'write')
  async updateAccount(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEmailAccountDto,
  ) {
    return this.emailService.updateAccount(user.tenantId, id, dto);
  }

  @Delete('accounts/:id')
  @RequirePermission('email', 'delete')
  async deleteAccount(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.emailService.deleteAccount(user.tenantId, id);
    return { success: true };
  }

  @Post('accounts/:id/test-smtp')
  @RequirePermission('email', 'write')
  async testSmtpConnection(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    try {
      const success = await this.emailService.testSmtpConnection(user.tenantId, id);
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

  // ==== MESSAGES ====
  @Get('messages')
  @RequirePermission('email', 'read')
  async findMessages(
    @CurrentUser() user: CurrentUserPayload,
    @Query('accountId') accountId?: string,
    @Query('direction') direction?: 'incoming' | 'outgoing',
    @Query('contactId') contactId?: string,
    @Query('companyId') companyId?: string,
    @Query('leadId') leadId?: string,
    @Query('saleId') saleId?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.emailService.findMessages(user.tenantId, {
      accountId,
      direction,
      contactId,
      companyId,
      leadId,
      saleId,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post('send')
  @RequirePermission('email', 'write')
  async sendEmail(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SendEmailDto,
  ) {
    return this.emailService.sendEmail(user.tenantId, dto);
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
}

