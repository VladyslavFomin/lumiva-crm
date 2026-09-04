// src/leads/leads.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ForbiddenException,
  NotFoundException,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { LeadsService } from './leads.service';
import { Lead } from './lead.entity';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { ConvertLeadDto } from './dto/convert-lead.dto';
import { LeadActivityService } from './lead-activity.service';
import { LeadAccessService, EffectiveTier } from './lead-access.service';
import { LeadAccessGrant, LeadAccessScopeType, LeadAccessTier } from './lead-access-grant.entity';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacService } from '../rbac/rbac.service';

import { User } from '../users/user.entity';
import { StaffUser, StaffRole } from '../staff/staff-user.entity';
import { SearchLeadsQueryDto } from './dto/search-leads-query.dto';
import { parseCsvRobust } from '../lib/import-spreadsheet.util';
import { NotificationsService } from '../notifications/notifications.service';
import { StaffUsersService } from '../staff/staff-users.service';
import { DataVisibilityService } from '../data-visibility/data-visibility.service';

interface CurrentUserPayload {
  userId?: string;   // id из таблицы users — реальное поле, которое кладёт JwtStrategy
  id?: string;       // альтернативное имя, см. другие контроллеры
  sub?: string;      // JWT-claim; JwtStrategy его не прокидывает, оставлено для совместимости
  tenantId: string;  // текущий tenant
  role?: StaffRole;  // роль (из users.role)
  email?: string;
  staffUserId?: string | null; // id из staff_users — для персональных исключений RBAC
}

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

interface LeadAccessCtx {
  staff: StaffUser | null;
  fullAccess: boolean;
  grants: LeadAccessGrant[];
  /** 'hide' | 'masked' | 'full' — Data Visibility rule for this role, see data-visibility.service.ts. */
  foreignRecords: string;
  /** 'all' | 'owner_manager' | 'hidden' — Data Visibility rule for this role. */
  amountsVisibility: string;
  /** 'show' | 'mask_until_assigned' | 'always_mask' — Data Visibility rule for this role. */
  contactMasking: string;
}

@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('leads', 'read')
@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly leadActivity: LeadActivityService,
    private readonly leadAccess: LeadAccessService,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(StaffUser)
    private readonly staffRepo: Repository<StaffUser>,

    private readonly notifications: NotificationsService,
    private readonly staffUsersService: StaffUsersService,
    private readonly rbac: RbacService,
    private readonly dataVisibility: DataVisibilityService,
  ) {}

  /**
   * Вспомогательный метод: находим staff-профиль для текущего
   * авторизованного пользователя по связке users.email == staff_users.email
   */
  private async getCurrentStaff(
    payload: CurrentUserPayload,
  ): Promise<StaffUser | null> {
    const { tenantId } = payload;
    const userId = payload.userId ?? payload.id ?? payload.sub;

    const authUser = await this.userRepo.findOne({
      where: { id: userId, tenantId },
    });
    if (!authUser) return null;

    const staff = await this.staffRepo.findOne({
      where: {
        tenantId,
        email: authUser.email,
      },
    });

    return staff ?? null;
  }

  /** Full access (owner/manager role, or head of any department) sees & can manage everything.
   * Everyone else gets a per-lead tier: 'owner' for their own assigned leads, else the highest
   * matching lead_access_grants tier for that lead's `source`, else a Data Visibility-driven
   * fallback (see tierFor) instead of flat invisibility. */
  private async getAccessContext(user: CurrentUserPayload): Promise<LeadAccessCtx> {
    const staff = await this.getCurrentStaff(user);
    const fullAccess = await this.leadAccess.hasFullAccess(user.tenantId, staff, user.role);
    const grants = !fullAccess && staff ? await this.leadAccess.getGrantsForStaff(user.tenantId, staff.id) : [];
    if (fullAccess) {
      return { staff, fullAccess, grants, foreignRecords: 'full', amountsVisibility: 'all', contactMasking: 'show' };
    }
    const [foreignRecords, amountsVisibility, contactMasking] = await Promise.all([
      this.dataVisibility.getRuleValue(user.tenantId, (user.role as StaffRole) || 'viewer', 'foreign_records'),
      this.dataVisibility.getRuleValue(user.tenantId, (user.role as StaffRole) || 'viewer', 'amounts_visibility'),
      this.dataVisibility.getRuleValue(user.tenantId, (user.role as StaffRole) || 'viewer', 'contact_masking'),
    ]);
    return { staff, fullAccess, grants, foreignRecords, amountsVisibility, contactMasking };
  }

  private extractAssigneeStaffIds(lead: Pick<Lead, 'assignedUserId' | 'assignedUserIds'>): string[] {
    const ids = new Set<string>();
    if (lead.assignedUserId) ids.add(lead.assignedUserId);
    (lead.assignedUserIds || []).forEach((id) => id && ids.add(id));
    return [...ids];
  }

  /** Уведомляет в колокольчик только НОВЫХ ответственных (сравнение с предыдущим состоянием),
   * чтобы не спамить при каждом сохранении лида, где назначение не менялось. */
  private async notifyNewLeadAssignees(
    tenantId: string,
    previousStaffIds: string[],
    lead: Lead,
    actorStaffId?: string | null,
  ): Promise<void> {
    const nextIds = this.extractAssigneeStaffIds(lead);
    const newIds = nextIds.filter((id) => !previousStaffIds.includes(id) && id !== actorStaffId);
    if (!newIds.length) return;

    const userIds = await this.staffUsersService.resolveNotificationUserIdsForTenant(tenantId, newIds);
    if (!userIds.length) return;

    // Личная настройка «Новый лид на мне» (Аккаунт → Интерфейс) — по умолчанию включена,
    // preferences может отсутствовать у пользователей, ещё не заходивших на эту вкладку.
    const recipients = await this.userRepo.find({ where: { id: In(userIds) } });
    const allowedUserIds = recipients
      .filter((u) => u.preferences?.notifications?.newLead !== false)
      .map((u) => u.id);
    if (!allowedUserIds.length) return;

    await this.notifications.create(
      tenantId,
      allowedUserIds,
      'Вам назначен лид',
      lead.name?.trim() || lead.email?.trim() || lead.phone?.trim() || 'Новый лид',
      { type: 'lead.assigned', leadId: lead.id, link: `/leads/${lead.id}` },
    );
  }

  /** Grant/assignment tier if one applies; otherwise falls back to the tenant's Data Visibility
   * "foreign records" rule instead of flat 'none' — a viewer-tier floor (read-only, no edit/
   * manage; see canEdit/canManage) so someone @mentioned in a comment or just checking a
   * colleague's deal isn't hard-403'd when the tenant has explicitly chosen to show foreign
   * records (full or masked). Only 'hide' keeps the old opt-in-only behavior. */
  private tierFor(lead: Lead, ctx: LeadAccessCtx): EffectiveTier {
    if (ctx.fullAccess) return 'owner';
    const grantTier = this.leadAccess.getEffectiveTier(lead as any, ctx.staff, ctx.grants);
    if (grantTier !== 'none') return grantTier;
    return ctx.foreignRecords === 'hide' ? 'none' : 'viewer';
  }

  /** Bolts UI-facing permission flags onto a lead — the frontend uses these to hide controls it
   * can't use instead of letting the user hit a 403 after the fact. Also applies the Data
   * Visibility amount mask here (not a separate pass) so every read path (list/search/getOne)
   * gets it for free via the one call each already makes. */
  private decorate(lead: Lead, ctx: LeadAccessCtx): Lead {
    const tier = this.tierFor(lead, ctx);
    const isAssignedToMe = !!(ctx.staff && this.leadAccess.isAssignedTo(lead as any, ctx.staff));
    const maskAmount =
      !ctx.fullAccess &&
      !isAssignedToMe &&
      (ctx.amountsVisibility === 'owner_manager' || ctx.amountsVisibility === 'hidden');
    const maskContact =
      !ctx.fullAccess &&
      (ctx.contactMasking === 'always_mask' || (ctx.contactMasking === 'mask_until_assigned' && !isAssignedToMe));
    return {
      ...lead,
      ...(maskAmount ? { amount: null as any } : null),
      ...(maskContact ? { phone: null, email: null } : null),
      myAccessTier: tier,
      canViewAnalytics: ctx.fullAccess || this.leadAccess.canViewAnalytics(tier),
      canEdit: ctx.fullAccess || this.leadAccess.canEdit(tier),
      canDelete: ctx.fullAccess || this.leadAccess.canManage(tier),
      canReassign: ctx.fullAccess || this.leadAccess.canManage(tier),
    };
  }

  private filterVisible(leads: Lead[], ctx: LeadAccessCtx): Lead[] {
    if (ctx.fullAccess) return leads;
    return leads.filter((lead) => this.tierFor(lead, ctx) !== 'none');
  }

  /** null = unrestricted (full-access user). Otherwise the ids of leads this user may see
   * analytics/ROI numbers for — assigned leads plus analyst-tier-or-better grants; a
   * viewer-tier-only grant does not unlock aggregate numbers. */
  private async getAnalyticsLeadIds(user: CurrentUserPayload): Promise<string[] | null> {
    const ctx = await this.getAccessContext(user);
    if (ctx.fullAccess) return null;
    if (!ctx.staff) return [];
    const all = await this.leadsService.listForTenant(user.tenantId);
    return all
      .filter((lead) => this.leadAccess.canViewAnalytics(this.tierFor(lead, ctx)))
      .map((lead) => lead.id);
  }

  // ====================== GET /leads ======================
  // full access (owner/manager/руководитель отдела) -> видит все лиды арендатора
  // остальные -> свои + то, что дали по гранту (см. LeadAccessService)
  @Get()
  async list(@CurrentUser() user: CurrentUserPayload): Promise<Lead[]> {
    const allLeads = await this.leadsService.listForTenant(user.tenantId);
    const ctx = await this.getAccessContext(user);
    return this.filterVisible(allLeads, ctx).map((lead) => this.decorate(lead, ctx));
  }

  // ====================== GET /leads/search ======================
  // Поиск лида по имени / email / телефону
  @Get('search')
  async search(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: SearchLeadsQueryDto,
  ): Promise<Lead[]> {
    const { tenantId } = user;

    const q = (query.q || '').trim();
    const limit = query.limit || 10;

    if (!q) {
      return [];
    }

    const allMatches = await this.leadsService.searchForTenant(
      tenantId,
      q,
      limit,
    );

    const ctx = await this.getAccessContext(user);
    return this.filterVisible(allMatches, ctx).map((lead) => this.decorate(lead, ctx));
  }

  // ====================== GET /leads/stats ======================
  // Общая аналитика по лидам (для дашборда)
  @Get('stats')
  async stats(
    @CurrentUser() user: CurrentUserPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const restrictToLeadIds = await this.getAnalyticsLeadIds(user);
    return this.leadsService.getStatsForTenant(user.tenantId, from, to, restrictToLeadIds);
  }

  // ====================== GET /leads/lost/stats ======================
  // Статистика по утраченным лидам: количество, сумма, по менеджерам
  @Get('lost/stats')
  async lostStats(
    @CurrentUser() user: CurrentUserPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const restrictToLeadIds = await this.getAnalyticsLeadIds(user);
    return this.leadsService.getLostStatsForTenant(user.tenantId, from, to, restrictToLeadIds);
  }

  // ====================== GET /leads/analytics ======================
  // Алиас, чтобы фронт, который дергает /leads/analytics, тоже работал
  @Get('analytics')
  async analytics(
    @CurrentUser() user: CurrentUserPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const restrictToLeadIds = await this.getAnalyticsLeadIds(user);
    return this.leadsService.getStatsForTenant(user.tenantId, from, to, restrictToLeadIds);
  }

  // ====================== GET /leads/roi ======================
  // ROI по лидам: суммы продаж, выручка, ROI-показатели
  @Get('roi')
  @RequirePermission('leads_view_roi', 'read')
  async roi(
    @CurrentUser() user: CurrentUserPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('source') source?: 'sales' | 'projects',
    @Query('currencyMode') currencyMode?: 'native' | 'converted',
    @Query('displayCurrency') displayCurrency?: string,
    @Query('rates') rates?: string,
  ) {
    const { tenantId } = user;
    const restrictToLeadIds = await this.getAnalyticsLeadIds(user);
    return this.leadsService.getRoiForTenant(tenantId, {
      from,
      restrictToLeadIds,
      to,
      source: source === 'projects' ? 'projects' : 'sales',
      currencyMode: currencyMode === 'converted' ? 'converted' : 'native',
      displayCurrency,
      rates,
    });
  }

  // ====================== GET /leads/:id/history ======================
  // full access -> любую историю; остальные -> только видимые им лиды (свои/по гранту)
  @Get(':id/history')
  async getLeadHistory(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const { tenantId } = user;

    // Если id не похож на UUID — сразу 404, чтобы не падать на "analytics"
    if (!UUID_RE.test(id)) {
      throw new NotFoundException('Lead not found');
    }

    const lead = await this.leadsService.findOneForTenant(tenantId, id);
    const ctx = await this.getAccessContext(user);
    if (this.tierFor(lead, ctx) === 'none') {
      throw new ForbiddenException('Недостаточно прав для просмотра истории лида');
    }

    // порядок аргументов: tenantId, leadId
    return this.leadActivity.getHistory(tenantId, id);
  }

  // ====================== GET /leads/:id ======================
  // full access -> любой лид; остальные -> только видимые им (свои/по гранту), иначе 403
  @Get(':id')
  async getOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<Lead> {
    const { tenantId } = user;

    if (!UUID_RE.test(id)) {
      throw new NotFoundException('Lead not found');
    }

    // тянем лид с проектами
    const lead = await this.leadsService.getLeadWithProjects(tenantId, id);
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const ctx = await this.getAccessContext(user);
    if (this.tierFor(lead, ctx) === 'none') {
      throw new ForbiddenException('Недостаточно прав для просмотра лида');
    }

    return this.decorate(lead, ctx);
  }

  // ====================== POST /leads ======================
  // owner/manager всегда проходят через ctx.fullAccess (LeadAccessService.FULL_ACCESS_ROLES),
  // как и любой руководитель отдела (headsADepartment) — это отдельная, более старая логика
  // LeadAccessService, не трогаем. Для всех остальных — настраиваемое право leads_create
  // (раньше был хардкод ['owner','manager','sales'], теперь то же по умолчанию, но видно и
  // меняется на вкладке «Права доступа»).
  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateLeadDto,
  ): Promise<Lead> {
    const { tenantId, role } = user;
    const ctx = await this.getAccessContext(user);

    if (!ctx.fullAccess) {
      const canCreate = await this.rbac.canForUser(
        tenantId,
        user.staffUserId || '',
        (role as any) || 'viewer',
        'leads_create',
      );
      if (!canCreate) {
        throw new ForbiddenException('Недостаточно прав для создания лида');
      }
    }

    const created = await this.leadsService.createForTenant(tenantId, dto, user.staffUserId ?? null);
    const actorStaff = await this.getCurrentStaff(user);
    await this.notifyNewLeadAssignees(tenantId, [], created, actorStaff?.id).catch(() => undefined);
    return created;
  }

  private static readonly REASSIGN_FIELDS = ['assignedUserId', 'assignedUserIds', 'assignedTo', 'assignedToList'] as const;

  // ====================== PATCH /leads/:id ======================
  // full access -> любой лид; editor+ по грант/своим полям, owner-грант нужен для переназначения
  @Patch(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ): Promise<Lead> {
    const { tenantId } = user;

    if (!UUID_RE.test(id)) {
      throw new NotFoundException('Lead not found');
    }

    const lead = await this.leadsService.findOneForTenant(tenantId, id);
    const ctx = await this.getAccessContext(user);

    if (!ctx.fullAccess) {
      const tier = this.tierFor(lead, ctx);
      if (!this.leadAccess.canEdit(tier)) {
        throw new ForbiddenException('Недостаточно прав для изменения лида');
      }
      const triesToReassign = LeadsController.REASSIGN_FIELDS.some((f) => (dto as any)[f] !== undefined);
      if (triesToReassign && !this.leadAccess.canManage(tier)) {
        throw new ForbiddenException('Недостаточно прав для переназначения ответственного');
      }
    }

    // Отдельное granular-право на сумму — не связано с LeadAccessService (тот управляет
    // доступом к самой записи и переназначением, не отдельными полями). Владелец компании
    // всегда проходит (canForUser сразу true для role='owner').
    if (dto.amount !== undefined) {
      const canEditAmount = await this.rbac.canForUser(
        tenantId,
        user.staffUserId || '',
        (user.role as any) || 'viewer',
        'leads_edit_amount',
      );
      if (!canEditAmount) {
        throw new ForbiddenException('Недостаточно прав для изменения суммы лида');
      }
    }

    const previousAssigneeIds = this.extractAssigneeStaffIds(lead);
    const saved = await this.leadsService.updateForTenant(tenantId, id, dto, user.staffUserId ?? null);
    await this.notifyNewLeadAssignees(tenantId, previousAssigneeIds, saved, ctx.staff?.id).catch(() => undefined);
    return this.decorate(saved, ctx);
  }

  // ====================== POST /leads/:id/convert ======================
  // Конвертация лида в клиента: находит-или-создаёт Contact/Company и
  // привязывает их к лиду. Не требует конкретного статуса лида — доступно
  // и для лидов в работе (например, повторный клиент), не только для "won".
  @Post(':id/convert')
  async convert(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: ConvertLeadDto,
  ) {
    const { tenantId, role } = user;

    if (!UUID_RE.test(id)) {
      throw new NotFoundException('Lead not found');
    }

    const lead = await this.leadsService.findOneForTenant(tenantId, id);
    const ctx = await this.getAccessContext(user);
    if (!ctx.fullAccess && !this.leadAccess.canEdit(this.tierFor(lead, ctx))) {
      throw new ForbiddenException('Недостаточно прав для конвертации лида');
    }

    const canContacts = await this.rbac.canForUser(
      tenantId,
      user.staffUserId || '',
      (role as any) || 'viewer',
      'contacts',
    );
    const canCompanies = await this.rbac.canForUser(
      tenantId,
      user.staffUserId || '',
      (role as any) || 'viewer',
      'companies',
    );
    if (!canContacts || (dto.companyName && !canCompanies)) {
      throw new ForbiddenException('Недостаточно прав для создания контакта/компании');
    }

    const actorStaff = await this.getCurrentStaff(user);
    return this.leadsService.convertForTenant(tenantId, id, dto, actorStaff?.id ?? null);
  }

  // ====================== DELETE /leads/:id ======================
  // full access -> любой лид; иначе нужен owner-тир (свой лид или owner-грант по source)
  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<void> {
    const { tenantId } = user;

    if (!UUID_RE.test(id)) {
      throw new NotFoundException('Lead not found');
    }

    const lead = await this.leadsService.findOneForTenant(tenantId, id);
    const ctx = await this.getAccessContext(user);
    if (!ctx.fullAccess && !this.leadAccess.canManage(this.tierFor(lead, ctx))) {
      throw new ForbiddenException('Недостаточно прав для удаления лида');
    }

    return this.leadsService.removeForTenant(tenantId, id);
  }

  // ====================== GET /leads/funnel-today ======================
  @Get('funnel-today')
  async funnelToday(@CurrentUser() user: CurrentUserPayload) {
    const restrictToLeadIds = await this.getAnalyticsLeadIds(user);
    return this.leadsService.getFunnelToday(user.tenantId, restrictToLeadIds);
  }

  // ====================== GET /leads/sources-weekly ======================
  @Get('sources-weekly')
  async sourcesWeekly(@CurrentUser() user: CurrentUserPayload) {
    const restrictToLeadIds = await this.getAnalyticsLeadIds(user);
    return this.leadsService.getSourcesWeekly(user.tenantId, restrictToLeadIds);
  }

  // ====================== ACCESS GRANTS (управление доступом к лидам) ======================
  // Кто может видеть/менять: только full-access (owner/manager/руководитель отдела).

  @Get('access-grants')
  async listAccessGrants(@CurrentUser() user: CurrentUserPayload) {
    const ctx = await this.getAccessContext(user);
    if (!ctx.fullAccess) {
      throw new ForbiddenException('Недостаточно прав для просмотра настроек доступа');
    }
    return this.leadAccess.listAllGrants(user.tenantId);
  }

  @Post('access-grants')
  async createAccessGrant(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { staffUserId: string; scopeType: LeadAccessScopeType; scopeValue?: string | null; tier: LeadAccessTier },
  ) {
    const ctx = await this.getAccessContext(user);
    if (!ctx.fullAccess) {
      throw new ForbiddenException('Недостаточно прав для управления доступом к лидам');
    }
    return this.leadAccess.upsertGrant(user.tenantId, body);
  }

  @Delete('access-grants/:grantId')
  async deleteAccessGrant(
    @CurrentUser() user: CurrentUserPayload,
    @Param('grantId') grantId: string,
  ) {
    const ctx = await this.getAccessContext(user);
    if (!ctx.fullAccess) {
      throw new ForbiddenException('Недостаточно прав для управления доступом к лидам');
    }
    await this.leadAccess.deleteGrant(user.tenantId, grantId);
    return { success: true };
  }

  // ====================== CSV IMPORT ======================

  /**
   * POST /leads/import/preview
   * Returns first 5 rows + headers without importing.
   */
  @Post('import/preview')
  async previewCsvImport(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { csvData: string; hasHeaderRow?: boolean },
  ): Promise<{ headers: string[]; rows: string[][]; totalRows: number }> {
    const { tenantId, role } = user;
    const canImport = await this.rbac.canForUser(
      tenantId,
      user.staffUserId || '',
      (role as any) || 'viewer',
      'leads_manage_import',
    );
    if (!canImport) {
      throw new ForbiddenException('Недостаточно прав для импорта лидов');
    }

    if (!body.csvData || typeof body.csvData !== 'string') {
      throw new BadRequestException('csvData is required');
    }

    const parsed = parseCsvRobust(body.csvData);
    const previewRows = parsed.rows.slice(0, 5).map((row) =>
      parsed.columns.map((col) => row[col] ?? ''),
    );

    return {
      headers: parsed.columns,
      rows: previewRows,
      totalRows: parsed.rows.length,
    };
  }

  /**
   * POST /leads/import
   * Import leads from CSV using a column mapping.
   */
  @Post('import')
  async importLeadsWithMapping(
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    body: {
      csvData: string;
      columnMapping: Record<string, string>; // csvColumn -> leadField
      options?: { hasHeaderRow?: boolean };
    },
  ): Promise<{ imported: number; skipped: number; errors: number }> {
    const { tenantId, role } = user;
    const canImport = await this.rbac.canForUser(
      tenantId,
      user.staffUserId || '',
      (role as any) || 'viewer',
      'leads_manage_import',
    );
    if (!canImport) {
      throw new ForbiddenException('Недостаточно прав для импорта лидов');
    }

    if (!body.csvData || typeof body.csvData !== 'string') {
      throw new BadRequestException('csvData is required');
    }

    const parsed = parseCsvRobust(body.csvData);
    const mapping = body.columnMapping || {};

    // Build reverse map: leadField -> csvColumn
    const fieldToCol: Record<string, string> = {};
    for (const [csvCol, leadField] of Object.entries(mapping)) {
      if (leadField && leadField !== 'skip') {
        fieldToCol[leadField] = csvCol;
      }
    }

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    const VALID_STATUSES = new Set(['new', 'in_progress', 'waiting', 'won', 'lost']);

    for (const row of parsed.rows) {
      try {
        const get = (field: string): string | undefined => {
          const col = fieldToCol[field];
          if (!col) return undefined;
          const v = row[col]?.trim();
          return v || undefined;
        };

        // firstName + lastName => name, or direct name field
        let name = get('name');
        if (!name) {
          const firstName = get('firstName') || '';
          const lastName = get('lastName') || '';
          const combined = [firstName, lastName].filter(Boolean).join(' ').trim();
          if (combined) name = combined;
        }

        const email = get('email');
        const phone = get('phone');
        const source = get('source');
        const rawStatus = get('status');
        const status = rawStatus && VALID_STATUSES.has(rawStatus) ? rawStatus : undefined;
        const company = get('company');
        const notes = get('notes');

        // Skip completely empty rows
        if (!name && !email && !phone) {
          skipped++;
          continue;
        }

        await this.leadsService.createForTenant(tenantId, {
          name: name || email || phone || 'Unknown',
          email: email || undefined,
          phone: phone || undefined,
          source: source || 'csv_import',
          status: status || 'new',
          meta: {
            importedFromCsv: true,
            company: company || undefined,
            notes: notes || undefined,
          },
        });

        imported++;
      } catch {
        errors++;
      }
    }

    return { imported, skipped, errors };
  }
}
