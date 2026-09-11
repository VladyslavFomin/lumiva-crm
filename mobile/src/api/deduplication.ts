import { api } from './client';

export type DedupEntityType = 'contact' | 'lead' | 'company';

export interface DuplicateGroup {
  entityType: DedupEntityType;
  ids: string[];
  score: number;
  reasons: string[];
  pairIds: string[];
  records: Record<string, any>[];
}

export interface DedupOverview {
  groupsCount: number;
  recordsInvolved: number;
  groupsHighConfidence: number;
  mergedTotal: number;
  duplicateRatePct: number;
  entityTotal: number;
}

export async function fetchDedupOverview(entityType: DedupEntityType): Promise<DedupOverview> {
  const res = await api.get<DedupOverview>('/deduplication/overview', { params: { entityType } });
  return res.data;
}

export async function fetchDedupGroups(entityType: DedupEntityType): Promise<DuplicateGroup[]> {
  const res = await api.get<{ groups: DuplicateGroup[] }>('/deduplication/groups', { params: { entityType } });
  return res.data.groups;
}

export async function ignoreDedupGroup(ids: string[]): Promise<void> {
  await api.post('/deduplication/groups/ignore', { ids });
}

export async function mergeDedupRecords(entityType: DedupEntityType, winnerId: string, loserId: string): Promise<void> {
  await api.post('/deduplication/merge', { entityType, winnerId, loserId, fieldMap: {} });
}
