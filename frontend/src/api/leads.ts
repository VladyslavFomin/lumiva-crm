// src/api/leads.ts
import { api } from './client';

export type LeadStatusCode = 'new' | 'in_progress' | 'waiting' | 'won' | 'lost';

// То, как показываем статусы в UI
export type LeadStatus =
  | 'Новый клиент'
  | 'В работе'
  | 'Ожидает ответа'
  | 'Закрыт (успех)'
  | 'Закрыт (проигран)';

const STATUS_MAP: Record<LeadStatusCode, LeadStatus> = {
  new: 'Новый клиент',
  in_progress: 'В работе',
  waiting: 'Ожидает ответа',
  won: 'Закрыт (успех)',
  lost: 'Закрыт (проигран)',
};

const STATUS_REVERSE: Record<LeadStatus, LeadStatusCode> = {
  'Новый клиент': 'new',
  'В работе': 'in_progress',
  'Ожидает ответа': 'waiting',
  'Закрыт (успех)': 'won',
  'Закрыт (проигран)': 'lost',
};

// DTO с бэка
export interface LeadDto {
  id: string;
  tenantId: string;
  siteId: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  country: string | null;
  status: LeadStatusCode;
  source: string | null;
  customFields?: Record<string, any> | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  assignedTo: string | null;      // отображаемое имя
  assignedUserId: string | null;  // ссылка на сотрудника
  assignedUserIds?: string[] | null;
  assignedToList?: string[] | null;
  contactId: string | null;
  companyId: string | null;
  meta: any;
  createdAt: string;
  updatedAt: string;
}

// То, чем оперируем во фронте
export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  country: string;
  status: LeadStatus;
  channel: string;
  customFields?: Record<string, any> | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  assignedTo?: string | null;
  assignedUserId?: string | null;
  assignedUserIds?: string[] | null;
  assignedToList?: string[] | null;
  contactId?: string | null;
  companyId?: string | null;
  meta?: any;
  createdAt: string;
  updatedAt: string;
}

// ===== История лида (LeadActivity) =====

export type LeadActivityType =
  | 'created'
  | 'status_changed'
  | 'assignee_changed'
  | 'comment';

export interface LeadActivity {
  id: string;
  tenantId: string;
  leadId: string;
  type: LeadActivityType | string;
  fromValue: string | null;
  toValue: string | null;
  comment: string | null;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  createdAt: string;
}

// Маппинг DTO -> UI модель
function mapLeadDtoToLead(dto: LeadDto): Lead {
  const status: LeadStatus = STATUS_MAP[dto.status] ?? 'Новый клиент';

  const meta = dto.meta || {};
  const utmSource = dto.utmSource ?? meta.utm_source ?? meta.utmSource ?? null;
  const utmMedium = dto.utmMedium ?? meta.utm_medium ?? meta.utmMedium ?? null;
  const utmCampaign =
    dto.utmCampaign ?? meta.utm_campaign ?? meta.utmCampaign ?? null;
  const utmContent =
    dto.utmContent ?? meta.utm_content ?? meta.utmContent ?? null;
  const utmTerm = dto.utmTerm ?? meta.utm_term ?? meta.utmTerm ?? null;
  const channel =
    dto.source ||
    meta.channel ||
    meta.form_name ||
    utmSource ||
    meta.page ||
    'unknown';

  const assignedUserIds =
    dto.assignedUserIds && dto.assignedUserIds.length
      ? dto.assignedUserIds
      : dto.assignedUserId
        ? [dto.assignedUserId]
        : [];
  const assignedToList =
    dto.assignedToList && dto.assignedToList.length
      ? dto.assignedToList
      : dto.assignedTo
        ? dto.assignedTo.split(/[,;/]+/).map((v) => v.trim()).filter(Boolean)
        : [];

  return {
    id: dto.id,
    name: dto.name ?? '',
    phone: dto.phone ?? '',
    email: dto.email ?? '',
    country: dto.country ?? '',
    status,
    channel,
    customFields: dto.customFields ?? null,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
    assignedTo: dto.assignedTo,
    assignedUserId: dto.assignedUserId,
    assignedUserIds,
    assignedToList,
    contactId: dto.contactId ?? null,
    companyId: dto.companyId ?? null,
    meta,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

// Обратный маппинг для записи (UI -> DTO payload)
export interface LeadPayload {
  name?: string;
  phone?: string;
  email?: string;
  country?: string;
  status?: LeadStatus;
  source?: string | null;
  assignedTo?: string | null;
  assignedUserId?: string | null;
  assignedUserIds?: string[] | null;
  assignedToList?: string[] | null;
  contactId?: string | null;
  companyId?: string | null;
  customFields?: Record<string, any> | null;
  meta?: any;
}

function buildLeadRequestBody(payload: LeadPayload) {
  const body: any = {};

  if (payload.name !== undefined) body.name = payload.name;
  if (payload.phone !== undefined) body.phone = payload.phone;
  if (payload.email !== undefined) body.email = payload.email;
  if (payload.country !== undefined) body.country = payload.country;
  if (payload.source !== undefined) body.source = payload.source;
  if (payload.assignedTo !== undefined) body.assignedTo = payload.assignedTo;
  if (payload.assignedUserId !== undefined)
    body.assignedUserId = payload.assignedUserId;
  if (payload.assignedUserIds !== undefined)
    body.assignedUserIds = payload.assignedUserIds;
  if (payload.assignedToList !== undefined)
    body.assignedToList = payload.assignedToList;
  if (payload.contactId !== undefined) body.contactId = payload.contactId;
  if (payload.companyId !== undefined) body.companyId = payload.companyId;
  if (payload.customFields !== undefined)
    body.customFields = payload.customFields;
  if (payload.meta !== undefined) body.meta = payload.meta;

  if (payload.status !== undefined) {
    const code = STATUS_REVERSE[payload.status] ?? 'new';
    body.status = code;
  }

  return body;
}

// ------- API-функции -------

export async function fetchLeads(): Promise<Lead[]> {
  const data = await api.get<LeadDto[]>('/leads');
  return data.map(mapLeadDtoToLead);
}

export async function fetchLeadById(id: string): Promise<Lead> {
  const dto = await api.get<LeadDto>(`/leads/${id}`);
  return mapLeadDtoToLead(dto);
}

export async function createLead(payload: LeadPayload): Promise<Lead> {
  const body = buildLeadRequestBody({
    status: payload.status ?? 'Новый клиент',
    source: payload.source ?? 'manual',
    ...payload,
  });
  const dto = await api.post<LeadDto>('/leads', body);
  return mapLeadDtoToLead(dto);
}

export async function updateLead(
  id: string,
  payload: LeadPayload,
): Promise<Lead> {
  const body = buildLeadRequestBody(payload);
  const dto = await api.patch<LeadDto>(`/leads/${id}`, body);
  return mapLeadDtoToLead(dto);
}

export async function updateLeadStatus(
  id: string,
  status: LeadStatus,
): Promise<Lead> {
  const code = STATUS_REVERSE[status] ?? 'new';
  const dto = await api.patch<LeadDto>(`/leads/${id}`, { status: code });
  return mapLeadDtoToLead(dto);
}

export async function fetchLeadsList(): Promise<Lead[]> {
  const data = await api.get<LeadDto[]>('/leads');
  return data.map(mapLeadDtoToLead);
}

// ===== История лида + комментарии =====

export async function fetchLeadHistory(
  leadId: string,
): Promise<LeadActivity[]> {
  try {
    return await api.get<LeadActivity[]>(`/leads/${leadId}/history`);
  } catch (e: any) {
    console.error('Ошибка загрузки истории лида', e);

    // Если бэк отдал 404 (лид не найден / pseudo-id analytics) — просто возвращаем пустой список
    const status =
      e?.statusCode ??
      e?.response?.status ??
      e?.data?.statusCode ??
      e?.data?.status;

    if (status === 404) {
      return [];
    }

    throw e;
  }
}

export async function addLeadComment(
  leadId: string,
  text: string,
): Promise<void> {
  // под наш backend: POST /leads/:id/comments { comment }
  await api.post(`/leads/${leadId}/comments`, { comment: text });
}

/* ════════════════
 * Поиск лидов для привязки к заказу
 * GET /leads/search?q=...&limit=...
 * ════════════════ */
export async function searchLeadsQuick(
  q: string,
  limit = 10,
): Promise<Lead[]> {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (limit) params.set('limit', String(limit));

  const path = `/leads/search?${params.toString()}`;
  const data = await api.get<LeadDto[]>(path);
  return data.map(mapLeadDtoToLead);
}

// ===== Аналитика лидов (для дашборда) =====

export interface LeadStatusStat {
  status: string; // raw-код с бэка: new / in_progress / waiting / won / lost / ...
  count: number;
}

export interface LeadSourceStat {
  source: string;
  count: number;
}

export interface LeadCountryStat {
  country: string;
  count: number;
}

// Утраченные лиды
export interface LostLeadManagerStat {
  manager: string;
  lost: number;
  amount: number;
}

export interface LostLeadItem {
  leadId: string;
  leadName: string | null;
  manager: string | null;
  amount: number;
  currency: string;
  createdAt: string;
}

export interface LostLeadsStats {
  totalLost: number;
  totalAmount: number;
  currency: string;
  byManager: LostLeadManagerStat[];
  items: LostLeadItem[];
}

export interface LeadManagerStat {
  manager: string; // assignedTo или "Без ответственного"
  total: number;
  won: number;
  lost: number;
}

export interface LeadStats {
  total: number;
  byStatus: LeadStatusStat[];
  bySource: LeadSourceStat[];
  byCountry: LeadCountryStat[];
  byManager: LeadManagerStat[];
}

export async function fetchLeadStats(params?: {
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
}): Promise<LeadStats> {
  const search = new URLSearchParams();
  if (params?.from) search.append('from', params.from);
  if (params?.to) search.append('to', params.to);

  const qs = search.toString();
  const url = `/leads/stats${qs ? `?${qs}` : ''}`;

  return api.get<LeadStats>(url);
}

export async function fetchLostLeadsStats(params?: {
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
}): Promise<LostLeadsStats> {
  const search = new URLSearchParams();
  if (params?.from) search.append('from', params.from);
  if (params?.to) search.append('to', params.to);

  const qs = search.toString();
  const url = `/leads/lost/stats${qs ? `?${qs}` : ''}`;

  return api.get<LostLeadsStats>(url);
}

// ===== ROI по лидам =====

export type LeadRoiMode = 'sales' | 'projects';

export interface LeadRoiRow {
  leadId: string;
  leadName: string | null;
  status: string | null;     // raw-код статуса (new / won / ...)
  channel: string | null;    // source / канал
  manager: string | null;    // assignedTo или "Без ответственного"
  totalRevenue: number;      // суммарная выручка по лиду
  currency: string;          // валюта (например, EUR)
  dealsCount: number;        // сколько оплат / проектов
  firstDealAt: string | null;
  lastDealAt: string | null;
}

export interface LeadsRoiStats {
  currency: string;
  totalRevenue: number;
  leadsWithRevenue: number;
  dealsCount: number;
  avgCheck: number;
  from?: string | null;
  to?: string | null;
  items: LeadRoiRow[];
}

export async function deleteLead(id: string): Promise<void> {
  await api.delete(`/leads/${id}`);
}

export async function fetchLeadRoi(params?: {
  from?: string;        // YYYY-MM-DD
  to?: string;          // YYYY-MM-DD
  mode?: LeadRoiMode;   // 'sales' | 'projects'
}): Promise<LeadsRoiStats> {
  const search = new URLSearchParams();
  if (params?.from) search.append('from', params.from);
  if (params?.to) search.append('to', params.to);
  if (params?.mode) search.append('source', params.mode); // <-- ВАЖНО

  const qs = search.toString();
  const url = `/leads/roi${qs ? `?${qs}` : ''}`;

  return api.get<LeadsRoiStats>(url);
}
