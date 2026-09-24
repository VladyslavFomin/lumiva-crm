import type { CustomObjectField } from '../api/customObjects';

/** meta.workspaceEntityRef — колонка хранит UUID лида или проекта CRM (один id или JSON-массив id в values) */
export const WORKSPACE_ENTITY_REF_KEY = 'workspaceEntityRef' as const;

/** meta.workspaceIsReadOnly — поле отображается без возможности ручного редактирования */
export const WORKSPACE_IS_READONLY_KEY = 'workspaceIsReadOnly' as const;

export function isWorkspaceReadOnlyField(field: CustomObjectField): boolean {
  // Умная колонка (type: 'ai') — значение всегда пишет назначенный ИИ, вручную не редактируется
  // (то же место, где остальной код уже проверяет "можно ли кликнуть и отредактировать ячейку").
  if (field.type === 'ai') return true;
  return (
    typeof field.meta === 'object' &&
    field.meta !== null &&
    (field.meta as Record<string, unknown>)[WORKSPACE_IS_READONLY_KEY] === true
  );
}

export type WorkspaceEntityRefKind = 'lead' | 'project' | 'company';

export function parseWorkspaceEntityRef(
  meta: Record<string, unknown> | null | undefined,
): WorkspaceEntityRefKind | null {
  if (!meta || typeof meta !== 'object') return null;
  const v = (meta as Record<string, unknown>)[WORKSPACE_ENTITY_REF_KEY];
  if (v === 'lead' || v === 'project' || v === 'company') return v;
  return null;
}

export function isWorkspaceEntityRefField(field: CustomObjectField): WorkspaceEntityRefKind | null {
  if (field.type !== 'text') return null;
  return parseWorkspaceEntityRef(field.meta as Record<string, unknown> | null);
}
