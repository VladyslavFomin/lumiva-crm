import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { ColumnAccessService } from './column-access.service';
import { COLUMN_ACCESS_TABLES } from './column-access.spec-map';

@Controller('column-access')
@UseGuards(JwtAuthGuard)
export class ColumnAccessController {
  constructor(private readonly access: ColumnAccessService) {}

  /** Ограничения таблицы + что скрыто от меня + могу ли я настраивать. */
  @Get(':tableKey')
  async get(@CurrentUser() user: CurrentUserPayload, @Param('tableKey') tableKey: string) {
    this.access.assertTable(tableKey);
    const canManage = this.access.canManage(user);
    const [restrictions, hidden] = await Promise.all([
      canManage ? this.access.list(user.tenantId, tableKey) : Promise.resolve([]),
      this.access.hiddenFor(user.tenantId, tableKey, user),
    ]);
    return {
      canManage,
      restrictableColumns: Object.keys(COLUMN_ACCESS_TABLES[tableKey].columns),
      restrictions,
      hiddenColumnIds: hidden.columnIds,
    };
  }

  @Put(':tableKey/:columnId')
  async set(
    @CurrentUser() user: CurrentUserPayload,
    @Param('tableKey') tableKey: string,
    @Param('columnId') columnId: string,
    @Body() body: { staffUserIds?: string[] },
  ) {
    return this.access.setViewers(
      user.tenantId,
      tableKey,
      decodeURIComponent(columnId),
      Array.isArray(body?.staffUserIds) ? body.staffUserIds : [],
      user,
    );
  }
}
