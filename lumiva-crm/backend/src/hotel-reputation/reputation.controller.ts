import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Logger, Param, Patch, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { ReputationSettingsService } from './reputation-settings.service';
import { ReputationReviewsService, FeedQuery } from './reputation-reviews.service';
import { ReputationAnalyticsService, AnalyticsQuery } from './reputation-analytics.service';
import { ReputationSyncService } from './reputation-sync.service';
import { ReputationAlertsService } from './reputation-alerts.service';
import { GoogleBusinessService } from './google-business.service';
import { ApifyService } from './apify.service';
import { ReputationAgentService } from './reputation-agent.service';
import { ReputationAiService } from './reputation-ai.service';
import { ReputationDuplicatesService } from './reputation-duplicates.service';
import { ReportRequest, ReputationReportService } from './reputation-report.service';
import { CompetitorAnalyticsQuery, ReputationCompetitorsService } from './reputation-competitors.service';
import { ReputationReservationsService } from './reputation-reservations.service';
import { tenantFrontend } from './reputation-tenant.util';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HotelReviewSource, HotelReviewSyncRun } from './reputation.entities';

/** Отели → Отзывы: лента, карточка, ответы, дашборд, настройки площадок. */
@Controller('hotel-reputation')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels', 'read')
export class ReputationController {
  constructor(
    private readonly settings: ReputationSettingsService,
    private readonly reviews: ReputationReviewsService,
    private readonly analytics: ReputationAnalyticsService,
    private readonly sync: ReputationSyncService,
    private readonly alerts: ReputationAlertsService,
    private readonly google: GoogleBusinessService,
    private readonly apify: ApifyService,
    private readonly agent: ReputationAgentService,
    private readonly ai: ReputationAiService,
    private readonly duplicates: ReputationDuplicatesService,
    private readonly report: ReputationReportService,
    private readonly competitors: ReputationCompetitorsService,
    private readonly stays: ReputationReservationsService,
    @InjectRepository(HotelReviewSyncRun) private readonly runs: Repository<HotelReviewSyncRun>,
    @InjectRepository(HotelReviewSource) private readonly sources: Repository<HotelReviewSource>,
  ) {}

  // ---------------------------------------------------------------- лента и карточка

  @Get('reviews')
  feed(@CurrentUser() u: CurrentUserPayload, @Query() q: FeedQuery) {
    return this.reviews.feed(u.tenantId, q);
  }

  @Get('ai-status')
  aiStatus(@CurrentUser() u: CurrentUserPayload) {
    return this.reviews.aiStatus(u.tenantId);
  }

  @Get('reviews-languages')
  languages(@CurrentUser() u: CurrentUserPayload) {
    return this.reviews.languages(u.tenantId);
  }

  @Get('reviews/:id')
  card(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string) {
    return this.reviews.card(u.tenantId, id);
  }

  @Post('reviews/:id/draft')
  @RequirePermission('hotels', 'write')
  draft(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string, @Body() b: { tone?: string }) {
    return this.agent.draftReview(u.tenantId, id, b?.tone, 'card');
  }

  @Post('reviews/:id/reply')
  @RequirePermission('hotels', 'write')
  reply(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string, @Body() b: { text: string }) {
    return this.reviews.reply(u.tenantId, (u.userId ?? u.id ?? u.sub)!, id, b?.text);
  }

  @Post('reviews/:id/mark-replied')
  @RequirePermission('hotels', 'write')
  markReplied(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string, @Body() b: { replied: boolean; text?: string }) {
    return this.reviews.markReplied(u.tenantId, (u.userId ?? u.id ?? u.sub)!, id, b?.replied !== false, b?.text);
  }

  @Post('reviews/:id/reanalyze')
  @RequirePermission('hotels', 'write')
  reanalyze(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string) {
    return this.reviews.reanalyze(u.tenantId, id);
  }

  @Post('reviews/:id/translate')
  @RequirePermission('hotels', 'read')
  translate(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string, @Body() b: { lang?: string }) {
    return this.reviews.translate(u.tenantId, id, b?.lang);
  }

  // ---------------------------------------------------------------- бронь гостя

  @Get('reviews/:id/stay-candidates')
  stayCandidates(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string) {
    return this.stays.candidates(u.tenantId, id);
  }

  /** action: link (reservationId) | confirm | reject | unlink. */
  @Post('reviews/:id/stay')
  @RequirePermission('hotels', 'write')
  async stayDecide(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string, @Body() b: { action?: string; reservationId?: string }) {
    await this.stays.decide(u.tenantId, id, b);
    return this.reviews.card(u.tenantId, id);
  }

  /** Подобрать брони для всех непроверенных отзывов (без внешних запросов). */
  @Post('stays/match')
  @RequirePermission('hotels', 'write')
  matchStays(@CurrentUser() u: CurrentUserPayload) {
    return this.stays.matchReviews(u.tenantId);
  }

  // ---------------------------------------------------------------- дубликаты

  @Get('reviews/:id/duplicate-candidates')
  duplicateCandidates(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string) {
    return this.duplicates.candidates(u.tenantId, id);
  }

  /** «Это дубликат отзыва ofId» (ofId=null — снять отметку). */
  @Post('reviews/:id/duplicate')
  @RequirePermission('hotels', 'write')
  async markDuplicate(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string, @Body() b: { ofId?: string | null }) {
    await this.duplicates.mark(u.tenantId, (u.userId ?? u.id ?? u.sub) || null, id, b?.ofId || null);
    return this.reviews.card(u.tenantId, id);
  }

  @Post('duplicates/:pairId/dismiss')
  @RequirePermission('hotels', 'write')
  async dismissDuplicate(@CurrentUser() u: CurrentUserPayload, @Param('pairId') pairId: string, @Body() b: { reviewId?: string }) {
    await this.duplicates.dismiss(u.tenantId, (u.userId ?? u.id ?? u.sub) || null, pairId);
    return b?.reviewId ? this.reviews.card(u.tenantId, b.reviewId) : { ok: true };
  }

  /** Подтвердить разом все пары с дословно тем же текстом. */
  @Post('duplicates/confirm-exact')
  @RequirePermission('hotels', 'write')
  confirmExactDuplicates(@CurrentUser() u: CurrentUserPayload) {
    return this.duplicates.confirmExact(u.tenantId, (u.userId ?? u.id ?? u.sub) || null);
  }

  /** Поиск дубликатов по всей истории (с даты «Отзывы с»). */
  @Post('duplicates/scan')
  @RequirePermission('hotels', 'write')
  scanDuplicates(@CurrentUser() u: CurrentUserPayload) {
    return this.duplicates.scanTenant(u.tenantId);
  }

  @Post('replies/:id/retry')
  @RequirePermission('hotels', 'write')
  retry(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string) {
    return this.reviews.retryReply(u.tenantId, id);
  }

  // ---------------------------------------------------------------- аналитика

  @Get('analytics/dashboard')
  dashboard(@CurrentUser() u: CurrentUserPayload, @Query() q: AnalyticsQuery) {
    return this.analytics.dashboard(u.tenantId, q);
  }

  @Get('hotels-summary')
  hotelsSummary(@CurrentUser() u: CurrentUserPayload) {
    return this.analytics.hotelsSummary(u.tenantId);
  }

  @Get('hotels/:hotelId/tasks')
  hotelTasks(@CurrentUser() u: CurrentUserPayload, @Param('hotelId') hotelId: string) {
    return this.agent.hotelTasks(u.tenantId, hotelId);
  }

  @Get('hotels/:hotelId/summary')
  hotelSummary(@CurrentUser() u: CurrentUserPayload, @Param('hotelId') hotelId: string) {
    return this.analytics.hotelSummary(u.tenantId, hotelId);
  }

  /** Сравнение на графике: несколько отелей (dim=hotel) или площадок (dim=platform). */
  @Get('analytics/compare')
  compare(@CurrentUser() u: CurrentUserPayload, @Query() q: AnalyticsQuery & { dim?: string }) {
    return this.analytics.compare(u.tenantId, q, q.dim === 'platform' ? 'platform' : 'hotel');
  }

  /** PDF-отчёт по текущим фильтрам дашборда на выбранном языке — скачать. */
  @Post('analytics/report/pdf')
  async reportPdf(@CurrentUser() u: CurrentUserPayload, @Body() b: ReportRequest, @Res() res: Response) {
    const { buffer, filename } = await this.report.build(u.tenantId, b);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  /** Тот же PDF — письмом на указанные адреса. */
  @Post('analytics/report/send')
  @RequirePermission('hotels', 'write')
  reportSend(@CurrentUser() u: CurrentUserPayload, @Body() b: ReportRequest & { emails?: string[]; message?: string }) {
    return this.report.send(u.tenantId, b);
  }

  /** Мы против конкурентов: по каждому отелю в срезе, у которого добавлены конкуренты. */
  @Get('analytics/competitors')
  competitorsCompare(@CurrentUser() u: CurrentUserPayload, @Query() q: CompetitorAnalyticsQuery) {
    return this.competitors.compare(u.tenantId, q);
  }

  // ---------------------------------------------------------------- конкуренты (настройки)

  @Get('competitors')
  listCompetitors(@CurrentUser() u: CurrentUserPayload, @Query('hotelId') hotelId?: string) {
    return this.competitors.list(u.tenantId, hotelId || undefined);
  }

  @Post('competitors')
  @RequirePermission('hotels', 'write')
  createCompetitor(@CurrentUser() u: CurrentUserPayload, @Body() b: any) {
    return this.competitors.create(u.tenantId, b);
  }

  @Patch('competitors/:id')
  @RequirePermission('hotels', 'write')
  updateCompetitor(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string, @Body() b: any) {
    return this.competitors.update(u.tenantId, id, b);
  }

  @Delete('competitors/:id')
  @RequirePermission('hotels', 'write')
  removeCompetitor(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string) {
    return this.competitors.remove(u.tenantId, id);
  }

  /** «Собрать сейчас» по одной площадке конкурента — с теми же ограничениями объёма и бюджета. */
  @Post('competitors/sources/:id/sync')
  @RequirePermission('hotels', 'write')
  async syncCompetitorSource(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string) {
    const src = await this.competitors.sourceForTenant(u.tenantId, id);
    return this.sync.startCompetitorApify(src, true);
  }

  @Get('analytics/topic-matrix')
  matrix(@CurrentUser() u: CurrentUserPayload, @Query() q: AnalyticsQuery) {
    return this.analytics.topicMatrix(u.tenantId, q);
  }

  @Get('analytics/monthly-report')
  monthly(@CurrentUser() u: CurrentUserPayload, @Query('brandId') brandId?: string, @Query('month') month?: string) {
    return this.analytics.monthlyReportWithSummary(u.tenantId, brandId || null, month);
  }

  // ---------------------------------------------------------------- настройки

  @Get('settings')
  getSettings(@CurrentUser() u: CurrentUserPayload) {
    return this.settings.publicSettings(u.tenantId);
  }

  @Patch('settings')
  @RequirePermission('hotels', 'write')
  updateSettings(@CurrentUser() u: CurrentUserPayload, @Body() b: any) {
    return this.settings.updateSettings(u.tenantId, b);
  }

  @Post('settings/topics/translate')
  @RequirePermission('hotels', 'write')
  translateTopic(@CurrentUser() u: CurrentUserPayload, @Body() b: { label?: string }) {
    const label = String(b?.label || '').trim();
    if (!label) throw new BadRequestException('Category name is required');
    return this.ai.translateTopicLabel(u.tenantId, label);
  }

  @Get('setup')
  setup(@CurrentUser() u: CurrentUserPayload) {
    return this.settings.listHotelsWithSources(u.tenantId);
  }

  @Post('brands')
  @RequirePermission('hotels', 'write')
  createBrand(@CurrentUser() u: CurrentUserPayload, @Body() b: { name: string; color?: string }) {
    return this.settings.saveBrand(u.tenantId, null, b);
  }

  @Patch('brands/:id')
  @RequirePermission('hotels', 'write')
  updateBrand(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string, @Body() b: { name: string; color?: string }) {
    return this.settings.saveBrand(u.tenantId, id, b);
  }

  @Delete('brands/:id')
  @RequirePermission('hotels', 'write')
  removeBrand(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string) {
    return this.settings.removeBrand(u.tenantId, id);
  }

  @Patch('hotels/:hotelId/brand')
  @RequirePermission('hotels', 'write')
  setBrand(@CurrentUser() u: CurrentUserPayload, @Param('hotelId') hotelId: string, @Body() b: { brandId: string | null }) {
    return this.settings.setHotelBrand(u.tenantId, hotelId, b?.brandId || null);
  }

  @Put('hotels/:hotelId/sources/:platform')
  @RequirePermission('hotels', 'write')
  upsertSource(
    @CurrentUser() u: CurrentUserPayload,
    @Param('hotelId') hotelId: string,
    @Param('platform') platform: string,
    @Body() b: { url?: string | null; externalId?: string | null; apiKey?: string | null; active?: boolean },
  ) {
    return this.settings.upsertSource(u.tenantId, hotelId, platform, b || {});
  }

  @Delete('sources/:id')
  @RequirePermission('hotels', 'write')
  removeSource(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string) {
    return this.settings.removeSource(u.tenantId, id);
  }

  @Post('sources/:id/sync')
  @RequirePermission('hotels', 'write')
  syncSource(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string) {
    return this.sync.syncNow(u.tenantId, id);
  }

  @Post('sources/:id/test')
  @RequirePermission('hotels', 'write')
  testSource(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string, @Body() b: { max?: number }) {
    return this.sync.testRun(u.tenantId, id, Math.min(100, Math.max(1, Number(b?.max) || 20)));
  }

  @Get('older-count')
  olderCount(@CurrentUser() u: CurrentUserPayload, @Query('before') before: string) {
    return this.sync.countOlder(u.tenantId, before);
  }

  @Post('purge-older')
  @RequirePermission('hotels', 'write')
  purgeOlder(@CurrentUser() u: CurrentUserPayload, @Body() b: { before: string }) {
    return this.sync.purgeOlder(u.tenantId, b?.before);
  }

  // ---------------------------------------------------------------- ИИ-менеджер отзывов

  @Get('agent')
  agentState(@CurrentUser() u: CurrentUserPayload) {
    return this.agent.getState(u.tenantId);
  }

  @Patch('agent')
  @RequirePermission('hotels', 'write')
  agentUpdate(@CurrentUser() u: CurrentUserPayload, @Body() b: any) {
    return this.agent.updateWork(u.tenantId, b);
  }

  @Post('agent/digest')
  @RequirePermission('hotels', 'write')
  agentDigest(@CurrentUser() u: CurrentUserPayload, @Body() b: { deliver?: boolean }) {
    return this.agent.runDigest(u.tenantId, { deliver: b?.deliver !== false });
  }

  @Post('agent/insights')
  @RequirePermission('hotels', 'write')
  agentInsights(@CurrentUser() u: CurrentUserPayload, @Body() b: { deliver?: boolean }) {
    return this.agent.runInsights(u.tenantId, { deliver: b?.deliver !== false });
  }

  @Post('agent/reminders')
  @RequirePermission('hotels', 'write')
  async agentReminders(@CurrentUser() u: CurrentUserPayload) {
    const a = await this.agent.agentFor(u.tenantId);
    if (!a) return { reminded: 0, escalated: 0, noAgent: true };
    return this.agent.remind(a, this.agent.work(a));
  }

  @Post('backfill')
  @RequirePermission('hotels', 'write')
  backfill(@CurrentUser() u: CurrentUserPayload, @Body() b: { sourceIds?: string[]; platform?: string; max: number }) {
    return this.sync.requestBackfill(u.tenantId, b || ({} as any));
  }

  @Post('sources/:id/use-primary')
  @RequirePermission('hotels', 'write')
  async usePrimary(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string) {
    await this.sources.update({ id, tenantId: u.tenantId }, { useFallback: false });
    return { ok: true };
  }

  @Get('runs')
  async listRuns(@CurrentUser() u: CurrentUserPayload, @Query('platform') platform?: string, @Query('hotelId') hotelId?: string, @Query('status') status?: string) {
    const where: any = { tenantId: u.tenantId };
    if (platform) where.platform = platform;
    if (hotelId) where.hotelId = hotelId;
    if (status) where.status = status;
    const rows = await this.runs.find({ where, order: { startedAt: 'DESC' }, take: 200 });
    return rows.map((r) => ({ ...r, new: r.newCount }));
  }

  @Get('runs/:id/preview')
  previewRun(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string) {
    return this.sync.previewTestRun(u.tenantId, id);
  }

  @Get('alerts')
  recentAlerts(@CurrentUser() u: CurrentUserPayload) {
    return this.alerts.recent(u.tenantId);
  }

  // ---------------------------------------------------------------- подключения

  /** Расход Apify за текущий платёжный цикл (из самого Apify). */
  @Get('apify/usage')
  apifyUsage(@CurrentUser() u: CurrentUserPayload) {
    return this.sync.apifyUsage(u.tenantId, true);
  }

  @Post('apify/verify')
  @RequirePermission('hotels', 'write')
  async verifyApify(@CurrentUser() u: CurrentUserPayload, @Body() b: { token?: string }) {
    const token = b?.token?.trim() || (await this.settings.secret(u.tenantId, 'apifyToken'));
    if (!token) return { ok: false, username: null };
    const r = await this.apify.verifyToken(token);
    return { ok: true, ...r };
  }

  @Get('google/auth-url')
  @RequirePermission('hotels', 'write')
  async googleAuthUrl(@CurrentUser() u: CurrentUserPayload) {
    return { url: await this.google.authUrl(u.tenantId) };
  }

  @Post('google/disconnect')
  @RequirePermission('hotels', 'write')
  async googleDisconnect(@CurrentUser() u: CurrentUserPayload) {
    await this.google.disconnect(u.tenantId);
    return { ok: true };
  }

  @Get('google/accounts')
  googleAccounts(@CurrentUser() u: CurrentUserPayload) {
    return this.google.listAccounts(u.tenantId);
  }

  @Get('google/locations')
  googleLocations(@CurrentUser() u: CurrentUserPayload, @Query('account') account?: string) {
    return this.google.listLocations(u.tenantId, account);
  }

  @Post('google/notifications')
  @RequirePermission('hotels', 'write')
  googleNotifications(@CurrentUser() u: CurrentUserPayload) {
    return this.google.setupNotifications(u.tenantId);
  }
}

/** Публичные точки Google: возврат OAuth и push-уведомления Pub/Sub (NEW_REVIEW). */
@Controller('public/hotel-reputation')
@SkipThrottle()
export class ReputationPublicController {
  private readonly log = new Logger(ReputationPublicController.name);

  constructor(
    private readonly google: GoogleBusinessService,
    private readonly settings: ReputationSettingsService,
    private readonly sync: ReputationSyncService,
  ) {}

  @Get('google/callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Query('error') error: string, @Res() res: Response) {
    const r: { ok: boolean; error?: string; tenantId?: string } = error || !code ? { ok: false, error: error || 'no_code' } : await this.google.completeOAuth(code, state);
    // вернуть пользователя в его CRM (свой домен клиента, если подключён)
    const frontend = r.tenantId
      ? await tenantFrontend((sql, p) => this.sync.rawQuery(sql, p), r.tenantId)
      : (process.env.FRONTEND_URL || 'https://crm.lumiva.agency').replace(/\/$/, '');
    res.redirect(`${frontend}/hotels/reviews/settings?tab=connections&google=${r.ok ? 'connected' : `error&reason=${encodeURIComponent(r.error || '')}`}`);
  }

  /**
   * Pub/Sub push: { message: { data: base64(JSON{type, location, review}) } }.
   * Токен в URL сопоставляется с тенантом; отвечаем сразу, отзыв дозапрашиваем в фоне.
   */
  @Post('google-push/:token')
  @HttpCode(204)
  async push(@Param('token') token: string, @Body() body: any) {
    const tenantId = await this.settings.tenantByPushToken(token);
    if (!tenantId) return;
    let payload: any = {};
    try {
      payload = JSON.parse(Buffer.from(String(body?.message?.data || ''), 'base64').toString('utf8') || '{}');
    } catch {
      return;
    }
    if (payload?.type && !['NEW_REVIEW', 'UPDATED_REVIEW'].includes(payload.type)) return;
    this.sync.handleGooglePush(tenantId, payload).catch((e) => this.log.warn(`google push: ${e?.message || e}`));
  }
}
