import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TableColumnRestriction } from './table-column-restriction.entity';
import { COLUMN_ACCESS_TABLES, isRestrictableColumn } from './column-access.spec-map';
import { CustomField } from '../custom-fields/custom-field.entity';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';

/** Что скрыто от конкретного пользователя в конкретной таблице. */
export type HiddenColumns = {
  tableKey: string;
  columnIds: string[];
  props: Set<string>;
  metaKeys: Set<string>;
  customFieldKeys: Set<string>;
};

export const EMPTY_HIDDEN = (tableKey: string): HiddenColumns => ({
  tableKey,
  columnIds: [],
  props: new Set(),
  metaKeys: new Set(),
  customFieldKeys: new Set(),
});

@Injectable()
export class ColumnAccessService {
  constructor(
    @InjectRepository(TableColumnRestriction)
    private readonly repo: Repository<TableColumnRestriction>,
    @InjectRepository(CustomField)
    private readonly customFieldRepo: Repository<CustomField>,
  ) {}

  assertTable(tableKey: string) {
    if (!COLUMN_ACCESS_TABLES[tableKey]) throw new BadRequestException('Unknown table');
  }

  canManage(user: { role?: string | null }): boolean {
    return user.role === 'owner';
  }

  async list(tenantId: string, tableKey: string) {
    this.assertTable(tableKey);
    const rows = await this.repo.find({ where: { tenantId, tableKey } });
    return rows
      .filter((r) => Array.isArray(r.viewerStaffIds) && r.viewerStaffIds.length)
      .map((r) => ({ columnId: r.columnId, viewerStaffIds: r.viewerStaffIds }));
  }

  async setViewers(
    tenantId: string,
    tableKey: string,
    columnId: string,
    staffUserIds: string[],
    user: CurrentUserPayload,
  ) {
    this.assertTable(tableKey);
    if (!this.canManage(user)) throw new ForbiddenException('Доступ к колонкам настраивает владелец компании');
    if (!isRestrictableColumn(tableKey, columnId)) {
      throw new BadRequestException('Эту колонку нельзя ограничить');
    }
    const ids = [...new Set((staffUserIds || []).map(String).filter((x) => /^[0-9a-f-]{36}$/i.test(x)))].slice(0, 500);
    let valid: string[] = [];
    if (ids.length) {
      const rows: Array<{ id: string }> = await this.repo.query(
        `SELECT id FROM staff_users WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
        [tenantId, ids],
      );
      valid = rows.map((r) => r.id);
    }
    const existing = await this.repo.findOne({ where: { tenantId, tableKey, columnId } });
    if (!valid.length) {
      if (existing) await this.repo.remove(existing);
      return { columnId, viewerStaffIds: [] as string[] };
    }
    const row = existing ?? this.repo.create({ tenantId, tableKey, columnId });
    row.viewerStaffIds = valid;
    row.updatedByUserId = user.userId ?? user.id ?? user.sub ?? null;
    await this.repo.save(row);
    return { columnId, viewerStaffIds: valid };
  }

  /** Скрытые от пользователя колонки таблицы (владелец компании видит всё). */
  async hiddenFor(tenantId: string, tableKey: string, user: { role?: string | null; staffUserId?: string | null }): Promise<HiddenColumns> {
    const out = EMPTY_HIDDEN(tableKey);
    const table = COLUMN_ACCESS_TABLES[tableKey];
    if (!table || !tenantId || this.canManage(user)) return out;
    const rows = await this.repo.find({ where: { tenantId, tableKey } });
    const me = user.staffUserId || null;
    const hiddenIds = rows
      .filter((r) => Array.isArray(r.viewerStaffIds) && r.viewerStaffIds.length)
      .filter((r) => !me || !r.viewerStaffIds.includes(me))
      .map((r) => r.columnId);
    if (!hiddenIds.length) return out;
    out.columnIds = hiddenIds;
    const cfIds: string[] = [];
    for (const id of hiddenIds) {
      const spec = table.columns[id];
      if (spec) {
        spec.props.forEach((p) => out.props.add(p));
        spec.metaKeys?.forEach((k) => out.metaKeys.add(k));
      } else if (id.startsWith('cf:')) {
        cfIds.push(id.slice(3));
      }
    }
    if (cfIds.length) {
      const cfs = await this.customFieldRepo.find({
        where: { tenantId, entityType: table.customFieldEntityType, id: In(cfIds) },
        select: ['id', 'key'],
      });
      cfs.forEach((f) => out.customFieldKeys.add(f.key));
    }
    return out;
  }

  isEmpty(h: HiddenColumns) {
    return !h.props.size && !h.metaKeys.size && !h.customFieldKeys.size;
  }

  /** Копия сущности без значений скрытых колонок. */
  stripEntity<T>(entity: T, h: HiddenColumns): T {
    if (!entity || typeof entity !== 'object' || this.isEmpty(h)) return entity;
    const src = entity as Record<string, any>;
    if (!('id' in src)) return entity;
    const copy: Record<string, any> = { ...src };
    h.props.forEach((p) => {
      if (p in copy) copy[p] = null;
    });
    if (h.metaKeys.size && copy.meta && typeof copy.meta === 'object' && !Array.isArray(copy.meta)) {
      const meta = { ...copy.meta };
      h.metaKeys.forEach((k) => delete meta[k]);
      copy.meta = meta;
    }
    if (h.customFieldKeys.size && copy.customFields && typeof copy.customFields === 'object') {
      const cf = { ...copy.customFields };
      h.customFieldKeys.forEach((k) => delete cf[k]);
      copy.customFields = cf;
    }
    return copy as T;
  }

  /** Обходит типичные формы ответа: сущность, массив, { items: [...] }. */
  stripResponse(body: unknown, h: HiddenColumns): unknown {
    if (this.isEmpty(h) || body === null || body === undefined) return body;
    if (Array.isArray(body)) return body.map((x) => this.stripEntity(x, h));
    if (typeof body === 'object') {
      const b = body as Record<string, any>;
      if (Array.isArray(b.items)) return { ...b, items: b.items.map((x: unknown) => this.stripEntity(x, h)) };
      return this.stripEntity(b, h);
    }
    return body;
  }

  /**
   * Входящий PATCH/POST от того, кому колонка не видна: значения скрытых колонок нельзя задать.
   * `existing` — текущая запись: из неё восстанавливаются скрытые ключи там, где сервис заменяет
   * объект целиком (meta у лидов, customFields у лидов), иначе сохранение карточки стирало бы их.
   */
  protectIncoming(dto: Record<string, any> | null | undefined, h: HiddenColumns, existing?: Record<string, any> | null) {
    if (!dto || typeof dto !== 'object' || this.isEmpty(h)) return dto;
    const table = COLUMN_ACCESS_TABLES[h.tableKey];
    h.props.forEach((p) => delete dto[p]);
    if (h.metaKeys.size && dto.meta && typeof dto.meta === 'object' && !Array.isArray(dto.meta)) {
      const prev = (existing?.meta ?? {}) as Record<string, any>;
      h.metaKeys.forEach((k) => {
        if (k in prev) dto.meta[k] = prev[k];
        else delete dto.meta[k];
      });
    }
    if (h.customFieldKeys.size && dto.customFields && typeof dto.customFields === 'object') {
      const prev = (existing?.customFields ?? {}) as Record<string, any>;
      h.customFieldKeys.forEach((k) => {
        if (table?.customFieldsReplacedOnUpdate && k in prev) dto.customFields[k] = prev[k];
        else delete dto.customFields[k];
      });
    }
    return dto;
  }
}
