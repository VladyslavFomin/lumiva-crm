// src/api/imports.ts
import { API_BASE } from './client';
import { getAccessToken } from '../auth/session';

/**
 * Ответ предпросмотра импорта.
 * backend может брать первые N строк, определять колонки и предлагать маппинг.
 */
export interface ImportPreviewResponse {
  importId: string; // ID сессии импорта на бэке
  columns: string[];
  sample: Record<string, string>[]; // первые строки
  totalRows: number;
  suggestedMapping?: Record<string, string | null>; // systemField -> columnName
}

/**
 * Поля, которые мы умеем импортировать (системные ключи).
 */
export type ImportSystemField = string;

export interface ImportApplyPayload {
  importId: string;
  channelId?: string;
  fieldMapping: Record<ImportSystemField, string | null>;
}

export interface ImportApplyResult {
  ok: boolean;
  created: number;
  skipped: number;
  message?: string;
  errors?: Array<{ row: number; reason: string }>;
}

/**
 * Предпросмотр импорта: отправляем файл, получаем колонки и пример данных.
 * Эндпоинт предполагаемый: POST /sales/import/preview
 */
export async function previewSalesImport(
  file: File,
): Promise<ImportPreviewResponse> {
  const token = getAccessToken();
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${API_BASE}/sales/import/preview`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Ошибка предпросмотра импорта: ${res.status}`);
  }

  if (!res.ok) {
    const msg =
      data?.message ||
      data?.error ||
      `Ошибка предпросмотра импорта: ${res.status} ${res.statusText}`;
    throw new Error(msg);
  }

  return data as ImportPreviewResponse;
}

/** Ответ предпросмотра файла для рабочей области (без привязки к таблице). */
export interface WorkspaceFileImportPreview {
  importId: string;
  columns: string[];
  sample: Record<string, unknown>[];
  totalRows: number;
}

/**
 * Предпросмотр файла (CSV/Excel) для рабочей области — без привязки к таблице.
 * Используется вложением в ИИ-чате: ИИ сам создаёт таблицу и переносит строки через importId.
 * Эндпоинт: POST /custom-objects/import/preview
 */
export async function previewWorkspaceFileImport(
  file: File,
): Promise<WorkspaceFileImportPreview> {
  const token = getAccessToken();
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${API_BASE}/custom-objects/import/preview`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Ошибка предпросмотра файла: ${res.status}`);
  }

  if (!res.ok) {
    const msg =
      data?.message ||
      data?.error ||
      `Ошибка предпросмотра файла: ${res.status} ${res.statusText}`;
    throw new Error(msg);
  }

  return data as WorkspaceFileImportPreview;
}

/**
 * Применение импорта: подтверждаем маппинг + канал.
 * Эндпоинт предполагаемый: POST /sales/import/apply
 */
export async function applySalesImport(
  payload: ImportApplyPayload,
): Promise<ImportApplyResult> {
  const token = getAccessToken();

  const res = await fetch(`${API_BASE}/sales/import/apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Ошибка применения импорта: ${res.status}`);
  }

  if (!res.ok) {
    const msg =
      data?.message ||
      data?.error ||
      `Ошибка применения импорта: ${res.status} ${res.statusText}`;
    throw new Error(msg);
  }

  return data as ImportApplyResult;
}
