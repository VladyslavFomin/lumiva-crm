// src/api/auditLog.ts
import { api } from './client';

export type AuditLogAction = 'create' | 'update' | 'delete';
export type AuditLogEntityType =
  | 'lead'
  | 'contact'
  | 'company'
  | 'sale'
  | 'project'
  | 'reservation'
  | 'hotel_reservation'
  | 'product';

export interface AuditLogChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  entityType: AuditLogEntityType;
  entityId: string;
  entityLabel: string | null;
  action: AuditLogAction;
  summary: string | null;
  changes: AuditLogChange[] | null;
  actorUserId: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface AuditLogQuery {
  entityType?: AuditLogEntityType;
  action?: AuditLogAction;
  actorUserId?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export function fetchAuditLog(query: AuditLogQuery): Promise<{ items: AuditLogEntry[]; total: number }> {
  return api.get<{ items: AuditLogEntry[]; total: number }>('/audit-log', { params: query });
}
