// src/sales-channels/sales-channels.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
} from '@nestjs/common';
import { SalesChannelsService } from './sales-channels.service';
import { SalesChannelDto } from './dto/sales-channel.dto';

@Controller('sales-channels')
export class SalesChannelsController {
  constructor(private readonly service: SalesChannelsService) {}

  /**
   * Список каналов продаж с агрегатами из интеграций
   * GET /v1/sales-channels
   */
  @Get()
  list(): Promise<SalesChannelDto[]> {
    return this.service.findAll();
  }

  /**
   * Включить/выключить канал
   * PATCH /v1/sales-channels/:id/enabled
   * body: { isEnabled: boolean }
   */
  @Patch(':id/enabled')
  toggleEnabled(
    @Param('id') id: string,
    @Body('isEnabled') isEnabled: boolean,
  ): Promise<SalesChannelDto> {
    return this.service.toggleEnabled(id, !!isEnabled);
  }

  /**
   * Мягкое удаление канала
   * DELETE /v1/sales-channels/:id
   */
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ ok: boolean }> {
    await this.service.softDelete(id);
    return { ok: true };
  }
}