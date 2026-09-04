import { api } from './client';
import type { IntegrationConnectionDto } from './integrations';
import type { MarketingIntegrationRow } from './marketing';
import type { WorkspaceAreaMember, WorkspaceAreaRole } from '../workspace/workspaceAreaRole';
import type { WorkspaceAreaActivityKind } from '../workspace/workspaceAreaActivityLog';

export interface WorkspaceArea {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  iconKey: string;
  iconColor: string;
  coverImageUrl: string | null;
  description: string | null;
  meta: Record<string, any> | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export async function fetchWorkspaceAreas(includeArchived = false) {
  return api.get<WorkspaceArea[]>(
    `/workspace-areas${includeArchived ? '?includeArchived=1' : ''}`,
  );
}

export interface WorkspaceAreaSummary {
  tableCount: number;
  boardCount: number;
  dataCount: number;
  recordCount: number;
  memberCount: number;
  sourceCount: number;
}

export async function fetchWorkspaceAreaSummary(id: string) {
  return api.get<WorkspaceAreaSummary>(`/workspace-areas/${id}/summary`);
}

export async function fetchWorkspaceArea(id: string) {
  return api.get<WorkspaceArea>(`/workspace-areas/${id}`);
}

export async function createWorkspaceArea(payload: {
  name: string;
  slug?: string;
  iconKey?: string;
  iconColor?: string;
  coverImageUrl?: string;
  description?: string;
  meta?: Record<string, any>;
}) {
  return api.post<WorkspaceArea>('/workspace-areas', payload);
}

export async function updateWorkspaceArea(
  id: string,
  payload: Partial<{
    name: string;
    slug: string;
    iconKey: string;
    iconColor: string;
    coverImageUrl: string | null;
    description: string | null;
    meta: Record<string, any> | null;
    sortOrder: number;
  }>,
) {
  return api.patch<WorkspaceArea>(`/workspace-areas/${id}`, payload);
}

export async function deleteWorkspaceArea(id: string) {
  return api.delete<{ ok: boolean }>(`/workspace-areas/${id}`);
}

export async function uploadWorkspaceAreaCover(areaId: string, file: File) {
  const fd = new FormData();
  fd.append('file', file);
  return api.postForm<WorkspaceArea>(`/workspace-areas/${areaId}/cover`, fd);
}

export async function fetchWorkspaceAreaMembers(areaId: string) {
  return api.get<WorkspaceAreaMember[]>(`/workspace-areas/${areaId}/members`);
}

export async function addWorkspaceAreaMember(
  areaId: string,
  payload: { staffUserId?: string; email?: string; role: WorkspaceAreaRole },
) {
  return api.post<WorkspaceAreaMember>(`/workspace-areas/${areaId}/members`, payload);
}

export async function updateWorkspaceAreaMemberRole(
  areaId: string,
  memberId: string,
  role: WorkspaceAreaRole,
) {
  return api.patch<WorkspaceAreaMember>(`/workspace-areas/${areaId}/members/${memberId}`, { role });
}

export async function removeWorkspaceAreaMember(areaId: string, memberId: string) {
  return api.delete<{ ok: boolean }>(`/workspace-areas/${areaId}/members/${memberId}`);
}

export interface WorkspaceAreaActivityLogEntryDto {
  id: string;
  tenantId: string;
  workspaceAreaId: string;
  kind: WorkspaceAreaActivityKind;
  title: string;
  detail: string | null;
  relatedObjectId: string | null;
  actorUserId: string | null;
  createdAt: string;
}

export async function fetchWorkspaceAreaActivityLog(areaId: string, limit = 50) {
  return api.get<WorkspaceAreaActivityLogEntryDto[]>(
    `/workspace-areas/${areaId}/activity-log?limit=${limit}`,
  );
}

export type WorkspaceIntegrationBinding = {
  id: string;
  catalogKey: string;
  label: string;
  connectionId?: string | null;
  /** Подключение из раздела «Маркетинг» (Meta Ads, GA4 и т.д.) */
  marketingIntegrationId?: string | null;
  /** Таблица данных области, в которую этот источник пишет строки — для карты области. */
  targetObjectId?: string | null;
};

export function readWorkspaceIntegrationBindings(
  meta: Record<string, any> | null | undefined,
): WorkspaceIntegrationBinding[] {
  const raw = meta?.integrationBindings;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => ({
      id: String((x as any).id || ''),
      catalogKey: String((x as any).catalogKey || ''),
      label: String((x as any).label || ''),
      connectionId: (x as any).connectionId ?? null,
      marketingIntegrationId: (x as any).marketingIntegrationId ?? null,
      targetObjectId: (x as any).targetObjectId ?? null,
    }))
    .filter((b) => Boolean(b.catalogKey));
}

/** Приводим ключи каталога к одному виду (GA4 в хабе = google_analytics). */
export function canonicalWorkspaceCatalogKey(raw: string): string {
  const k = String(raw || '')
    .trim()
    .toLowerCase();
  if (k === 'google_analytics_4' || k === 'google_analytics_ga4') return 'google_analytics';
  return k;
}

/** Совпадение привязки области с подключением из списка интеграций. */
export function integrationMatchesWorkspaceCatalog(
  c: IntegrationConnectionDto,
  catalogKey: string,
): boolean {
  const want = canonicalWorkspaceCatalogKey(catalogKey);
  if (want === 'woocommerce') return c.kind === 'woocommerce';
  if (c.kind !== 'third_party_link') return false;
  if (!c.linkCatalogId) return false;
  return canonicalWorkspaceCatalogKey(c.linkCatalogId) === want;
}

/** Провайдер маркетинговой интеграции соответствует ключу каталога области (meta_ads, google_analytics, …). */
export function marketingProviderMatchesWorkspaceCatalog(
  providerRaw: string,
  catalogKey: string,
): boolean {
  const want = canonicalWorkspaceCatalogKey(catalogKey);
  const p = String(providerRaw || '')
    .trim()
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .normalize('NFKC')
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
  if (want === 'meta_ads') {
    return (
      p === 'meta_ads' ||
      p === 'facebook_ads' ||
      p === 'meta' ||
      p === 'facebook_marketing' ||
      p === 'instagram_ads' ||
      p === 'fb_ads'
    );
  }
  if (want === 'google_analytics') {
    return (
      p === 'google_analytics' ||
      p === 'ga4' ||
      p === 'google_analytics_4' ||
      p === 'google_analytics_ga4'
    );
  }
  return canonicalWorkspaceCatalogKey(p) === want;
}

/** Есть ли активное подключение, удовлетворяющее этой строке привязки. */
export function workspaceBindingHasActiveIntegration(
  b: WorkspaceIntegrationBinding,
  integrations: IntegrationConnectionDto[],
  marketingIntegrations?: MarketingIntegrationRow[],
): boolean {
  const active = integrations.filter((c) => !c.isDeleted && c.isEnabled);
  const rawId = b.connectionId != null ? String(b.connectionId).trim() : '';
  if (rawId && /^[0-9a-f-]{36}$/i.test(rawId)) {
    return active.some((c) => c.id === rawId);
  }
  const rawMkt = b.marketingIntegrationId != null ? String(b.marketingIntegrationId).trim() : '';
  if (rawMkt && /^[0-9a-f-]{36}$/i.test(rawMkt)) {
    const mrows = marketingIntegrations?.filter((m) => m.isActive) ?? [];
    return mrows.some(
      (m) =>
        m.id === rawMkt && marketingProviderMatchesWorkspaceCatalog(m.provider, b.catalogKey),
    );
  }
  const key = (b.catalogKey || '').trim();
  if (!key) return false;
  if (active.some((c) => integrationMatchesWorkspaceCatalog(c, key))) return true;
  const mrows = marketingIntegrations?.filter((m) => m.isActive) ?? [];
  return mrows.some((m) => marketingProviderMatchesWorkspaceCatalog(m.provider, key));
}

/**
 * ID подключений, которые считаются привязанными к области:
 * — явный connectionId в binding;
 * — иначе все включённые подключения, чей тип совпадает с catalogKey (если в UI не выбрали конкретный инстанс).
 */
export function resolveIntegrationIdsForWorkspaceBindings(
  bindings: WorkspaceIntegrationBinding[],
  integrations: IntegrationConnectionDto[],
): Set<string> {
  const allowed = new Set<string>();
  const active = integrations.filter((c) => !c.isDeleted && c.isEnabled);

  for (const b of bindings) {
    const rawId = b.connectionId != null ? String(b.connectionId).trim() : '';
    if (rawId && /^[0-9a-f-]{36}$/i.test(rawId)) {
      allowed.add(rawId);
      continue;
    }
    const key = (b.catalogKey || '').trim();
    if (!key) continue;
    for (const c of active) {
      if (integrationMatchesWorkspaceCatalog(c, key)) {
        allowed.add(c.id);
      }
    }
  }
  return allowed;
}

/**
 * ID маркетинговых интеграций, привязанных к области (явно или по типу каталога).
 */
export function resolveMarketingIntegrationIdsForWorkspaceBindings(
  bindings: WorkspaceIntegrationBinding[],
  marketingRows: MarketingIntegrationRow[],
): Set<string> {
  const allowed = new Set<string>();
  const active = marketingRows.filter((m) => m.isActive);
  for (const b of bindings) {
    const rawMkt = b.marketingIntegrationId != null ? String(b.marketingIntegrationId).trim() : '';
    if (rawMkt && /^[0-9a-f-]{36}$/i.test(rawMkt)) {
      const row = active.find((m) => m.id === rawMkt);
      if (row && marketingProviderMatchesWorkspaceCatalog(row.provider, b.catalogKey)) {
        allowed.add(rawMkt);
      }
      continue;
    }
    const rawConn = b.connectionId != null ? String(b.connectionId).trim() : '';
    if (rawConn) continue;
    const key = (b.catalogKey || '').trim();
    if (!key) continue;
    for (const m of active) {
      if (marketingProviderMatchesWorkspaceCatalog(m.provider, key)) {
        allowed.add(m.id);
      }
    }
  }
  return allowed;
}
