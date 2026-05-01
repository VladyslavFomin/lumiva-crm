import { api, API_BASE } from './client';
import { getAccessToken } from '../auth/session';

export type CustomObjectFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'status'
  | 'select'
  | 'multiselect'
  | 'file';

export interface CustomObject {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  workspaceAreaId?: string | null;
  meta: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomObjectField {
  id: string;
  objectId: string;
  key: string;
  label: string;
  type: CustomObjectFieldType;
  required: boolean;
  options: Array<{ value: string; label: string }> | null;
  order: number;
  isActive: boolean;
  meta: Record<string, any> | null;
}

export interface CustomObjectRecord {
  id: string;
  objectId: string;
  externalId: string | null;
  values: Record<string, any>;
  meta: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomObjectView {
  id: string;
  objectId: string;
  type: 'table' | 'kanban' | 'calendar' | 'gantt';
  name: string;
  config: Record<string, any> | null;
  isDefault: boolean;
  order: number;
}

export interface CustomObjectImportPreview {
  importId: string;
  columns: string[];
  sample: Array<Record<string, any>>;
  totalRows: number;
  suggestedMapping: Record<string, string | null>;
  headerRowNumber?: number;
  /** Уникальные значения по колонкам (со всего файла) — для статусов при создании поля */
  uniqueValuesByColumn?: Record<string, string[]>;
}

export async function fetchCustomObjects(workspaceAreaId?: string) {
  const q =
    workspaceAreaId && /^[0-9a-f-]{36}$/i.test(workspaceAreaId)
      ? `?workspaceAreaId=${encodeURIComponent(workspaceAreaId)}`
      : '';
  return api.get<CustomObject[]>(`/custom-objects${q}`);
}

export async function fetchCustomObject(objectId: string) {
  return api.get<CustomObject>(`/custom-objects/${objectId}`);
}

export async function createCustomObject(payload: {
  name: string;
  slug?: string;
  description?: string;
  workspaceAreaId?: string | null;
  meta?: Record<string, unknown> | null;
}) {
  return api.post<CustomObject>('/custom-objects', payload);
}

export async function updateCustomObject(
  objectId: string,
  payload: Partial<{
    name: string;
    slug: string;
    description: string;
    isActive: boolean;
    meta: Record<string, any>;
    workspaceAreaId: string | null;
  }>,
) {
  return api.patch<CustomObject>(`/custom-objects/${objectId}`, payload);
}

export async function deleteCustomObject(objectId: string) {
  return api.delete<{ ok: boolean }>(`/custom-objects/${objectId}`);
}

export async function duplicateCustomObject(objectId: string) {
  return api.post<CustomObject>(`/custom-objects/${objectId}/duplicate`, {});
}

export async function fetchCustomObjectFields(objectId: string) {
  return api.get<CustomObjectField[]>(`/custom-objects/${objectId}/fields`);
}

/** Уникальные ключи в jsonb values по всем записям объекта (импорт, интеграции). */
export async function fetchCustomObjectValueKeys(objectId: string) {
  return api.get<{ keys: string[] }>(`/custom-objects/${objectId}/value-keys`);
}

export async function fetchCustomObjectDistinctFieldValues(objectId: string, fieldKey: string) {
  const q = new URLSearchParams();
  q.set('fieldKey', fieldKey);
  return api.get<{ values: string[] }>(
    `/custom-objects/${objectId}/records/distinct-values?${q.toString()}`,
  );
}

export async function clearAllCustomObjectRecords(objectId: string) {
  return api.post<{ ok: boolean; deleted: number }>(`/custom-objects/${objectId}/records/clear`, {
    confirm: 'CLEAR_ALL_RECORDS',
  });
}

export async function createCustomObjectField(
  objectId: string,
  payload: {
    key: string;
    label: string;
    type: CustomObjectFieldType;
    required?: boolean;
    options?: Array<{ value: string; label: string }>;
    /** Например `columnBinding` — см. `workspace/workspaceColumnBinding.ts` */
    meta?: Record<string, unknown>;
  },
) {
  return api.post<CustomObjectField>(`/custom-objects/${objectId}/fields`, payload);
}

export async function updateCustomObjectField(
  objectId: string,
  fieldId: string,
  payload: Partial<{
    key: string;
    label: string;
    type: CustomObjectFieldType;
    required: boolean;
    options: Array<{ value: string; label: string }>;
    order: number;
    isActive: boolean;
    meta: Record<string, any>;
  }>,
) {
  return api.patch<CustomObjectField>(
    `/custom-objects/${objectId}/fields/${fieldId}`,
    payload,
  );
}

export async function deleteCustomObjectField(objectId: string, fieldId: string) {
  return api.delete<{ ok: boolean }>(`/custom-objects/${objectId}/fields/${fieldId}`);
}

export async function fetchCustomObjectViews(objectId: string) {
  return api.get<CustomObjectView[]>(`/custom-objects/${objectId}/views`);
}

export type FetchCustomObjectRecordsPageParams = {
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  /** Подставить значения для колонок с meta.columnBinding (основная таблица / board). */
  enrichColumnBindings?: boolean;
};

/** Одна страница записей (для таблицы с пагинацией). Полный список см. fetchCustomObjectRecords. */
export async function fetchCustomObjectRecordsPage(
  objectId: string,
  params: FetchCustomObjectRecordsPageParams = {},
) {
  const query = new URLSearchParams();
  query.set('limit', String(params.limit ?? 100));
  query.set('offset', String(params.offset ?? 0));
  if (params.search?.trim()) query.set('search', params.search.trim());
  if (params.sortBy?.trim()) {
    query.set('sortBy', params.sortBy.trim());
    query.set('sortOrder', params.sortOrder === 'ASC' ? 'ASC' : 'DESC');
  }
  if (params.enrichColumnBindings) {
    query.set('enrichColumnBindings', '1');
  }
  return api.get<{ items: CustomObjectRecord[]; total: number }>(
    `/custom-objects/${objectId}/records?${query.toString()}`,
  );
}

export async function fetchCustomObjectRecords(
  objectId: string,
  search?: string,
  opts?: { enrichColumnBindings?: boolean },
) {
  const all: CustomObjectRecord[] = [];
  const pageSize = 200;
  let offset = 0;
  let total = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query = new URLSearchParams();
    query.set('limit', String(pageSize));
    query.set('offset', String(offset));
    if (search?.trim()) query.set('search', search.trim());
    if (opts?.enrichColumnBindings) query.set('enrichColumnBindings', '1');
    const res = await api.get<{ items: CustomObjectRecord[]; total: number }>(
      `/custom-objects/${objectId}/records?${query.toString()}`,
    );
    if (!total) total = res.total || 0;
    all.push(...res.items);
    offset += res.items.length;
    if (res.items.length < pageSize || offset >= (res.total || total)) break;
  }
  return { items: all, total: total || all.length };
}

export async function fetchAllCustomObjectRecords(objectId: string) {
  const all: CustomObjectRecord[] = [];
  const pageSize = 200;
  let offset = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await api.get<{ items: CustomObjectRecord[]; total: number }>(
      `/custom-objects/${objectId}/records?limit=${pageSize}&offset=${offset}`,
    );
    all.push(...res.items);
    offset += res.items.length;
    if (res.items.length < pageSize || offset >= res.total) break;
  }
  return all;
}

export async function createCustomObjectRecord(
  objectId: string,
  payload: { externalId?: string; values: Record<string, any>; meta?: Record<string, any> },
) {
  return api.post<CustomObjectRecord>(`/custom-objects/${objectId}/records`, payload);
}

export type PushRecordsToBoardResult = {
  created: CustomObjectRecord[];
  skipped: Array<{ recordId: string; reason: string }>;
  errors: Array<{ recordId: string; message: string }>;
};

export async function pushRecordsToBoard(
  sourceObjectId: string,
  payload: {
    targetObjectId: string;
    recordIds: string[];
    fieldMap?: Record<string, string>;
    omitAutoTargetKeys?: string[];
    duplicateKeyTargetField?: string | null;
    skipDuplicates?: boolean;
  },
) {
  return api.post<PushRecordsToBoardResult>(
    `/custom-objects/${sourceObjectId}/records/push-to-board`,
    payload,
  );
}

export async function updateCustomObjectRecord(
  objectId: string,
  recordId: string,
  payload: { externalId?: string; values: Record<string, any> },
) {
  return api.patch<CustomObjectRecord>(
    `/custom-objects/${objectId}/records/${recordId}`,
    payload,
  );
}

export async function deleteCustomObjectRecord(objectId: string, recordId: string) {
  return api.delete<{ ok: boolean }>(`/custom-objects/${objectId}/records/${recordId}`);
}

export async function fetchCustomObjectAnalytics(objectId: string) {
  return api.get<{ totalRecords: number; byStatus: Record<string, number>; byDay: Record<string, number> }>(
    `/custom-objects/${objectId}/analytics`,
  );
}

export async function previewCustomObjectImport(
  objectId: string,
  file: File,
): Promise<CustomObjectImportPreview> {
  const token = getAccessToken();
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/custom-objects/${objectId}/import/preview`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message || 'Failed to preview import');
  }
  return data as CustomObjectImportPreview;
}

export type WorkspaceFileFieldValue = {
  name: string;
  relativePath: string;
  /** Кто загрузил (email), подставляется сервером при POST …/attachments/upload */
  uploadedByEmail?: string | null;
};

/** Синхронизировать с бэкендом: workspace-attachment.constants WORKSPACE_ATTACHMENT_MAX_BYTES */
export const WORKSPACE_UPLOAD_MAX_FILE_BYTES = 30 * 1024 * 1024;
export const WORKSPACE_UPLOAD_MAX_FILE_LABEL = '30 МБ';

function nestErrorMessage(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const o = data as { message?: unknown; error?: unknown };
  const m = o.message !== undefined ? o.message : o.error;
  if (typeof m === 'string') return m;
  if (Array.isArray(m) && m.length) return String(m[0]);
  return '';
}

function formatMaxFromBytes(maxBytes: number): string {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) return WORKSPACE_UPLOAD_MAX_FILE_LABEL;
  const mb = maxBytes / (1024 * 1024);
  if (mb >= 1 && mb === Math.floor(mb)) return `${Math.round(mb)} МБ`;
  if (mb >= 1) return `${mb.toFixed(1)} МБ`;
  const kb = maxBytes / 1024;
  return `${Math.round(kb)} КБ`;
}

/** Только признаки лимита Multer/нашего API. Не включать «request entity too large» — это текст страницы nginx и даёт ложное «30 МБ». */
function looksLikeFileSizeLimitError(message: string): boolean {
  const m = message.trim();
  if (!m) return false;
  return /FILE_TOO_LARGE|LIMIT_FILE_SIZE|limit_file_size|file (is )?too large|multer.*(file size|LIMIT)/i.test(m);
}

/** Ответ nginx при client_max_body_size (по умолчанию часто 1 МБ — файл 1.1 МБ уже отсекается). */
function looksLikeNginxRequestEntityTooLarge(rawText: string | undefined, status: number): boolean {
  const r = (rawText || '').toLowerCase();
  if (status === 413) return true;
  if (r.includes('request entity too large') && (r.includes('nginx') || r.includes('<title>413'))) return true;
  return false;
}

/** Сообщение при ошибке загрузки (в т.ч. превышение размера). `rawText` — тело ответа, если это не JSON (nginx и т.п.). */
export function workspaceUploadFailureMessage(
  status: number,
  body: unknown,
  rawText?: string,
): string {
  const fromApi =
    body && typeof body === 'object'
      ? (body as { message?: unknown; maxBytes?: number; error?: string })
      : null;
  const isOurPayloadTooLarge =
    fromApi?.message === 'FILE_TOO_LARGE' ||
    (status === 413 &&
      typeof fromApi?.maxBytes === 'number' &&
      fromApi.maxBytes > 0);

  if (isOurPayloadTooLarge && fromApi) {
    const label = formatMaxFromBytes(fromApi.maxBytes ?? WORKSPACE_UPLOAD_MAX_FILE_BYTES);
    return `Файл слишком большой. Максимальный размер — ${label}.`;
  }

  if (looksLikeNginxRequestEntityTooLarge(rawText, status)) {
    return (
      `Запрос обрезан nginx: тело запроса больше, чем разрешено в конфиге (часто по умолчанию 1 МБ). ` +
      `Файл 1.1 МБ при лимите 1 МБ не пройдёт — это не лимит приложения (${WORKSPACE_UPLOAD_MAX_FILE_LABEL}). ` +
      `В блоке server для вашего сайта добавьте: client_max_body_size 32m; и выполните nginx -s reload.`
    );
  }

  if (status === 413) {
    return (
      `Размер запроса отклонён (часто это лимит nginx или другого прокси перед API). ` +
      `В приложении допускается до ${WORKSPACE_UPLOAD_MAX_FILE_LABEL}. ` +
      `Проверьте client_max_body_size / лимит прокси, если файл меньше этого порога.`
    );
  }

  const msg = nestErrorMessage(body);
  if (status === 400 && looksLikeFileSizeLimitError(msg)) {
    return `Файл слишком большой. Максимальный размер — ${WORKSPACE_UPLOAD_MAX_FILE_LABEL}.`;
  }
  if (msg) return msg;

  const raw = rawText?.trim();
  if (raw) {
    if (raw.startsWith('<')) {
      return (
        `Не удалось загрузить файл (HTTP ${status}). Ответ не JSON — часто это страница ошибки nginx/прокси. ` +
        `Откройте DevTools → Network → этот запрос → вкладка Response; проверьте логи nginx и client_max_body_size.`
      );
    }
    if (raw.length < 800) {
      return raw;
    }
  }
  return `Не удалось загрузить файл (HTTP ${status})`;
}

/** Публичный GET /v1/uploads/... для вложения рабочей области */
export function workspaceFileDownloadHref(relativePath: string): string {
  const safe = relativePath.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  const base = API_BASE.replace(/\/$/, '');
  return `${base}/uploads/${safe}`.replace(/([^:]\/)\/+/g, '$1');
}

export async function uploadWorkspaceFile(
  objectId: string,
  file: File,
): Promise<WorkspaceFileFieldValue> {
  if (file.size > WORKSPACE_UPLOAD_MAX_FILE_BYTES) {
    throw new Error(
      `Файл слишком большой. Максимальный размер — ${WORKSPACE_UPLOAD_MAX_FILE_LABEL}.`,
    );
  }
  const token = getAccessToken();
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/custom-objects/${objectId}/attachments/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message = workspaceUploadFailureMessage(res.status, data, text);
    console.error('[uploadWorkspaceFile]', {
      fileName: file.name,
      fileSize: file.size,
      httpStatus: res.status,
      message,
      responsePreview: text?.slice(0, 1200),
    });
    throw new Error(message);
  }
  if (!data || typeof data !== 'object') {
    console.error('[uploadWorkspaceFile] invalid success body', { text: text?.slice(0, 500) });
    throw new Error('Некорректный ответ сервера при загрузке файла');
  }
  return data as WorkspaceFileFieldValue;
}

export async function applyCustomObjectImport(
  objectId: string,
  payload: {
    importId: string;
    fieldMapping: Record<string, string | null>;
    externalIdField?: string;
    defaultValues?: Record<string, any>;
  },
) {
  return api.post<{
    ok: boolean;
    created: number;
    updated: number;
    skipped: number;
    /** Строки без данных в сопоставленных колонках (не дублируются в errors). */
    skippedEmptyRows?: number;
    /** Строки с ошибкой валидации/сохранения (совпадает с длиной errors). */
    skippedValidationFailed?: number;
    errors: Array<{ row: number; reason: string }>;
  }>(`/custom-objects/${objectId}/import/apply`, payload);
}

