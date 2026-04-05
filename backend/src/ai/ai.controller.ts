import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiAssistantService } from './ai-assistant.service';
import { AiQuotaService } from './ai-quota.service';
import { AiOpenAiService } from './ai-openai.service';
import { AiChatSession } from './ai-chat-session.entity';
import { AiChatMessage } from './ai-chat-message.entity';
import { AiMemoryChunk } from './ai-memory-chunk.entity';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { isDefaultAiChatTitle } from './ai-chat-title.util';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly assistant: AiAssistantService,
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
    const configured = Boolean(
      (cfg?.openAiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim() || '')
        .length,
    );
    const quota = await this.quota.getQuotaSnapshot(user.tenantId);
    return {
      configured,
      quota,
    };
  }

  @Get('quota')
  async quotaOnly(@CurrentUser() user: CurrentUserPayload) {
    return this.quota.getQuotaSnapshot(user.tenantId);
  }

  @Post('chat')
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
      workspaceCsvContext?: {
        fileName?: string;
        tableNameHint?: string;
        headers: string[];
        fieldKeys: string[];
        rows: Record<string, string>[];
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
      sessionId: body.sessionId,
      message: body.message || '',
      salesImportContext: body.salesImportContext,
      workspaceCsvContext: body.workspaceCsvContext,
      imageFollowUpContext: body.imageFollowUpContext,
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
    const img = await this.openai.generateImage({
      prompt,
      size: body.size,
    });
    await this.quota.chargeCents(user.tenantId, cost, {
      userId: user.userId!,
      kind: 'image',
      model: cfg?.openAiImageModel || 'dall-e-3',
      promptTokens: 0,
      completionTokens: 0,
    });

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
