import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { ContentService } from './content.service';
import { ContentCanvaService } from './content-canva.service';
import { ContentVideoAccountsService } from './content-video-accounts.service';
import { ContentPublisherService } from './content-publisher.service';

const actorOf = (u: CurrentUserPayload) => ({ userId: u.userId ?? u.id ?? u.sub ?? null, name: u.name ?? u.email ?? null, role: (u.role || '').toLowerCase() });

/** Контент и публикации (/marketing/smm). */
@Controller('content')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('marketing')
export class ContentController {
  constructor(
    private readonly svc: ContentService,
    private readonly publisher: ContentPublisherService,
    private readonly canva: ContentCanvaService,
    private readonly videoAccounts: ContentVideoAccountsService,
  ) {}

  // ── Canva (источник картинок) ──
  @Get('canva/status')
  canvaStatus(@CurrentUser() u: CurrentUserPayload) {
    return this.canva.status(u.tenantId, actorOf(u).userId);
  }

  @Get('canva/auth-url')
  canvaAuth(@CurrentUser() u: CurrentUserPayload) {
    return this.canva.authUrl(u.tenantId, actorOf(u).userId);
  }

  @Delete('canva/connection')
  canvaDisconnect(@CurrentUser() u: CurrentUserPayload) {
    return this.canva.disconnect(u.tenantId, actorOf(u).userId);
  }

  @Get('canva/designs')
  canvaDesigns(@CurrentUser() u: CurrentUserPayload, @Query('query') query?: string, @Query('continuation') continuation?: string) {
    return this.canva.designs(u.tenantId, actorOf(u).userId, query, continuation);
  }

  @Get('canva/templates')
  canvaTemplates(@CurrentUser() u: CurrentUserPayload, @Query('query') query?: string) {
    return this.canva.templates(u.tenantId, actorOf(u).userId, query);
  }

  @Get('canva/templates/:tid/fields')
  canvaTemplateFields(@CurrentUser() u: CurrentUserPayload, @Param('tid') tid: string) {
    return this.canva.templateFields(u.tenantId, actorOf(u).userId, tid);
  }

  @Post('posts/:id/canva/import')
  canvaImport(@CurrentUser() u: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, any>) {
    return this.canva.importDesign(u.tenantId, actorOf(u), id, body || {});
  }

  @Post('posts/:id/canva/open')
  canvaOpen(@CurrentUser() u: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, any>) {
    return this.canva.openInCanva(u.tenantId, actorOf(u), id, body || {});
  }

  @Post('posts/:id/canva/autofill')
  canvaAutofill(@CurrentUser() u: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, any>) {
    return this.canva.autofill(u.tenantId, actorOf(u), id, body || {});
  }

  @Get('overview')
  overview(@CurrentUser() u: CurrentUserPayload) {
    return this.svc.overview(u.tenantId);
  }

  @Get('analytics')
  analytics(@CurrentUser() u: CurrentUserPayload, @Query('days') days?: string, @Query('tz') tz?: string) {
    return this.svc.analytics(u.tenantId, Number(days) || 30, String(tz || 'UTC').slice(0, 64));
  }

  // ── каналы ──
  @Get('channels')
  channels(@CurrentUser() u: CurrentUserPayload) {
    return this.svc.listChannels(u.tenantId);
  }

  @Get('channels/options')
  options(@CurrentUser() u: CurrentUserPayload) {
    return this.svc.connectOptions(u.tenantId);
  }

  @Post('channels')
  addChannel(@CurrentUser() u: CurrentUserPayload, @Body() body: Record<string, any>) {
    return this.svc.addChannel(u.tenantId, actorOf(u), body || {});
  }

  @Patch('channels/:id')
  updateChannel(@CurrentUser() u: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, any>) {
    return this.svc.updateChannel(u.tenantId, id, body || {});
  }

  @Delete('channels/:id')
  removeChannel(@CurrentUser() u: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removeChannel(u.tenantId, id);
  }

  @Get('threads/auth-url')
  threadsAuth(@CurrentUser() u: CurrentUserPayload) {
    return this.svc.threadsAuthUrl(u.tenantId, u.userId ?? u.sub ?? null);
  }

  @Get('vk/auth-url')
  vkAuth(@CurrentUser() u: CurrentUserPayload) {
    return this.svc.vkAuthUrl(u.tenantId, u.userId ?? u.sub ?? null);
  }

  @Get('linkedin/auth-url')
  linkedinAuth(@CurrentUser() u: CurrentUserPayload) {
    return this.svc.linkedinAuthUrl(u.tenantId, u.userId ?? u.sub ?? null);
  }

  // ── медиа и ИИ ──
  @Post('media')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  upload(@CurrentUser() u: CurrentUserPayload, @UploadedFile() file: { buffer: Buffer; originalname: string; size: number }) {
    return this.svc.uploadImage(u.tenantId, file);
  }

  @Post('media/video/start')
  videoStart(@CurrentUser() u: CurrentUserPayload, @Body() body: Record<string, any>) {
    return this.svc.startVideoUpload(u.tenantId, body || {});
  }

  @Post('media/video/:uid/chunk')
  @UseInterceptors(FileInterceptor('chunk', { storage: memoryStorage(), limits: { fileSize: 9 * 1024 * 1024 } }))
  videoChunk(@CurrentUser() u: CurrentUserPayload, @Param('uid', ParseUUIDPipe) uid: string, @Query('index') index: string, @UploadedFile() file: { buffer: Buffer }) {
    return this.svc.appendVideoChunk(u.tenantId, uid, Number(index), file?.buffer);
  }

  @Post('media/video/:uid/finish')
  videoFinish(@CurrentUser() u: CurrentUserPayload, @Param('uid', ParseUUIDPipe) uid: string) {
    return this.svc.finishVideoUpload(u.tenantId, uid);
  }

  @Get('youtube/auth-url')
  youtubeAuth(@CurrentUser() u: CurrentUserPayload) {
    return this.videoAccounts.authUrl(u.tenantId, actorOf(u).userId, 'youtube');
  }

  @Get('tiktok/auth-url')
  tiktokAuth(@CurrentUser() u: CurrentUserPayload) {
    return this.videoAccounts.authUrl(u.tenantId, actorOf(u).userId, 'tiktok');
  }

  @Post('ai/compose')
  compose(@CurrentUser() u: CurrentUserPayload, @Body() body: Record<string, any>) {
    return this.svc.compose(u.tenantId, actorOf(u), body || {});
  }

  @Post('ai/image')
  async image(@CurrentUser() u: CurrentUserPayload, @Body() body: { prompt?: string; size?: string }) {
    const size = body?.size === '1024x1792' || body?.size === '1792x1024' ? body.size : '1024x1024';
    try {
      return await this.svc.aiImage(u.tenantId, actorOf(u).userId, String(body?.prompt || '').trim() || 'abstract brand illustration', size);
    } catch (e) {
      const msg = (e as Error).message || '';
      return { error: /credit|quota|insufficient|429|billing/i.test(msg) ? 'provider_quota' : msg.slice(0, 300) };
    }
  }

  // ── посты ──
  @Get('posts')
  posts(@CurrentUser() u: CurrentUserPayload, @Query() q: Record<string, string>) {
    return this.svc.listPosts(u.tenantId, { status: q.status, from: q.from, to: q.to, channelId: q.channelId, planId: q.planId });
  }

  @Get('posts/:id')
  post(@CurrentUser() u: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getPost(u.tenantId, id);
  }

  @Post('posts')
  create(@CurrentUser() u: CurrentUserPayload, @Body() body: Record<string, any>) {
    return this.svc.savePost(u.tenantId, actorOf(u), null, body || {});
  }

  @Put('posts/:id')
  update(@CurrentUser() u: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, any>) {
    return this.svc.savePost(u.tenantId, actorOf(u), id, body || {});
  }

  @Delete('posts/:id')
  remove(@CurrentUser() u: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removePost(u.tenantId, id);
  }

  @Post('posts/:id/submit')
  submit(@CurrentUser() u: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.submitPost(u.tenantId, id);
  }

  @Post('posts/:id/approve')
  approve(@CurrentUser() u: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.approvePost(u.tenantId, actorOf(u), id);
  }

  @Post('posts/:id/changes')
  changes(@CurrentUser() u: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: { note?: string; reject?: boolean }) {
    return this.svc.requestChanges(u.tenantId, actorOf(u), id, body || {});
  }

  @Post('posts/:id/media-review')
  mediaReview(@CurrentUser() u: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: { index?: number; approved?: boolean; note?: string }) {
    return this.svc.reviewMedia(u.tenantId, actorOf(u), id, body || {});
  }

  @Post('posts/:id/comments')
  comment(@CurrentUser() u: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: { text?: string }) {
    return this.svc.comment(u.tenantId, actorOf(u), id, String(body?.text || ''));
  }

  @Post('posts/:id/ab')
  abVariant(@CurrentUser() u: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, any>) {
    return this.svc.createAbVariant(u.tenantId, actorOf(u), id, body || {});
  }

  @Post('posts/:id/duplicate')
  duplicate(@CurrentUser() u: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.duplicatePost(u.tenantId, actorOf(u), id);
  }

  @Post('posts/:id/publish-now')
  async publishNow(@CurrentUser() u: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    const r = await this.svc.publishNow(u.tenantId, actorOf(u), id);
    void this.publisher.tick().catch(() => undefined);
    return r;
  }

  // ── планы ──
  @Get('plans')
  plans(@CurrentUser() u: CurrentUserPayload) {
    return this.svc.listPlans(u.tenantId);
  }

  @Post('plans')
  createPlan(@CurrentUser() u: CurrentUserPayload, @Body() body: Record<string, any>) {
    return this.svc.createPlan(u.tenantId, actorOf(u), body || {});
  }

  @Post('plans/:id/approve')
  approvePlan(@CurrentUser() u: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.approvePlan(u.tenantId, actorOf(u), id);
  }

  @Delete('plans/:id')
  removePlan(@CurrentUser() u: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removePlan(u.tenantId, id);
  }
}

/** Возврат из OAuth LinkedIn (без JWT: пользователь приходит со страницы LinkedIn). */
@Controller('content/linkedin')
export class ContentLinkedinCallbackController {
  constructor(private readonly svc: ContentService) {}

  @Get('callback')
  async callback(@Res() res: Response, @Query('code') code?: string, @Query('state') state?: string) {
    return res.redirect(await this.svc.linkedinCallback(code, state));
  }
}

/** Возврат из VK ID (без JWT). VK ID добавляет к коду device_id — без него код не обменять. */
@Controller('content/vk')
export class ContentVkCallbackController {
  constructor(private readonly svc: ContentService) {}

  @Get('callback')
  async callback(@Res() res: Response, @Query('code') code?: string, @Query('state') state?: string, @Query('device_id') deviceId?: string) {
    return res.redirect(await this.svc.vkCallback({ code, state, device_id: deviceId }));
  }
}

/** OAuth Canva и возврат из редактора Canva (без JWT: пользователь приходит со страницы Canva). */
@Controller('content/canva')
export class ContentCanvaCallbackController {
  constructor(private readonly canva: ContentCanvaService) {}

  @Get('callback')
  async callback(@Res() res: Response, @Query('code') code?: string, @Query('state') state?: string, @Query('error') error?: string) {
    return res.redirect(await this.canva.callback({ code, state, error }));
  }

  @Get('return')
  async back(@Res() res: Response, @Query('correlation_jwt') jwt?: string) {
    return res.redirect(await this.canva.returnFromCanva(jwt));
  }
}

/** Возврат из OAuth Threads (без JWT). */
@Controller('content/threads')
export class ContentThreadsCallbackController {
  constructor(private readonly svc: ContentService) {}

  @Get('callback')
  async callback(@Res() res: Response, @Query('code') code?: string, @Query('state') state?: string) {
    return res.redirect(await this.svc.threadsCallback(code, state));
  }
}

/** Возврат из OAuth YouTube (Google) и TikTok (без JWT). */
@Controller('content')
export class ContentVideoCallbackController {
  constructor(private readonly accounts: ContentVideoAccountsService) {}

  @Get('youtube/callback')
  async youtube(@Res() res: Response, @Query('code') code?: string, @Query('state') state?: string, @Query('error') error?: string) {
    return res.redirect(await this.accounts.callback('youtube', code, state, error));
  }

  @Get('tiktok/callback')
  async tiktok(@Res() res: Response, @Query('code') code?: string, @Query('state') state?: string, @Query('error') error?: string) {
    return res.redirect(await this.accounts.callback('tiktok', code, state, error));
  }
}
