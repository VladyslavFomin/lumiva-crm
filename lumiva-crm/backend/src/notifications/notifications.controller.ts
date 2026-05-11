import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Query('unread') unread?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = (user.userId ?? user.id ?? user.sub) as string;
    return this.svc.findForUser(
      user.tenantId,
      userId,
      limit ? parseInt(limit, 10) : 50,
      unread === 'true',
      user.email,
    );
  }

  @Patch(':id/read')
  async markRead(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const userId = (user.userId ?? user.id ?? user.sub) as string;
    await this.svc.markRead(user.tenantId, userId, id, user.email);
    return { success: true };
  }

  @Patch('read-all')
  async markAllRead(@CurrentUser() user: CurrentUserPayload) {
    const userId = (user.userId ?? user.id ?? user.sub) as string;
    await this.svc.markAllRead(user.tenantId, userId, user.email);
    return { success: true };
  }
}
