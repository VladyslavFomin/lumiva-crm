import { api } from './client';

export type DedupEntityType = 'contact' | 'lead' | 'company' | 'sale' | 'segment';
export type DuplicatePairStatus = 'pending' | 'merged' | 'ignored' | 'undone';
export type DedupMasterRule = 'oldest' | 'newest';

export interface DuplicateMergeSnapshot {
  winnerBefore: Record<string, unknown>;
  loserRow: Record<string, unknown>;
}

export interface DuplicatePair {
  id: string;
  tenantId: string;
  entityType: DedupEntityType;
  entityAId: string;
  entityBId: string;
  score: number;
  reasons: string[] | null;
  status: DuplicatePairStatus;
  snapshot: DuplicateMergeSnapshot | null;
  resolvedAt: string | null;
  resolvedBy?: string | null;
  createdAt: string;
}

export interface DuplicateGroup {
  entityType: DedupEntityType;
  ids: string[];
  score: number;
  reasons: string[];
  pairIds: string[];
  records: Record<string, any>[];
}

export interface ScanResult {
  scanned: number;
  found: number;
}

export interface DedupOverview {
  groupsCount: number;
  recordsInvolved: number;
  groupsHighConfidence: number;
  mergedTotal: number;
  duplicateRatePct: number;
  entityTotal: number;
}

export interface DedupSettings {
  tenantId: string;
  masterRule: DedupMasterRule;
  fillEmptyFields: boolean;
  autoMergeThreshold: number | null;
}

export interface MergeDto {
  entityType: DedupEntityType;
  winnerId: string;
  loserId: string;
  fieldMap?: Record<string, 'winner' | 'loser'>;
}

export function scanDuplicates(entityType: DedupEntityType): Promise<ScanResult> {
  return api.post<ScanResult>('/deduplication/scan', { entityType });
}

export function fetchDuplicatePairs(params?: {
  entityType?: DedupEntityType;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: DuplicatePair[]; total: number }> {
  return api.get('/deduplication/pairs', { params });
}

export function fetchDuplicateGroups(entityType: DedupEntityType): Promise<{ groups: DuplicateGroup[] }> {
  return api.get('/deduplication/groups', { params: { entityType } });
}

export function fetchDedupOverview(entityType: DedupEntityType): Promise<DedupOverview> {
  return api.get('/deduplication/overview', { params: { entityType } });
}

export function fetchDedupSettings(): Promise<DedupSettings> {
  return api.get<DedupSettings>('/deduplication/settings');
}

export function saveDedupSettings(
  patch: Partial<Pick<DedupSettings, 'masterRule' | 'fillEmptyFields' | 'autoMergeThreshold'>>,
): Promise<DedupSettings> {
  return api.patch<DedupSettings>('/deduplication/settings', patch);
}

export function fetchDedupHistory(params?: {
  entityType?: DedupEntityType;
  limit?: number;
  offset?: number;
}): Promise<{ items: DuplicatePair[]; total: number }> {
  return api.get('/deduplication/history', { params });
}

export function ignoreDuplicatePair(id: string): Promise<DuplicatePair> {
  return api.patch<DuplicatePair>(`/deduplication/pairs/${id}/ignore`);
}

export function ignoreDuplicateGroup(ids: string[]): Promise<void> {
  return api.post<void>('/deduplication/groups/ignore', { ids });
}

export function undoDuplicateMerge(pairId: string): Promise<DuplicatePair> {
  return api.post<DuplicatePair>(`/deduplication/pairs/${pairId}/undo`);
}

export function mergeDuplicates(dto: MergeDto): Promise<{ merged: true }> {
  return api.post<{ merged: true }>('/deduplication/merge', dto);
}
