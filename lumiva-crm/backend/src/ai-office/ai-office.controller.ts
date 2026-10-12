import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { joinUploadsAbsolute } from '../common/uploads-root.util';
import { AiOfficeService, type DepartmentInput } from './ai-office.service';
import { normLang } from './ai-office-i18n';
import { AiBrainService } from './ai-brain.service';
import { AiOfficeConnectorsService } from './ai-office-connectors.service';
import { AiOfficeOAuthService, type OfficeOAuthProvider } from './ai-office-oauth.service';
import { CurrencyRatesService } from '../currency/currency-rates.service';
import { AiOfficeEngineService } from './ai-office-engine.service';
import { AiOfficeDataService } from './ai-office-data.service';
import { AiOfficeAutonomyService } from './ai-office-autonomy.service';
import { AiOfficeProgramsService } from './ai-office-programs.service';

const OAUTH_PROVIDERS = ['notion', 'github', 'canva'];
function oauthProvider(p: string): OfficeOAuthProvider {
  if (!OAUTH_PROVIDERS.includes(p)) throw new NotFoundException('Unknown provider');
  return p as OfficeOAuthProvider;
}

/** Публичный OAuth-callback (без JWT): целостность — подписанный state. */
@Controller('ai-office/oauth')
export class AiOfficeOAuthCallbackController {
  constructor(private readonly oauth: AiOfficeOAuthService) {}

  @Get(':provider/callback')
  async callback(@Param('provider') provider: string, @Query('code') code: string | undefined, @Query('state') state: string | undefined, @Res() res: Response) {
    const front = (process.env.FRONTEND_URL || 'https://crm.lumiva.agency').replace(/\/$/, '');
    const p = oauthProvider(provider);
    const ok = !!code && !!state && (await this.oauth.callback(p, code, state));
    return res.redirect(`${front}/ai-office/connect?oauth=${p}&result=${ok ? 'connected' : 'error'}`);
  }
}

function uid(user: CurrentUserPayload): string | null {
  return user.userId || user.id || user.sub || null;
}

@Controller('ai-office')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('ai_office')
export class AiOfficeController {
  constructor(
    private readonly office: AiOfficeService,
    private readonly brain: AiBrainService,
    private readonly connectors: AiOfficeConnectorsService,
    private readonly oauth: AiOfficeOAuthService,
    private readonly currency: CurrencyRatesService,
    private readonly engine: AiOfficeEngineService,
    private readonly data: AiOfficeDataService,
    private readonly autonomy: AiOfficeAutonomyService,
    private readonly programs: AiOfficeProgramsService,
  ) {}

  // ── офис ──
  @Get('overview')
  overview(@CurrentUser() user: CurrentUserPayload) {
    return this.office.overview(user.tenantId);
  }

  @Get('live')
  live(@CurrentUser() user: CurrentUserPayload, @Query('since') since?: string) {
    return this.office.live(user.tenantId, since);
  }

  @Get('plan')
  async plan(@CurrentUser() user: CurrentUserPayload) {
    const plan = await this.office.planInfo(user.tenantId);
    const depts = await this.office.listDepartments(user.tenantId);
    const spend = await this.office.spendSince(user.tenantId, depts.map((d) => d.id), this.office.monthStart());
    const rates = await this.currency.getRates().catch(() => ({} as Record<string, number>));
    return {
      ...plan,
      rates: { RUB: Number(rates.RUB) || null, TRY: Number(rates.TRY) || null },
      lang: await this.office.langOf(user.tenantId),
      departments: depts.map((d, i) => ({
        id: d.id, name: d.name, color: d.color, agents: d.agents.length, engine: d.engine, status: d.status, pausedReason: d.pausedReason,
        spendMonthCents: spend[d.id] ?? 0, monthlyBudgetCents: d.monthlyBudgetCents, slot: i < plan.included ? 'included' : 'extra',
      })),
    };
  }

  @Get('templates')
  async templates(@CurrentUser() user: CurrentUserPayload, @Query('lang') lang?: string) {
    // язык интерфейса того, кто смотрит (а не язык компании) — иначе русский интерфейс видит турецкие шаблоны
    return this.office.templates(normLang(lang) ?? (await this.office.langOf(user.tenantId)));
  }

  @Get('catalog')
  catalog() {
    return this.office.catalog();
  }

  // ── отделы ──
  @Get('departments')
  departments(@CurrentUser() user: CurrentUserPayload) {
    return this.office.listDepartments(user.tenantId);
  }

  @Post('departments')
  create(@CurrentUser() user: CurrentUserPayload, @Body() body: DepartmentInput) {
    return this.office.createDepartment(user.tenantId, uid(user), body || {});
  }

  @Get('departments/:id')
  department(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.office.getDepartment(user.tenantId, id);
  }

  @Patch('departments/:id')
  update(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: DepartmentInput) {
    return this.office.updateDepartment(user.tenantId, id, uid(user), body || {});
  }

  @Delete('departments/:id')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.office.deleteDepartment(user.tenantId, id);
  }

  /** «Предоставить доступ»: открыть отделу данные его зоны (подключённые рекламные кабинеты) — задачи продолжатся. */
  @Post('departments/:id/data-access/:key')
  async grantData(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string, @Param('key') key: string) {
    const dept = await this.office.getDeptEntity(user.tenantId, id);
    const src = (await this.data.sources(dept)).find((s) => s.key === key);
    if (!src) throw new NotFoundException('Unknown data source');
    if (src.status === 'grant') {
      await this.office.updateDepartment(user.tenantId, id, uid(user), { connectors: [...new Set([...dept.connectors, ...src.grantConnectors])] });
    }
    const after = (await this.data.sources(await this.office.getDeptEntity(user.tenantId, id))).find((s) => s.key === key);
    if (after?.status === 'ok') await this.office.resolveIssueByKey(user.tenantId, `${id}:data:${key}`);
    return { status: after?.status ?? src.status };
  }

  /** «Разрешить отправлять самому» (предложение «доверие по истории») */
  /** Утренняя сводка сейчас (проверка / кнопка) — по всем отделам компании с включённой сводкой. */
  @Post('digest/send-now')
  async digestNow(@CurrentUser() user: CurrentUserPayload) {
    const depts = await this.office.listDepartments(user.tenantId);
    const entities = await Promise.all((depts as any[]).map((d) => this.office.getDeptEntity(user.tenantId, d.id)));
    return { sent: await this.autonomy.sendDigest(user.tenantId, entities.filter((d) => d.status === 'active')) };
  }

  @Post('departments/:id/programs/run')
  runPrograms(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.programs.runNow(user.tenantId, id);
  }

  @Post('departments/:id/autonomy')
  grantAutonomy(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.autonomy.grantAutonomy(user.tenantId, id, uid(user));
  }

  @Post('departments/:id/pause')
  pause(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.office.setStatus(user.tenantId, id, 'paused');
  }

  @Post('departments/:id/resume')
  resume(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.office.setStatus(user.tenantId, id, 'active');
  }

  @Get('departments/:id/posts')
  posts(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.office.listPosts(user.tenantId, id);
  }

  @Post('posts/:id/cancel')
  cancelPost(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.office.cancelPost(user.tenantId, id);
  }

  @Get('departments/:id/impact')
  impact(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string, @Query('days') days?: string) {
    return this.office.impact(user.tenantId, id, Number(days) || 30);
  }

  @Post('departments/:id/plan')
  async planNow(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    await this.office.getDeptEntity(user.tenantId, id);
    return this.engine.planNow(user.tenantId, id);
  }

  @Post('departments/:id/move')
  move(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: { slot?: [number, number] }) {
    const s = Array.isArray(body?.slot) ? body.slot : [0, 0];
    return this.office.moveDepartment(user.tenantId, id, [Number(s[0]), Number(s[1])]);
  }

  // ── задачи ──
  @Get('tasks')
  tasks(
    @CurrentUser() user: CurrentUserPayload,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.office.listTasks(user.tenantId, { departmentId, status, limit: Number(limit) || undefined });
  }

  @Post('tasks')
  createTask(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { departmentId: string; title: string; details?: string; priority?: number; entityType?: string; entityId?: string; agentId?: string },
  ) {
    return this.office.createTask(user.tenantId, { ...body, source: 'manual', createdBy: uid(user) });
  }

  @Get('tasks/:id')
  taskDetail(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.office.taskDetail(user.tenantId, id);
  }

  @Post('tasks/:id/actions/:actionId/send')
  sendDraft(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string, @Param('actionId', ParseUUIDPipe) actionId: string, @Body() body: Record<string, unknown>) {
    return this.office.sendDraft(user.tenantId, id, actionId, uid(user), body || {});
  }

  @Patch('tasks/:id/actions/:actionId')
  editAction(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('actionId', ParseUUIDPipe) actionId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.office.editPendingAction(user.tenantId, id, actionId, body || {});
  }

  @Post('tasks/:id/approve')
  approve(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.office.approveTask(user.tenantId, id, uid(user));
  }

  @Post('tasks/:id/reject')
  reject(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: { reason?: string }) {
    return this.office.rejectTask(user.tenantId, id, uid(user), body?.reason);
  }

  @Post('tasks/:id/retry')
  retry(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.office.retryTask(user.tenantId, id);
  }

  @Post('tasks/:id/cancel')
  cancel(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.office.cancelTask(user.tenantId, id, uid(user));
  }

  // ── проблемы и журнал ──
  @Get('issues')
  issues(@CurrentUser() user: CurrentUserPayload, @Query('status') status?: string) {
    return this.office.listIssues(user.tenantId, status === 'resolved' ? 'resolved' : 'open');
  }

  @Post('issues/:id/resolve')
  resolve(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.office.resolveIssue(user.tenantId, id, uid(user));
  }

  @Get('events')
  events(
    @CurrentUser() user: CurrentUserPayload,
    @Query('departmentId') departmentId?: string,
    @Query('since') since?: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    return this.office.listEvents(user.tenantId, { departmentId, since, before, limit: Number(limit) || undefined });
  }

  // ── подключения ──
  @Get('connectors')
  connectorsList(@CurrentUser() user: CurrentUserPayload) {
    return this.connectors.overview(user.tenantId);
  }

  @Post('oauth/:provider/start')
  async oauthStart(@CurrentUser() user: CurrentUserPayload, @Param('provider') provider: string) {
    return { url: await this.oauth.start(oauthProvider(provider), user.tenantId, String(uid(user) ?? '')) };
  }

  @Patch('connections/:id/settings')
  connectionSettings(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: { repo?: string; parentPageId?: string }) {
    return this.oauth.updateSettings(user.tenantId, id, body || {});
  }

  @Get('connections/:id/options')
  connectionOptions(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.oauth.options(user.tenantId, id);
  }

  @Get('engines')
  engines(@CurrentUser() user: CurrentUserPayload) {
    return this.connectors.engines(user.tenantId);
  }

  @Post('connectors/scope')
  scope(@CurrentUser() user: CurrentUserPayload, @Body() body: { connector: string; connectionId: string; departmentIds?: string[] }) {
    return this.connectors.setScope(user.tenantId, uid(user), String(body?.connector), String(body?.connectionId ?? ''), Array.isArray(body?.departmentIds) ? body.departmentIds : []);
  }

  @Post('connectors/grant')
  async grant(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { connector: string; label?: string; token: string; departmentIds?: string[]; settings?: Record<string, string>; requestId?: string },
  ) {
    const r = await this.connectors.grantToken(user.tenantId, uid(user), body);
    if (body?.requestId) await this.office.resolveIssue(user.tenantId, body.requestId, uid(user)).catch(() => undefined);
    this.office.invalidate();
    return r;
  }

  // ── «Мозг» ──
  @Get('brain/files')
  brainFiles(@CurrentUser() user: CurrentUserPayload, @Query('folder') folder?: string) {
    return this.brain.list(user.tenantId, folder);
  }

  @Get('brain/files/:id')
  brainFile(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.brain.get(user.tenantId, id);
  }

  @Get('brain/files/:id/download')
  async brainDownload(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const f = await this.brain.rawFile(user.tenantId, id);
    if (f.storagePath) {
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`);
      return res.sendFile(joinUploadsAbsolute(f.storagePath));
    }
    if (f.bodyMd != null) {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`);
      return res.send(f.bodyMd);
    }
    throw new NotFoundException('File has no content');
  }

  @Post('brain/files')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async brainUpload(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    @Body() body: { folder?: string; scope?: string; requestId?: string },
  ) {
    let scope: unknown;
    try {
      scope = body?.scope ? JSON.parse(body.scope) : undefined;
    } catch {
      scope = undefined;
    }
    const folder = body?.folder && body.folder !== 'common' ? body.folder : null;
    const row = await this.brain.upload(user.tenantId, uid(user), file, folder, scope);
    await this.office.resolveUploadRequest(user.tenantId, body?.requestId, folder, uid(user));
    return row;
  }

  @Post('brain/docs')
  async brainDoc(@CurrentUser() user: CurrentUserPayload, @Body() body: { name?: string; folder?: string; bodyMd?: string; scope?: string[]; requestId?: string }) {
    const row = await this.brain.createDoc(user.tenantId, { ...body, userId: uid(user) });
    await this.office.resolveUploadRequest(user.tenantId, body?.requestId, body?.folder && body.folder !== 'common' ? body.folder : null, uid(user));
    return row;
  }

  @Patch('brain/files/:id')
  brainUpdate(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: { name?: string; bodyMd?: string; scope?: string[]; folder?: string }) {
    return this.brain.update(user.tenantId, id, body || {});
  }

  @Delete('brain/files/:id')
  brainRemove(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.brain.remove(user.tenantId, id);
  }
}
