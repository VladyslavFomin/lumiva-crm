import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { SalesChannelsService } from './sales-channels.service';
import { SalesChannelDto } from './dto/sales-channel.dto';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('sales-channels')
export class SalesChannelsController {
  constructor(private readonly service: SalesChannelsService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserPayload): Promise<SalesChannelDto[]> {
    return this.service.findAllForTenant(user.tenantId);
  }

  @Patch(':id/enabled')
  toggleEnabled(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body('isEnabled') isEnabled: boolean,
  ): Promise<SalesChannelDto> {
    return this.service.toggleEnabledForTenant(user.tenantId, id, !!isEnabled);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<{ ok: boolean }> {
    await this.service.softDeleteForTenant(user.tenantId, id);
    return { ok: true };
  }
}