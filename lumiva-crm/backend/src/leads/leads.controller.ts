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
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { LeadsService } from './leads.service';
import { Lead } from './lead.entity';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadActivityService } from './lead-activity.service';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

import { User } from '../users/user.entity';
import { StaffUser, StaffRole } from '../staff/staff-user.entity';
import { SearchLeadsQueryDto } from './dto/search-leads-query.dto';

interface CurrentUserPayload {
  sub: string;       // id из таблицы users
  tenantId: string;  // текущий tenant
  role?: StaffRole;  // роль (из users.role)
}

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

@UseGuards(JwtAuthGuard)
@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly leadActivity: LeadActivityService,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(StaffUser)
    private readonly staffRepo: Repository<StaffUser>,
  ) {}

  /**
   * Вспомогательный метод: находим staff-профиль для текущего
   * авторизованного пользователя по связке users.email == staff_users.email
   */
  private async getCurrentStaff(
    payload: CurrentUserPayload,
  ): Promise<StaffUser | null> {
    const { sub: userId, tenantId } = payload;

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

  private isLeadMine(lead: any, staff: StaffUser | null): boolean {
    if (!staff) return false;
    const staffId = staff.id;
    const fullName = staff.fullName?.trim();
    if (
      Array.isArray(lead.assignedUserIds) &&
      lead.assignedUserIds.includes(staffId)
    ) {
      return true;
    }
    if (
      Array.isArray(lead.assignedToList) &&
      fullName &&
      lead.assignedToList.includes(fullName)
    ) {
      return true;
    }
    if (lead.assignedUserId && lead.assignedUserId === staffId) {
      return true;
    }
    if (fullName && lead.assignedTo && lead.assignedTo === fullName) {
      return true;
    }
    return false;
  }

  /**
   * Фильтрация лидов по доступу сотрудника (кроме owner).
   */
  private filterLeadsByStaff(
    leads: Lead[],
    staff: StaffUser | null,
  ): Lead[] {
    if (!staff) return [];
    return leads.filter((lead: any) => this.isLeadMine(lead, staff));
  }

  // ====================== GET /leads ======================
  // owner  -> видит все лиды арендатора
  // остальные (manager/sales/viewer/...) -> только свои
  @Get()
  async list(@CurrentUser() user: CurrentUserPayload): Promise<Lead[]> {
    const { tenantId, role } = user;

    const allLeads = await this.leadsService.listForTenant(tenantId);

    // Владелец видит всё
    if (role === 'owner') {
      return allLeads;
    }

    // Для остальных — только свои
    const staff = await this.getCurrentStaff(user);
    return this.filterLeadsByStaff(allLeads, staff);
  }

  // ====================== GET /leads/search ======================
  // Поиск лида по имени / email / телефону
  @Get('search')
  async search(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: SearchLeadsQueryDto,
  ): Promise<Lead[]> {
    const { tenantId, role } = user;

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

    if (role === 'owner') {
      return allMatches;
    }

    const staff = await this.getCurrentStaff(user);
    return this.filterLeadsByStaff(allMatches, staff);
  }

  // ====================== GET /leads/stats ======================
  // Общая аналитика по лидам (для дашборда)
  @Get('stats')
  async stats(
    @CurrentUser() user: CurrentUserPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const { tenantId } = user;
    return this.leadsService.getStatsForTenant(tenantId, from, to);
  }

  // ====================== GET /leads/lost/stats ======================
  // Статистика по утраченным лидам: количество, сумма, по менеджерам
  @Get('lost/stats')
  async lostStats(
    @CurrentUser() user: CurrentUserPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const { tenantId } = user;
    return this.leadsService.getLostStatsForTenant(tenantId, from, to);
  }

  // ====================== GET /leads/analytics ======================
  // Алиас, чтобы фронт, который дергает /leads/analytics, тоже работал
  @Get('analytics')
  async analytics(
    @CurrentUser() user: CurrentUserPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const { tenantId } = user;
    return this.leadsService.getStatsForTenant(tenantId, from, to);
  }

  // ====================== GET /leads/roi ======================
  // ROI по лидам: суммы продаж, выручка, ROI-показатели
  @Get('roi')
  async roi(
    @CurrentUser() user: CurrentUserPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('source') source?: 'sales' | 'projects',
    @Query('currencyMode') currencyMode?: 'native' | 'converted',
    @Query('displayCurrency') displayCurrency?: string,
    @Query('rates') rates?: string,
  ) {
    const { tenantId, role } = user;

    // Можно ограничить доступ только владельцу / менеджеру / финансисту
    const allowed: StaffRole[] = ['owner', 'manager', 'finance'];
    if (role && !allowed.includes(role)) {
      throw new ForbiddenException('Недостаточно прав для просмотра ROI');
    }
console.log('ROI controller: query.source =', source);

  const normalized: 'sales' | 'projects' =
    source === 'projects' ? 'projects' : 'sales';

  console.log('ROI controller: normalized =', normalized);
    return this.leadsService.getRoiForTenant(tenantId, {
      from,
      to,
      source: source === 'projects' ? 'projects' : 'sales',
      currencyMode: currencyMode === 'converted' ? 'converted' : 'native',
      displayCurrency,
      rates,
    });
  }

  // ====================== GET /leads/:id/history ======================
  // owner -> может смотреть любую историю
  // остальные -> только для своих лидов
  @Get(':id/history')
  async getLeadHistory(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const { tenantId, role } = user;

    // Если id не похож на UUID — сразу 404, чтобы не падать на "analytics"
    if (!UUID_RE.test(id)) {
      throw new NotFoundException('Lead not found');
    }

    const lead = await this.leadsService.findOneForTenant(tenantId, id);

    if (role !== 'owner') {
      const staff = await this.getCurrentStaff(user);
      if (!staff) {
        throw new ForbiddenException(
          'Недостаточно прав для просмотра истории лида',
        );
      }

      const isMine = this.isLeadMine(lead as any, staff);

      if (!isMine) {
        throw new ForbiddenException(
          'Недостаточно прав для просмотра истории лида',
        );
      }
    }

    // порядок аргументов: tenantId, leadId
    return this.leadActivity.getHistory(tenantId, id);
  }

  // ====================== GET /leads/:id ======================
  // owner -> может смотреть любой
  // остальные -> только свой, иначе 403
  @Get(':id')
  async getOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<Lead> {
    const { tenantId, role } = user;

    if (!UUID_RE.test(id)) {
      throw new NotFoundException('Lead not found');
    }

    // тянем лид с проектами
    const lead = await this.leadsService.getLeadWithProjects(tenantId, id);
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    if (role === 'owner') {
      return lead;
    }

    const staff = await this.getCurrentStaff(user);
    if (!staff) {
      throw new ForbiddenException('Недостаточно прав для просмотра лида');
    }

    const isMine = this.isLeadMine(lead as any, staff);

    if (!isMine) {
      throw new ForbiddenException('Недостаточно прав для просмотра лида');
    }

    return lead;
  }

  // ====================== POST /leads ======================
  // owner / manager / sales -> могут создавать
  // viewer / finance / support / developer -> нет
  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateLeadDto,
  ): Promise<Lead> {
    const { tenantId, role } = user;
    const canCreateRoles: StaffRole[] = ['owner', 'manager', 'sales'];

    if (!canCreateRoles.includes(role || 'viewer')) {
      throw new ForbiddenException('Недостаточно прав для создания лида');
    }

    return this.leadsService.createForTenant(tenantId, dto);
  }

  // ====================== PATCH /leads/:id ======================
  // owner -> может править любой лид
  // manager/sales -> только свои
  // viewer/finance/support/developer -> не могут править
  @Patch(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ): Promise<Lead> {
    const { tenantId, role } = user;

    const canEditRoles: StaffRole[] = ['owner', 'manager', 'sales'];
    if (!canEditRoles.includes(role || 'viewer')) {
      throw new ForbiddenException('Недостаточно прав для изменения лида');
    }

    if (!UUID_RE.test(id)) {
      throw new NotFoundException('Lead not found');
    }

    const lead = await this.leadsService.findOneForTenant(tenantId, id);

    // owner может менять всё
    if (role === 'owner') {
      return this.leadsService.updateForTenant(tenantId, id, dto);
    }

    // manager / sales — только свои лиды
    const staff = await this.getCurrentStaff(user);
    if (!staff) {
      throw new ForbiddenException('Недостаточно прав для изменения лида');
    }

    const isMine = this.isLeadMine(lead as any, staff);

    if (!isMine) {
      throw new ForbiddenException('Можно изменять только свои лиды');
    }

    return this.leadsService.updateForTenant(tenantId, id, dto);
  }

  // ====================== DELETE /leads/:id ======================
  // Пока жёстко: только owner
  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<void> {
    const { tenantId, role } = user;

    if (role !== 'owner') {
      throw new ForbiddenException('Удалять лиды может только владелец');
    }

    if (!UUID_RE.test(id)) {
      throw new NotFoundException('Lead not found');
    }

    return this.leadsService.removeForTenant(tenantId, id);
  }
}
