import { api, API_BASE } from './client';

export type CompanyFileSource =
  | 'company_storage'
  | 'logo'
  | 'online_chat'
  | 'email'
  | 'telegram'
  | 'workspace'
  | 'tenant_disk';

export interface TenantCompanyFileRow {
  id: string;
  source: CompanyFileSource;
  originalName: string;
  sizeBytes: number | null;
  createdAt: string;
  relativePath: string | null;
  uploadedByEmail: string | null;
}

/** Агрегат файлов с диска (разные модули CRM), не отдельная загрузка с этой страницы. */
export async function fetchTenantCompanyFiles(): Promise<TenantCompanyFileRow[]> {
  return api.get<TenantCompanyFileRow[]>('/tenants/storage/files');
}

export async function deleteTenantCompanyFile(fileId: string): Promise<void> {
  await api.delete(
    `/tenants/storage/files/${encodeURIComponent(fileId)}`,
  );
}

/** Публичная раздача через GET /v1/uploads/... */
export function tenantStorageFileHref(relativePath: string): string {
  const safe = relativePath.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  const base = API_BASE.replace(/\/$/, '');
  const path = `${base}/uploads/${safe}`.replace(/([^:]\/)\/+/g, '$1');
  return path;
}
