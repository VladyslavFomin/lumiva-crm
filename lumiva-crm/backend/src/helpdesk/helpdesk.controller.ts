// src/helpdesk/helpdesk.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { HelpdeskService, type HelpdeskLinkType } from './helpdesk.service';
import type { HelpdeskChannel, HelpdeskTicketPriority, HelpdeskTicketStatus } from './helpdesk-ticket.entity';

@Controller('helpdesk')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('helpdesk', 'read')
export class HelpdeskController {
  constructor(private readonly helpdesk: HelpdeskService) {}

  @Get('tickets')
  list(
    @CurrentUser() user: CurrentUserPayload,
    @Query('status') status?: HelpdeskTicketStatus,
    @Query('assignedUserId') assignedUserId?: string,
  ) {
    return this.helpdesk.listTickets(user.tenantId, { status, assignedUserId });
  }

  @Get('tickets/:id')
  getOne(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.helpdesk.getTicketWithMessages(user.tenantId, id);
  }

  @Post('tickets')
  @RequirePermission('helpdesk', 'write')
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    body: {
      contactId?: string;
      subject: string;
      message: string;
      category?: string;
      priority?: HelpdeskTicketPriority;
      channel?: HelpdeskChannel;
      entityType?: HelpdeskLinkType;
      entityId?: string;
      assignedUserId?: string;
    },
  ) {
    return this.helpdesk.createTicketFromStaff(user.tenantId, {
      ...body,
      authorName: user.name || user.email || 'Сотрудник',
    });
  }

  @Patch('tickets/:id')
  @RequirePermission('helpdesk', 'write')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body()
    body: {
      status?: HelpdeskTicketStatus;
      priority?: HelpdeskTicketPriority;
      assignedUserId?: string | null;
      category?: string | null;
      entityType?: HelpdeskLinkType | null;
      entityId?: string | null;
    },
  ) {
    return this.helpdesk.updateTicket(user.tenantId, id, body);
  }

  @Post('tickets/:id/messages')
  @RequirePermission('helpdesk', 'write')
  reply(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Body() body: { text: string }) {
    return this.helpdesk.addStaffMessage(user.tenantId, id, user.name || user.email || 'Сотрудник', body.text);
  }
}

@Controller('helpdesk/link-options')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('helpdesk', 'read')
export class HelpdeskLinkOptionsController {
  constructor(private readonly helpdesk: HelpdeskService) {}

  @Get(':type')
  search(@CurrentUser() user: CurrentUserPayload, @Param('type') type: HelpdeskLinkType, @Query('search') search?: string) {
    return this.helpdesk.searchLinkEntities(user.tenantId, type, search);
  }
}

/** Deliberately guarded by JwtAuthGuard only (no RbacGuard/helpdesk permission) — any
 * authenticated staff member can raise an internal request to support, regardless of
 * whether they have general helpdesk read/write access (e.g. Sales asking IT for help). */
@Controller('helpdesk/internal-requests')
@UseGuards(JwtAuthGuard)
export class HelpdeskInternalRequestsController {
  constructor(private readonly helpdesk: HelpdeskService) {}

  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { subject: string; message: string; category?: string; priority?: HelpdeskTicketPriority },
  ) {
    return this.helpdesk.createInternalRequest(
      user.tenantId,
      { id: user.userId || user.id || user.sub || '', name: user.name, email: user.email },
      body,
    );
  }
}
