import type { CustomObjectField } from '../api/customObjects';

/** meta key: ячейка читается/пишется в `values[mapsToImportedKey]`, колонка в UI — `field.key` */
export const WORKSPACE_MAPS_TO_IMPORTED_KEY = 'mapsToImportedKey';

export function getWorkspaceFieldValueStorageKey(field: CustomObjectField): string {
  const meta = field.meta as Record<string, unknown> | null | undefined;
  const mapped = meta?.[WORKSPACE_MAPS_TO_IMPORTED_KEY];
  if (typeof mapped === 'string' && mapped.trim()) return mapped.trim();
  return field.key;
}
