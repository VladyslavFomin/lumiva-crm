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
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { AiEmployeesService } from './ai-employees.service';

function userId(user: CurrentUserPayload): string | null {
  return user.userId || user.id || user.sub || null;
}

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
@UseGuards(JwtAuthGuard)
export class AiPlanLimitsController {
  constructor(private readonly service: AiEmployeesService) {}

  @Get()
  async get(@CurrentUser() user: CurrentUserPayload) {
    return this.service.getPlanLimits(user.tenantId);
  }
}

@Controller('ai-usage')
@UseGuards(JwtAuthGuard)
export class AiEmployeesUsageController {
  constructor(private readonly service: AiEmployeesService) {}

  @Get()
  async get(@CurrentUser() user: CurrentUserPayload) {
    return this.service.getPlanLimits(user.tenantId);
  }
}

@Controller('ai-agents')
@UseGuards(JwtAuthGuard)
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

@Controller('ai-actions')
@UseGuards(JwtAuthGuard)
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
@UseGuards(JwtAuthGuard)
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
@UseGuards(JwtAuthGuard)
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
