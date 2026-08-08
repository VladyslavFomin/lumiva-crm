import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { SmsService } from './sms.service';
import { SendSmsDto } from './dto/send-sms.dto';
import { SaveSmsConfigDto } from './dto/save-sms-config.dto';
import { SmsEntityType } from './sms-message.entity';

@Controller('sms')
@UseGuards(JwtAuthGuard, RbacGuard)
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  // ─── Config ───────────────────────────────────────────────────────────────

  @Get('config')
  @RequirePermission('settings', 'read')
  async getConfig(@CurrentUser() user: CurrentUserPayload) {
    const config = await this.smsService.getConfig(user.tenantId);
    if (!config) return null;
    const base = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    // Не возвращаем чувствительные поля в полном виде
    return {
      id: config.id,
      provider: config.provider,
      senderName: config.senderName,
      isEnabled: config.isEnabled,
      hasCredentials: Object.keys(config.credentials).length > 0,
      inboundWebhookUrl:
        config.provider === 'twilio' && base
          ? `${base}/v1/webhooks/sms/twilio/${user.tenantId}`
          : null,
    };
  }

  @Patch('config')
  @RequirePermission('settings', 'write')
  saveConfig(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SaveSmsConfigDto,
  ) {
    return this.smsService.saveConfig(user.tenantId, dto);
  }

  @Delete('config')
  @RequirePermission('settings', 'write')
  deleteConfig(@CurrentUser() user: CurrentUserPayload) {
    return this.smsService.deleteConfig(user.tenantId);
  }

  // ─── Send ─────────────────────────────────────────────────────────────────

  @Post('send')
  @RequirePermission('marketing', 'write')
  send(@CurrentUser() user: CurrentUserPayload, @Body() dto: SendSmsDto) {
    return this.smsService.send(user.tenantId, dto, user.userId ?? user.id ?? user.sub);
  }

  // ─── Messages ─────────────────────────────────────────────────────────────

  @Get('messages')
  @RequirePermission('marketing', 'read')
  findMessages(
    @CurrentUser() user: CurrentUserPayload,
    @Query('entityType') entityType?: SmsEntityType,
    @Query('entityId') entityId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.smsService.findMessages(user.tenantId, {
      entityType,
      entityId,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('messages/:id')
  @RequirePermission('marketing', 'read')
  findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.smsService.findOne(user.tenantId, id);
  }
}
