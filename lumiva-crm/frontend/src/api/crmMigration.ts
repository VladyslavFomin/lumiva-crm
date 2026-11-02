// src/api/crmMigration.ts — мастер переезда из amoCRM / Битрикс24 / Excel
import { api } from './client';

export type MigrationSourceKey = 'amocrm' | 'bitrix24';
export type LeadStatusKey = 'new' | 'in_progress' | 'waiting' | 'won' | 'lost';
export type FileTarget = 'contacts' | 'companies' | 'leads';

export type SourceInput = {
  source: MigrationSourceKey;
  connectionId?: string;
  baseUrl?: string;
  token?: string;
  webhookUrl?: string;
};

export type MigrationStage = { key: string; pipeline: string; name: string; suggested: LeadStatusKey };

export type MigrationPreview = {
  account: { name: string; currency: string | null };
  stages: MigrationStage[];
  counts: Partial<Record<'companies' | 'contacts' | 'deals' | 'leads', number>>;
  users: { total: number; matched: number; unmatched: string[] };
  hasLeadsEntity: boolean;
};

export type MigrationCounter = { created: number; updated: number; skipped: number; failed: number };

export type MigrationRun = {
  id: string;
  source: MigrationSourceKey | 'file';
  status: 'running' | 'done' | 'failed' | string;
  stage: string | null;
  options: Record<string, unknown>;
  counters: Record<string, MigrationCounter>;
  warnings: string[];
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type FilePreview = {
  columns: string[];
  sample: string[][];
  totalRows: number;
  fields: Record<FileTarget, string[]>;
  suggested: Record<FileTarget, Record<string, string>>;
};

export const fetchMigrationConnections = () =>
  api.get<Array<{ id: string; name: string; source: MigrationSourceKey }>>('/crm-migration/connections');

export const fetchMigrationRuns = () =>
  api.get<{ runs: MigrationRun[]; imported: Array<{ source: string; entityType: string; count: number }> }>('/crm-migration/runs');

export const fetchMigrationRun = (id: string) => api.get<MigrationRun>(`/crm-migration/runs/${id}`);

export const previewMigration = (input: SourceInput) => api.post<MigrationPreview>('/crm-migration/preview', input);

export const startMigration = (
  input: SourceInput & {
    include: { companies: boolean; contacts: boolean; deals: boolean; leads: boolean };
    statusMap: Record<string, LeadStatusKey>;
    mergeExisting: boolean;
  },
) => api.post<MigrationRun>('/crm-migration/start', input);

export function previewMigrationFile(file: File) {
  const form = new FormData();
  form.append('file', file);
  return api.postForm<FilePreview>('/crm-migration/file/preview', form);
}

export function startMigrationFile(file: File, target: FileTarget, mapping: Record<string, string>, mergeExisting: boolean) {
  const form = new FormData();
  form.append('file', file);
  form.append('target', target);
  form.append('mapping', JSON.stringify(mapping));
  form.append('mergeExisting', String(mergeExisting));
  return api.postForm<MigrationRun>('/crm-migration/file/start', form);
}
