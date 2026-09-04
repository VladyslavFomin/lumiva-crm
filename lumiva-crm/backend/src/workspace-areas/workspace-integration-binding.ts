export interface WorkspaceIntegrationBinding {
  id: string;
  catalogKey?: string;
  label?: string;
  connectionId?: string;
  marketingIntegrationId?: string;
  /** Таблица данных области, в которую этот источник пишет строки — для карты области. */
  targetObjectId?: string;
}

export function parseWorkspaceIntegrationBindings(
  meta: Record<string, any> | null | undefined,
): WorkspaceIntegrationBinding[] {
  const raw = meta?.integrationBindings;
  if (!Array.isArray(raw)) return [];
  return raw.filter((b): b is WorkspaceIntegrationBinding => b && typeof b === 'object');
}
