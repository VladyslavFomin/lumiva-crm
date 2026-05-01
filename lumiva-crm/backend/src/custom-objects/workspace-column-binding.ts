/**
 * Контракт `CustomObjectField.meta.columnBinding` (согласован с frontend `workspaceColumnBinding.ts`).
 * jsonb — миграции не требуются.
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
  description?: string;
}

export interface ColumnBindingFromPushedSourceV1 extends ColumnBindingBaseV1 {
  mode: 'from_pushed_source';
  sourceFieldKey: string;
}

export interface ColumnBindingLookupByKeyV1 extends ColumnBindingBaseV1 {
  mode: 'lookup_by_key';
  dataObjectId: string;
  boardMatchFieldKey: string;
  dataMatchFieldKey: string;
  dataDisplayFieldKey: string;
}

export interface ColumnBindingPickFromDataV1 extends ColumnBindingBaseV1 {
  mode: 'pick_from_data';
  dataObjectId: string;
  dataFieldKey: string;
}

export interface ColumnBindingCachedSnapshotV1 extends ColumnBindingBaseV1 {
  mode: 'cached_snapshot';
  sourceLabel?: string;
}

export interface ColumnBindingRollupV1 extends ColumnBindingBaseV1 {
  mode: 'rollup';
  dataObjectId: string;
  groupByFieldKey: string;
  boardMatchFieldKey: string;
  aggregate: 'sum' | 'count' | 'avg' | 'min' | 'max';
  valueFieldKey: string;
}

export function parseWorkspaceColumnBindingV1(
  meta: Record<string, any> | null | undefined,
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
