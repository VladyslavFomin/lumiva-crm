// src/media/media.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { MediaService, type LinkInput, type StatsPeriod } from './media.service';
import { MediaPublicService } from './media-public.service';
import { MEDIA_CHUNK_BYTES } from './media.constants';

const uid = (u: CurrentUserPayload): string | null => (u.userId ?? (u as any).id ?? (u as any).sub) || null;
const period = (p?: string): StatsPeriod => (p === '7' || p === '90' || p === 'all' ? p : '30');

@Controller('media')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  private acc(u: CurrentUserPayload) {
    return this.media.allowedHotels(u.tenantId, uid(u), u.role);
  }

  @Get('overview')
  async overview(@CurrentUser() u: CurrentUserPayload) {
    return this.media.overview(u.tenantId, await this.acc(u));
  }

  // папки
  @Post('folders')
  async createFolder(@CurrentUser() u: CurrentUserPayload, @Body() b: { name?: string; hotelId?: string | null; collectionId?: string | null; parentId?: string | null }) {
    return this.media.createFolder(u.tenantId, uid(u), b, await this.acc(u));
  }

  @Patch('folders/:id')
  async updateFolder(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string, @Body() b: { name?: string; parentId?: string | null; hotelId?: string | null; collectionId?: string | null }) {
    return this.media.updateFolder(u.tenantId, id, b, await this.acc(u));
  }

  @Post('folders/:id/duplicate')
  async duplicateFolder(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string) {
    return this.media.duplicateFolder(u.tenantId, uid(u), id, await this.acc(u));
  }

  // разделы (бренд, архив и т.п.)
  @Post('collections')
  async createCollection(@CurrentUser() u: CurrentUserPayload, @Body() b: { name?: string }) {
    return this.media.createCollection(u.tenantId, String(b?.name || ''), await this.acc(u));
  }

  @Patch('collections/:id')
  async renameCollection(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string, @Body() b: { name?: string }) {
    return this.media.renameCollection(u.tenantId, id, String(b?.name || ''), await this.acc(u));
  }

  @Delete('collections/:id')
  async deleteCollection(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string, @Query('mode') mode?: string) {
    return this.media.deleteCollection(u.tenantId, id, mode === 'delete' ? 'delete' : 'keep', await this.acc(u));
  }

  @Delete('folders/:id')
  async deleteFolder(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string) {
    return this.media.deleteFolder(u.tenantId, id, await this.acc(u));
  }

  @Get('folders/:id/files')
  async files(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string, @Query('q') q?: string) {
    return this.media.listFiles(u.tenantId, id, q, await this.acc(u));
  }

  // файлы
  @Patch('files/:id')
  async renameFile(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string, @Body() b: { name?: string }) {
    return this.media.renameFile(u.tenantId, id, String(b.name || ''), await this.acc(u));
  }

  @Post('files/:id/thumb')
  @UseInterceptors(FileInterceptor('thumb', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async setThumb(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string, @Body() b: Record<string, string>, @UploadedFile() thumb: any) {
    return this.media.setPdfThumb(u.tenantId, id, thumb?.buffer, { width: Number(b.width), height: Number(b.height) }, await this.acc(u));
  }

  @Post('files/move')
  async move(@CurrentUser() u: CurrentUserPayload, @Body() b: { ids?: string[]; folderId?: string }) {
    return this.media.moveFiles(u.tenantId, b.ids || [], String(b.folderId || ''), await this.acc(u));
  }

  @Post('files/delete')
  async remove(@CurrentUser() u: CurrentUserPayload, @Body() b: { ids?: string[] }) {
    return this.media.deleteFiles(u.tenantId, b.ids || [], await this.acc(u));
  }

  @Post('download')
  async download(@CurrentUser() u: CurrentUserPayload, @Body() b: { fileIds?: string[]; folderIds?: string[] }) {
    return this.media.crmDownloadTicket(u.tenantId, b, await this.acc(u));
  }

  // загрузка по частям
  @Post('uploads')
  async initUpload(@CurrentUser() u: CurrentUserPayload, @Body() b: { folderId?: string; name?: string; size?: number }) {
    return this.media.initUpload(u.tenantId, uid(u), b, await this.acc(u));
  }

  @Post('uploads/:id/chunk')
  @UseInterceptors(FileInterceptor('chunk', { limits: { fileSize: MEDIA_CHUNK_BYTES + 1024 } }))
  chunk(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string, @Query('offset') offset: string, @UploadedFile() file: any) {
    return this.media.appendChunk(u.tenantId, id, Number(offset) || 0, file?.buffer);
  }

  @Post('uploads/:id/complete')
  @UseInterceptors(FileInterceptor('thumb', { limits: { fileSize: 2 * 1024 * 1024 } }))
  complete(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string, @Body() b: Record<string, string>, @UploadedFile() thumb: any) {
    return this.media.completeUpload(
      u.tenantId,
      id,
      { width: Number(b.width), height: Number(b.height), durationSec: Number(b.durationSec) },
      thumb?.buffer,
    );
  }

  @Delete('uploads/:id')
  abort(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string) {
    return this.media.abortUpload(u.tenantId, id);
  }

  // ссылки
  @Get('links')
  async links(@CurrentUser() u: CurrentUserPayload) {
    return this.media.listLinks(u.tenantId, await this.acc(u));
  }

  @Post('links')
  async createLink(@CurrentUser() u: CurrentUserPayload, @Body() b: LinkInput) {
    return this.media.createLink(u.tenantId, uid(u), b, await this.acc(u));
  }

  @Patch('links/:id')
  async updateLink(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string, @Body() b: LinkInput) {
    return this.media.updateLink(u.tenantId, id, b, await this.acc(u));
  }

  @Delete('links/:id')
  async deleteLink(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string) {
    return this.media.deleteLink(u.tenantId, id, await this.acc(u));
  }

  // форма
  @Get('settings')
  settings(@CurrentUser() u: CurrentUserPayload) {
    return this.media.getSettings(u.tenantId);
  }

  @Patch('settings')
  updateSettings(@CurrentUser() u: CurrentUserPayload, @Body() b: any) {
    return this.media.updateSettings(u.tenantId, b || {});
  }

  // аналитика
  @Get('stats')
  async stats(@CurrentUser() u: CurrentUserPayload, @Query('link') link?: string, @Query('period') p?: string) {
    return this.media.stats(u.tenantId, link || 'all', period(p), await this.acc(u));
  }

  @Get('stats.csv')
  async csv(@CurrentUser() u: CurrentUserPayload, @Res() res: Response, @Query('link') link?: string, @Query('period') p?: string) {
    const body = await this.media.statsCsv(u.tenantId, link || 'all', period(p), await this.acc(u));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="media-stats-${period(p)}.csv"`);
    res.send(body);
  }
}

/** Публичная страница ссылки, превью и скачивание — без авторизации. */
@Controller('public/media')
export class MediaPublicController {
  constructor(private readonly pub: MediaPublicService) {}

  @Get('raw/:fileId')
  raw(@Param('fileId') fileId: string, @Query() q: Record<string, string>, @Req() req: Request, @Res() res: Response) {
    return this.pub.streamPreview(fileId, q, req, res);
  }

  @Get('download/:ticket')
  dl(@Param('ticket') ticket: string, @Res() res: Response) {
    return this.pub.streamTicket(ticket, res);
  }

  @Get('s/:slug')
  page(@Param('slug') slug: string, @Req() req: Request, @Query('lang') lang?: string) {
    return this.pub.getPage(slug, req, lang);
  }

  @Post('s/:slug/unlock')
  unlock(@Param('slug') slug: string, @Body() b: { password?: string }) {
    return this.pub.unlock(slug, String(b?.password || ''));
  }

  @Post('s/:slug/event')
  event(@Param('slug') slug: string, @Req() req: Request, @Body() b: { type?: string; folderId?: string }) {
    return this.pub.track(slug, req, b || {});
  }

  @Post('s/:slug/lead')
  lead(@Param('slug') slug: string, @Req() req: Request, @Body() b: { values?: Record<string, unknown>; lang?: string }) {
    return this.pub.submitLead(slug, req, b || {});
  }

  @Post('s/:slug/download')
  download(@Param('slug') slug: string, @Req() req: Request, @Body() b: { fileIds?: string[]; folderIds?: string[]; all?: boolean }) {
    return this.pub.requestDownload(slug, req, b || {});
  }
}
