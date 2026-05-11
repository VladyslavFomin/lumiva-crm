import { api } from './client';

export type DedupEntityType = 'contact' | 'lead' | 'company' | 'sale' | 'segment';
export type DuplicatePairStatus = 'pending' | 'merged' | 'ignored';

export interface DuplicatePair {
  id: string;
  tenantId: string;
  entityType: DedupEntityType;
  entityAId: string;
  entityBId: string;
  score: number;
  status: DuplicatePairStatus;
  resolvedAt: string | null;
  createdAt: string;
}

export interface ScanResult {
  scanned: number;
  found: number;
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

export function ignoreDuplicatePair(id: string): Promise<DuplicatePair> {
  return api.patch<DuplicatePair>(`/deduplication/pairs/${id}/ignore`);
}

export function mergeDuplicates(dto: MergeDto): Promise<{ merged: true }> {
  return api.post<{ merged: true }>('/deduplication/merge', dto);
}
