import { api } from './client';

export type AuditLogAction = 'create' | 'update' | 'delete';
export type AuditLogEntityType = 'lead' | 'contact' | 'company' | 'sale' | 'project' | 'reservation' | 'hotel_reservation' | 'product';

export interface AuditLogChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface AuditLogEntry {
  id: string;
  action: AuditLogAction;
  summary: string | null;
  changes: AuditLogChange[] | null;
  actorName: string | null;
  createdAt: string;
}

export interface GlobalAuditLogEntry extends AuditLogEntry {
  entityType: AuditLogEntityType;
  entityId: string;
  entityLabel: string | null;
}

export async function fetchAuditLog(entityType: AuditLogEntityType, entityId: string): Promise<AuditLogEntry[]> {
  const res = await api.get<{ items: AuditLogEntry[]; total: number }>('/audit-log', { params: { entityType, entityId, limit: 50 } });
  return res.data.items;
}

export interface GlobalAuditLogFilters {
  entityType?: AuditLogEntityType;
  action?: AuditLogAction;
  search?: string;
  page?: number;
  limit?: number;
}

export async function fetchGlobalAuditLog(filters: GlobalAuditLogFilters = {}): Promise<{ items: GlobalAuditLogEntry[]; total: number }> {
  const res = await api.get<{ items: GlobalAuditLogEntry[]; total: number }>('/audit-log', { params: filters });
  return res.data;
}
