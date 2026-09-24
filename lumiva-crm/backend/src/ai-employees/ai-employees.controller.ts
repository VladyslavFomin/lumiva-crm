import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { AiEmployeesService } from './ai-employees.service';

function userId(user: CurrentUserPayload): string | null {
  return user.userId || user.id || user.sub || null;
}

// Намеренно НЕ за 'ai_employees': каталог ролей (заголовки/описания/функции) — не чувствительные
// данные конкретного тенанта, а справочник, нужный AiAssigneeGroup всем сотрудникам (round 14
// изначально ушёл дальше, чем задумывалось, — закрыл и этот справочник тоже, что сломало подсказку
// "какую роль завести" в обычном виджете назначения на Leads/Projects/Workspace; открыт как и раньше).
@Controller('ai-roles')
@UseGuards(JwtAuthGuard)
export class AiRolesController {
  constructor(private readonly service: AiEmployeesService) {}

  @Get()
  async list(@CurrentUser() user: CurrentUserPayload) {
    return this.service.listRoles(user.tenantId);
  }

  @Get('available-for-plan')
  async available(@CurrentUser() user: CurrentUserPayload) {
    return this.service.getPlanLimits(user.tenantId);
  }
}

@Controller('ai-plan-limits')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('ai_employees')
export class AiPlanLimitsController {
  constructor(private readonly service: AiEmployeesService) {}

  @Get()
  async get(@CurrentUser() user: CurrentUserPayload) {
    return this.service.getPlanLimits(user.tenantId);
  }
}

@Controller('ai-usage')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('ai_employees')
export class AiEmployeesUsageController {
  constructor(private readonly service: AiEmployeesService) {}

  @Get()
  async get(@CurrentUser() user: CurrentUserPayload) {
    return this.service.getPlanLimits(user.tenantId);
  }
}

@Controller('ai-agents')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('ai_employees')
export class AiAgentsController {
  constructor(private readonly service: AiEmployeesService) {}

  @Get()
  async list(@CurrentUser() user: CurrentUserPayload) {
    return this.service.listAgents(user.tenantId);
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.createAgent(user.tenantId, userId(user), body as any);
  }

  /** «Расширить с помощью ИИ»: короткий черновик инструкций → полноценные инструкции. Без :id — работает и в мастере создания, до сохранения сотрудника. */
  @Post('expand-instructions')
  async expandInstructions(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.expandInstructions(user.tenantId, userId(user), body as any);
  }

  @Get(':id')
  async get(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.getAgent(user.tenantId, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.updateAgent(user.tenantId, id, userId(user), body as any);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.removeAgent(user.tenantId, id, userId(user));
  }

  @Post(':id/pause')
  async pause(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.setAgentStatus(user.tenantId, id, 'paused', userId(user));
  }

  @Post(':id/resume')
  async resume(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.setAgentStatus(user.tenantId, id, 'active', userId(user));
  }

  @Post(':id/run-now')
  async runNow(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.runNow(user.tenantId, id, userId(user));
  }

  @Get(':id/lessons')
  async lessons(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.listLessons(user.tenantId, id);
  }

  @Delete(':id/lessons/:lessonId')
  async removeLesson(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Param('lessonId') lessonId: string) {
    return this.service.removeLesson(user.tenantId, id, lessonId);
  }

  @Get(':id/config')
  async getConfig(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.getAgentConfig(user.tenantId, id);
  }

  @Patch(':id/config')
  async updateConfig(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.updateAgentConfig(user.tenantId, id, userId(user), body as any);
  }

  @Post(':id/ask')
  async ask(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.askAboutRecord(
      user.tenantId,
      id,
      { userId: userId(user), email: user.email, role: user.role, staffUserId: user.staffUserId ?? null },
      body as any,
    );
  }

  @Get(':id/tasks')
  async listTasks(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.listAgentTasks(user.tenantId, id);
  }

  @Post(':id/tasks')
  async assignTask(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.assignTask(user.tenantId, id, userId(user), body as any);
  }

  @Post(':id/sla-check')
  async slaCheck(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.checkSlaNow(user.tenantId, id);
  }

  @Post(':id/daily-plan')
  async dailyPlan(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.runDailyPlanNow(user.tenantId, id);
  }

  @Get(':id/assignments')
  async listAssignments(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.listAgentAssignments(user.tenantId, id);
  }

  @Get(':id/permissions')
  async permissions(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.service.getPermissions(user.tenantId, id);
  }

  @Patch(':id/permissions')
  async updatePermissions(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.updatePermissions(user.tenantId, id, userId(user), body as any);
  }

  @Get(':id/approval-rules')
  async approvalRules(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.service.getApprovalRules(user.tenantId, id);
  }

  @Patch(':id/approval-rules')
  async updateApprovalRules(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.updateApprovalRules(user.tenantId, id, userId(user), body as any);
  }

  @Get(':id/logs')
  async agentLogs(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Query() query: Record<string, string>,
  ) {
    return this.service.listLogs(user.tenantId, { ...query, agentId: id });
  }

  @Get(':id/reports')
  async agentReports(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Query() query: Record<string, string>,
  ) {
    return this.service.listReports(user.tenantId, { ...query, agentId: id });
  }

  @Post(':id/generate-report')
  async generateReport(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.generateReport(user.tenantId, id, userId(user), body as any);
  }
}

// Намеренно НЕ за 'ai_employees': это не управление самим ИИ-сотрудником, а обычное действие
// рядового сотрудника на СВОЕЙ записи («назначить ИИ ответственным за этот лид/проект») —
// AiAssigneeGroup/AiAssigneeChips встроены прямо в карточки/списки Leads/Projects/Companies/
// Contacts, которые рядовые сотрудники и так открывают. Видеть/снимать ИИ-бейдж на своей записи
// остаётся доступным всем — закрыт только сам раздел «ИИ-сотрудники» (просмотр/редактирование
// профиля агента, его прав, отчётов).
@Controller('ai-assignments')
@UseGuards(JwtAuthGuard)
export class AiAssignmentsController {
  constructor(private readonly service: AiEmployeesService) {}

  /** Минимальный список нанятых ИИ-сотрудников для виджета назначения (AiAssigneeGroup) — без
   * прав/статистики/логов, которые скрыты за 'ai_employees' (round 14); имя/роль/статус — не
   * чувствительные данные, нужны любому сотруднику, чтобы выбрать, кого назначить на свою запись. */
  @Get('roster')
  async roster(
    @CurrentUser() user: CurrentUserPayload,
    @Query('objectId') objectId?: string,
    @Query('access') access?: 'read' | 'write',
  ) {
    return this.service.listAssignableRoster(
      user.tenantId,
      objectId || undefined,
      access === 'write' ? 'write' : 'read',
    );
  }

  /** ИИ-сотрудники, назначенные ответственными за конкретный лид / проект / задачу. */
  @Get()
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
  ) {
    return this.service.listEntityAssignments(user.tenantId, String(entityType || ''), String(entityId || ''));
  }

  /** Пакетно: кто из ИИ ответственный за набор записей (колонка «Ответственный» в списках). */
  @Post('batch')
  async batch(@CurrentUser() user: CurrentUserPayload, @Body() body: Record<string, unknown>) {
    return this.service.assignmentsBatch(
      user.tenantId,
      String(body.entityType || ''),
      Array.isArray(body.ids) ? (body.ids as unknown[]).map(String) : [],
    );
  }

  @Put()
  async set(@CurrentUser() user: CurrentUserPayload, @Body() body: Record<string, unknown>) {
    return this.service.setEntityAssignment(user.tenantId, userId(user), {
      agentId: String(body.agentId || ''),
      entityType: String(body.entityType || ''),
      entityId: String(body.entityId || ''),
      assigned: body.assigned !== false,
    });
  }
}

@Controller('ai-activity')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('ai_employees')
export class AiActivityController {
  constructor(private readonly service: AiEmployeesService) {}

  @Get()
  async feed(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: { limit?: string; since?: string },
  ) {
    return this.service.activityFeed(user.tenantId, query);
  }
}

@Controller('ai-knowledge')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('ai_employees')
export class AiKnowledgeController {
  constructor(private readonly service: AiEmployeesService) {}

  @Get()
  async list(@CurrentUser() user: CurrentUserPayload) {
    return this.service.listKnowledge(user.tenantId);
  }

  @Post()
  async save(@CurrentUser() user: CurrentUserPayload, @Body() body: Record<string, unknown>) {
    return this.service.saveKnowledge(user.tenantId, userId(user), body as any);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.deleteKnowledge(user.tenantId, id);
  }
}

@Controller('ai-insights')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('ai_employees')
export class AiInsightsController {
  constructor(private readonly service: AiEmployeesService) {}

  @Get()
  async get(@CurrentUser() user: CurrentUserPayload, @Query('days') days?: string) {
    return this.service.insights(user.tenantId, days ? Number(days) : 30);
  }
}

@Controller('ai-actions')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('ai_employees')
export class AiActionsController {
  constructor(private readonly service: AiEmployeesService) {}

  @Get()
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: Record<string, string>,
  ) {
    return this.service.listActions(user.tenantId, query);
  }

  @Get('pending')
  async pending(@CurrentUser() user: CurrentUserPayload) {
    return this.service.pendingActions(user.tenantId);
  }

  @Post(':id/approve')
  async approve(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.approveAction(user.tenantId, id, userId(user));
  }

  @Post(':id/reject')
  async reject(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.rejectAction(user.tenantId, id, userId(user), body as any);
  }

  @Post(':id/execute')
  async execute(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.executeAction(user.tenantId, id, userId(user));
  }
}

@Controller('ai-logs')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('ai_employees')
export class AiLogsController {
  constructor(private readonly service: AiEmployeesService) {}

  @Get()
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: Record<string, string>,
  ) {
    return this.service.listLogs(user.tenantId, query);
  }
}

@Controller('ai-reports')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('ai_employees')
export class AiReportsController {
  constructor(private readonly service: AiEmployeesService) {}

  @Get()
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: Record<string, string>,
  ) {
    return this.service.listReports(user.tenantId, query);
  }

  @Post(':id/send')
  async send(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.sendReport(user.tenantId, id, userId(user), body as any);
  }
}
