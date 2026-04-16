import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IntegrationConnection } from '../integration-connection.entity';
import {
  IntegrationGoogleSheetSyncState,
  type GoogleSheetSyncTargetKind,
} from './integration-google-sheet-sync-state.entity';
import { IntegrationGoogleSheetSyncJob } from './integration-google-sheet-sync-job.entity';
import { GoogleSheetsTokenService } from './google-sheets-token.service';
import { GoogleSheetsHttpService } from './google-sheets-http.service';
import { LeadsService } from '../../leads/leads.service';
import { CustomObjectsService } from '../../custom-objects/custom-objects.service';
import { Lead } from '../../leads/lead.entity';
import { CustomObjectRecord } from '../../custom-objects/custom-object-record.entity';
import { CustomObjectField } from '../../custom-objects/custom-object-field.entity';
import type { CreateLeadDto } from '../../leads/dto/create-lead.dto';
import type { UpdateLeadDto } from '../../leads/dto/update-lead.dto';
import type { GoogleSheetsPreviewDto } from '../dto/google-sheets-preview.dto';

export type SheetConnectionCfg = {
  catalogId?: string;
  spreadsheetId?: string;
  sheetTabName?: string;
  apiToken?: string;
  sync?: {
    targetKind?: 'leads' | 'workspace' | 'projects' | 'sales';
    workspaceObjectId?: string;
    columnMap?: Record<string, string>;
    headerRow?: number;
    /** Первая строка данных (1-based), не ниже headerRow+1; по умолчанию headerRow+1. */
    firstDataRow?: number;
    /** Последняя строка данных включительно; без поля — до конца листа. */
    lastDataRow?: number;
    dedupeBy?: 'email' | 'phone' | 'external_id';
    externalIdHeader?: string;
    batchSize?: number;
    /** Явный список номеров строк листа (1-based) для импорта; если непустой — режим selected. */
    selectedDataRows?: number[];
  };
};

const MAX_SELECTED_SHEET_ROWS = 5000;

export type GoogleSheetsPreviewRow = { rowNumber: number; cells: string[] };

export type GoogleSheetsPreviewResult = {
  headers: string[];
  rows: GoogleSheetsPreviewRow[];
  previewFromRow: number;
  previewToRow: number;
};

function normalizeSelectedDataRows(
  raw: unknown,
  headerRow: number,
  firstDataRow: number,
  lastDataRow: number | null,
): number[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set<number>();
  for (const x of raw) {
    const n = Math.floor(Number(x));
    if (!Number.isFinite(n) || n <= headerRow) continue;
    if (n < firstDataRow) continue;
    if (lastDataRow !== null && n > lastDataRow) continue;
    set.add(n);
  }
  return [...set].sort((a, b) => a - b).slice(0, MAX_SELECTED_SHEET_ROWS);
}

function parseCfg(entity: IntegrationConnection): SheetConnectionCfg | null {
  if (!entity.configJson) return null;
  try {
    return JSON.parse(entity.configJson) as SheetConnectionCfg;
  } catch {
    return null;
  }
}

function colLetter(n: number): string {
  let s = '';
  let x = Math.max(1, n);
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

function normHeader(h: string): string {
  return String(h || '')
    .trim()
    .toLowerCase();
}

/** Автосопоставление заголовков колонок с полями лида / workspace. */
function buildDefaultColumnMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of headers) {
    const k = normHeader(h);
    if (!h) continue;
    if (/e.?mail|^email$|^correo|^mail$/i.test(k)) map[h] = 'email';
    else if (/phone|tel|mobile|whatsapp|móvil/i.test(k)) map[h] = 'phone';
    else if (/^name$|nombre|full.?name|contact|fio/i.test(k)) map[h] = 'name';
    else if (/status|estado|etapa/i.test(k)) map[h] = 'status';
    else if (/source|origen|канал|origin/i.test(k)) map[h] = 'source';
    else if (/country|país|pais|ülke/i.test(k)) map[h] = 'country';
  }
  return map;
}

function setDeep(
  target: Record<string, unknown>,
  path: string,
  value: string,
): void {
  const parts = path.split('.').filter(Boolean);
  if (!parts.length) return;
  let cur: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {};
    cur = cur[p] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

/**
 * Как CustomObjectsService.slugify + замена дефисов на _, чтобы ключи совпадали с createField.
 */
function canonicalWorkspaceFieldKey(input: string): string {
  return (
    String(input || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 180) || 'table'
  ).replace(/-/g, '_');
}

/** Тип нового поля по заголовку колонки (как в WorkspaceImportPage; status/select → text из листа). */
function inferWorkspaceFieldTypeFromHeader(header: string): 'text' | 'number' | 'date' | 'datetime' | 'boolean' {
  const v = normHeader(header);
  if (v.includes('datetime') || (v.includes('time') && v.includes('date')))
    return 'datetime';
  if (
    v.includes('date') ||
    v.includes('дата') ||
    v.includes('tarih') ||
    v.includes('fecha') ||
    v.includes('ziyaret')
  )
    return 'date';
  if (
    v.includes('sum') ||
    v.includes('amount') ||
    v.includes('number') ||
    v.includes('сумм') ||
    v.includes('цена') ||
    v.includes('fiyat') ||
    v.includes('miktar')
  )
    return 'number';
  if (v.includes('bool') || v === 'yes_no' || v.includes('да/нет'))
    return 'boolean';
  return 'text';
}

@Injectable()
export class GoogleSheetsSyncService {
  private readonly log = new Logger(GoogleSheetsSyncService.name);

  constructor(
    @InjectRepository(IntegrationConnection)
    private readonly connRepo: Repository<IntegrationConnection>,
    @InjectRepository(IntegrationGoogleSheetSyncState)
    private readonly stateRepo: Repository<IntegrationGoogleSheetSyncState>,
    @InjectRepository(IntegrationGoogleSheetSyncJob)
    private readonly jobRepo: Repository<IntegrationGoogleSheetSyncJob>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    @InjectRepository(CustomObjectRecord)
    private readonly recordRepo: Repository<CustomObjectRecord>,
    private readonly tokenService: GoogleSheetsTokenService,
    private readonly sheetsHttp: GoogleSheetsHttpService,
    @Inject(forwardRef(() => LeadsService))
    private readonly leadsService: LeadsService,
    @Inject(forwardRef(() => CustomObjectsService))
    private readonly customObjectsService: CustomObjectsService,
  ) {}

  /** Можно ли ставить фоновую задачу чтения листа (лиды / workspace с объектом). */
  shouldEnqueuePull(entity: IntegrationConnection): boolean {
    const cfg = parseCfg(entity);
    if (!cfg || cfg.catalogId !== 'google_sheets') return false;
    const sid = (cfg.spreadsheetId || '').trim();
    if (!sid) return false;
    const tk = cfg.sync?.targetKind;
    const norm =
      tk === 'workspace'
        ? 'workspace'
        : tk === 'projects'
          ? 'projects'
          : tk === 'sales'
            ? 'sales'
            : 'leads';
    if (norm === 'projects' || norm === 'sales') return false;
    if (norm === 'workspace' && !(cfg.sync?.workspaceObjectId || '').trim()) return false;
    return true;
  }

  async enqueuePullFromConnection(
    tenantId: string,
    connectionId: string,
  ): Promise<{ enqueued: boolean; jobId?: string }> {
    const entity = await this.connRepo.findOne({
      where: { id: connectionId, tenantId, isDeleted: false, isEnabled: true } as any,
    });
    if (!entity) return { enqueued: false };
    const cfg = parseCfg(entity);
    if (!cfg || cfg.catalogId !== 'google_sheets') return { enqueued: false };
    const sid = (cfg.spreadsheetId || '').trim();
    if (!sid) return { enqueued: false };
    if (!this.shouldEnqueuePull(entity)) return { enqueued: false };

    const state = await this.ensureState(tenantId, entity, cfg);

    const pending = await this.jobRepo.count({
      where: {
        integrationConnectionId: connectionId,
        status: 'pending' as any,
      } as any,
    });
    if (pending > 0) return { enqueued: false };

    const job = await this.jobRepo.save(
      this.jobRepo.create({
        tenantId,
        integrationConnectionId: connectionId,
        syncStateId: state.id,
        kind: 'pull_batch',
        status: 'pending',
        attempts: 0,
        maxAttempts: 10,
        payload: { reason: 'manual_or_adapter_sync' },
      }),
    );
    return { enqueued: true, jobId: job.id };
  }

  /** Превью заголовков и строк без сохранения подключения (для выбора строк в UI). */
  async previewSheet(dto: GoogleSheetsPreviewDto): Promise<GoogleSheetsPreviewResult> {
    let spreadsheetId = (dto.spreadsheetId || '').trim();
    const fromUrl = spreadsheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (fromUrl) spreadsheetId = fromUrl[1];
    if (!spreadsheetId || !/^[a-zA-Z0-9-_]{20,}$/.test(spreadsheetId)) {
      throw new BadRequestException('Некорректный spreadsheetId');
    }
    const tab = (dto.sheetTabName || 'Sheet1').trim() || 'Sheet1';
    const headerRow = Math.max(1, Number(dto.headerRow) || 1);
    const firstDataRow = Math.max(
      headerRow + 1,
      Number(dto.firstDataRow) || headerRow + 1,
    );
    const lastRaw = dto.lastDataRow;
    const lastBound =
      lastRaw !== undefined && lastRaw !== null && String(lastRaw).trim() !== ''
        ? Math.max(headerRow + 1, Number(lastRaw))
        : null;
    const maxPreview = Math.min(100, Math.max(5, Number(dto.maxPreviewRows) || 40));
    let previewTo = firstDataRow + maxPreview - 1;
    if (lastBound !== null) previewTo = Math.min(previewTo, lastBound);

    let accessToken: string;
    try {
      accessToken = await this.tokenService.resolveAccessToken(dto.apiToken);
    } catch (e) {
      throw new BadRequestException((e as Error).message || 'Не удалось получить access token');
    }

    try {
      const headerCells = await this.sheetsHttp.getValues(
        accessToken,
        spreadsheetId,
        tab,
        `${headerRow}:${headerRow}`,
      );
      const headers = (headerCells[0] || []).map((c) => String(c ?? '').trim());
      const colCount = Math.max(1, headers.filter((h) => h).length || headers.length || 1);
      const endCol = colLetter(Math.max(colCount, 26));

      if (previewTo < firstDataRow) {
        return {
          headers,
          rows: [],
          previewFromRow: firstDataRow,
          previewToRow: previewTo,
        };
      }

      const rangeStr = `A${firstDataRow}:${endCol}${previewTo}`;
      const data = await this.sheetsHttp.getValues(accessToken, spreadsheetId, tab, rangeStr);
      const rows: GoogleSheetsPreviewRow[] = [];
      for (let i = 0; i < data.length; i++) {
        const absoluteRow = firstDataRow + i;
        if (lastBound !== null && absoluteRow > lastBound) break;
        rows.push({
          rowNumber: absoluteRow,
          cells: (data[i] || []).map((c) => String(c ?? '').trim()),
        });
      }
      return {
        headers,
        rows,
        previewFromRow: firstDataRow,
        previewToRow: previewTo,
      };
    } catch (e) {
      const msg = (e as Error).message || String(e);
      throw new BadRequestException(msg);
    }
  }

  async processPendingJobs(limit = 5): Promise<number> {
    let done = 0;
    for (let i = 0; i < limit; i++) {
      const job = await this.jobRepo.findOne({
        where: { status: 'pending' as any } as any,
        order: { createdAt: 'ASC' },
      });
      if (!job) break;
      const locked = await this.jobRepo.update(
        { id: job.id, status: 'pending' as any },
        { status: 'running' as any, startedAt: new Date(), lockedAt: new Date() } as any,
      );
      if (!locked.affected) continue;

      try {
        await this.runPullBatchJob(job.id);
        done += 1;
      } catch (e) {
        const msg = (e as Error).message || String(e);
        this.log.error(`Sheet job ${job.id}: ${msg}`);
        const stRun = await this.stateRepo.findOne({
          where: { integrationConnectionId: job.integrationConnectionId } as any,
        });
        if (stRun && stRun.status === 'running') {
          stRun.status = 'error';
          stRun.lastError = msg.slice(0, 2000);
          await this.stateRepo.save(stRun);
        }
        await this.jobRepo.increment({ id: job.id }, 'attempts', 1);
        const j2 = await this.jobRepo.findOne({ where: { id: job.id } as any });
        if (!j2) continue;
        const httpStatus = (e as Error & { httpStatus?: number }).httpStatus;
        const nestStatus = e instanceof HttpException ? e.getStatus() : undefined;
        const clientAbort =
          (typeof httpStatus === 'number' && httpStatus >= 400 && httpStatus < 500) ||
          (typeof nestStatus === 'number' && nestStatus >= 400 && nestStatus < 500);
        const terminal = clientAbort || j2.attempts >= j2.maxAttempts;
        await this.jobRepo.update(
          { id: job.id },
          {
            status: (terminal ? 'error' : 'pending') as any,
            errorMessage: msg.slice(0, 2000),
            finishedAt: terminal ? new Date() : null,
            startedAt: null,
            lockedAt: null,
          } as any,
        );
      }
    }
    return done;
  }

  private async ensureState(
    tenantId: string,
    entity: IntegrationConnection,
    cfg: SheetConnectionCfg,
  ): Promise<IntegrationGoogleSheetSyncState> {
    const spreadsheetId = (cfg.spreadsheetId || '').trim();
    const tab = (cfg.sheetTabName || 'Sheet1').trim() || 'Sheet1';
    const sync = cfg.sync || {};
    const headerRow = Math.max(1, Number(sync.headerRow) || 1);
    const batchSize = Math.min(
      500,
      Math.max(10, Number(sync.batchSize) || 200),
    );
    const rawTarget = sync.targetKind;
    const targetKind: GoogleSheetSyncTargetKind =
      rawTarget === 'workspace'
        ? 'workspace'
        : rawTarget === 'projects'
          ? 'projects'
          : rawTarget === 'sales'
            ? 'sales'
            : 'leads';
    const firstDataRow = Math.max(
      headerRow + 1,
      Number(sync.firstDataRow) || headerRow + 1,
    );
    const lastDataRowBound =
      sync.lastDataRow !== undefined && sync.lastDataRow !== null && String(sync.lastDataRow).trim() !== ''
        ? Math.max(headerRow + 1, Number(sync.lastDataRow))
        : null;
    const selectedSorted = normalizeSelectedDataRows(
      sync.selectedDataRows,
      headerRow,
      firstDataRow,
      lastDataRowBound,
    );
    const importMode: 'range' | 'selected' =
      selectedSorted.length > 0 ? 'selected' : 'range';
    const workspaceObjectId =
      typeof sync.workspaceObjectId === 'string' && sync.workspaceObjectId.trim()
        ? sync.workspaceObjectId.trim()
        : null;
    const dedupeBy = sync.dedupeBy || 'email';
    const externalIdHeader = sync.externalIdHeader?.trim() || null;

    let columnMap: Record<string, string> | null = null;
    if (sync.columnMap && typeof sync.columnMap === 'object') {
      columnMap = sync.columnMap as Record<string, string>;
    }

    let existing = await this.stateRepo.findOne({
      where: { integrationConnectionId: entity.id } as any,
    });

    if (!existing) {
      existing = this.stateRepo.create({
        tenantId,
        integrationConnectionId: entity.id,
        spreadsheetId,
        sheetTabName: tab,
        headerRow,
        targetKind,
        workspaceObjectId,
        columnMapJson: columnMap ? JSON.stringify(columnMap) : null,
        dedupeBy,
        externalIdHeader,
        importMode,
        selectedRowsJson:
          importMode === 'selected' ? JSON.stringify(selectedSorted) : null,
        nextRowCursor: importMode === 'selected' ? 0 : firstDataRow,
        batchSize,
        status: 'idle',
      });
    } else {
      existing.spreadsheetId = spreadsheetId;
      existing.sheetTabName = tab;
      existing.headerRow = headerRow;
      existing.targetKind = targetKind;
      existing.workspaceObjectId = workspaceObjectId;
      if (columnMap) existing.columnMapJson = JSON.stringify(columnMap);
      existing.dedupeBy = dedupeBy;
      existing.externalIdHeader = externalIdHeader;
      existing.batchSize = batchSize;
      existing.importMode = importMode;
      if (importMode === 'selected') {
        existing.selectedRowsJson = JSON.stringify(selectedSorted);
        existing.nextRowCursor = 0;
      } else {
        existing.selectedRowsJson = null;
      }
    }

    return this.stateRepo.save(existing);
  }

  private async runPullBatchJob(jobId: string): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } as any });
    if (!job) return;

    const state = await this.stateRepo.findOne({ where: { id: job.syncStateId } as any });
    const entity = await this.connRepo.findOne({
      where: { id: job.integrationConnectionId, tenantId: job.tenantId } as any,
    });
    if (!state || !entity) {
      await this.finishJob(job.id, 'error', 'Состояние или подключение не найдены');
      return;
    }

    const cfg = parseCfg(entity);
    if (!cfg?.apiToken?.trim()) {
      await this.finishJob(job.id, 'error', 'Нет API token в подключении');
      await this.markStateError(state, 'Нет API token');
      return;
    }

    if (state.targetKind === 'projects' || state.targetKind === 'sales') {
      const msg =
        'Импорт из Google Sheets в проекты и продажи пока не поддерживается. Выберите «Лиды» или «Рабочая область» в настройках подключения.';
      await this.finishJob(job.id, 'error', msg);
      await this.markStateError(state, msg);
      return;
    }
    if (state.targetKind === 'workspace' && !state.workspaceObjectId) {
      const msg =
        'Для импорта в рабочую область укажите объект (workspaceObjectId) в настройках подключения.';
      await this.finishJob(job.id, 'error', msg);
      await this.markStateError(state, msg);
      return;
    }

    state.status = 'running';
    await this.stateRepo.save(state);

    let accessToken: string;
    try {
      accessToken = await this.tokenService.resolveAccessToken(cfg.apiToken);
    } catch (e) {
      await this.finishJob(job.id, 'error', (e as Error).message);
      await this.markStateError(state, (e as Error).message);
      return;
    }

    const headerRow = state.headerRow;
    const tab = state.sheetTabName;

    const headerCells = await this.sheetsHttp.getValues(
      accessToken,
      state.spreadsheetId,
      tab,
      `${headerRow}:${headerRow}`,
    );
    const headers = (headerCells[0] || []).map((c) => String(c ?? '').trim());
    const colCount = Math.max(1, headers.filter((h) => h).length || headers.length || 1);
    const endCol = colLetter(Math.max(colCount, 26));

    const hadUserColumnMap = !!(state.columnMapJson && String(state.columnMapJson).trim());

    let columnMap: Record<string, string> = {};
    if (hadUserColumnMap) {
      try {
        columnMap = JSON.parse(state.columnMapJson as string) as Record<string, string>;
      } catch {
        columnMap = {};
      }
    }
    if (!Object.keys(columnMap).length) {
      columnMap = buildDefaultColumnMap(headers);
      state.columnMapJson = JSON.stringify(columnMap);
      await this.stateRepo.save(state);
    }

    /** Без явного columnMap в настройках — каждая колонка листа → своё поле (как при импорте файла в workspace). */
    if (state.targetKind === 'workspace' && state.workspaceObjectId && !hadUserColumnMap) {
      for (const h of headers) {
        const t = String(h || '').trim();
        if (!t) continue;
        if (columnMap[t]) continue;
        columnMap[t] = canonicalWorkspaceFieldKey(t);
      }
    }

    if (state.targetKind === 'workspace' && state.workspaceObjectId) {
      await this.ensureMissingWorkspaceFieldsFromColumnMap(
        job.tenantId,
        state.workspaceObjectId,
        columnMap,
      );
    }

    const syncCfg = cfg.sync || {};
    const firstDataRow = Math.max(
      state.headerRow + 1,
      Number(syncCfg.firstDataRow) || state.headerRow + 1,
    );
    const lastRaw = syncCfg.lastDataRow;
    const lastDataRow =
      lastRaw !== undefined && lastRaw !== null && String(lastRaw).trim() !== ''
        ? Math.max(state.headerRow + 1, Number(lastRaw))
        : null;

    const mode = state.importMode === 'selected' ? 'selected' : 'range';

    if (mode === 'selected') {
      let selectedRows: number[] = [];
      try {
        const raw = JSON.parse(state.selectedRowsJson || '[]') as unknown;
        selectedRows = Array.isArray(raw)
          ? raw.map((x) => Math.floor(Number(x))).filter((n) => Number.isFinite(n) && n > 0)
          : [];
      } catch {
        selectedRows = [];
      }
      if (!selectedRows.length) {
        await this.finishJob(
          job.id,
          'error',
          'Не задан список строк для импорта (selectedDataRows)',
        );
        await this.markStateError(state, 'Пустой список строк импорта');
        return;
      }

      const startIdx = state.nextRowCursor;
      if (startIdx >= selectedRows.length) {
        state.status = 'idle';
        state.lastPullAt = new Date();
        state.lastError = null;
        await this.stateRepo.save(state);
        await this.finishJob(job.id, 'done', undefined);
        return;
      }

      const slice = selectedRows.slice(startIdx, startIdx + state.batchSize);
      const minR = Math.min(...slice);
      const maxR = Math.max(...slice);
      const rangeStr = `A${minR}:${endCol}${maxR}`;
      const dataRows = await this.sheetsHttp.getValues(
        accessToken,
        state.spreadsheetId,
        tab,
        rangeStr,
      );

      for (const absoluteRow of slice) {
        const idx = absoluteRow - minR;
        if (idx < 0 || idx >= dataRows.length) continue;
        const row = (dataRows[idx] || []).map((c) => String(c ?? '').trim());
        if (row.every((c) => !c)) continue;

        const flat: Record<string, string> = {};
        for (let c = 0; c < headers.length; c++) {
          const hn = headers[c];
          if (!hn) continue;
          const path = columnMap[hn];
          if (!path) continue;
          const v = row[c] ?? '';
          if (!v) continue;
          flat[path] = v;
        }

        if (state.targetKind === 'leads') {
          await this.upsertLeadFromRow(job.tenantId, entity.id, state, absoluteRow, flat);
        } else if (state.targetKind === 'workspace' && state.workspaceObjectId) {
          await this.upsertWorkspaceRowFromRow(
            job.tenantId,
            state.workspaceObjectId,
            entity.id,
            absoluteRow,
            flat,
            headers,
            row,
            columnMap,
            state.externalIdHeader,
          );
        }
      }

      state.nextRowCursor = startIdx + slice.length;
      state.status = 'idle';
      state.lastPullAt = new Date();
      state.lastError = null;
      await this.stateRepo.save(state);
      await this.finishJob(job.id, 'done', undefined);

      if (state.nextRowCursor < selectedRows.length) {
        await this.enqueuePullFromConnection(job.tenantId, job.integrationConnectionId);
      }
      return;
    }

    const start = state.nextRowCursor;
    if (lastDataRow !== null && start > lastDataRow) {
      state.status = 'idle';
      state.lastPullAt = new Date();
      state.lastError = null;
      await this.stateRepo.save(state);
      await this.finishJob(job.id, 'done', undefined);
      return;
    }

    let end = start + state.batchSize - 1;
    if (lastDataRow !== null) end = Math.min(end, lastDataRow);
    const range = `A${start}:${endCol}${end}`;
    const rows = await this.sheetsHttp.getValues(
      accessToken,
      state.spreadsheetId,
      tab,
      range,
    );

    if (!rows.length) {
      state.status = 'idle';
      state.lastPullAt = new Date();
      state.lastError = null;
      await this.stateRepo.save(state);
      await this.finishJob(job.id, 'done', undefined);
      return;
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i].map((c) => String(c ?? '').trim());
      const absoluteRow = start + i;
      if (absoluteRow < firstDataRow) continue;
      if (lastDataRow !== null && absoluteRow > lastDataRow) continue;
      if (row.every((c) => !c)) continue;

      const flat: Record<string, string> = {};
      for (let c = 0; c < headers.length; c++) {
        const hn = headers[c];
        if (!hn) continue;
        const path = columnMap[hn];
        if (!path) continue;
        const v = row[c] ?? '';
        if (!v) continue;
        flat[path] = v;
      }

      if (state.targetKind === 'leads') {
        await this.upsertLeadFromRow(job.tenantId, entity.id, state, absoluteRow, flat);
      } else if (state.targetKind === 'workspace' && state.workspaceObjectId) {
        await this.upsertWorkspaceRowFromRow(
          job.tenantId,
          state.workspaceObjectId,
          entity.id,
          absoluteRow,
          flat,
          headers,
          row,
          columnMap,
          state.externalIdHeader,
        );
      }
    }

    /** Продвигаем курсор по числу строк диапазона, даже если строки пустые — иначе зацикливание. */
    let nextCursor = start + rows.length;
    if (lastDataRow !== null) nextCursor = Math.min(nextCursor, lastDataRow + 1);
    state.nextRowCursor = nextCursor;
    state.status = 'idle';
    state.lastPullAt = new Date();
    state.lastError = null;
    await this.stateRepo.save(state);

    await this.finishJob(job.id, 'done', undefined);

    const reachedEnd =
      lastDataRow !== null && (rows.length === 0 || start + rows.length - 1 >= lastDataRow);
    if (!reachedEnd && rows.length >= state.batchSize) {
      await this.enqueuePullFromConnection(job.tenantId, job.integrationConnectionId);
    }
  }

  private async finishJob(
    id: string,
    status: 'done' | 'error',
    err?: string,
  ): Promise<void> {
    await this.jobRepo.update(
      { id },
      {
        status: status as any,
        finishedAt: new Date(),
        errorMessage: err ?? null,
      } as any,
    );
  }

  private async markStateError(
    state: IntegrationGoogleSheetSyncState,
    msg: string,
  ): Promise<void> {
    state.status = 'error';
    state.lastError = msg.slice(0, 2000);
    await this.stateRepo.save(state);
  }

  private async upsertLeadFromRow(
    tenantId: string,
    connectionId: string,
    state: IntegrationGoogleSheetSyncState,
    sheetRow: number,
    flat: Record<string, string>,
  ): Promise<void> {
    const dto = this.flatToLeadDto(flat, connectionId, sheetRow, state.spreadsheetId);
    if (!dto.email && !dto.phone) return;

    let existing: Lead | null = null;
    if (state.dedupeBy === 'phone' && dto.phone) {
      const digits = dto.phone.replace(/\D/g, '');
      if (digits.length >= 6) {
        existing = await this.leadRepo
          .createQueryBuilder('l')
          .where('l.tenantId = :tenantId', { tenantId })
          .andWhere("regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g') = :digits", {
            digits,
          })
          .orderBy('l.updatedAt', 'DESC')
          .getOne();
      }
    } else if (state.dedupeBy === 'external_id') {
      const ext = (flat.__externalId || '').trim();
      if (ext) {
        existing = await this.leadRepo
          .createQueryBuilder('l')
          .where('l.tenantId = :tenantId', { tenantId })
          .andWhere("l.meta->>'googleSheetsExternalId' = :ext", { ext })
          .orderBy('l.updatedAt', 'DESC')
          .getOne();
      }
    } else if (dto.email) {
      const em = dto.email.trim().toLowerCase();
      existing = await this.leadRepo
        .createQueryBuilder('l')
        .where('l.tenantId = :tenantId', { tenantId })
        .andWhere('lower(trim(l.email)) = :em', { em })
        .orderBy('l.updatedAt', 'DESC')
        .getOne();
    }

    const sheetMeta = {
      googleSheets: {
        connectionId,
        spreadsheetId: state.spreadsheetId,
        sheetTab: state.sheetTabName,
        row: sheetRow,
        lastImportAt: new Date().toISOString(),
      },
    };

    if (existing) {
      const patch: UpdateLeadDto = {
        name: dto.name ?? existing.name ?? undefined,
        phone: dto.phone ?? existing.phone ?? undefined,
        email: dto.email ?? existing.email ?? undefined,
        country: dto.country ?? existing.country ?? undefined,
        status: dto.status ?? undefined,
        source: dto.source ?? undefined,
        meta: {
          ...(existing.meta && typeof existing.meta === 'object' ? existing.meta : {}),
          ...sheetMeta,
        },
        customFields: dto.customFields
          ? { ...(existing.customFields || {}), ...dto.customFields }
          : undefined,
      };
      await this.leadsService.updateForTenant(tenantId, existing.id, patch);
    } else {
      await this.leadsService.createForTenant(tenantId, {
        ...dto,
        meta: {
          ...(dto.meta && typeof dto.meta === 'object' ? dto.meta : {}),
          ...sheetMeta,
        },
      });
    }
  }

  private flatToLeadDto(
    flat: Record<string, string>,
    connectionId: string,
    sheetRow: number,
    spreadsheetId: string,
  ): CreateLeadDto {
    const lead: Record<string, unknown> = {
      source: flat.source || 'google_sheets',
      status: flat.status || 'new',
    };
    const custom: Record<string, unknown> = {};

    for (const [path, val] of Object.entries(flat)) {
      if (!path || path === '__externalId') continue;
      if (
        path === 'name' ||
        path === 'email' ||
        path === 'phone' ||
        path === 'country' ||
        path === 'status' ||
        path === 'source'
      ) {
        (lead as any)[path] = val;
      } else if (path.startsWith('customFields.')) {
        const sub = path.slice('customFields.'.length);
        setDeep(custom, sub, val);
      }
    }

    if (Object.keys(custom).length) {
      lead.customFields = custom;
    }

    const meta: Record<string, unknown> = {
      googleSheetsImport: true,
      sheetRow,
      connectionId,
      spreadsheetId,
    };
    if (flat.__externalId?.trim()) {
      meta.googleSheetsExternalId = flat.__externalId.trim();
    }
    lead.meta = meta;

    return lead as CreateLeadDto;
  }

  /**
   * Для импорта в workspace: создаём у объекта поля, которых ещё нет, по ключам из columnMap
   * (аналог кнопки «Создать поле» в файловом импорте рабочей области).
   */
  private async ensureMissingWorkspaceFieldsFromColumnMap(
    tenantId: string,
    objectId: string,
    columnMap: Record<string, string>,
  ): Promise<void> {
    const rawPaths = new Set<string>();
    for (const path of Object.values(columnMap)) {
      const p = String(path || '').trim();
      if (!p || p === '__externalId' || p.startsWith('customFields.')) continue;
      rawPaths.add(p);
    }
    if (!rawPaths.size) return;

    const fields = await this.customObjectsService.listFields(tenantId, objectId);
    const existing = new Set(fields.map((f) => f.key));

    const headerForPath = (rawPath: string): string => {
      for (const [h, mapped] of Object.entries(columnMap)) {
        if (String(mapped || '').trim() === rawPath) return String(h || '').trim() || rawPath;
      }
      return rawPath;
    };

    for (const path of rawPaths) {
      const canonical = canonicalWorkspaceFieldKey(path);
      if (existing.has(canonical)) continue;
      if (existing.has(path)) continue;

      const labelRaw = headerForPath(path);
      const label = labelRaw.length > 200 ? labelRaw.slice(0, 200) : labelRaw;
      const type = inferWorkspaceFieldTypeFromHeader(labelRaw);

      try {
        const created = await this.customObjectsService.createField(tenantId, objectId, {
          key: canonical,
          label: label || canonical,
          type,
          required: false,
        });
        existing.add(created.key);
        this.log.log(
          `Google Sheets → workspace: создано поле «${created.key}» (${created.type}), объект ${objectId}`,
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/already exists|Field key already/i.test(msg)) {
          existing.add(canonical);
          continue;
        }
        this.log.warn(
          `Google Sheets → workspace: не удалось создать поле «${canonical}»: ${msg}`,
        );
      }
    }
  }

  private async upsertWorkspaceRowFromRow(
    tenantId: string,
    objectId: string,
    connectionId: string,
    sheetRow: number,
    flat: Record<string, string>,
    headers: string[],
    row: string[],
    columnMap: Record<string, string>,
    externalIdHeader: string | null,
  ): Promise<void> {
    const values: Record<string, unknown> = {};
    let externalId: string | undefined;

    for (let c = 0; c < headers.length; c++) {
      const hn = headers[c];
      if (!hn) continue;
      const path = columnMap[hn];
      if (!path) continue;
      const cell = row[c] ?? '';
      if (!cell) continue;
      if (path === '__externalId') {
        externalId = cell;
        continue;
      }
      if (path.startsWith('customFields.')) {
        const sub = path.slice('customFields.'.length);
        setDeep(values as Record<string, unknown>, sub, cell);
      } else {
        values[canonicalWorkspaceFieldKey(path)] = cell;
      }
    }

    if (externalIdHeader) {
      const h = headers.find((x) => x === externalIdHeader);
      if (h) {
        const idx = headers.indexOf(h);
        if (idx >= 0 && row[idx]) externalId = row[idx];
      }
    }

    const fields = await this.customObjectsService.listFields(tenantId, objectId);
    let blockingFileKey: string | null = null;
    for (const f of fields) {
      if (!f.required || f.type !== 'file') continue;
      const v = values[f.key];
      if (v === undefined || v === null || v === '') {
        blockingFileKey = f.key;
        break;
      }
    }
    if (blockingFileKey) {
      this.log.warn(
        `Google Sheets row ${sheetRow}: пропуск — обязательное поле-файл «${blockingFileKey}» не заполнено`,
      );
      return;
    }

    this.fillRequiredWorkspaceFieldsFromRow(fields, values, row, sheetRow, externalId);

    const meta = {
      googleSheets: {
        connectionId,
        row: sheetRow,
      },
    };

    if (externalId) {
      const hit = await this.recordRepo.findOne({
        where: { tenantId, objectId, externalId } as any,
      });
      if (hit) {
        await this.customObjectsService.updateRecord(tenantId, objectId, hit.id, {
          values: { ...hit.values, ...values },
          meta: { ...(hit.meta || {}), ...meta },
        });
        return;
      }
    }

    await this.customObjectsService.createRecord(tenantId, objectId, {
      values,
      ...(externalId ? { externalId } : {}),
      meta,
    });
  }

  /**
   * Обязательные поля объекта workspace: если из листа не пришло значение,
   * подставляем осмысленный текст из ячеек строки (часто так падает поле name).
   */
  private fillRequiredWorkspaceFieldsFromRow(
    fields: CustomObjectField[],
    values: Record<string, unknown>,
    row: string[],
    sheetRow: number,
    externalId: string | undefined,
  ): void {
    const nonEmpty = row.map((c) => String(c ?? '').trim()).filter(Boolean);
    const looksLikeShortDateOnly = (c: string) =>
      /^\d{1,2}\.\d{1,2}(\.\d{2,4})?$/.test(c);
    const cellsForFallback = nonEmpty.filter((c) => !looksLikeShortDateOnly(c));
    const longestCell = cellsForFallback.reduce(
      (best, c) => (c.length > best.length ? c : best),
      '',
    );
    const fallbackTitle =
      longestCell ||
      nonEmpty[0] ||
      (externalId?.trim() ? String(externalId).trim() : '') ||
      `Google Sheets · строка ${sheetRow}`;

    const firstNumberInRow = (): number | null => {
      for (const c of row) {
        const n = Number(String(c ?? '').replace(/\s/g, '').replace(',', '.'));
        if (Number.isFinite(n)) return n;
      }
      return null;
    };

    for (const f of fields) {
      if (!f.required) continue;
      const cur = values[f.key];
      if (cur !== null && cur !== undefined && cur !== '') continue;

      switch (f.type) {
        case 'file':
          break;
        case 'boolean':
          values[f.key] = false;
          break;
        case 'number': {
          const n = firstNumberInRow();
          values[f.key] = n ?? 0;
          break;
        }
        case 'date': {
          const d = new Date();
          values[f.key] = d.toISOString().slice(0, 10);
          break;
        }
        case 'datetime':
          values[f.key] = new Date().toISOString();
          break;
        case 'select':
        case 'status': {
          const opts = f.options || [];
          const first = opts[0] ? String(opts[0].value) : '';
          values[f.key] = first || String(fallbackTitle).slice(0, 4000);
          break;
        }
        case 'multiselect': {
          const opts = f.options || [];
          if (opts[0]) {
            values[f.key] = [String(opts[0].value)];
          } else {
            values[f.key] = [];
          }
          break;
        }
        default:
          values[f.key] = String(fallbackTitle).slice(0, 4000);
      }
    }
  }
}
