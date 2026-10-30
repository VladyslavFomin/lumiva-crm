import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { getUploadsRoot } from '../common/uploads-root.util';
import { StorageQuotaService } from '../storage-quota/storage-quota.service';
import { HotelHousekeepingService } from './hotel-housekeeping.service';

const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic'];
const actor = (u: CurrentUserPayload) => (u.userId ?? (u as any).id ?? (u as any).sub ?? null) as string | null;

/** Уборка, неработающие номера, неисправности, находки (PMS v2, этап 3). Изменения — право hotels_housekeeping. */
@Controller('hotels/housekeeping')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels', 'read')
export class HotelHousekeepingController {
  constructor(
    private readonly hk: HotelHousekeepingService,
    private readonly storageQuota: StorageQuotaService,
  ) {}

  @Get('staff')
  staff(@CurrentUser() user: CurrentUserPayload) {
    return this.hk.staff(user.tenantId);
  }

  @Get('plan')
  plan(@CurrentUser() user: CurrentUserPayload, @Query('hotelId') hotelId: string, @Query('date') date?: string) {
    return this.hk.plan(user.tenantId, hotelId, date);
  }

  @Post('plan/auto-assign')
  @RequirePermission('hotels_housekeeping', 'write')
  autoAssign(@CurrentUser() user: CurrentUserPayload, @Body() dto: { hotelId: string; date: string; userIds: string[]; mode?: 'unassigned' | 'all' }) {
    return this.hk.autoAssign(user.tenantId, dto?.hotelId, dto?.date, dto?.userIds || [], dto?.mode === 'all' ? 'all' : 'unassigned');
  }

  @Get('my')
  my(@CurrentUser() user: CurrentUserPayload, @Query('date') date?: string) {
    return this.hk.myTasks(user.tenantId, String(actor(user) || ''), date);
  }

  @Patch('tasks/:id/assign')
  @RequirePermission('hotels_housekeeping', 'write')
  assign(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: { userId: string | null }) {
    return this.hk.assignTask(user.tenantId, id, dto?.userId || null);
  }

  @Post('tasks/:id/:action')
  @RequirePermission('hotels_housekeeping', 'write')
  action(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Param('action') action: string, @Body() dto: { note?: string }) {
    return this.hk.taskAction(user.tenantId, id, action as any, dto?.note, actor(user));
  }

  // номера
  @Get('units')
  units(@CurrentUser() user: CurrentUserPayload, @Query('hotelId') hotelId: string) {
    return this.hk.listUnits(user.tenantId, hotelId);
  }

  @Patch('units/:id')
  @RequirePermission('hotels_housekeeping', 'write')
  updateUnit(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: any) {
    return this.hk.updateUnit(user.tenantId, id, dto || {});
  }

  @Post('units/floors-from-labels')
  @RequirePermission('hotels_housekeeping', 'write')
  floors(@CurrentUser() user: CurrentUserPayload, @Body() dto: { hotelId: string; overwrite?: boolean }) {
    return this.hk.floorsFromLabels(user.tenantId, dto?.hotelId, !!dto?.overwrite);
  }

  // неработающие номера
  @Get('outages')
  outages(@CurrentUser() user: CurrentUserPayload, @Query('hotelId') hotelId: string, @Query('includeEnded') includeEnded?: string) {
    return this.hk.listOutages(user.tenantId, hotelId, { includeEnded: includeEnded === '1' || includeEnded === 'true' });
  }

  @Post('outages')
  @RequirePermission('hotels_housekeeping', 'write')
  createOutage(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.hk.createOutage(user.tenantId, dto || {}, actor(user));
  }

  @Patch('outages/:id')
  @RequirePermission('hotels_housekeeping', 'write')
  updateOutage(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: any) {
    return this.hk.updateOutage(user.tenantId, id, dto || {});
  }

  @Post('outages/:id/end')
  @RequirePermission('hotels_housekeeping', 'write')
  endOutage(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.hk.endOutage(user.tenantId, id);
  }

  @Delete('outages/:id')
  @RequirePermission('hotels_housekeeping', 'write')
  removeOutage(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.hk.removeOutage(user.tenantId, id);
  }

  // неисправности
  @Get('issues')
  issues(@CurrentUser() user: CurrentUserPayload, @Query('hotelId') hotelId: string, @Query('status') status?: string) {
    return this.hk.listIssues(user.tenantId, hotelId, status);
  }

  @Post('issues')
  @RequirePermission('hotels_housekeeping', 'write')
  createIssue(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.hk.createIssue(user.tenantId, dto || {}, actor(user));
  }

  @Patch('issues/:id')
  @RequirePermission('hotels_housekeeping', 'write')
  updateIssue(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: any) {
    return this.hk.updateIssue(user.tenantId, id, dto || {});
  }

  // находки
  @Get('lost-found')
  lost(@CurrentUser() user: CurrentUserPayload, @Query('hotelId') hotelId: string, @Query('status') status?: string, @Query('search') search?: string) {
    return this.hk.listLost(user.tenantId, hotelId, status, search);
  }

  @Post('lost-found')
  @RequirePermission('hotels_housekeeping', 'write')
  createLost(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.hk.createLost(user.tenantId, dto || {}, actor(user));
  }

  @Patch('lost-found/:id')
  @RequirePermission('hotels_housekeeping', 'write')
  updateLost(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: any) {
    return this.hk.updateLost(user.tenantId, id, dto || {});
  }

  @Post('lost-found/:id/notify')
  @RequirePermission('hotels_housekeeping', 'write')
  notify(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.hk.notifyLost(user.tenantId, id);
  }

  @Delete('lost-found/:id')
  @RequirePermission('hotels_housekeeping', 'write')
  removeLost(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.hk.removeLost(user.tenantId, id);
  }

  /** Фото поломки / находки с телефона: сохраняется в uploads/hotels/<tenant>/housekeeping/<YYYY-MM>/ */
  @Post('photos')
  @RequirePermission('hotels_housekeeping', 'write')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const tenantId = (req as any).user?.tenantId as string | undefined;
          if (!tenantId) {
            cb(new BadRequestException('Missing tenant'), '');
            return;
          }
          const dir = join(getUploadsRoot(), 'hotels', tenantId, 'housekeeping', new Date().toISOString().slice(0, 7));
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '').toLowerCase();
          cb(null, `${randomUUID()}${IMAGE_EXT.includes(ext) ? ext : '.jpg'}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req: any, file: any, cb: any) => {
        if (!/^image\//.test(file.mimetype || '')) return cb(new BadRequestException({ code: 'HOTEL_HK_PHOTO_TYPE', message: 'Нужна фотография' }), false);
        cb(null, true);
      },
    }),
  )
  async photo(@CurrentUser() user: CurrentUserPayload, @UploadedFile() file: { filename: string; path?: string } | undefined) {
    if (!file) throw new BadRequestException({ code: 'HOTEL_HK_PHOTO_REQUIRED', message: 'Нужен файл' });
    await this.storageQuota.assertAfterWrite(user.tenantId, file.path);
    return { url: `/v1/uploads/hotels/${user.tenantId}/housekeeping/${new Date().toISOString().slice(0, 7)}/${file.filename}` };
  }
}
