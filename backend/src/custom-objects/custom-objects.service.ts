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
import { Repository } from 'typeorm';
import { mkdir, writeFile } from 'fs/promises';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import ExcelJS from 'exceljs';
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
import type { CustomObjectFieldType } from './custom-object-field.entity';

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
  ) {}

  private slugify(input: string) {
    return String(input || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 180) || 'table';
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
    return this.slugify(source).replace(/-/g, '_');
  }

  /** Как `normalizeOptionValue` на Kanban (frontend) — иначе «confirmed» и опция «Confirmed» не сходятся с `optionToken`. */
  private normalizeKanbanToken(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_а-яё-]/gi, '');
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

    const lower = source.toLowerCase();
    const caseInsensitive = options.find(
      (opt) =>
        String(opt.value).toLowerCase() === lower ||
        String(opt.label).toLowerCase() === lower,
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
      let nextValue = this.optionToken(source);
      if (!nextValue) {
        nextValue =
          source
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_а-яё-]/gi, '') || source;
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
      let value = this.optionToken(labelRaw);
      if (!value) {
        value =
          labelRaw
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_а-яё-]/gi, '') || 'status';
      }
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
      const value =
        typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
      if (Number.isNaN(value)) {
        throw new BadRequestException(`Field "${field.key}" expects number`);
      }
      return value;
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

  private normalizeRecordValues(
    fields: CustomObjectField[],
    rawValues: Record<string, any>,
    mode: 'create' | 'update',
    changedKeys?: string[],
    tenantId?: string,
  ) {
    const normalized: Record<string, any> = {};
    const byKey = new Map(fields.map((f) => [f.key, f]));
    Object.entries(rawValues || {}).forEach(([key, value]) => {
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

  async listObjects(tenantId: string) {
    return this.objectRepo.find({
      where: { tenantId },
      order: { updatedAt: 'DESC' },
    });
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
    await this.getObject(tenantId, objectId);
    const field = await this.fieldRepo.findOne({
      where: { id: fieldId, tenantId, objectId },
    });
    if (!field) throw new NotFoundException('Field not found');
    if (dto.key !== undefined) field.key = this.slugify(dto.key).replace(/-/g, '_');
    if (dto.label !== undefined) field.label = dto.label;
    if (dto.type !== undefined) field.type = dto.type;
    if (dto.required !== undefined) field.required = dto.required;
    if (dto.options !== undefined) field.options = dto.options || null;
    if (dto.order !== undefined) field.order = dto.order;
    if (dto.isActive !== undefined) field.isActive = dto.isActive;
    if (dto.meta !== undefined) field.meta = dto.meta || null;
    return this.fieldRepo.save(field);
  }

  async deleteField(tenantId: string, objectId: string, fieldId: string) {
    await this.getObject(tenantId, objectId);
    const field = await this.fieldRepo.findOne({
      where: { id: fieldId, tenantId, objectId },
    });
    if (!field) throw new NotFoundException('Field not found');
    await this.fieldRepo.remove(field);
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
      const sortExpr =
        options.sortBy === 'createdAt' || options.sortBy === 'updatedAt'
          ? `record.${options.sortBy}`
          : `record.values ->> '${options.sortBy}'`;
      qb.orderBy(sortExpr, options.sortOrder || 'DESC');
    } else {
      qb.orderBy('record.updatedAt', 'DESC');
    }
    qb.limit(options?.limit || 50);
    qb.offset(options?.offset || 0);
    const items = await qb.getMany();
    return { items, total };
  }

  async createRecord(
    tenantId: string,
    objectId: string,
    dto: CreateCustomObjectRecordDto,
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
    const created = await this.recordRepo.save(
      this.recordRepo.create({
        tenantId,
        objectId,
        externalId: dto.externalId || null,
        values: normalizedValues,
        meta: dto.meta || null,
      }),
    );
    await this.triggerRecordEvent(tenantId, objectId, created, 'created');
    return created;
  }

  async updateRecord(
    tenantId: string,
    objectId: string,
    recordId: string,
    dto: UpdateCustomObjectRecordDto,
  ) {
    await this.getObject(tenantId, objectId);
    const fields = await this.listFields(tenantId, objectId);
    const record = await this.recordRepo.findOne({
      where: { id: recordId, tenantId, objectId },
    });
    if (!record) throw new NotFoundException('Record not found');
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
      await this.ensureSelectOptionsForIncomingPatch(
        tenantId,
        objectId,
        fields,
        dto.values || {},
      );
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

  async deleteRecord(tenantId: string, objectId: string, recordId: string) {
    await this.getObject(tenantId, objectId);
    const fields = await this.listFields(tenantId, objectId);
    const record = await this.recordRepo.findOne({
      where: { id: recordId, tenantId, objectId },
    });
    if (!record) throw new NotFoundException('Record not found');
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
    const byStatus = records.reduce<Record<string, number>>((acc, rec) => {
      const key = String(rec.values?.status || 'without_status');
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
    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (!lines.length)
      return { columns: [] as string[], rows: [] as Array<Record<string, any>>, headerRowNumber: 1 };
    const header = lines[0];
    const comma = (header.match(/,/g) || []).length;
    const semi = (header.match(/;/g) || []).length;
    const delimiter = semi > comma ? ';' : ',';
    const split = (line: string) =>
      line.split(delimiter).map((cell) => cell.replace(/^"|"$/g, '').trim());
    const columns = split(header);
    const rows: Array<Record<string, any>> = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = split(lines[i]);
      const row: Record<string, any> = {};
      columns.forEach((col, idx) => {
        row[col] = cells[idx] ?? '';
      });
      rows.push(row);
    }
    return { columns, rows, headerRowNumber: 1 };
  }

  private excelCellToString(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value).trim();
    }
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') {
      if (typeof value.text === 'string') return value.text.trim();
      if (typeof value.result === 'string' || typeof value.result === 'number') {
        return String(value.result).trim();
      }
      if (Array.isArray(value.richText)) {
        return value.richText.map((chunk: any) => String(chunk?.text || '')).join('').trim();
      }
    }
    return String(value).trim();
  }

  private async parseXlsx(buffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet)
      return { columns: [] as string[], rows: [] as Array<Record<string, any>>, headerRowNumber: 1 };
    let headerRowNumber = 1;
    let columns: string[] = [];

    for (let rowNum = 1; rowNum <= Math.min(sheet.rowCount, 50); rowNum++) {
      const row = sheet.getRow(rowNum);
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      const candidate = values
        .map((v: any) => this.excelCellToString(v))
        .filter(Boolean);
      if (candidate.length > 0) {
        headerRowNumber = rowNum;
        columns = candidate;
        break;
      }
    }

    if (!columns.length) {
      return { columns: [] as string[], rows: [] as Array<Record<string, any>>, headerRowNumber: 1 };
    }

    const rows: Array<Record<string, any>> = [];
    for (let rowNum = headerRowNumber + 1; rowNum <= sheet.rowCount; rowNum++) {
      const row = sheet.getRow(rowNum);
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      const obj: Record<string, any> = {};
      columns.forEach((col, idx) => {
        obj[col] = this.excelCellToString(values[idx]);
      });
      const hasData = Object.values(obj).some((v) => String(v ?? '').trim() !== '');
      if (hasData) rows.push(obj);
    }
    return { columns, rows, headerRowNumber };
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
    const map: Record<string, string | null> = {};
    const cols = columns.map((c) => ({ raw: c, norm: c.toLowerCase().trim() }));
    fields.forEach((field) => {
      const keyNorm = field.key.toLowerCase().trim();
      const labelNorm = field.label.toLowerCase().trim();
      const exact = cols.find((c) => c.norm === keyNorm || c.norm === labelNorm);
      const partial =
        exact ||
        cols.find((c) => c.norm.includes(keyNorm) || c.norm.includes(labelNorm));
      map[field.key] = partial ? partial.raw : null;
    });
    return map;
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

  async applyImport(tenantId: string, objectId: string, payload: ImportApplyPayload) {
    await this.getObject(tenantId, objectId);
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
      // Quietly skip blank spreadsheet lines instead of returning noisy required-field errors.
      if (!hasMappedRowData && !hasDefaultData && !hasExternalId) {
        skipped += 1;
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
      errors: errors.slice(0, 200),
    };
    await this.importRepo.save(session);
    return { ok: true, created, updated, skipped, errors: errors.slice(0, 200) };
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

