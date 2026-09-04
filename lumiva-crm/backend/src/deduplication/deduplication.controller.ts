import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { DeduplicationService } from './deduplication.service';
import { MergeDto } from './dto/merge.dto';
import { DedupEntityType } from './duplicate-pair.entity';

@Controller('deduplication')
@UseGuards(JwtAuthGuard, RbacGuard)
export class DeduplicationController {
  constructor(private readonly dedupService: DeduplicationService) {}

  /** Запускает сканирование и возвращает сколько пар найдено */
  @Post('scan')
  @RequirePermission('settings', 'write')
  scan(
    @CurrentUser() user: CurrentUserPayload,
    @Body('entityType') entityType: DedupEntityType = 'contact',
  ) {
    return this.dedupService.scan(user.tenantId, entityType);
  }

  /** Список обнаруженных пар */
  @Get('pairs')
  @RequirePermission('leads', 'read')
  findPairs(
    @CurrentUser() user: CurrentUserPayload,
    @Query('entityType') entityType?: DedupEntityType,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.dedupService.findPairs(
      user.tenantId,
      entityType,
      status ?? 'pending',
      limit ? Number(limit) : 50,
      offset ? Number(offset) : 0,
    );
  }

  /** Группы дублей (N-way, кластеризация пар) с записями для сравнения */
  @Get('groups')
  @RequirePermission('leads', 'read')
  getGroups(
    @CurrentUser() user: CurrentUserPayload,
    @Query('entityType') entityType: DedupEntityType = 'contact',
  ) {
    return this.dedupService.getGroups(user.tenantId, entityType);
  }

  /** KPI шапки страницы */
  @Get('overview')
  @RequirePermission('leads', 'read')
  getOverview(
    @CurrentUser() user: CurrentUserPayload,
    @Query('entityType') entityType: DedupEntityType = 'contact',
  ) {
    return this.dedupService.getOverview(user.tenantId, entityType);
  }

  /** Настройки объединения тенанта */
  @Get('settings')
  @RequirePermission('settings', 'read')
  getSettings(@CurrentUser() user: CurrentUserPayload) {
    return this.dedupService.getSettings(user.tenantId);
  }

  @Patch('settings')
  @RequirePermission('settings', 'write')
  saveSettings(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { masterRule?: 'oldest' | 'newest'; fillEmptyFields?: boolean; autoMergeThreshold?: number | null },
  ) {
    return this.dedupService.saveSettings(user.tenantId, body);
  }

  /** Журнал объединений и «не дублей» */
  @Get('history')
  @RequirePermission('leads', 'read')
  getHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Query('entityType') entityType?: DedupEntityType,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.dedupService.getHistory(user.tenantId, entityType, limit ? Number(limit) : 50, offset ? Number(offset) : 0);
  }

  /** Пометить пару как «не дубль» */
  @Patch('pairs/:id/ignore')
  @RequirePermission('leads', 'write')
  ignorePair(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const userId = (user.userId ?? user.id ?? user.sub) as string;
    return this.dedupService.ignorePair(user.tenantId, id, userId);
  }

  /** Пометить всю группу как «не дубли» */
  @Post('groups/ignore')
  @RequirePermission('leads', 'write')
  ignoreGroup(@CurrentUser() user: CurrentUserPayload, @Body('ids') ids: string[]) {
    const userId = (user.userId ?? user.id ?? user.sub) as string;
    return this.dedupService.ignoreGroup(user.tenantId, ids ?? [], userId);
  }

  /** Отменить объединение (только contact/lead/company, есть снапшот) */
  @Post('pairs/:id/undo')
  @RequirePermission('leads', 'write')
  undoMerge(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    const userId = (user.userId ?? user.id ?? user.sub) as string;
    return this.dedupService.undoMerge(user.tenantId, id, userId);
  }

  /** Объединить две записи */
  @Post('merge')
  @RequirePermission('leads', 'write')
  merge(@CurrentUser() user: CurrentUserPayload, @Body() dto: MergeDto) {
    const userId = (user.userId ?? user.id ?? user.sub) as string;
    return this.dedupService.merge(user.tenantId, dto, userId);
  }
}
