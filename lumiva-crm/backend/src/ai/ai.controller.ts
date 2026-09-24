import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiAssistantService } from './ai-assistant.service';
import { WorkspaceSyncService, type SyncSourceKind } from '../workspace-sync/workspace-sync.service';
import { AiQuotaService } from './ai-quota.service';
import { AiOpenAiService } from './ai-openai.service';
import { AiChatSession } from './ai-chat-session.entity';
import { AiChatMessage } from './ai-chat-message.entity';
import { AiMemoryChunk } from './ai-memory-chunk.entity';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { isDefaultAiChatTitle } from './ai-chat-title.util';

@Controller('ai')
@UseGuards(JwtAuthGuard, RbacGuard)
export class AiController {
  constructor(
    private readonly assistant: AiAssistantService,
    private readonly sync: WorkspaceSyncService,
    private readonly quota: AiQuotaService,
    private readonly openai: AiOpenAiService,
    private readonly platformSettings: PlatformSettingsService,
    @InjectRepository(AiChatSession)
    private readonly sessions: Repository<AiChatSession>,
    @InjectRepository(AiChatMessage)
    private readonly messages: Repository<AiChatMessage>,
    @InjectRepository(AiMemoryChunk)
    private readonly memoryRepo: Repository<AiMemoryChunk>,
  ) {}

  @Get('status')
  async status(@CurrentUser() user: CurrentUserPayload) {
    const cfg = await this.platformSettings.getSettings();
    const platformConfigured = Boolean(
      (cfg?.openAiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim() || '')
        .length,
    );
    const tenantOverride = await this.assistant.resolveTenantOpenAiOverride(
      user.tenantId,
    );
    const quota = await this.quota.getQuotaSnapshot(user.tenantId);
    return {
      configured: platformConfigured || Boolean(tenantOverride),
      quota,
    };
  }

  /* ── Источники синхронизации таблицы рабочей области (см. workspace-sync) ── */

  @Get('workspace-tables/:objectId/sync-sources')
  @RequirePermission('custom_objects', 'read')
  async listSyncSources(@CurrentUser() user: CurrentUserPayload, @Param('objectId') objectId: string) {
    return { sources: (await this.sync.listSources(user.tenantId, objectId)) ?? [] };
  }

  @Post('workspace-tables/:objectId/sync-sources')
  @RequirePermission('custom_objects', 'write')
  async addSyncSource(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId') objectId: string,
    @Body() body: { kind: SyncSourceKind; params: Record<string, any>; label?: string; autoRefresh?: boolean; skipInitialRefresh?: boolean },
  ) {
    return this.sync.addSource(user.tenantId, objectId, body);
  }

  @Patch('workspace-tables/:objectId/sync-sources/:sourceId')
  @RequirePermission('custom_objects', 'write')
  async updateSyncSource(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId') objectId: string,
    @Param('sourceId') sourceId: string,
    @Body() body: { autoRefresh?: boolean; label?: string; params?: Record<string, any> },
  ) {
    return this.sync.updateSource(user.tenantId, objectId, sourceId, body || {});
  }

  @Delete('workspace-tables/:objectId/sync-sources/:sourceId')
  @RequirePermission('custom_objects', 'write')
  async removeSyncSource(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId') objectId: string,
    @Param('sourceId') sourceId: string,
    @Query('deleteRows') deleteRows?: string,
  ) {
    return this.sync.removeSource(user.tenantId, objectId, sourceId, { deleteRows: deleteRows === '1' || deleteRows === 'true' });
  }

  @Post('workspace-tables/:objectId/sync-sources/:sourceId/refresh')
  @RequirePermission('custom_objects', 'write')
  async refreshSyncSource(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId') objectId: string,
    @Param('sourceId') sourceId: string,
  ) {
    return this.sync.refreshSource(user.tenantId, objectId, sourceId);
  }

  /** «Обновить всё» — все источники таблицы. */
  @Post('workspace-tables/:objectId/refresh')
  @RequirePermission('custom_objects', 'write')
  async refreshMarketingTable(@CurrentUser() user: CurrentUserPayload, @Param('objectId') objectId: string) {
    return this.sync.refreshTable(user.tenantId, objectId);
  }

  @Patch('workspace-tables/:objectId/auto-refresh')
  @RequirePermission('custom_objects', 'write')
  async setAutoRefreshAll(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId') objectId: string,
    @Body() body: { enabled: boolean },
  ) {
    const sources = (await this.sync.listSources(user.tenantId, objectId)) ?? [];
    for (const s of sources) await this.sync.updateSource(user.tenantId, objectId, s.id, { autoRefresh: !!body?.enabled });
    return { ok: true, autoRefresh: !!body?.enabled };
  }

  @Get('quota')
  async quotaOnly(@CurrentUser() user: CurrentUserPayload) {
    return this.quota.getQuotaSnapshot(user.tenantId);
  }

  @Post('chat')
  @RequirePermission('chat', 'write')
  async chat(
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    body: {
      sessionId?: string | null;
      message?: string;
      salesImportContext?: {
        importId: string;
        suggestedMapping?: Record<string, string | null>;
        fileName?: string;
        totalRows?: number;
      };
      workspaceFileContext?: {
        importId: string;
        fileName?: string;
        tableNameHint?: string;
        columns: string[];
        sample: Record<string, unknown>[];
        totalRows: number;
      };
      imageFollowUpContext?: {
        lastUserPrompt?: string;
        lastRevisedPrompt?: string;
        lastUrl?: string;
      };
    },
  ) {
    return this.assistant.runChat({
      tenantId: user.tenantId,
      userId: user.userId!,
      userEmail: user.email,
      userRole: user.role,
      staffUserId: user.staffUserId,
      sessionId: body.sessionId,
      message: body.message || '',
      salesImportContext: body.salesImportContext,
      workspaceFileContext: body.workspaceFileContext,
      imageFollowUpContext: body.imageFollowUpContext,
    });
  }

  /** Решение по карточке-рекомендации в чате: одобрить (AI-сотрудник берёт работу) или отклонить. */
  @Post('proposals/:messageId/:proposalId/decision')
  @RequirePermission('chat', 'write')
  async decideProposal(
    @CurrentUser() user: CurrentUserPayload,
    @Param('messageId') messageId: string,
    @Param('proposalId') proposalId: string,
    @Body() body: { decision?: string },
  ) {
    return this.assistant.decideProposal({
      tenantId: user.tenantId,
      userId: user.userId!,
      messageId,
      proposalId,
      decision: body?.decision === 'approve' ? 'approve' : 'reject',
    });
  }

  @Get('sessions')
  async listSessions(
    @CurrentUser() user: CurrentUserPayload,
    @Query('limit') limit?: string,
  ) {
    const take = Math.min(50, Math.max(1, parseInt(limit || '30', 10) || 30));
    return this.sessions.find({
      where: { tenantId: user.tenantId, userId: user.userId! },
      order: { updatedAt: 'DESC' },
      take,
    });
  }

  @Post('sessions')
  async createSession(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body?: { title?: string | null },
  ) {
    const raw = body?.title != null ? String(body.title).trim() : '';
    const s = this.sessions.create({
      tenantId: user.tenantId,
      userId: user.userId!,
      title: raw ? raw.slice(0, 500) : null,
    });
    await this.sessions.save(s);
    return s;
  }

  @Get('sessions/:id/messages')
  async sessionMessages(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const s = await this.sessions.findOne({
      where: { id, tenantId: user.tenantId, userId: user.userId! },
    });
    if (!s) return { messages: [] };
    const rows = await this.messages.find({
      where: { sessionId: id },
      order: { createdAt: 'ASC' },
    });
    return { session: s, messages: rows };
  }

  @Delete('sessions/:id')
  async deleteSession(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const s = await this.sessions.findOne({
      where: { id, tenantId: user.tenantId, userId: user.userId! },
    });
    if (!s) return { ok: false };
    await this.messages.delete({ sessionId: id });
    await this.sessions.delete({ id });
    return { ok: true };
  }

  @Post('image')
  async image(
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    body: {
      prompt?: string;
      size?: '1024x1024' | '1792x1024' | '1024x1792';
      sessionId?: string | null;
    },
  ) {
    const prompt = String(body.prompt || '').trim();
    if (!prompt) return { ok: false, message: 'Пустой промпт' };
    const cfg = await this.platformSettings.getSettings();
    const cost =
      cfg?.aiImageCostCents != null && cfg.aiImageCostCents > 0
        ? cfg.aiImageCostCents
        : 8;
    const openAiOverride = await this.assistant.resolveTenantOpenAiOverride(user.tenantId);
    const img = await this.openai.generateImage(
      { prompt, size: body.size },
      openAiOverride,
    );
    // BYOK (свой ключ OpenAI) — тенант уже платит своему провайдеру напрямую за эту
    // генерацию, платформенную AI-квоту не списываем (как и для обычного чата).
    if (!openAiOverride || openAiOverride.provider === 'anthropic') {
      await this.quota.chargeCents(user.tenantId, cost, {
        userId: user.userId!,
        kind: 'image',
        model: cfg?.openAiImageModel || 'dall-e-3',
        promptTokens: 0,
        completionTokens: 0,
      });
    }

    const sid = body.sessionId ? String(body.sessionId).trim() : '';
    if (sid) {
      const s = await this.sessions.findOne({
        where: {
          id: sid,
          tenantId: user.tenantId,
          userId: user.userId!,
        },
      });
      if (s) {
        await this.messages.save(
          this.messages.create({
            sessionId: s.id,
            role: 'user',
            content: prompt,
          }),
        );
        const caption = 'Изображение сгенерировано.';
        const assistantMd = `${caption}\n\n![Изображение](${img.url})`;
        await this.messages.save(
          this.messages.create({
            sessionId: s.id,
            role: 'assistant',
            content: assistantMd,
            toolCalls: null,
            meta: {
              imageUrl: img.url,
              revised_prompt: img.revised_prompt ?? null,
            },
          }),
        );
        if (isDefaultAiChatTitle(s.title)) {
          s.title = prompt.slice(0, 80);
          await this.sessions.save(s);
        }
      }
    }

    return {
      ok: true,
      url: img.url,
      revised_prompt: img.revised_prompt,
      sessionId: sid || undefined,
    };
  }

  @Get('memory')
  async listMemory(
    @CurrentUser() user: CurrentUserPayload,
    @Query('limit') limit?: string,
  ) {
    const take = Math.min(100, Math.max(1, parseInt(limit || '40', 10) || 40));
    return this.memoryRepo.find({
      where: { tenantId: user.tenantId },
      order: { createdAt: 'DESC' },
      take,
    });
  }

  @Post('memory')
  async addMemory(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { title?: string; content?: string },
  ) {
    const content = String(body.content || '').trim();
    if (!content) return { ok: false };
    const addBytes = BigInt(Buffer.byteLength(content, 'utf8'));
    await this.quota.assertStorageHeadroom(user.tenantId, addBytes);
    const chunk = this.memoryRepo.create({
      tenantId: user.tenantId,
      userId: user.userId!,
      title: body.title ? String(body.title).slice(0, 500) : null,
      content: content.slice(0, 50_000),
    });
    await this.memoryRepo.save(chunk);
    await this.quota.addStorageUsedBytes(user.tenantId, addBytes);
    return { ok: true, id: chunk.id };
  }

  @Post('lead-score/:leadId')
  async scoreLead(
    @CurrentUser() user: CurrentUserPayload,
    @Param('leadId') leadId: string,
  ) {
    return this.assistant.scoreLead(user.tenantId, user.userId!, leadId);
  }

  @Post('enrich/:entityType/:entityId')
  async enrichEntity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    const type = entityType === 'company' ? 'company' : 'lead';
    return this.assistant.enrichEntity(user.tenantId, user.userId!, type, entityId);
  }

  @Post('email-reply-suggest')
  async emailReplySuggest(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { subject?: string; body?: string; senderName?: string },
  ) {
    return this.assistant.suggestEmailReply(user.tenantId, user.userId!, body);
  }

  @Post('next-action/:leadId')
  async nextAction(
    @CurrentUser() user: CurrentUserPayload,
    @Param('leadId') leadId: string,
  ) {
    return this.assistant.nextAction(user.tenantId, user.userId!, leadId);
  }

  @Post('outreach-email/:leadId')
  async outreachEmail(
    @CurrentUser() user: CurrentUserPayload,
    @Param('leadId') leadId: string,
  ) {
    return this.assistant.generateOutreachEmail(user.tenantId, user.userId!, leadId);
  }

  @Post('project-tasks')
  async generateProjectTasks(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { projectName?: string; prompt?: string },
  ) {
    return this.assistant.generateProjectTasks(user.tenantId, user.userId!, body || {});
  }

  @Post('find-duplicates')
  async findDuplicates(@CurrentUser() user: CurrentUserPayload) {
    return this.assistant.findDuplicates(user.tenantId, user.userId!);
  }

  @Post('smart-search')
  async smartSearch(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { query: string },
  ) {
    return this.assistant.smartSearch(user.tenantId, user.userId!, body.query || '');
  }

  @Post('analytics/build-dashboard')
  async buildAnalyticsDashboard(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { module?: string; workspaceObjectId?: string; periodFrom?: string; periodTo?: string },
  ) {
    return this.assistant.buildAnalyticsDashboard(user.tenantId, user.userId!, body || {});
  }

  @Delete('memory/:id')
  async deleteMemory(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const row = await this.memoryRepo.findOne({
      where: { id, tenantId: user.tenantId },
    });
    if (!row) return { ok: false };
    const sub = BigInt(Buffer.byteLength(row.content || '', 'utf8'));
    await this.memoryRepo.delete({ id });
    await this.quota.subtractStorageUsedBytes(user.tenantId, sub);
    return { ok: true };
  }
}
