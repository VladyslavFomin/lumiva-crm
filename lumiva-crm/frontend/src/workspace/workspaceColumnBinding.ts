/**
 * Привязка колонки основной таблицы (board) к данным интеграций / таблицы данных.
 *
 * Хранится в `CustomObjectField.meta[WORKSPACE_COLUMN_BINDING_META_KEY]` — отдельная
 * миграция БД не нужна (поле `custom_object_fields.meta` уже jsonb).
 *
 * Значение в ячейке по-прежнему лежит в `CustomObjectRecord.values[field.key]` (снимок
 * или ввод пользователя). Биндинг описывает *откуда* брать/обновлять значение и как
 * показывать колонку в UI. Резолвинг «по месту» — отдельный этап (эндпоинт enrich,
 * автоматизация sync, n8n).
 */
export const WORKSPACE_COLUMN_BINDING_META_KEY = 'columnBinding';

export type WorkspaceColumnBindingV1 =
  | ColumnBindingFromPushedSourceV1
  | ColumnBindingLookupByKeyV1
  | ColumnBindingPickFromDataV1
  | ColumnBindingCachedSnapshotV1
  | ColumnBindingRollupV1;

export interface ColumnBindingBaseV1 {
  version: 1;
  /** Подсказка в настройках колонки */
  description?: string;
}

/**
 * Строка доски создана из таблицы данных («Передать в основную таблицу»):
 * `CustomObjectRecord.meta.workspaceDataLink` указывает на исходную строку.
 * Колонка показывает поле `sourceFieldKey` из той строки (чтение при enrich или кэш в values).
 */
export interface ColumnBindingFromPushedSourceV1 extends ColumnBindingBaseV1 {
  mode: 'from_pushed_source';
  sourceFieldKey: string;
}

/**
 * На доске есть ключ (например id заказа Woo), в таблице данных — соответствующая строка.
 * Один запрос: найти запись в `dataObjectId` где `dataMatchFieldKey` = `values[boardMatchFieldKey]`,
 * взять `dataDisplayFieldKey`.
 */
export interface ColumnBindingLookupByKeyV1 extends ColumnBindingBaseV1 {
  mode: 'lookup_by_key';
  dataObjectId: string;
  boardMatchFieldKey: string;
  dataMatchFieldKey: string;
  dataDisplayFieldKey: string;
}

/**
 * Выпадающий список значений из поля таблицы данных (например все id / number заказов Woo).
 */
export interface ColumnBindingPickFromDataV1 extends ColumnBindingBaseV1 {
  mode: 'pick_from_data';
  dataObjectId: string;
  dataFieldKey: string;
}

/**
 * Данные уже лежат в values (импорт, автоматизация); meta только для подписи «источник» в UI.
 */
export interface ColumnBindingCachedSnapshotV1 extends ColumnBindingBaseV1 {
  mode: 'cached_snapshot';
  sourceLabel?: string;
}

/**
 * Агрегация по многим строкам таблицы данных (например сумма по каналу). Этап 2+: нужен
 * запрос с group by / предрасчёт в materialized snapshot.
 */
export interface ColumnBindingRollupV1 extends ColumnBindingBaseV1 {
  mode: 'rollup';
  dataObjectId: string;
  /** Поле в таблице данных для группировки (страна, канал) */
  groupByFieldKey: string;
  /** Локальное поле доски должно совпадать с ключом группы (или задать match отдельно) */
  boardMatchFieldKey: string;
  aggregate: 'sum' | 'count' | 'avg' | 'min' | 'max';
  valueFieldKey: string;
}

export function parseWorkspaceColumnBindingV1(
  meta: Record<string, unknown> | null | undefined,
): WorkspaceColumnBindingV1 | null {
  const raw = meta?.[WORKSPACE_COLUMN_BINDING_META_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  const mode = o.mode;
  if (mode === 'from_pushed_source' && typeof o.sourceFieldKey === 'string') {
    return {
      version: 1,
      mode: 'from_pushed_source',
      sourceFieldKey: o.sourceFieldKey,
      description: typeof o.description === 'string' ? o.description : undefined,
    };
  }
  if (
    mode === 'lookup_by_key' &&
    typeof o.dataObjectId === 'string' &&
    typeof o.boardMatchFieldKey === 'string' &&
    typeof o.dataMatchFieldKey === 'string' &&
    typeof o.dataDisplayFieldKey === 'string'
  ) {
    return {
      version: 1,
      mode: 'lookup_by_key',
      dataObjectId: o.dataObjectId,
      boardMatchFieldKey: o.boardMatchFieldKey,
      dataMatchFieldKey: o.dataMatchFieldKey,
      dataDisplayFieldKey: o.dataDisplayFieldKey,
      description: typeof o.description === 'string' ? o.description : undefined,
    };
  }
  if (
    mode === 'pick_from_data' &&
    typeof o.dataObjectId === 'string' &&
    typeof o.dataFieldKey === 'string'
  ) {
    return {
      version: 1,
      mode: 'pick_from_data',
      dataObjectId: o.dataObjectId,
      dataFieldKey: o.dataFieldKey,
      description: typeof o.description === 'string' ? o.description : undefined,
    };
  }
  if (mode === 'cached_snapshot') {
    return {
      version: 1,
      mode: 'cached_snapshot',
      sourceLabel: typeof o.sourceLabel === 'string' ? o.sourceLabel : undefined,
      description: typeof o.description === 'string' ? o.description : undefined,
    };
  }
  if (
    mode === 'rollup' &&
    typeof o.dataObjectId === 'string' &&
    typeof o.groupByFieldKey === 'string' &&
    typeof o.boardMatchFieldKey === 'string' &&
    typeof o.valueFieldKey === 'string' &&
    (o.aggregate === 'sum' ||
      o.aggregate === 'count' ||
      o.aggregate === 'avg' ||
      o.aggregate === 'min' ||
      o.aggregate === 'max')
  ) {
    return {
      version: 1,
      mode: 'rollup',
      dataObjectId: o.dataObjectId,
      groupByFieldKey: o.groupByFieldKey,
      boardMatchFieldKey: o.boardMatchFieldKey,
      aggregate: o.aggregate,
      valueFieldKey: o.valueFieldKey,
      description: typeof o.description === 'string' ? o.description : undefined,
    };
  }
  return null;
}
