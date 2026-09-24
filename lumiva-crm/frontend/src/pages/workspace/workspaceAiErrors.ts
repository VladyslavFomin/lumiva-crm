import type { TFunction } from 'i18next';

/**
 * Backend error codes for computeSmartColumn/analyzeWorkspaceTable (ai-employees.service.ts) are
 * plain snake_case strings meant for logs, not people — surfacing them raw ("agent_not_found_or_inactive")
 * confused a real user (2026-09-23). Map known codes to a translated message, fall back to the
 * generic "could not compute" message for anything unrecognized (including network errors).
 */
const KNOWN_CODES: Record<string, string> = {
  agent_not_found_or_inactive: 'crm.workspace.recordDrawer.aiColumnErrorAgentInactive',
  permission_denied: 'crm.workspace.recordDrawer.aiColumnErrorNoPermission',
  no_table_write_access: 'crm.workspace.recordDrawer.aiColumnErrorNoAccess',
  no_table_access: 'crm.workspace.recordDrawer.aiColumnErrorNoAccess',
  no_prompt_configured: 'crm.workspace.recordDrawer.aiColumnErrorNoPrompt',
  no_staff_to_assign: 'crm.workspace.recordDrawer.aiColumnErrorNoStaff',
  no_confident_match: 'crm.workspace.recordDrawer.aiColumnErrorNoConfidentMatch',
};

export function aiColumnErrorMessage(
  t: TFunction,
  code: string | undefined | null,
  fallbackKey = 'crm.workspace.recordDrawer.aiColumnError',
): string {
  if (code && KNOWN_CODES[code]) return t(KNOWN_CODES[code]);
  return t(fallbackKey);
}
