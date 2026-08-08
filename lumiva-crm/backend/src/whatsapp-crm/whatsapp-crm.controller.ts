// src/whatsapp-crm/whatsapp-crm.controller.ts
import { Controller, Get, Post, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { WhatsappCrmService } from './whatsapp-crm.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';

@Controller('whatsapp-crm')
@UseGuards(JwtAuthGuard, RbacGuard)
export class WhatsappCrmController {
  constructor(private readonly whatsappCrmService: WhatsappCrmService) {}

  @Get('connections')
  @RequirePermission('whatsapp', 'read')
  async listConnections(@CurrentUser() user: CurrentUserPayload) {
    return this.whatsappCrmService.listConnections(user.tenantId);
  }

  @Get('contacts')
  @RequirePermission('whatsapp', 'read')
  async findContacts(
    @CurrentUser() user: CurrentUserPayload,
    @Query('search') search?: string,
    @Query('connectionId') connectionId?: string,
  ) {
    return this.whatsappCrmService.findContacts(user.tenantId, { search, connectionId });
  }

  @Post('contacts/:id/read')
  @RequirePermission('whatsapp', 'read')
  async markContactRead(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.whatsappCrmService.markContactMessagesRead(user.tenantId, id);
    return { success: true };
  }

  @Get('messages')
  @RequirePermission('whatsapp', 'read')
  async findMessages(
    @CurrentUser() user: CurrentUserPayload,
    @Query('contactId') contactId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.whatsappCrmService.findMessages(user.tenantId, {
      contactId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post('send')
  @RequirePermission('whatsapp', 'write')
  async sendMessage(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { connectionId: string; contactId: string; text: string },
  ) {
    return this.whatsappCrmService.sendMessage(
      user.tenantId,
      body.connectionId,
      body.contactId,
      body.text,
    );
  }
}
