import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { mkdir, writeFile } from 'fs/promises';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { CustomObject } from './custom-object.entity';
import { CustomObjectField } from './custom-object-field.entity';
import { CustomObjectRecord } from './custom-object-record.entity';
import { CustomObjectView } from './custom-object-view.entity';
import { CustomObjectImportSession } from './custom-object-import-session.entity';
import { CreateCustomObjectDto } from './dto/create-custom-object.dto';
import { UpdateCustomObjectDto } from './dto/update-custom-object.dto';
import { CreateCustomObjectFieldDto } from './dto/create-custom-object-field.dto';
import { UpdateCustomObjectFieldDto } from './dto/update-custom-object-field.dto';
import { CreateCustomObjectRecordDto } from './dto/create-custom-object-record.dto';
import { UpdateCustomObjectRecordDto } from './dto/update-custom-object-record.dto';
import { CreateCustomObjectViewDto } from './dto/create-custom-object-view.dto';
import { UpdateCustomObjectViewDto } from './dto/update-custom-object-view.dto';
import { AutomationsService } from '../automations/automations.service';
import { TriggerEvent } from '../automations/automation.entity';
import {
  joinUploadsAbsolute,
  unlinkUploadsRelative,
} from '../common/uploads-root.util';
import { parseDecimalString } from '../lib/locale-number.util';
import type { CustomObjectFieldType } from './custom-object-field.entity';
import {
  buildSuggestedCustomObjectFieldMapping,
  parseCsvRobust,
  parseXlsxRobust,
} from '../lib/import-spreadsheet.util';
import {
  getWorkspaceTableKind,
  WORKSPACE_DATA_LINK_META_KEY,
} from './workspace-table-kind';
import {
  wooImportColumnApplicationRank,
  wooOrderTotalNumber,
} from '../integrations/woocommerce/woo-order-flat.util';
import {
  parseWorkspaceColumnBindingV1,
  type WorkspaceColumnBindingV1,
} from './workspace-column-binding';
import { WorkspaceAreaMembersService } from '../workspace-areas/workspace-area-members.service';
import { WorkspaceAreaActivityLogService } from '../workspace-areas/workspace-area-activity-log.service';

export interface ImportPreviewResponse {
  importId: string;
  columns: string[];
  sample: Array<Record<string, any>>;
  totalRows: number;
  suggestedMapping: Record<string, string | null>;
  headerRowNumber?: number;
  /** Уникальные непустые строки по каждой колонке (для статусов при создании поля из импорта). */
  uniqueValuesByColumn: Record<string, string[]>;
}

export interface ImportApplyPayload {
  importId: string;
  fieldMapping: Record<string, string | null>;
  externalIdField?: string;
  defaultValues?: Record<string, any>;
}

@Injectable()
export class CustomObjectsService {
  private readonly logger = new Logger(CustomObjectsService.name);

  constructor(
    @InjectRepository(CustomObject)
    private readonly objectRepo: Repository<CustomObject>,
    @InjectRepository(CustomObjectField)
    private readonly fieldRepo: Repository<CustomObjectField>,
    @InjectRepository(CustomObjectRecord)
    private readonly recordRepo: Repository<CustomObjectRecord>,
    @InjectRepository(CustomObjectView)
    private readonly viewRepo: Repository<CustomObjectView>,
    @InjectRepository(CustomObjectImportSession)
    private readonly importRepo: Repository<CustomObjectImportSession>,
    @Inject(forwardRef(() => AutomationsService))
    private readonly automationsService: AutomationsService,
    private readonly workspaceAreaMembers: WorkspaceAreaMembersService,
    private readonly activityLog: WorkspaceAreaActivityLogService,
  ) {}

  /** JWT identity is `users.id` (login), not `staff_users.id` — resolve the real staff
   * record the same way the area-access guard and ReservationsService.findActingStaffUserId
   * do (externalId first, then email). Returns null for logins with no staff directory row
   * (e.g. an owner-only tenant) — callers treat that as "no stampable/checkable identity". */
  private async resolveActorStaffId(
    tenantId: string,
    actor?: { loginUserId?: string; email?: string },
  ): Promise<string | null> {
    if (!actor?.loginUserId && !actor?.email) return null;
    return this.workspaceAreaMembers.resolveStaffUserId(tenantId, {
      loginUserId: actor.loginUserId,
      email: actor.email,
    });
  }

  /** own_rows_only может писать только собственные строки — остальные роли уже отфильтрованы
   * гардом на уровне контроллера. Системные вызовы (automations, AI, синки) без actorStaffId
   * пропускаются без проверки — они не проходят через контроллер вовсе. */
  private async assertCanWriteRecord(
    tenantId: string,
    obj: CustomObject,
    record: CustomObjectRecord,
    actorStaffId?: string | null,
  ): Promise<void> {
    if (!actorStaffId || !obj.workspaceAreaId) return;
    const role = await this.workspaceAreaMembers.resolveEffectiveRole(
      tenantId,
      obj.workspaceAreaId,
      actorStaffId,
      undefined,
    );
    if (role !== 'own_rows_only') return;
    if (record.createdByUserId !== actorStaffId) {
      throw new ForbiddenException('Можно изменять только свои строки');
    }
  }

  private slugify(input: string) {
    return String(input || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 180) || 'table';
  }

  /**
   * Токены опций select/status (не slug таблицы): сохраняем Unicode-буквы, иначе турецкий текст
   * превращается в planlan_yor вместо planlanıyor и ломает сопоставление с Excel.
   */
  private slugifyOptionValue(input: string): string {
    const s = String(input || '')
      .trim()
      .toLocaleLowerCase('tr-TR')
      .normalize('NFKC')
      .replace(/\s+/g, '_')
      .replace(/[^\p{L}\p{N}_]+/gu, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    return s.slice(0, 120);
  }

  private async uniqueSlug(tenantId: string, base: string, excludeId?: string) {
    let candidate = this.slugify(base);
    let i = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const found = await this.objectRepo.findOne({
        where: { tenantId, slug: candidate },
      });
      if (!found || found.id === excludeId) return candidate;
      candidate = `${this.slugify(base)}-${i++}`;
    }
  }

  private async createDefaultViews(
    tenantId: string,
    objectId: string,
    fields: CustomObjectField[],
  ) {
    /** Только таблица; канбан/календарь подключаются с UI по запросу пользователя */
    const views: Array<Partial<CustomObjectView>> = [
      {
        tenantId,
        objectId,
        type: 'table',
        name: 'Table',
        isDefault: true,
        order: 0,
        config: {},
      },
    ];
    if (views.length > 0) {
      await this.viewRepo.save(this.viewRepo.create(views));
    }
  }

  private parseBoolean(raw: any) {
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'number') {
      if (raw === 1) return true;
      if (raw === 0) return false;
    }
    if (typeof raw === 'string') {
      const normalized = raw.trim().toLowerCase();
      if (['true', '1', 'yes', 'y', 'on', 'да'].includes(normalized)) return true;
      if (['false', '0', 'no', 'n', 'off', 'нет'].includes(normalized)) return false;
    }
    throw new BadRequestException(`Invalid boolean value: ${String(raw)}`);
  }

  private hasMeaningfulValue(raw: any) {
    if (raw === undefined || raw === null) return false;
    if (typeof raw === 'string') return raw.trim().length > 0;
    if (Array.isArray(raw)) return raw.some((item) => this.hasMeaningfulValue(item));
    return true;
  }

  private optionToken(raw: any) {
    const source = String(raw ?? '').trim();
    if (!source) return '';
    const t = this.slugifyOptionValue(source);
    return t || 'option';
  }

  /** Согласован с `optionToken` / фронтом `normalizeOptionToken`. */
  private normalizeKanbanToken(value: string): string {
    return this.slugifyOptionValue(String(value || ''));
  }

  private resolveSingleOptionValue(field: CustomObjectField, raw: any): string | null {
    if (raw === undefined || raw === null || raw === '') return null;
    const options = field.options || [];
    const source = String(raw).trim();
    if (!options.length) return source;

    // Fast path for exact value/label matches.
    const exact = options.find(
      (opt) => String(opt.value) === source || String(opt.label) === source,
    );
    if (exact) return String(exact.value);

    const lower = source.toLocaleLowerCase('tr-TR');
    const caseInsensitive = options.find(
      (opt) =>
        String(opt.value).toLocaleLowerCase('tr-TR') === lower ||
        String(opt.label).toLocaleLowerCase('tr-TR') === lower,
    );
    if (caseInsensitive) return String(caseInsensitive.value);

    const sourceToken = this.optionToken(source);
    const loose = options.find((opt) => {
      const value = String(opt.value);
      const label = String(opt.label);
      return (
        this.optionToken(value) === sourceToken ||
        this.optionToken(label) === sourceToken
      );
    });
    if (loose) return String(loose.value);

    const kanbanTok = this.normalizeKanbanToken(source);
    if (kanbanTok) {
      const kMatch = options.find((opt) => {
        const tv = this.normalizeKanbanToken(String(opt.value ?? ''));
        const tl = this.normalizeKanbanToken(String(opt.label ?? ''));
        return (tv && tv === kanbanTok) || (tl && tl === kanbanTok);
      });
      if (kMatch) return String(kMatch.value);
    }
    return null;
  }

  /**
   * Значение из колонки Kanban / селекта может отсутствовать в options поля — добавляем опцию, чтобы PATCH не падал с 400.
   */
  private async ensureSelectOptionsForIncomingPatch(
    _tenantId: string,
    _objectId: string,
    fields: CustomObjectField[],
    patch: Record<string, any>,
  ) {
    const byKey = new Map(fields.map((f) => [f.key, f]));
    const dirty: CustomObjectField[] = [];

    for (const [key, raw] of Object.entries(patch || {})) {
      if (raw === undefined || raw === null || raw === '') continue;
      const field = byKey.get(key);
      if (!field || (field.type !== 'select' && field.type !== 'status')) continue;
      if (this.resolveSingleOptionValue(field, raw) !== null) continue;

      const source = String(raw).trim();
      if (!source) continue;

      const options = Array.isArray(field.options) ? [...field.options] : [];
      let baseToken = this.optionToken(source);
      if (!baseToken) {
        baseToken =
          source
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_а-яё-]/gi, '') || source;
      }
      let nextValue = baseToken;
      let suffix = 2;
      while (options.some((opt) => String(opt.value) === nextValue)) {
        nextValue = `${baseToken}_${suffix++}`;
      }

      const sourceKan = this.normalizeKanbanToken(source);
      const dup = options.some((o) => {
        const ov = String(o.value);
        if (ov === source || ov === nextValue) return true;
        if (sourceKan && this.normalizeKanbanToken(ov) === sourceKan) return true;
        if (sourceKan && this.normalizeKanbanToken(String(o.label ?? '')) === sourceKan) return true;
        return false;
      });
      if (dup) continue;

      const baseLabel = source.includes('_') ? source.replace(/_/g, ' ') : source;
      const label =
        baseLabel.length > 0
          ? baseLabel.charAt(0).toUpperCase() + baseLabel.slice(1)
          : nextValue;

      options.push({ value: nextValue, label });
      field.options = options;
      if (!dirty.includes(field)) dirty.push(field);
    }

    if (dirty.length) {
      await this.fieldRepo.save(dirty);
    }
  }

  private parseMultiSelectInput(raw: any): string[] {
    return Array.isArray(raw)
      ? raw.map((v) => String(v).trim()).filter(Boolean)
      : String(raw ?? '')
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
  }

  private ensureOptionForImport(field: CustomObjectField, raw: any): boolean {
    if (!this.hasMeaningfulValue(raw)) return false;
    const label = String(raw).trim();
    if (!label) return false;
    const alreadyResolved = this.resolveSingleOptionValue(field, label);
    if (alreadyResolved) return false;

    const options = Array.isArray(field.options) ? [...field.options] : [];
    const baseToken = this.optionToken(label);
    if (!baseToken) return false;

    let nextValue = baseToken;
    let suffix = 2;
    while (options.some((opt) => String(opt.value) === nextValue)) {
      nextValue = `${baseToken}_${suffix++}`;
    }

    options.push({ value: nextValue, label });
    field.options = options;
    return true;
  }

  private async extendImportFieldOptions(
    fields: CustomObjectField[],
    rows: Array<Record<string, any>>,
    mapping: Record<string, string | null>,
    defaultValues: Record<string, any>,
  ) {
    const byKey = new Map(fields.map((field) => [field.key, field]));
    const touched = new Set<string>();

    const ensureForField = (field: CustomObjectField, raw: any) => {
      const type = field.type as CustomObjectFieldType;
      if (type !== 'select' && type !== 'status' && type !== 'multiselect') return;
      if (type === 'multiselect') {
        const values = this.parseMultiSelectInput(raw);
        values.forEach((item) => {
          if (this.ensureOptionForImport(field, item)) touched.add(field.id);
        });
        return;
      }
      if (this.ensureOptionForImport(field, raw)) touched.add(field.id);
    };

    Object.entries(mapping).forEach(([fieldKey, column]) => {
      if (!column) return;
      const field = byKey.get(fieldKey);
      if (!field) return;
      rows.forEach((source) => ensureForField(field, source[column]));
    });

    Object.entries(defaultValues || {}).forEach(([fieldKey, raw]) => {
      const field = byKey.get(fieldKey);
      if (!field) return;
      ensureForField(field, raw);
    });

    if (!touched.size) return;
    const changed = fields.filter((field) => touched.has(field.id));
    await this.fieldRepo.save(changed);
  }

  /** Порядок первого появления в файле, без дубликатов. */
  private firstSeenUniqueOrder(
    rows: Array<Record<string, any>>,
    column: string,
  ): string[] {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const row of rows) {
      const s = String(row[column] ?? '').trim();
      if (!s) continue;
      if (seen.has(s)) continue;
      seen.add(s);
      order.push(s);
    }
    return order;
  }

  /**
   * Как на фронте WorkspaceImportPage.statusOptionsFromFileValues — значения для поля status из импорта.
   */
  private buildStatusOptionsFromImportStrings(
    firstSeen: string[],
  ): Array<{ value: string; label: string }> {
    const used = new Set<string>();
    const out: Array<{ value: string; label: string }> = [];
    for (const raw of firstSeen) {
      const labelRaw = String(raw).trim();
      if (!labelRaw) continue;
      let value = this.slugifyOptionValue(labelRaw) || 'status';
      let v = value;
      let n = 2;
      while (used.has(v)) {
        v = `${value}_${n++}`;
      }
      used.add(v);
      const forDisplay = labelRaw.replace(/_/g, ' ');
      const label =
        forDisplay.length > 0
          ? forDisplay.charAt(0).toUpperCase() + forDisplay.slice(1)
          : v;
      out.push({ value: v, label });
    }
    return out;
  }

  /**
   * Если колонка статуса сопоставлена и в файле есть непустые значения — подменяем опции поля
   * только ими (без шаблонных working_on_it / done / …). Иначе оставляем текущие опции.
   */
  private async replaceStatusFieldOptionsFromImport(
    fields: CustomObjectField[],
    rows: Array<Record<string, any>>,
    mapping: Record<string, string | null>,
  ): Promise<void> {
    const COLOR_PRESETS = [
      '#60a5fa',
      '#34d399',
      '#fbbf24',
      '#f87171',
      '#a78bfa',
      '#f472b6',
      '#38bdf8',
      '#fb923c',
      '#4ade80',
      '#facc15',
      '#94a3b8',
    ];
    const dirty: CustomObjectField[] = [];
    for (const field of fields) {
      if (field.type !== 'status') continue;
      const col = mapping[field.key];
      if (!col) continue;
      const firstSeen = this.firstSeenUniqueOrder(rows, col);
      if (firstSeen.length === 0) continue;

      const options = this.buildStatusOptionsFromImportStrings(firstSeen);
      field.options = options;
      const statusColors: Record<string, string> = {};
      options.forEach((o, i) => {
        statusColors[o.value] = COLOR_PRESETS[i % COLOR_PRESETS.length];
      });
      const meta = { ...(field.meta || {}) } as Record<string, any>;
      meta.statusColors = statusColors;
      meta.statusOrder = options.map((o) => o.value);
      field.meta = meta;
      dirty.push(field);
    }
    if (dirty.length) await this.fieldRepo.save(dirty);
  }

  private coerceFileFieldValue(
    raw: any,
    tenantId: string,
  ): {
    name: string;
    relativePath: string;
    uploadedByEmail?: string | null;
  } | null {
    if (raw === undefined || raw === null || raw === '') return null;
    const obj =
      typeof raw === 'string'
        ? (() => {
            try {
              return JSON.parse(raw);
            } catch {
              return null;
            }
          })()
        : raw;
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object' || Array.isArray(obj)) {
      throw new BadRequestException(
        `File field expects an object { name, relativePath }`,
      );
    }
    const name = String(obj.name || '').trim();
    const relativePath = String(obj.relativePath || '')
      .trim()
      .replace(/\\/g, '/');
    if (!name || !relativePath) {
      throw new BadRequestException('File field requires name and relativePath');
    }
    if (!relativePath.startsWith('workspace-files/')) {
      throw new BadRequestException('Invalid file path');
    }
    const segments = relativePath.split('/').filter(Boolean);
    const tid = tenantId.trim();
    if (
      !segments.some((s) => s.toLowerCase() === tid.toLowerCase())
    ) {
      throw new ForbiddenException('Invalid file path');
    }
    const out: {
      name: string;
      relativePath: string;
      uploadedByEmail?: string | null;
    } = { name, relativePath };
    if ('uploadedByEmail' in obj) {
      const e = (obj as { uploadedByEmail?: unknown }).uploadedByEmail;
      out.uploadedByEmail =
        e === null || e === undefined
          ? null
          : String(e).trim() || null;
    }
    return out;
  }

  private coerceFieldValue(
    field: CustomObjectField,
    raw: any,
    tenantId?: string,
  ): any {
    if (raw === undefined || raw === null || raw === '') return null;
    const type = field.type as CustomObjectFieldType;
    const options = field.options || [];
    const optionValues = new Set(options.map((o) => String(o.value)));
    if (type === 'text') return String(raw);
    if (type === 'number') {
      if (typeof raw === 'number') {
        if (Number.isNaN(raw)) {
          throw new BadRequestException(`Field "${field.key}" expects number`);
        }
        return raw;
      }
      const parsed = parseDecimalString(raw);
      if (parsed === null) {
        throw new BadRequestException(`Field "${field.key}" expects number`);
      }
      return parsed;
    }
    if (type === 'boolean') {
      return this.parseBoolean(raw);
    }
    if (type === 'date') {
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) {
        throw new BadRequestException(`Field "${field.key}" expects date`);
      }
      return date.toISOString().slice(0, 10);
    }
    if (type === 'datetime') {
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) {
        throw new BadRequestException(`Field "${field.key}" expects datetime`);
      }
      return date.toISOString();
    }
    if (type === 'select' || type === 'status') {
      const value = this.resolveSingleOptionValue(field, raw);
      if (value === null) {
        // Раньше тихо писали null — в UI казалось, что статус «не меняется» (или сбрасывался).
        if (raw === undefined || raw === null || raw === '') return null;
        throw new BadRequestException(
          `Field "${field.key}" value "${String(raw)}" does not match any option (check option values/labels)`,
        );
      }
      if (optionValues.size && !optionValues.has(value)) {
        throw new BadRequestException(
          `Field "${field.key}" value "${String(raw)}" is not in options`,
        );
      }
      return value;
    }
    if (type === 'multiselect') {
      const list = Array.isArray(raw)
        ? raw.map((v) => String(v))
        : String(raw)
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean);
      if (optionValues.size && (field.options || []).length) {
        const normalized: string[] = [];
        for (const item of list) {
          const resolved = this.resolveSingleOptionValue(field, item);
          if (!resolved || !optionValues.has(resolved)) {
            throw new BadRequestException(
              `Field "${field.key}" value "${item}" is not in options`,
            );
          }
          normalized.push(resolved);
        }
        return normalized;
      }
      if (optionValues.size) {
        const invalid = list.find((v) => !optionValues.has(v));
        if (invalid) {
          throw new BadRequestException(
            `Field "${field.key}" value "${invalid}" is not in options`,
          );
        }
      }
      return list;
    }
    if (type === 'file') {
      if (!tenantId) {
        throw new BadRequestException('File field validation requires tenant context');
      }
      return this.coerceFileFieldValue(raw, tenantId);
    }
    return raw;
  }

  /** Пустое значение канонического ключа + данные под mapsToImportedKey (импорт) → копируем в field.key для валидации и coerce. */
  private isWorkspaceCellEmpty(value: any): boolean {
    if (value === undefined || value === null || value === '') return true;
    if (Array.isArray(value)) return value.length === 0;
    return false;
  }

  private mergeWorkspaceImportKeyAliases(
    fields: CustomObjectField[],
    rawValues: Record<string, any>,
  ): Record<string, any> {
    const raw = { ...(rawValues || {}) };
    for (const field of fields) {
      const meta = field.meta as Record<string, unknown> | null | undefined;
      const mapped =
        meta && typeof meta === 'object' ? meta['mapsToImportedKey'] : undefined;
      if (typeof mapped !== 'string' || !mapped.trim()) continue;
      const importKey = mapped.trim();
      if (importKey === field.key) continue;
      const vCanon = raw[field.key];
      const vImport = raw[importKey];
      if (this.isWorkspaceCellEmpty(vCanon) && !this.isWorkspaceCellEmpty(vImport)) {
        raw[field.key] = vImport;
      }
    }
    return raw;
  }

  private normalizeRecordValues(
    fields: CustomObjectField[],
    rawValues: Record<string, any>,
    mode: 'create' | 'update',
    changedKeys?: string[],
    tenantId?: string,
  ) {
    const merged = this.mergeWorkspaceImportKeyAliases(fields, rawValues);
    const normalized: Record<string, any> = {};
    const byKey = new Map(fields.map((f) => [f.key, f]));
    Object.entries(merged).forEach(([key, value]) => {
      const field = byKey.get(key);
      if (!field) {
        // Keep unknown keys for backward compatibility while enforcing known types.
        normalized[key] = value;
        return;
      }
      normalized[key] = this.coerceFieldValue(field, value, tenantId);
    });
    if (mode === 'create') {
      fields.forEach((field) => {
        const value = normalized[field.key];
        if (!field.required) return;
        if (field.type === 'file') {
          const ok =
            value &&
            typeof value === 'object' &&
            String((value as { relativePath?: string }).relativePath || '').trim();
          if (!ok) {
            throw new BadRequestException(
              `Field "${field.key}" is required (${mode})`,
            );
          }
          return;
        }
        if (value === null || value === undefined || value === '') {
          throw new BadRequestException(
            `Field "${field.key}" is required (${mode})`,
          );
        }
      });
    }
    return normalized;
  }

  private valuesEqual(a: any, b: any) {
    if (a === b) return true;
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }

  async listObjects(tenantId: string, workspaceAreaId?: string | null) {
    const qb = this.objectRepo
      .createQueryBuilder('o')
      .where('o.tenantId = :tid', { tid: tenantId });
    if (workspaceAreaId) {
      qb.andWhere('o.workspaceAreaId = :wid', { wid: workspaceAreaId });
    }
    return qb.orderBy('o.updatedAt', 'DESC').getMany();
  }

  async getObject(tenantId: string, objectId: string) {
    const object = await this.objectRepo.findOne({
      where: { id: objectId, tenantId },
    });
    if (!object) throw new NotFoundException('Custom object not found');
    return object;
  }

  async createObject(tenantId: string, dto: CreateCustomObjectDto) {
    const slug = await this.uniqueSlug(tenantId, dto.slug || dto.name);
    const meta =
      dto.meta != null
        ? dto.meta
        : ({ enabledViews: ['table'] } as Record<string, any>);
    const created = await this.objectRepo.save(
      this.objectRepo.create({
        tenantId,
        name: dto.name,
        slug,
        description: dto.description || null,
        isActive: dto.isActive ?? true,
        meta,
        workspaceAreaId: dto.workspaceAreaId ?? null,
      }),
    );
    let fields: CustomObjectField[] = [];
    if (dto.fields?.length) {
      fields = await this.fieldRepo.save(
        this.fieldRepo.create(
          dto.fields.map((f, index) => ({
            tenantId,
            objectId: created.id,
            key: this.slugify(f.key).replace(/-/g, '_'),
            label: f.label,
            type: f.type,
            required: f.required ?? false,
            options: f.options || null,
            order: f.order ?? index,
            isActive: true,
            meta: null,
          })),
        ),
      );
    }
    await this.createDefaultViews(tenantId, created.id, fields);
    await this.activityLog.log(
      tenantId,
      created.workspaceAreaId,
      'table_created',
      `Создана таблица «${created.name}»`,
      getWorkspaceTableKind(created.meta as Record<string, any>) === 'board'
        ? 'Основная таблица'
        : 'Таблица данных',
      { relatedObjectId: created.id },
    );
    return created;
  }

  async updateObject(tenantId: string, objectId: string, dto: UpdateCustomObjectDto) {
    const object = await this.getObject(tenantId, objectId);
    if (dto.name !== undefined) object.name = dto.name;
    if (dto.slug !== undefined) {
      object.slug = await this.uniqueSlug(tenantId, dto.slug, object.id);
    }
    if (dto.description !== undefined) object.description = dto.description || null;
    if (dto.isActive !== undefined) object.isActive = dto.isActive;
    if (dto.meta !== undefined) object.meta = dto.meta || null;
    if (dto.workspaceAreaId !== undefined) {
      object.workspaceAreaId = dto.workspaceAreaId;
    }
    return this.objectRepo.save(object);
  }

  async deleteObject(tenantId: string, objectId: string) {
    const object = await this.getObject(tenantId, objectId);
    await this.objectRepo.remove(object);
    return { ok: true };
  }

  async duplicateObject(tenantId: string, sourceId: string) {
    const src = await this.getObject(tenantId, sourceId);
    const fields = await this.listFields(tenantId, sourceId);
    const name = `${src.name} (copy)`;
    const slug = await this.uniqueSlug(tenantId, `${src.slug}-copy`);
    const created = await this.objectRepo.save(
      this.objectRepo.create({
        tenantId,
        name,
        slug,
        description: src.description || null,
        isActive: true,
        workspaceAreaId: src.workspaceAreaId ?? null,
        meta: {
          ...(src.meta && typeof src.meta === 'object' ? src.meta : {}),
          enabledViews: ['table'],
        },
      }),
    );
    for (const f of fields) {
      await this.createField(tenantId, created.id, {
        key: f.key,
        label: f.label,
        type: f.type as any,
        required: f.required,
        options: f.options || undefined,
        order: f.order,
      });
    }
    if (fields.length === 0) {
      await this.createDefaultViews(tenantId, created.id, []);
    }
    return this.getObject(tenantId, created.id);
  }

  /**
   * Ключи, реально встречающиеся в values (импорт может добавить поля до объявления колонок).
   */
  async listDistinctValueKeys(tenantId: string, objectId: string): Promise<{ keys: string[] }> {
    await this.getObject(tenantId, objectId);
    const rows: Array<{ k: string }> = await this.recordRepo.query(
      `SELECT DISTINCT k AS k
       FROM custom_object_records r,
       LATERAL jsonb_object_keys(COALESCE(r."values", '{}'::jsonb)) AS k
       WHERE r."tenantId" = $1 AND r."objectId" = $2::uuid
       ORDER BY k
       LIMIT 2000`,
      [tenantId, objectId],
    );
    const keys = rows.map((r) => r.k).filter((k) => typeof k === 'string' && k.length > 0);
    return { keys };
  }

  async listFields(tenantId: string, objectId: string) {
    await this.getObject(tenantId, objectId);
    return this.fieldRepo.find({
      where: { tenantId, objectId },
      order: { order: 'ASC', createdAt: 'ASC' },
    });
  }

  async uploadWorkspaceAttachment(
    tenantId: string,
    objectId: string,
    file: { buffer: Buffer; originalname?: string },
    uploadedByEmail?: string,
  ) {
    await this.getObject(tenantId, objectId);
    if (!file?.buffer?.length) {
      this.logger.warn(`Workspace upload rejected: empty buffer objectId=${objectId}`);
      throw new BadRequestException('File is required');
    }
    const baseName = (file.originalname || 'file').replace(
      /[^a-zA-Z0-9._\-а-яёА-ЯЁ ]/gi,
      '_',
    );
    const ext = extname(baseName).toLowerCase() || '.bin';
    const allowed = new Set([
      '.pdf',
      '.doc',
      '.docx',
      '.xls',
      '.xlsx',
      '.ppt',
      '.pptx',
      '.csv',
      '.txt',
      '.rtf',
      '.odt',
      '.ods',
    ]);
    if (!allowed.has(ext)) {
      this.logger.warn(
        `Workspace upload rejected: unsupported ext=${ext} originalName=${file.originalname || ''} objectId=${objectId}`,
      );
      throw new BadRequestException(
        `Unsupported file type (${ext}). Use PDF, Word, Excel, PowerPoint, CSV or similar.`,
      );
    }
    const id = randomUUID();
    const relDir = `workspace-files/${tenantId}/${objectId}`;
    const filename = `${id}${ext}`;
    const relativePath = `${relDir}/${filename}`;
    const absDir = joinUploadsAbsolute(relDir);
    await mkdir(absDir, { recursive: true });
    await writeFile(joinUploadsAbsolute(relativePath), file.buffer);
    return {
      name: baseName || filename,
      relativePath,
      uploadedByEmail: uploadedByEmail?.trim() || null,
    };
  }

  async createField(tenantId: string, objectId: string, dto: CreateCustomObjectFieldDto) {
    await this.getObject(tenantId, objectId);
    const key = this.slugify(dto.key).replace(/-/g, '_');
    const exists = await this.fieldRepo.findOne({
      where: { tenantId, objectId, key },
    });
    if (exists) throw new BadRequestException('Field key already exists');
    const count = await this.fieldRepo.count({ where: { tenantId, objectId } });
    const saved = await this.fieldRepo.save(
      this.fieldRepo.create({
        tenantId,
        objectId,
        key,
        label: dto.label,
        type: dto.type,
        required: dto.required ?? false,
        options: dto.options || null,
        order: dto.order ?? count,
        isActive: dto.isActive ?? true,
        meta: dto.meta || null,
      }),
    );
    const hasViews = await this.viewRepo.count({ where: { tenantId, objectId } });
    if (!hasViews) {
      const fields = await this.listFields(tenantId, objectId);
      await this.createDefaultViews(tenantId, objectId, fields);
    }
    return saved;
  }

  async updateField(
    tenantId: string,
    objectId: string,
    fieldId: string,
    dto: UpdateCustomObjectFieldDto,
  ) {
    const obj = await this.getObject(tenantId, objectId);
    const field = await this.fieldRepo.findOne({
      where: { id: fieldId, tenantId, objectId },
    });
    if (!field) throw new NotFoundException('Field not found');
    let renamedKey: { oldKey: string; newKey: string } | null = null;
    if (dto.key !== undefined) {
      const newKey = this.slugify(dto.key).replace(/-/g, '_');
      const clash = await this.fieldRepo.findOne({
        where: { tenantId, objectId, key: newKey },
      });
      if (clash && clash.id !== field.id) {
        throw new BadRequestException('Field key already exists');
      }
      if (newKey !== field.key) renamedKey = { oldKey: field.key, newKey };
      field.key = newKey;
    }
    if (dto.label !== undefined) field.label = dto.label;
    if (dto.type !== undefined) field.type = dto.type;
    if (dto.required !== undefined) field.required = dto.required;
    if (dto.options !== undefined) field.options = dto.options || null;
    if (dto.order !== undefined) field.order = dto.order;
    if (dto.isActive !== undefined) field.isActive = dto.isActive;
    const prevBinding = parseWorkspaceColumnBindingV1(field.meta);
    if (dto.meta !== undefined) field.meta = dto.meta || null;
    const nextBinding = parseWorkspaceColumnBindingV1(field.meta);
    const saved = await this.fieldRepo.save(field);
    if (renamedKey) {
      // Иначе значение молча "теряется" под старым ключом в jsonb blob'е — колонка
      // выглядит пустой для всех существующих записей после переименования.
      await this.recordRepo.query(
        `UPDATE custom_object_records
         SET values = (values - $1) || jsonb_build_object($2::text, values -> $1)
         WHERE "tenantId" = $3 AND "objectId" = $4 AND values ? $1`,
        [renamedKey.oldKey, renamedKey.newKey, tenantId, objectId],
      );
    }
    if (JSON.stringify(prevBinding) !== JSON.stringify(nextBinding)) {
      await this.activityLog.log(
        tenantId,
        obj.workspaceAreaId,
        'mapping_change',
        `Изменена связь колонки «${saved.label}»`,
        nextBinding ? `Режим: ${nextBinding.mode}` : 'Связь удалена',
        { relatedObjectId: objectId },
      );
    }
    return saved;
  }

  async deleteField(tenantId: string, objectId: string, fieldId: string) {
    await this.getObject(tenantId, objectId);
    const field = await this.fieldRepo.findOne({
      where: { id: fieldId, tenantId, objectId },
    });
    if (!field) throw new NotFoundException('Field not found');
    await this.fieldRepo.remove(field);
    // Тот же класс бага, что у смены key (см. updateField выше) — иначе значение остаётся
    // в jsonb "values" всех записей таблицы навсегда, невидимым мусором.
    await this.recordRepo.query(
      `UPDATE custom_object_records SET values = values - $1
       WHERE "tenantId" = $2 AND "objectId" = $3 AND values ? $1`,
      [field.key, tenantId, objectId],
    );
    return { ok: true };
  }

  async listViews(tenantId: string, objectId: string) {
    await this.getObject(tenantId, objectId);
    return this.viewRepo.find({
      where: { tenantId, objectId },
      order: { order: 'ASC', createdAt: 'ASC' },
    });
  }

  async createView(tenantId: string, objectId: string, dto: CreateCustomObjectViewDto) {
    await this.getObject(tenantId, objectId);
    const count = await this.viewRepo.count({ where: { tenantId, objectId } });
    return this.viewRepo.save(
      this.viewRepo.create({
        tenantId,
        objectId,
        type: dto.type,
        name: dto.name,
        config: dto.config || null,
        isDefault: dto.isDefault ?? false,
        order: dto.order ?? count,
      }),
    );
  }

  async updateView(
    tenantId: string,
    objectId: string,
    viewId: string,
    dto: UpdateCustomObjectViewDto,
  ) {
    await this.getObject(tenantId, objectId);
    const view = await this.viewRepo.findOne({
      where: { id: viewId, tenantId, objectId },
    });
    if (!view) throw new NotFoundException('View not found');
    if (dto.type !== undefined) view.type = dto.type;
    if (dto.name !== undefined) view.name = dto.name;
    if (dto.config !== undefined) view.config = dto.config || null;
    if (dto.isDefault !== undefined) view.isDefault = dto.isDefault;
    if (dto.order !== undefined) view.order = dto.order;
    return this.viewRepo.save(view);
  }

  async deleteView(tenantId: string, objectId: string, viewId: string) {
    await this.getObject(tenantId, objectId);
    const view = await this.viewRepo.findOne({
      where: { id: viewId, tenantId, objectId },
    });
    if (!view) throw new NotFoundException('View not found');
    await this.viewRepo.remove(view);
    return { ok: true };
  }

  async listRecords(
    tenantId: string,
    objectId: string,
    options?: {
      limit?: number;
      offset?: number;
      sortBy?: string;
      sortOrder?: 'ASC' | 'DESC';
      search?: string;
      enrichColumnBindings?: boolean;
    },
  ) {
    await this.getObject(tenantId, objectId);
    const qb = this.recordRepo
      .createQueryBuilder('record')
      .where('record.tenantId = :tenantId', { tenantId })
      .andWhere('record.objectId = :objectId', { objectId });
    if (options?.search) {
      qb.andWhere('record.values::text ILIKE :search', {
        search: `%${options.search}%`,
      });
    }
    const total = await qb.getCount();
    if (options?.sortBy) {
      let sortKey = options.sortBy;
      if (
        sortKey !== 'createdAt' &&
        sortKey !== 'updatedAt' &&
        CustomObjectsService.SAFE_VALUES_KEY.test(sortKey)
      ) {
        const sortField = await this.fieldRepo.findOne({
          where: { tenantId, objectId, key: sortKey },
        });
        const meta = sortField?.meta as Record<string, unknown> | undefined;
        const mapped = meta?.mapsToImportedKey;
        if (typeof mapped === 'string' && CustomObjectsService.SAFE_VALUES_KEY.test(mapped.trim())) {
          sortKey = mapped.trim();
        }
      }
      const sortExpr =
        sortKey === 'createdAt' || sortKey === 'updatedAt'
          ? `record.${sortKey}`
          : `record.values ->> '${sortKey}'`;
      qb.orderBy(sortExpr, options.sortOrder || 'DESC');
    } else {
      qb.orderBy('record.updatedAt', 'DESC');
    }
    qb.limit(options?.limit || 50);
    qb.offset(options?.offset || 0);
    const items = await qb.getMany();
    if (options?.enrichColumnBindings && items.length > 0) {
      const enriched = await this.enrichRecordsColumnBindings(tenantId, objectId, items);
      return { items: enriched, total };
    }
    return { items, total };
  }

  private static readonly SAFE_VALUES_KEY = /^[a-zA-Z0-9_]+$/;

  private static readonly MAPS_TO_IMPORTED_KEY = 'mapsToImportedKey';

  private getFieldValueStorageKey(field: CustomObjectField): string {
    const meta = field.meta as Record<string, unknown> | null | undefined;
    const m = meta?.[CustomObjectsService.MAPS_TO_IMPORTED_KEY];
    if (typeof m === 'string' && CustomObjectsService.SAFE_VALUES_KEY.test(m.trim())) {
      return m.trim();
    }
    return field.key;
  }

  private getValuesStorageKeyForFieldMap(
    fieldMap: Map<string, CustomObjectField>,
    fieldKey: string,
  ): string {
    const f = fieldMap.get(fieldKey);
    return f ? this.getFieldValueStorageKey(f) : fieldKey;
  }

  private isCellValueEmpty(raw: any): boolean {
    if (raw === null || raw === undefined) return true;
    if (typeof raw === 'string') return raw.trim() === '';
    return false;
  }

  /** Агрегаты по таблице данных, сгруппированные по полю (для columnBinding mode rollup). */
  private async computeRollupByGroupKey(
    tenantId: string,
    dataObjectId: string,
    groupByFieldKey: string,
    valueFieldKey: string,
    aggregate: 'sum' | 'count' | 'avg' | 'min' | 'max',
  ): Promise<Map<string, number>> {
    if (
      !CustomObjectsService.SAFE_VALUES_KEY.test(groupByFieldKey) ||
      !CustomObjectsService.SAFE_VALUES_KEY.test(valueFieldKey)
    ) {
      return new Map();
    }
    try {
      await this.getObject(tenantId, dataObjectId);
    } catch {
      return new Map();
    }
    const g = groupByFieldKey;
    const v = valueFieldKey;
    const numExpr = `
      CASE
        WHEN (record.values->>'${v}') IS NULL OR trim(record.values->>'${v}') = '' THEN NULL::double precision
        WHEN (record.values->>'${v}') ~ '^-?[0-9]+(\\.[0-9]+)?([eE][+-]?[0-9]+)?$'
          THEN (record.values->>'${v}')::double precision
        ELSE NULL::double precision
      END`;

    let aggExpr: string;
    switch (aggregate) {
      case 'sum':
        aggExpr = `COALESCE(SUM(${numExpr}), 0)::double precision`;
        break;
      case 'count':
        aggExpr = `COUNT(*)::double precision`;
        break;
      case 'avg':
        aggExpr = `AVG(${numExpr})`;
        break;
      case 'min':
        aggExpr = `MIN(${numExpr})`;
        break;
      case 'max':
        aggExpr = `MAX(${numExpr})`;
        break;
      default:
        return new Map();
    }

    const sql = `
      SELECT COALESCE(record.values->>'${g}', '') AS "groupKey",
             ${aggExpr} AS "agg"
      FROM "custom_object_records" record
      WHERE record."tenantId" = $1 AND record."objectId" = $2::uuid
      GROUP BY COALESCE(record.values->>'${g}', '')
    `;

    const rows: Array<{ groupKey: string; agg: unknown }> = await this.recordRepo.query(sql, [
      tenantId,
      dataObjectId,
    ]);
    const map = new Map<string, number>();
    for (const row of rows) {
      const k = String(row.groupKey ?? '');
      const a = row.agg;
      if (a === null || a === undefined) continue;
      const n = typeof a === 'string' ? parseFloat(a) : Number(a);
      if (Number.isFinite(n)) map.set(k, n);
    }
    return map;
  }

  /**
   * Подставляет в ответ значения для колонок с meta.columnBinding.
   * Lookup и rollup пересчитываются по текущему ключу сопоставления (в т.ч. при смене ID на доске).
   */
  private async enrichRecordsColumnBindings(
    tenantId: string,
    objectId: string,
    items: CustomObjectRecord[],
  ): Promise<CustomObjectRecord[]> {
    const fields = await this.listFields(tenantId, objectId);
    const pushed: Array<{ fieldKey: string; binding: Extract<WorkspaceColumnBindingV1, { mode: 'from_pushed_source' }> }> =
      [];
    const lookups: Array<{ fieldKey: string; binding: Extract<WorkspaceColumnBindingV1, { mode: 'lookup_by_key' }> }> =
      [];
    const rollups: Array<{ fieldKey: string; binding: Extract<WorkspaceColumnBindingV1, { mode: 'rollup' }> }> = [];
    for (const f of fields) {
      if (!f.isActive) continue;
      const b = parseWorkspaceColumnBindingV1(f.meta);
      if (!b) continue;
      if (b.mode === 'from_pushed_source') pushed.push({ fieldKey: f.key, binding: b });
      else if (b.mode === 'lookup_by_key') lookups.push({ fieldKey: f.key, binding: b });
      else if (b.mode === 'rollup') rollups.push({ fieldKey: f.key, binding: b });
    }
    if (!pushed.length && !lookups.length && !rollups.length) return items;

    const boardFieldByKey = new Map(fields.map((f) => [f.key, f]));
    const dataFieldCache = new Map<string, Map<string, CustomObjectField>>();
    const ensureDataFieldMap = async (
      oid: string,
    ): Promise<Map<string, CustomObjectField> | null> => {
      const cached = dataFieldCache.get(oid);
      if (cached) return cached;
      try {
        await this.getObject(tenantId, oid);
      } catch {
        return null;
      }
      const fl = await this.listFields(tenantId, oid);
      const m = new Map(fl.map((f) => [f.key, f]));
      dataFieldCache.set(oid, m);
      return m;
    };

    const overlays: Record<string, Record<string, unknown>> = {};
    const addOverlay = (recordId: string, fieldKey: string, val: unknown) => {
      if (!overlays[recordId]) overlays[recordId] = {};
      overlays[recordId][fieldKey] = val;
    };

    if (pushed.length) {
      const grouped = new Map<string, Set<string>>();
      for (const item of items) {
        const link = item.meta?.[WORKSPACE_DATA_LINK_META_KEY];
        if (!link || typeof link !== 'object' || Array.isArray(link)) continue;
        const o = link as Record<string, unknown>;
        const sid = typeof o.sourceObjectId === 'string' ? o.sourceObjectId : '';
        const rid = typeof o.sourceRecordId === 'string' ? o.sourceRecordId : '';
        if (!sid || !rid) continue;
        if (!grouped.has(sid)) grouped.set(sid, new Set());
        grouped.get(sid)!.add(rid);
      }
      const cache = new Map<string, CustomObjectRecord>();
      for (const [srcObjId, idSet] of grouped) {
        try {
          await this.getObject(tenantId, srcObjId);
        } catch {
          continue;
        }
        const ids = [...idSet];
        if (!ids.length) continue;
        const rows = await this.recordRepo
          .createQueryBuilder('r')
          .where('r.tenantId = :tenantId', { tenantId })
          .andWhere('r.objectId = :oid', { oid: srcObjId })
          .andWhere('r.id IN (:...ids)', { ids })
          .getMany();
        for (const row of rows) {
          cache.set(`${srcObjId}:${row.id}`, row);
        }
      }
      for (const item of items) {
        const link = item.meta?.[WORKSPACE_DATA_LINK_META_KEY];
        if (!link || typeof link !== 'object' || Array.isArray(link)) continue;
        const o = link as Record<string, unknown>;
        const sid = typeof o.sourceObjectId === 'string' ? o.sourceObjectId : '';
        const rid = typeof o.sourceRecordId === 'string' ? o.sourceRecordId : '';
        if (!sid || !rid) continue;
        const src = cache.get(`${sid}:${rid}`);
        if (!src?.values || typeof src.values !== 'object') continue;
        const srcVals = src.values as Record<string, unknown>;
        const curVals =
          item.values && typeof item.values === 'object' && !Array.isArray(item.values)
            ? (item.values as Record<string, unknown>)
            : {};
        for (const { fieldKey, binding } of pushed) {
          const storage = this.getValuesStorageKeyForFieldMap(boardFieldByKey, fieldKey);
          if (!CustomObjectsService.SAFE_VALUES_KEY.test(storage)) continue;
          if (this.isCellValueEmpty(curVals[storage])) {
            const v = srcVals[binding.sourceFieldKey];
            if (!this.isCellValueEmpty(v)) addOverlay(item.id, storage, v);
          }
        }
      }
    }

    for (const { fieldKey, binding } of lookups) {
      const { dataObjectId, boardMatchFieldKey, dataMatchFieldKey, dataDisplayFieldKey } = binding;
      const dataFields = await ensureDataFieldMap(dataObjectId);
      if (!dataFields) continue;

      const matchStorageBoard = this.getValuesStorageKeyForFieldMap(boardFieldByKey, boardMatchFieldKey);
      const matchStorageData = this.getValuesStorageKeyForFieldMap(dataFields, dataMatchFieldKey);
      const displayStorageData = this.getValuesStorageKeyForFieldMap(dataFields, dataDisplayFieldKey);
      const targetStorage = this.getValuesStorageKeyForFieldMap(boardFieldByKey, fieldKey);

      if (
        !CustomObjectsService.SAFE_VALUES_KEY.test(matchStorageBoard) ||
        !CustomObjectsService.SAFE_VALUES_KEY.test(matchStorageData) ||
        !CustomObjectsService.SAFE_VALUES_KEY.test(displayStorageData) ||
        !CustomObjectsService.SAFE_VALUES_KEY.test(targetStorage)
      ) {
        continue;
      }

      const matchVals = new Set<string>();
      for (const item of items) {
        const curVals =
          item.values && typeof item.values === 'object' && !Array.isArray(item.values)
            ? (item.values as Record<string, unknown>)
            : {};
        const raw = curVals[matchStorageBoard];
        if (this.isCellValueEmpty(raw)) continue;
        matchVals.add(String(raw));
      }
      if (!matchVals.size) {
        for (const item of items) {
          addOverlay(item.id, targetStorage, null);
        }
        continue;
      }
      const rows = await this.recordRepo
        .createQueryBuilder('r')
        .where('r.tenantId = :tenantId', { tenantId })
        .andWhere('r.objectId = :oid', { oid: dataObjectId })
        .andWhere(`r.values->>'${matchStorageData}' IN (:...vals)`, { vals: [...matchVals] })
        .getMany();
      const byMatch = new Map<string, CustomObjectRecord>();
      for (const row of rows) {
        const mv =
          row.values && typeof row.values === 'object' && !Array.isArray(row.values)
            ? (row.values as Record<string, unknown>)[matchStorageData]
            : undefined;
        if (this.isCellValueEmpty(mv)) continue;
        byMatch.set(String(mv), row);
      }
      for (const item of items) {
        const curVals =
          item.values && typeof item.values === 'object' && !Array.isArray(item.values)
            ? (item.values as Record<string, unknown>)
            : {};
        const mk = curVals[matchStorageBoard];
        if (this.isCellValueEmpty(mk)) {
          addOverlay(item.id, targetStorage, null);
          continue;
        }
        const src = byMatch.get(String(mk));
        if (!src?.values || typeof src.values !== 'object') {
          addOverlay(item.id, targetStorage, null);
          continue;
        }
        const dv = (src.values as Record<string, unknown>)[displayStorageData];
        addOverlay(item.id, targetStorage, this.isCellValueEmpty(dv) ? null : dv);
      }
    }

    for (const { fieldKey, binding } of rollups) {
      const { dataObjectId, groupByFieldKey, boardMatchFieldKey, valueFieldKey, aggregate } = binding;
      const dataFields = await ensureDataFieldMap(dataObjectId);
      if (!dataFields) continue;

      const groupStorageData = this.getValuesStorageKeyForFieldMap(dataFields, groupByFieldKey);
      const valueStorageData = this.getValuesStorageKeyForFieldMap(dataFields, valueFieldKey);
      const matchStorageBoard = this.getValuesStorageKeyForFieldMap(boardFieldByKey, boardMatchFieldKey);
      const targetStorage = this.getValuesStorageKeyForFieldMap(boardFieldByKey, fieldKey);

      if (
        !CustomObjectsService.SAFE_VALUES_KEY.test(groupStorageData) ||
        !CustomObjectsService.SAFE_VALUES_KEY.test(valueStorageData) ||
        !CustomObjectsService.SAFE_VALUES_KEY.test(matchStorageBoard) ||
        !CustomObjectsService.SAFE_VALUES_KEY.test(targetStorage)
      ) {
        continue;
      }
      const aggMap = await this.computeRollupByGroupKey(
        tenantId,
        dataObjectId,
        groupStorageData,
        valueStorageData,
        aggregate,
      );
      for (const item of items) {
        const curVals =
          item.values && typeof item.values === 'object' && !Array.isArray(item.values)
            ? (item.values as Record<string, unknown>)
            : {};
        const mk = curVals[matchStorageBoard];
        if (this.isCellValueEmpty(mk)) {
          addOverlay(item.id, targetStorage, null);
          continue;
        }
        const gk = String(mk);
        const v = aggMap.get(gk);
        if (v !== undefined && Number.isFinite(v)) addOverlay(item.id, targetStorage, v);
        else addOverlay(item.id, targetStorage, null);
      }
    }

    if (!Object.keys(overlays).length) return items;

    return items.map((r) => {
      const patch = overlays[r.id];
      if (!patch) return r;
      const base =
        r.values && typeof r.values === 'object' && !Array.isArray(r.values)
          ? { ...(r.values as Record<string, unknown>) }
          : {};
      return {
        ...r,
        values: { ...base, ...patch },
      } as CustomObjectRecord;
    });
  }

  async createRecord(
    tenantId: string,
    objectId: string,
    dto: CreateCustomObjectRecordDto,
    actor?: { loginUserId?: string; email?: string },
  ) {
    await this.getObject(tenantId, objectId);
    const fields = await this.listFields(tenantId, objectId);
    const incoming = dto.values || {};
    await this.ensureSelectOptionsForIncomingPatch(tenantId, objectId, fields, incoming);
    const normalizedValues = this.normalizeRecordValues(
      fields,
      incoming,
      'create',
      undefined,
      tenantId,
    );
    const actorStaffId = await this.resolveActorStaffId(tenantId, actor);
    const created = await this.recordRepo.save(
      this.recordRepo.create({
        tenantId,
        objectId,
        externalId: dto.externalId || null,
        values: normalizedValues,
        meta: dto.meta || null,
        createdByUserId: actorStaffId,
      }),
    );
    await this.triggerRecordEvent(tenantId, objectId, created, 'created');
    return created;
  }

  /**
   * Копирует строки из таблицы данных в основную «Таблицу» (board) той же области.
   */
  async pushRecordsToBoard(
    tenantId: string,
    sourceObjectId: string,
    dto: {
      targetObjectId: string;
      recordIds: string[];
      fieldMap?: Record<string, string>;
      omitAutoTargetKeys?: string[];
      duplicateKeyTargetField?: string | null;
      skipDuplicates?: boolean;
    },
    actor?: { loginUserId?: string; email?: string },
  ): Promise<{
    created: CustomObjectRecord[];
    skipped: Array<{ recordId: string; reason: string }>;
    errors: Array<{ recordId: string; message: string }>;
  }> {
    const targetObjectId = dto.targetObjectId?.trim();
    if (!targetObjectId) {
      throw new BadRequestException('targetObjectId is required');
    }
    if (sourceObjectId === targetObjectId) {
      throw new BadRequestException('Source and target table must differ');
    }
    const ids = (dto.recordIds || []).map((id) => id?.trim()).filter(Boolean);
    if (!ids.length) {
      throw new BadRequestException('At least one record id is required');
    }

    const sourceObj = await this.getObject(tenantId, sourceObjectId);
    const targetObj = await this.getObject(tenantId, targetObjectId);

    if (!sourceObj.workspaceAreaId || sourceObj.workspaceAreaId !== targetObj.workspaceAreaId) {
      throw new BadRequestException('Tables must belong to the same workspace area');
    }

    if (getWorkspaceTableKind(sourceObj.meta as Record<string, any>) === 'board') {
      throw new BadRequestException('Only a data table can be the source');
    }
    if (getWorkspaceTableKind(targetObj.meta as Record<string, any>) !== 'board') {
      throw new BadRequestException('Target must be the main table (board)');
    }

    const dupField = (dto.duplicateKeyTargetField || '').trim();
    if (dupField && !/^[a-zA-Z0-9_]+$/.test(dupField)) {
      throw new BadRequestException('Invalid duplicateKeyTargetField');
    }

    const sourceFields = (await this.listFields(tenantId, sourceObjectId)).filter((f) => f.isActive);
    const targetFields = (await this.listFields(tenantId, targetObjectId)).filter((f) => f.isActive);
    const targetKeys = new Set(targetFields.map((f) => f.key));
    const sourceKeySet = new Set(sourceFields.map((f) => f.key));

    const explicit = dto.fieldMap || {};
    const sourceToTarget = new Map<string, string>();
    for (const [sk, tk] of Object.entries(explicit)) {
      const s = String(sk || '').trim();
      const t = String(tk || '').trim();
      if (s && t && targetKeys.has(t) && sourceKeySet.has(s)) {
        sourceToTarget.set(s, t);
      }
    }
    const omitAuto = new Set(
      (dto.omitAutoTargetKeys || [])
        .map((k) => String(k || '').trim())
        .filter((k) => /^[a-zA-Z0-9_]+$/.test(k) && targetKeys.has(k)),
    );
    for (const tf of targetFields) {
      if (omitAuto.has(tf.key)) continue;
      if ([...sourceToTarget.values()].includes(tf.key)) continue;
      if (sourceKeySet.has(tf.key)) {
        sourceToTarget.set(tf.key, tf.key);
      }
    }

    const skipDup = dto.skipDuplicates !== false;
    const created: CustomObjectRecord[] = [];
    const skipped: Array<{ recordId: string; reason: string }> = [];
    const errors: Array<{ recordId: string; message: string }> = [];

    const baseDefaults = this.defaultValuesForRequiredFields(targetFields);

    for (const recordId of ids) {
      try {
        const srcRec = await this.recordRepo.findOne({
          where: { id: recordId, tenantId, objectId: sourceObjectId },
        });
        if (!srcRec) {
          errors.push({ recordId, message: 'Record not found' });
          continue;
        }
        const srcVals =
          srcRec.values && typeof srcRec.values === 'object' && !Array.isArray(srcRec.values)
            ? (srcRec.values as Record<string, any>)
            : {};

        const incoming: Record<string, any> = { ...baseDefaults };
        for (const [sk, tk] of sourceToTarget.entries()) {
          if (Object.prototype.hasOwnProperty.call(srcVals, sk)) {
            incoming[tk] = srcVals[sk];
          }
        }

        if (dupField && skipDup) {
          const raw = incoming[dupField];
          const cmp = this.serializeValueForDuplicateCheck(raw);
          const existing = await this.findRecordByTargetFieldValue(
            tenantId,
            targetObjectId,
            dupField,
            cmp,
          );
          if (existing) {
            skipped.push({ recordId, reason: 'duplicate' });
            continue;
          }
        }

        const linkMeta = {
          sourceObjectId,
          sourceRecordId: recordId,
          pushedAt: new Date().toISOString(),
        };

        const row = await this.createRecord(
          tenantId,
          targetObjectId,
          {
            values: incoming,
            meta: { [WORKSPACE_DATA_LINK_META_KEY]: linkMeta },
          },
          actor,
        );
        created.push(row);
      } catch (e: any) {
        errors.push({
          recordId,
          message: e?.message || String(e),
        });
      }
    }

    const actorStaffId = await this.resolveActorStaffId(tenantId, actor);
    await this.activityLog.log(
      tenantId,
      targetObj.workspaceAreaId,
      'push',
      `Перенесено ${created.length} строк в «${targetObj.name}»`,
      `Источник: «${sourceObj.name}»${skipped.length ? `, пропущено дублей: ${skipped.length}` : ''}${
        errors.length ? `, ошибок: ${errors.length}` : ''
      }`,
      { relatedObjectId: targetObjectId, actorUserId: actorStaffId },
    );

    return { created, skipped, errors };
  }

  private serializeValueForDuplicateCheck(val: any): string {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  }

  private async findRecordByTargetFieldValue(
    tenantId: string,
    objectId: string,
    fieldKey: string,
    compareVal: string,
  ): Promise<CustomObjectRecord | null> {
    if (!/^[a-zA-Z0-9_]+$/.test(fieldKey)) return null;
    return this.recordRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.objectId = :objectId', { objectId })
      .andWhere(`r.values->>'${fieldKey}' = :val`, { val: compareVal })
      .getOne();
  }

  async updateRecord(
    tenantId: string,
    objectId: string,
    recordId: string,
    dto: UpdateCustomObjectRecordDto,
    actor?: { loginUserId?: string; email?: string },
  ) {
    const obj = await this.getObject(tenantId, objectId);
    const fields = await this.listFields(tenantId, objectId);
    const record = await this.recordRepo.findOne({
      where: { id: recordId, tenantId, objectId },
    });
    if (!record) throw new NotFoundException('Record not found');
    const actorStaffId = await this.resolveActorStaffId(tenantId, actor);
    await this.assertCanWriteRecord(tenantId, obj, record, actorStaffId);
    const previousStatus = record.values?.status;

    const hasPatch =
      dto.externalId !== undefined ||
      dto.values !== undefined ||
      dto.meta !== undefined;
    if (!hasPatch) {
      return record;
    }

    const existingValues =
      record.values &&
      typeof record.values === 'object' &&
      !Array.isArray(record.values)
        ? { ...(record.values as Record<string, any>) }
        : {};

    // Колонка называется "values" (зарезервированное слово в SQL) + jsonb: надёжнее явный SQL с $1::jsonb,
    // чем repository.update/save (у TypeORM бывают сбои с diff jsonb).
    const setParts: string[] = [];
    const sqlParams: any[] = [];
    let p = 1;

    if (dto.values !== undefined) {
      const mergedValues = { ...existingValues, ...(dto.values || {}) };
      for (const field of fields) {
        if (field.type !== 'file') continue;
        const oldV = existingValues[field.key];
        const newV = mergedValues[field.key];
        const oldPath =
          oldV && typeof oldV === 'object' && oldV !== null
            ? String((oldV as { relativePath?: string }).relativePath || '').trim()
            : '';
        const newPath =
          newV && typeof newV === 'object' && newV !== null
            ? String((newV as { relativePath?: string }).relativePath || '').trim()
            : '';
        if (oldPath && oldPath !== newPath) {
          await unlinkUploadsRelative(oldPath).catch(() => {});
        }
      }
      /** Иначе PATCH по одному полю падает: в merged уже есть status из Woo, не попавший в options доски. */
      await this.ensureSelectOptionsForIncomingPatch(tenantId, objectId, fields, mergedValues);
      const normalizedValues = this.normalizeRecordValues(
        fields,
        mergedValues,
        'update',
        undefined,
        tenantId,
      );
      setParts.push(`"values" = $${p}::jsonb`);
      sqlParams.push(JSON.stringify(normalizedValues));
      p += 1;
    }
    if (dto.externalId !== undefined) {
      setParts.push(`"externalId" = $${p}`);
      sqlParams.push(dto.externalId || null);
      p += 1;
    }
    if (dto.meta !== undefined) {
      setParts.push(`"meta" = $${p}::jsonb`);
      sqlParams.push(dto.meta === null ? null : JSON.stringify(dto.meta));
      p += 1;
    }
    setParts.push(`"updatedAt" = NOW()`);

    const idP = p;
    const tenantP = p + 1;
    const objectP = p + 2;
    sqlParams.push(recordId, tenantId, objectId);

    const sql = `
      UPDATE "custom_object_records"
      SET ${setParts.join(', ')}
      WHERE "id" = $${idP} AND "tenantId" = $${tenantP} AND "objectId" = $${objectP}
      RETURNING "id"
    `;

    const updatedRows = await this.recordRepo.manager.query(sql, sqlParams);
    if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
      throw new NotFoundException('Record could not be updated (not found or tenant mismatch)');
    }

    const saved = await this.recordRepo.findOne({
      where: { id: recordId, tenantId, objectId },
    });
    if (!saved) throw new NotFoundException('Record not found');

    await this.triggerRecordEvent(
      tenantId,
      objectId,
      saved,
      'updated',
      previousStatus,
    );
    return saved;
  }

  async deleteRecord(
    tenantId: string,
    objectId: string,
    recordId: string,
    actor?: { loginUserId?: string; email?: string },
  ) {
    const obj = await this.getObject(tenantId, objectId);
    const fields = await this.listFields(tenantId, objectId);
    const record = await this.recordRepo.findOne({
      where: { id: recordId, tenantId, objectId },
    });
    if (!record) throw new NotFoundException('Record not found');
    const actorStaffId = await this.resolveActorStaffId(tenantId, actor);
    await this.assertCanWriteRecord(tenantId, obj, record, actorStaffId);
    for (const f of fields) {
      if (f.type !== 'file') continue;
      const v = record.values?.[f.key];
      const p =
        v && typeof v === 'object' && v !== null
          ? String((v as { relativePath?: string }).relativePath || '').trim()
          : '';
      if (p) {
        await unlinkUploadsRelative(p).catch(() => {});
      }
    }
    await this.recordRepo.remove(record);
    return { ok: true };
  }

  /** Уникальные непустые строковые значения поля (выпадающий список ID заказов и т.д.). */
  async listDistinctFieldValues(tenantId: string, objectId: string, fieldKey: string) {
    await this.getObject(tenantId, objectId);
    const fk = fieldKey.trim();
    if (!fk) {
      throw new BadRequestException('fieldKey is required');
    }
    if (!CustomObjectsService.SAFE_VALUES_KEY.test(fk)) {
      throw new BadRequestException('Invalid fieldKey');
    }
    const esc = fk.replace(/'/g, "''");
    const rows: Array<{ v: string }> = await this.recordRepo.query(
      `SELECT DISTINCT COALESCE(NULLIF(TRIM(r."values"->>'${esc}'), ''), '') AS v
       FROM custom_object_records r
       WHERE r."tenantId" = $1 AND r."objectId" = $2::uuid
       AND NULLIF(TRIM(r."values"->>'${esc}'), '') IS NOT NULL
       ORDER BY v ASC
       LIMIT 5000`,
      [tenantId, objectId],
    );
    return { values: rows.map((r) => r.v).filter((x) => x && String(x).trim()) };
  }

  /** Удалить все строки объекта (очистка таблицы). Вложенные файлы в storage не чистятся пакетно. */
  async deleteAllRecordsForObject(tenantId: string, objectId: string) {
    await this.getObject(tenantId, objectId);
    const res = await this.recordRepo.delete({ tenantId, objectId });
    return { ok: true, deleted: res.affected ?? 0 };
  }

  /**
   * Injects crmLeadId into the patch if any field on the object carries
   * meta.workspaceEntityRef === 'lead'. Skips if crmLeadId is blank or already set.
   */
  private injectCrmLeadIntoWooPatch(
    fields: CustomObjectField[],
    patch: Record<string, any>,
    crmLeadId?: string | null,
  ): void {
    if (!crmLeadId) return;
    const leadRefField = fields.find(
      (f) =>
        f.type === 'text' &&
        typeof f.meta === 'object' &&
        f.meta !== null &&
        (f.meta as Record<string, unknown>)['workspaceEntityRef'] === 'lead',
    );
    if (!leadRefField) return;
    // Only write if not already set (don't overwrite a manually selected lead)
    if (!patch[leadRefField.key]) {
      patch[leadRefField.key] = crmLeadId;
    }
  }

  /**
   * Синхронизация WooCommerce → строка пользовательской таблицы (по externalId = id заказа).
   * Поля заполняются эвристикой по key/label; при конфликте типов строка может быть пропущена.
   */
  async upsertRecordFromWooOrder(
    tenantId: string,
    objectId: string,
    order: Record<string, any>,
    crmLeadId?: string | null,
  ): Promise<'created' | 'updated' | 'skipped'> {
    const oid =
      order?.id !== undefined && order?.id !== null ? String(order.id) : '';
    if (!oid) return 'skipped';

    try {
      const fields = (await this.listFields(tenantId, objectId)).filter(
        (f) => f.isActive,
      );
      const patch = this.buildWooDerivedValuesForFields(fields, order);
      this.injectCrmLeadIntoWooPatch(fields, patch, crmLeadId);

      const allMatching = await this.recordRepo.find({
        where: { tenantId, objectId, externalId: oid },
        order: { updatedAt: 'DESC' },
      });

      // Удаляем дубли, оставляем только самую свежую запись
      if (allMatching.length > 1) {
        const dupIds = allMatching.slice(1).map((r) => r.id);
        await this.recordRepo.delete(dupIds);
        this.logger.warn(
          `upsertRecordFromWooOrder: removed ${dupIds.length} duplicate(s) for externalId=${oid} objectId=${objectId}`,
        );
      }

      const existing = allMatching[0] ?? null;

      if (existing) {
        const prev =
          existing.values &&
          typeof existing.values === 'object' &&
          !Array.isArray(existing.values)
            ? { ...(existing.values as Record<string, any>) }
            : {};
        const merged = { ...prev, ...patch };
        await this.updateRecord(tenantId, objectId, existing.id, {
          values: merged,
          externalId: oid,
        });
        return 'updated';
      }

      const base = this.defaultValuesForRequiredFields(fields);
      const mergedCreate = { ...base, ...patch };
      await this.createRecord(tenantId, objectId, {
        externalId: oid,
        values: mergedCreate,
      });
      return 'created';
    } catch (e) {
      this.logger.warn(
        `upsertRecordFromWooOrder skipped objectId=${objectId} order=${String(
          order?.id,
        )}: ${(e as Error).message}`,
      );
      return 'skipped';
    }
  }

  /**
   * Woo → таблица по явному маппингу колонок (после превью на фронте).
   */
  async upsertRecordFromWooMapped(
    tenantId: string,
    objectId: string,
    flat: Record<string, string>,
    cfg: {
      enabledWooColumns: string[];
      wooColumnToFieldKey: Record<string, string>;
      statusFieldKey?: string | null;
    },
    crmLeadId?: string | null,
  ): Promise<'created' | 'updated' | 'skipped'> {
    const oid = (flat.id ?? '').trim();
    if (!oid) return 'skipped';

    const enabled = new Set(
      cfg.enabledWooColumns.filter((c) => typeof c === 'string' && c.trim()),
    );
    try {
      const fields = (await this.listFields(tenantId, objectId)).filter(
        (f) => f.isActive,
      );
      const byKey = new Map(fields.map((f) => [f.key, f]));

      const rawValues: Record<string, any> = {};
      const enabledList = [...enabled].sort(
        (a, b) =>
          wooImportColumnApplicationRank(a) - wooImportColumnApplicationRank(b),
      );
      for (const wooCol of enabledList) {
        const fieldKey = (cfg.wooColumnToFieldKey[wooCol] || '').trim();
        if (!fieldKey) continue;
        const f = byKey.get(fieldKey);
        if (!f) continue;
        const cell = flat[wooCol];
        if (cell === undefined || String(cell).trim() === '') {
          // Не кладём null: иначе при create затрём placeholder из defaultValuesForRequiredFields
          // (типичный случай: обязательное «name» сопоставлено с пустой колонкой Woo).
          continue;
        }
        rawValues[fieldKey] = cell;
      }
      this.injectCrmLeadIntoWooPatch(fields, rawValues, crmLeadId);

      if (cfg.statusFieldKey?.trim()) {
        const sk = cfg.statusFieldKey.trim();
        if (!byKey.has(sk)) {
          this.logger.warn(
            `upsertRecordFromWooMapped: statusFieldKey ${sk} not found on object`,
          );
        }
      }

      const allMatching = await this.recordRepo.find({
        where: { tenantId, objectId, externalId: oid },
        order: { updatedAt: 'DESC' },
      });

      // Удаляем дубли, оставляем только самую свежую запись
      if (allMatching.length > 1) {
        const dupIds = allMatching.slice(1).map((r) => r.id);
        await this.recordRepo.delete(dupIds);
        this.logger.warn(
          `upsertRecordFromWooMapped: removed ${dupIds.length} duplicate(s) for externalId=${oid} objectId=${objectId}`,
        );
      }

      const existing = allMatching[0] ?? null;

      if (existing) {
        const prev =
          existing.values &&
          typeof existing.values === 'object' &&
          !Array.isArray(existing.values)
            ? { ...(existing.values as Record<string, any>) }
            : {};
        const merged = { ...prev, ...rawValues };
        await this.updateRecord(tenantId, objectId, existing.id, {
          values: merged,
          externalId: oid,
        });
        return 'updated';
      }

      const base = this.defaultValuesForRequiredFields(fields);
      const mergedCreate = { ...base, ...rawValues };
      await this.createRecord(tenantId, objectId, {
        externalId: oid,
        values: mergedCreate,
      });
      return 'created';
    } catch (e) {
      this.logger.warn(
        `upsertRecordFromWooMapped skipped objectId=${objectId} order=${oid}: ${
          (e as Error).message
        }`,
      );
      return 'skipped';
    }
  }

  private defaultValuesForRequiredFields(
    fields: CustomObjectField[],
  ): Record<string, any> {
    const out: Record<string, any> = {};
    for (const f of fields) {
      if (!f.required) continue;
      const t = f.type as CustomObjectFieldType;
      if (t === 'text') out[f.key] = '—';
      else if (t === 'number') out[f.key] = 0;
      else if (t === 'boolean') out[f.key] = false;
      else if (t === 'date')
        out[f.key] = new Date().toISOString().slice(0, 10);
      else if (t === 'datetime') out[f.key] = new Date().toISOString();
      else if (t === 'select' || t === 'status') {
        const first = f.options?.[0]?.value;
        if (first != null) out[f.key] = String(first);
      } else if (t === 'multiselect') {
        const first = f.options?.[0]?.value;
        out[f.key] = first != null ? [String(first)] : [];
      }
    }
    return out;
  }

  private buildWooDerivedValuesForFields(
    fields: CustomObjectField[],
    order: Record<string, any>,
  ): Record<string, any> {
    const billing = order.billing || {};
    const shipping = order.shipping || {};
    const fullName = `${billing.first_name || ''} ${billing.last_name || ''}`
      .trim()
      .replace(/\s+/g, ' ');
    const email =
      billing.email != null ? String(billing.email).trim() : '';
    const lineItems = Array.isArray(order.line_items) ? order.line_items : [];
    const firstLine = lineItems[0] as Record<string, any> | undefined;
    const productName = firstLine?.name ? String(firstLine.name) : '';
    const productUrl = firstLine?.permalink ? String(firstLine.permalink) : '';
    const orderNum = order.number != null ? String(order.number) : '';
    const titleStr =
      productName ||
      (orderNum ? `Order #${orderNum}` : `Woo #${order.id}`);
    const safeAmount = wooOrderTotalNumber(order);
    const wooStatus = order.status != null ? String(order.status) : '';
    const saleDateStr = order.date_created_gmt || order.date_created || null;
    const currency = order.currency != null ? String(order.currency) : '';
    const noteParts = [order.customer_note, productUrl].filter(Boolean);
    const notesJoined = noteParts.map(String).join('\n').trim() || null;

    const out: Record<string, any> = {};

    for (const f of fields) {
      const k = f.key.toLowerCase();
      const lab = (f.label || '').toLowerCase();
      const hay = `${k} ${lab}`;

      if (f.type === 'number') {
        if (
          k === 'id' ||
          k === 'order_id' ||
          (k.includes('order') &&
            (k.includes('id') || k.includes('no')) &&
            !k.includes('product'))
        ) {
          const oid = Number(order.id);
          if (order.id != null && Number.isFinite(oid)) {
            out[f.key] = oid;
          }
        } else if (
          k.includes('amount') ||
          k.includes('total') ||
          k.includes('sum') ||
          k.includes('price') ||
          lab.includes('сумм')
        ) {
          out[f.key] = safeAmount;
        }
        continue;
      }

      if (f.type === 'boolean') {
        if (k.includes('paid') || lab.includes('оплачен')) {
          out[f.key] = ['completed', 'processing'].includes(
            String(order.status || '').toLowerCase(),
          );
        }
        continue;
      }

      if (f.type === 'text') {
        if (
          k.includes('title') ||
          k === 'name' ||
          (k.includes('subject') && !k.includes('first')) ||
          lab.includes('назван')
        ) {
          out[f.key] = titleStr;
        } else if (
          k.includes('client') ||
          k.includes('customer') ||
          k.includes('guest') ||
          lab.includes('клиент')
        ) {
          out[f.key] = fullName || null;
        } else if (k.includes('email') || lab.includes('почт') || lab.includes('email')) {
          out[f.key] = email || null;
        } else if (k.includes('currency') || lab.includes('валют')) {
          out[f.key] = currency || null;
        } else if (
          k.includes('note') ||
          k.includes('comment') ||
          k.includes('link') ||
          lab.includes('коммент') ||
          lab.includes('ссылк')
        ) {
          out[f.key] = notesJoined;
        } else if (
          (k.includes('order') && (k.includes('id') || k.includes('no'))) ||
          k === 'woo_order_id' ||
          k.includes('external')
        ) {
          out[f.key] = orderNum || String(order.id);
        }
        continue;
      }

      if (f.type === 'date' || f.type === 'datetime') {
        if (
          hay.includes('date') ||
          hay.includes('дат') ||
          hay.includes('created') ||
          hay.includes('врем')
        ) {
          out[f.key] = saleDateStr;
        }
        continue;
      }

      if (f.type === 'select' || f.type === 'status' || f.type === 'multiselect') {
        if (
          k.includes('status') ||
          k.includes('state') ||
          lab.includes('статус') ||
          lab.includes('состоян')
        ) {
          out[f.key] = wooStatus;
        }
        continue;
      }
    }

    return out;
  }

  private async triggerRecordEvent(
    tenantId: string,
    objectId: string,
    record: CustomObjectRecord,
    kind: 'created' | 'updated',
    previousStatus?: any,
  ) {
    try {
      await this.automationsService.triggerAutomation(
        tenantId,
        kind === 'created'
          ? TriggerEvent.CUSTOM_OBJECT_RECORD_CREATED
          : TriggerEvent.CUSTOM_OBJECT_RECORD_UPDATED,
        {
          entityType: 'custom_object',
          objectId,
          recordId: record.id,
          record,
        },
      );
      const nextStatus = record.values?.status;
      if (kind === 'updated' && previousStatus !== nextStatus) {
        await this.automationsService.triggerAutomation(
          tenantId,
          TriggerEvent.CUSTOM_OBJECT_STATUS_CHANGED,
          {
            entityType: 'custom_object',
            objectId,
            recordId: record.id,
            previousStatus,
            nextStatus,
            record,
          },
        );
      }
    } catch (e) {
      console.error('Failed to trigger custom object automation:', e);
    }
  }

  async getAnalytics(tenantId: string, objectId: string) {
    await this.getObject(tenantId, objectId);
    const records = await this.recordRepo.find({
      where: { tenantId, objectId },
      order: { createdAt: 'ASC' },
    });
    const totalRecords = records.length;
    // Раньше ключ поля "статус" был захардкожен как буквально "status" — ничто в
    // создании таблиц не гарантирует такой key (поле типа status/select может называться
    // как угодно, напр. "stage"), из-за чего отчёт молча показывал только "without_status".
    // Ищем реальное status-поле по типу, а не по имени; select — как более слабый фолбэк.
    const fields = await this.fieldRepo.find({ where: { tenantId, objectId } });
    const statusField =
      fields.find((f) => f.type === 'status') ?? fields.find((f) => f.type === 'select');
    const statusKey = statusField?.key || 'status';
    const byStatus = records.reduce<Record<string, number>>((acc, rec) => {
      const key = String(rec.values?.[statusKey] || 'without_status');
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const byDay = records.reduce<Record<string, number>>((acc, rec) => {
      const key = rec.createdAt.toISOString().slice(0, 10);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return {
      totalRecords,
      byStatus,
      byDay,
    };
  }

  private parseCsv(content: string) {
    const t = parseCsvRobust(content);
    return {
      columns: t.columns,
      rows: t.rows as Array<Record<string, any>>,
      headerRowNumber: t.headerRowNumber,
    };
  }

  /** Делегирует в общий парсер `parseXlsxRobust` (переиспользуется модулем `products`). */
  private async parseXlsx(buffer: Buffer) {
    return parseXlsxRobust(buffer);
  }

  private uniqueValuesByColumn(
    columns: string[],
    rows: Array<Record<string, any>>,
    maxPerColumn = 800,
  ): Record<string, string[]> {
    const sets: Record<string, Set<string>> = {};
    for (const c of columns) {
      sets[c] = new Set();
    }
    for (const row of rows) {
      for (const col of columns) {
        const s = String(row[col] ?? '').trim();
        if (!s) continue;
        const set = sets[col];
        if (set.size >= maxPerColumn) continue;
        set.add(s);
      }
    }
    const out: Record<string, string[]> = {};
    for (const col of columns) {
      out[col] = Array.from(sets[col]).sort((a, b) => a.localeCompare(b));
    }
    return out;
  }

  private buildSuggestedMapping(columns: string[], fields: CustomObjectField[]) {
    return buildSuggestedCustomObjectFieldMapping(columns, fields);
  }

  async previewImport(tenantId: string, objectId: string, file: any): Promise<ImportPreviewResponse> {
    await this.getObject(tenantId, objectId);
    if (!file) throw new BadRequestException('File is required');
    const filename = (file.originalname || '').toLowerCase();
    let parsed: { columns: string[]; rows: Array<Record<string, any>>; headerRowNumber: number };
    if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      parsed = await this.parseXlsx(file.buffer);
    } else {
      parsed = this.parseCsv(file.buffer.toString('utf-8'));
    }
    if (!parsed.columns.length) throw new BadRequestException('No columns detected');
    const fields = await this.listFields(tenantId, objectId);
    const suggestedMapping = this.buildSuggestedMapping(parsed.columns, fields);
    const uniqueValuesByColumn = this.uniqueValuesByColumn(
      parsed.columns,
      parsed.rows,
    );
    const session = await this.importRepo.save(
      this.importRepo.create({
        tenantId,
        objectId,
        originalFileName: file.originalname || null,
        columns: parsed.columns,
        rows: parsed.rows,
        sample: parsed.rows.slice(0, 20),
        totalRows: parsed.rows.length,
        suggestedMapping,
        status: 'preview',
      }),
    );
    return {
      importId: session.id,
      columns: session.columns,
      sample: session.sample,
      totalRows: session.totalRows,
      suggestedMapping: session.suggestedMapping || {},
      headerRowNumber: parsed.headerRowNumber,
      uniqueValuesByColumn,
    };
  }

  /**
   * Same parsing as {@link previewImport}, but with no target table yet — used by the AI
   * chat when a spreadsheet is attached before the user (or the model) has decided which
   * workspace table it should become. Call {@link attachImportAndApply} once a table exists.
   */
  async previewHeadlessImport(
    tenantId: string,
    file: any,
  ): Promise<{
    importId: string;
    columns: string[];
    sample: Array<Record<string, any>>;
    totalRows: number;
  }> {
    if (!file) throw new BadRequestException('Нужен файл');
    const filename = (file.originalname || '').toLowerCase();
    let parsed: { columns: string[]; rows: Array<Record<string, any>>; headerRowNumber: number };
    if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      parsed = await this.parseXlsx(file.buffer);
    } else {
      parsed = this.parseCsv(file.buffer.toString('utf-8'));
    }
    if (!parsed.columns.length) {
      throw new BadRequestException('Не удалось найти колонки — проверьте, что в первой строке есть заголовки.');
    }
    const session = await this.importRepo.save(
      this.importRepo.create({
        tenantId,
        objectId: null,
        originalFileName: file.originalname || null,
        columns: parsed.columns,
        rows: parsed.rows,
        sample: parsed.rows.slice(0, 20),
        totalRows: parsed.rows.length,
        suggestedMapping: null,
        status: 'preview',
      }),
    );
    return {
      importId: session.id,
      columns: session.columns,
      sample: session.sample,
      totalRows: session.totalRows,
    };
  }

  /**
   * Adopts a headless (table-less) import session into a specific table and imports every
   * row into it — the bridge the AI chat's `crm_workspace_import_file` tool calls after the
   * model has created (or picked) the target table via `crm_workspace_create_table`.
   *
   * Re-callable for the same (importId, objectId) pair — e.g. once with an auto-guessed
   * mapping, then again with an explicit `fieldMapping` if the model sees unmatched columns
   * in the first result and wants to correct it. Only rejects if the session is headless-gone
   * (already attached to a *different* table).
   */
  async attachImportAndApply(
    tenantId: string,
    importId: string,
    objectId: string,
    fieldMapping?: Record<string, string | null>,
    defaultValues?: Record<string, any>,
  ) {
    await this.getObject(tenantId, objectId);
    const session = await this.importRepo.findOne({ where: { id: importId, tenantId } });
    if (!session || (session.objectId && session.objectId !== objectId)) {
      throw new NotFoundException('Import session not found, or it is already attached to a different table');
    }
    const fields = await this.listFields(tenantId, objectId);
    let mapping = fieldMapping && Object.keys(fieldMapping).length ? fieldMapping : undefined;
    if (!mapping) {
      mapping = this.buildSuggestedMapping(session.columns, fields);
    }
    const mappedColumns = new Set(Object.values(mapping).filter((v): v is string => Boolean(v)));
    const unmatchedColumns = session.columns.filter((c) => !mappedColumns.has(c));
    if (session.objectId !== objectId) {
      session.objectId = objectId;
      await this.importRepo.save(session);
    }
    const result = await this.applyImport(tenantId, objectId, { importId, fieldMapping: mapping, defaultValues });
    return { ...result, fieldMapping: mapping, unmatchedColumns };
  }

  async applyImport(tenantId: string, objectId: string, payload: ImportApplyPayload) {
    const obj = await this.getObject(tenantId, objectId);
    const fields = await this.listFields(tenantId, objectId);
    const session = await this.importRepo.findOne({
      where: { id: payload.importId, tenantId, objectId },
    });
    if (!session) throw new NotFoundException('Import session not found');
    const rows = session.rows || [];
    const mapping = payload.fieldMapping || {};
    const defaultValues = payload.defaultValues || {};
    await this.extendImportFieldOptions(fields, rows, mapping, defaultValues);
    await this.replaceStatusFieldOptionsFromImport(fields, rows, mapping);
    const fieldsForRows = await this.listFields(tenantId, objectId);
    let created = 0;
    let updated = 0;
    let skipped = 0;
    /** Строки без данных в сопоставленных колонках (и без externalId / defaultValues) — не попадают в errors. */
    let skippedEmptyRows = 0;
    const errors: Array<{ row: number; reason: string }> = [];
    const updatedRecordIds = new Set<string>();
    for (let i = 0; i < rows.length; i++) {
      const source = rows[i];
      const values: Record<string, any> = {};
      let hasMappedRowData = false;
      Object.entries(mapping).forEach(([fieldKey, col]) => {
        if (!col) return;
        const raw = source[col];
        values[fieldKey] = raw;
        if (this.hasMeaningfulValue(raw)) hasMappedRowData = true;
      });
      const mergedImportValues = { ...values, ...defaultValues };
      const extField = payload.externalIdField || 'externalId';
      const externalId =
        (mergedImportValues[extField] as string | undefined) ||
        (source.externalId as string | undefined) ||
        null;
      const hasDefaultData = Object.values(defaultValues).some((value) =>
        this.hasMeaningfulValue(value),
      );
      const hasExternalId = this.hasMeaningfulValue(externalId);
      // Пустые строки: нет значений в сопоставленных колонках, нет externalId и нет defaultValues.
      if (!hasMappedRowData && !hasDefaultData && !hasExternalId) {
        skipped += 1;
        skippedEmptyRows += 1;
        continue;
      }
      try {
        if (externalId) {
          const exists = await this.recordRepo.findOne({
            where: { tenantId, objectId, externalId },
          });
          if (exists) {
            exists.values = this.normalizeRecordValues(
              fieldsForRows,
              { ...(exists.values || {}), ...mergedImportValues },
              'update',
              Object.keys(mergedImportValues),
              tenantId,
            );
            await this.recordRepo.save(exists);
            if (!updatedRecordIds.has(exists.id)) {
              updatedRecordIds.add(exists.id);
              updated += 1;
            }
            await this.triggerRecordEvent(tenantId, objectId, exists, 'updated');
            continue;
          }
        }
        const normalizedValues = this.normalizeRecordValues(
          fieldsForRows,
          mergedImportValues,
          'create',
          undefined,
          tenantId,
        );
        const createdRec = await this.recordRepo.save(
          this.recordRepo.create({
            tenantId,
            objectId,
            externalId,
            values: normalizedValues,
            meta: { importId: session.id, rowIndex: i },
          }),
        );
        created += 1;
        await this.triggerRecordEvent(tenantId, objectId, createdRec, 'created');
      } catch (e: any) {
        skipped += 1;
        errors.push({ row: i + 1, reason: e?.message || 'Failed to import row' });
      }
    }
    session.status = errors.length ? 'failed' : 'applied';
    session.meta = {
      ...(session.meta || {}),
      created,
      updated,
      skipped,
      skippedEmptyRows,
      skippedValidationFailed: errors.length,
      errors: errors.slice(0, 200),
    };
    await this.importRepo.save(session);
    await this.activityLog.log(
      tenantId,
      obj.workspaceAreaId,
      'import',
      `Импорт «${session.originalFileName}»`,
      `Создано: ${created}, обновлено: ${updated}, пропущено: ${skipped}${errors.length ? `, ошибок: ${errors.length}` : ''}`,
      { relatedObjectId: objectId },
    );
    return {
      ok: true,
      created,
      updated,
      skipped,
      skippedEmptyRows,
      skippedValidationFailed: errors.length,
      errors: errors.slice(0, 200),
    };
  }

  async ingestRecords(
    tenantId: string,
    slug: string,
    body: any,
    idempotencyKey?: string,
  ) {
    const object = await this.objectRepo.findOne({
      where: { tenantId, slug },
    });
    if (!object) throw new NotFoundException('Custom object not found');
    const fields = await this.listFields(tenantId, object.id);
    const items = Array.isArray(body?.records)
      ? body.records
      : Array.isArray(body)
        ? body
        : [body];
    let created = 0;
    let updated = 0;
    for (const item of items) {
      const values = item?.values && typeof item.values === 'object' ? item.values : item;
      const externalId = item?.externalId || values?.externalId || null;
      if (externalId) {
        const existing = await this.recordRepo.findOne({
          where: { tenantId, objectId: object.id, externalId },
        });
        if (existing) {
          existing.values = this.normalizeRecordValues(
            fields,
            { ...(existing.values || {}), ...values },
            'update',
            Object.keys(values),
            tenantId,
          );
          existing.meta = {
            ...(existing.meta || {}),
            idempotencyKey: idempotencyKey || null,
            source: 'push_api',
          };
          const saved = await this.recordRepo.save(existing);
          updated += 1;
          await this.triggerRecordEvent(tenantId, object.id, saved, 'updated');
          continue;
        }
      }
      const normalizedValues = this.normalizeRecordValues(
        fields,
        values,
        'create',
        undefined,
        tenantId,
      );
      const createdRec = await this.recordRepo.save(
        this.recordRepo.create({
          tenantId,
          objectId: object.id,
          externalId,
          values: normalizedValues,
          meta: { source: 'push_api', idempotencyKey: idempotencyKey || null },
        }),
      );
      created += 1;
      await this.triggerRecordEvent(tenantId, object.id, createdRec, 'created');
    }
    return { ok: true, created, updated };
  }
}

