/**
 * «Кто может просматривать этот столбец» для рабочих таблиц.
 *
 * Хранится в field.meta.viewers = string[] (id строк staff_users). Пустой/отсутствующий список —
 * колонку видят все, у кого есть доступ к таблице (как раньше). Непустой — значения колонки
 * вырезаются из ответов API для всех, кроме:
 *   - владельца компании (tenant role 'owner'),
 *   - владельца рабочей области/таблицы (эффективная роль 'owner' — он и настраивает доступ),
 *   - сотрудников из списка.
 * Скрытие серверное: колонки нет в /fields, значений нет в /records, по ней нельзя искать и
 * сортировать, а входящие значения для неё молча отбрасываются (нельзя «вслепую» перезаписать).
 */
import type { CustomObjectField } from './custom-object-field.entity';

export type ColumnViewer = {
  tenantRole?: string | null;
  staffUserId?: string | null;
  /** Эффективная роль в рабочей области (выставляет WorkspaceAreaAccessGuard), null — таблица без области. */
  areaRole?: string | null;
};

export const WORKSPACE_FIELD_VIEWERS_KEY = 'viewers';
export const WORKSPACE_FIELD_RULES_KEY = 'rules';
/** Ключи field.meta, которые меняются только своими эндпоинтами (не общим PATCH поля). */
export const PROTECTED_FIELD_META_KEYS = [WORKSPACE_FIELD_VIEWERS_KEY, WORKSPACE_FIELD_RULES_KEY] as const;

export function readFieldViewers(meta: Record<string, any> | null | undefined): string[] {
  const v = meta?.[WORKSPACE_FIELD_VIEWERS_KEY];
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x) : [];
}

export function canManageColumnAccess(viewer: ColumnViewer | null | undefined): boolean {
  if (!viewer) return true; // внутренний вызов без пользователя
  return viewer.tenantRole === 'owner' || viewer.areaRole === 'owner';
}

export function canSeeField(field: Pick<CustomObjectField, 'meta'>, viewer: ColumnViewer | null | undefined): boolean {
  const viewers = readFieldViewers(field.meta);
  if (!viewers.length) return true;
  if (canManageColumnAccess(viewer)) return true;
  return !!viewer?.staffUserId && viewers.includes(viewer.staffUserId);
}

function storageKeyOf(field: Pick<CustomObjectField, 'key' | 'meta'>): string | null {
  const m = (field.meta as Record<string, unknown> | null | undefined)?.mapsToImportedKey;
  return typeof m === 'string' && /^[a-zA-Z0-9_]+$/.test(m.trim()) ? m.trim() : null;
}

/** Все ключи jsonb values, под которыми может лежать значение скрытых для viewer колонок. */
export function hiddenValueKeys(
  fields: Array<Pick<CustomObjectField, 'key' | 'meta'>>,
  viewer: ColumnViewer | null | undefined,
): Set<string> {
  const out = new Set<string>();
  if (!viewer) return out;
  const visibleKeys = new Set<string>();
  for (const f of fields) {
    if (canSeeField(f, viewer)) {
      visibleKeys.add(f.key);
      const sk = storageKeyOf(f);
      if (sk) visibleKeys.add(sk);
    }
  }
  for (const f of fields) {
    if (canSeeField(f, viewer)) continue;
    out.add(f.key);
    const sk = storageKeyOf(f);
    // Ключ импорта может быть общим с видимой колонкой — тогда его не трогаем.
    if (sk && !visibleKeys.has(sk)) out.add(sk);
  }
  return out;
}

export function stripValues<T extends Record<string, any> | null | undefined>(values: T, hidden: Set<string>): T {
  if (!values || !hidden.size || typeof values !== 'object' || Array.isArray(values)) return values;
  let copy: Record<string, any> | null = null;
  for (const k of hidden) {
    if (k in values) {
      copy = copy ?? { ...values };
      delete copy[k];
    }
  }
  return (copy ?? values) as T;
}

export function stripRecord<R extends { values?: any }>(record: R, hidden: Set<string>): R {
  if (!record || !hidden.size) return record;
  const values = stripValues(record.values, hidden);
  return values === record.values ? record : { ...record, values };
}
