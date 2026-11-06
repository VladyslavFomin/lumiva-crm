import { api } from './client';

/** Ограничение просмотра колонок встроенных таблиц (Лиды, Проекты). */
export type ColumnAccessTableKey = 'leads' | 'projects';

export type ColumnAccessInfo = {
  canManage: boolean;
  /** Встроенные колонки, которые можно ограничить (плюс любые пользовательские поля `cf:<id>`). */
  restrictableColumns: string[];
  restrictions: Array<{ columnId: string; viewerStaffIds: string[] }>;
  /** Колонки, скрытые от текущего пользователя. */
  hiddenColumnIds: string[];
};

export async function fetchColumnAccess(tableKey: ColumnAccessTableKey) {
  return api.get<ColumnAccessInfo>(`/column-access/${tableKey}`);
}

export async function setColumnViewers(tableKey: ColumnAccessTableKey, columnId: string, staffUserIds: string[]) {
  return api.put<{ columnId: string; viewerStaffIds: string[] }>(
    `/column-access/${tableKey}/${encodeURIComponent(columnId)}`,
    { staffUserIds },
  );
}

export const isRestrictableColumnId = (info: ColumnAccessInfo | null, columnId: string) =>
  !!info && (info.restrictableColumns.includes(columnId) || columnId.startsWith('cf:'));
