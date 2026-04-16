// src/online-chat/public-online-chat.controller.ts
import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { OnlineChatService } from './online-chat.service';

// DTO-шки для тела запросов
interface PublicSessionDto {
  tenantKey: string;
  siteUrl: string;
  siteHost: string;
  userAgent?: string;

  // на всякий случай, если прилетит snake_case
  tenant_key?: string;
  site_url?: string;
  site_host?: string;
  user_agent?: string;
}

interface PublicMessageDto {
  tenantKey?: string;
  tenant_key?: string;

  // поддерживаем оба варианта
  sessionId?: string;
  session_id?: string;

  text?: string;

  from?: 'client' | 'staff' | 'system';
  type?: string;

  // ✅ ФАЙЛЫ
  fileUrl?: string;
  file_url?: string;

  fileName?: string;
  file_name?: string;
}

interface PublicLeadDto {
  tenantKey?: string;
  tenant_key?: string;

  sessionId?: string;
  session_id?: string;

  name?: string;
  phone?: string;
  email?: string;

  utm?: any;
  utmSource?: string;
  utm_source?: string;
  utmMedium?: string;
  utm_medium?: string;
  utmCampaign?: string;
  utm_campaign?: string;
  utmContent?: string;
  utm_content?: string;
  utmTerm?: string;
  utm_term?: string;
  pageUrl?: string;
  page_url?: string;
  referrer?: string;
  referer?: string;
}

@Controller('public/online-chat') // <── ВАЖНО: без `v1`
export class PublicOnlineChatController {
  constructor(private readonly chat: OnlineChatService) {}

  /* ================== SESSION ================== */

  // POST /v1/public/online-chat/session
  @Post('session')
  async createSession(@Body() body: PublicSessionDto) {
    const tenantKey = body.tenantKey ?? body.tenant_key ?? '';
    const siteUrl = body.siteUrl ?? body.site_url ?? '';
    const siteHost = body.siteHost ?? body.site_host ?? '';
    const userAgent = body.userAgent ?? body.user_agent;

    return this.chat.createPublicSession({
      tenantKey,
      siteUrl,
      siteHost,
      userAgent,
    });
  }

  /* ================== MESSAGE ================== */

  // POST /v1/public/online-chat/message
  @Post('message')
  async postMessage(@Body() body: PublicMessageDto) {
    const tenantKey = body.tenantKey ?? body.tenant_key;

    const sessionIdRaw = body.sessionId ?? body.session_id ?? '';
    const sessionId = String(sessionIdRaw || '');

    const fileUrl = (body.fileUrl ?? body.file_url ?? '') || undefined;
    const fileName = (body.fileName ?? body.file_name ?? '') || undefined;

    return this.chat.postPublicMessage({
      tenantKey,
      sessionId,
      text: body.text ?? '',
      from: body.from,
      type: body.type,
      fileUrl,
      fileName,
    });
  }

  /* ================== LEAD ================== */

  // POST /v1/public/online-chat/lead
  @Post('lead')
  async saveLead(@Body() body: PublicLeadDto) {
    const tenantKey = body.tenantKey ?? body.tenant_key;

    const sessionIdRaw = body.sessionId ?? body.session_id ?? '';
    const sessionId = String(sessionIdRaw || '');

    return this.chat.savePublicLead({
      tenantKey,
      sessionId,
      name: body.name,
      phone: body.phone,
      email: body.email,
      utm: body.utm,
      utmSource: body.utmSource ?? body.utm_source,
      utmMedium: body.utmMedium ?? body.utm_medium,
      utmCampaign: body.utmCampaign ?? body.utm_campaign,
      utmContent: body.utmContent ?? body.utm_content,
      utmTerm: body.utmTerm ?? body.utm_term,
      pageUrl: body.pageUrl ?? body.page_url,
      referrer: body.referrer ?? body.referer,
    });
  }

  /* ================== HISTORY ================== */

  // GET /v1/public/online-chat/history?sessionId=...&limit=50
  // (и поддержим session_id)
  @Get('history')
  async getHistory(
    @Query('tenantKey') tenantKey: string,
    @Query('sessionId') sessionId?: string,
    @Query('session_id') session_id?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chat.getPublicHistory({
      tenantKey,
      sessionId: String(sessionId ?? session_id ?? ''),
      limit: Number(limit || 50),
    });
  }

  /* ================== POLL ================== */

  // GET /v1/public/online-chat/poll?sessionId=...&after=...
  // (и поддержим session_id)
  @Get('poll')
  async poll(
    @Query('tenantKey') tenantKey: string,
    @Query('sessionId') sessionId?: string,
    @Query('session_id') session_id?: string,
    @Query('after') after?: string,
  ) {
    return this.chat.pollPublic({
      tenantKey,
      sessionId: String(sessionId ?? session_id ?? ''),
      after: Number(after || 0),
    });
  }

  /* ================== DEBUG ================== */

  // GET /v1/public/online-chat/debug-sessions?tenantKey=demo-client
  @Get('debug-sessions')
  async debugSessions(@Query('tenantKey') tenantKey: string) {
    return this.chat.debugListByTenantKey(tenantKey);
  }
}
